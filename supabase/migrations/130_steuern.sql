-- Steuern: Ausgaben (Eingangsrechnungen) und persönliche Angaben für die Steuerschätzung
--
-- 1. „ausgaben“: was die Firma bezahlt hat. Daraus rechnet die App Vorsteuer, § 13b (Reverse Charge) und den Gewinn.
--    Gleiche Regeln wie bei den Rechnungen: nur das Firmenkonto, lesen mit dem Recht „rechnungen“, ändern mit Schreibrecht.
-- 2. „steuer_privat“: persönliche Angaben für die Einkommensteuer-Schätzung (andere Einkünfte, Abzüge, Kirchensteuer).
--    Jede Zeile gehört genau einem Konto und ist nur für dieses Konto sichtbar – auch nicht für andere im Team.

create table if not exists public.ausgaben (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default public.firma_user_id() references auth.users(id) on delete cascade,
  datum        date not null,                              -- Rechnungsdatum (zählt für die Vorsteuer)
  bezahlt_am   date,                                       -- Zahltag (zählt für den Gewinn); leer = wie datum
  lieferant    text not null check (length(btrim(lieferant)) between 1 and 120),
  beschreibung text check (beschreibung is null or length(beschreibung) <= 300),
  kategorie    text not null default 'sonstiges' check (kategorie ~ '^[a-z_]{2,30}$'),
  art          text not null default 'inland' check (art in ('inland', 'eu', 'drittland', 'ohne')),
  netto        numeric(12,2) not null,
  ust_satz     numeric(5,2) not null default 19 check (ust_satz between 0 and 100),
  ust          numeric(12,2) not null default 0,           -- Inland: Vorsteuer; eu/drittland: die selbst geschuldete Steuer nach § 13b
  brutto       numeric(12,2) not null,                     -- der gezahlte Betrag
  notiz        text check (notiz is null or length(notiz) <= 1000),
  created_at   timestamptz not null default now(),
  check (art <> 'ohne' or ust = 0)
);
create index if not exists ausgaben_firma_idx on public.ausgaben (user_id, datum desc);
alter table public.ausgaben enable row level security;
drop policy if exists team_lesen on public.ausgaben;
create policy team_lesen on public.ausgaben for select to authenticated
  using (user_id = public.firma_id() and public.darf('rechnungen'));
drop policy if exists team_schreiben on public.ausgaben;
create policy team_schreiben on public.ausgaben for all to authenticated
  using (user_id = public.firma_id() and public.darf('rechnungen', true))
  with check (user_id = public.firma_id() and public.darf('rechnungen', true));
revoke all on public.ausgaben from anon;
grant select, insert, update, delete on public.ausgaben to authenticated;

create table if not exists public.steuer_privat (
  user_id   uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  daten     jsonb not null default '{}'::jsonb check (pg_column_size(daten) < 4000),
  geaendert timestamptz not null default now()
);
alter table public.steuer_privat enable row level security;
drop policy if exists eigene on public.steuer_privat;
create policy eigene on public.steuer_privat for all to authenticated
  using (user_id = auth.uid() and public.darf('rechnungen'))
  with check (user_id = auth.uid() and public.darf('rechnungen'));
revoke all on public.steuer_privat from anon;
grant select, insert, update, delete on public.steuer_privat to authenticated;

-- Realtime: Ausgaben, die jemand anderes im Team einträgt, sofort sehen
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.ausgaben'; exception when others then null; end;
  end if;
end $$;
