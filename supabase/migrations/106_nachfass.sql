-- Medialyte-App, Etappe 2b: Nachfassen (Anrufliste) und Zugang zum Zähler-Dienst
-- Stand je Demo: Offen, Nicht erreicht, Rückruf, Interesse, Kunde, Kein Interesse – mit Wiedervorlage, Notiz, Verlauf.
-- Ab jetzt ist die App die Quelle; der Agent liest von hier (Erinnerung morgens, Demos von Interessenten bleiben online).

create table if not exists public.nachfass (
  slug          text primary key,
  status        text not null default 'offen' check (status in ('offen', 'nicht_erreicht', 'rueckruf', 'interesse', 'kunde', 'kein_interesse')),
  wieder        date,
  notiz         text not null default '',
  verlauf       jsonb not null default '[]'::jsonb,   -- [{zeit, status, wieder}], höchstens 30
  zeit          timestamptz,
  geaendert_von uuid default auth.uid() references auth.users(id) on delete set null
);

alter table public.nachfass enable row level security;
drop policy if exists nachfass_lesen on public.nachfass;
create policy nachfass_lesen on public.nachfass for select to authenticated using (public.darf('akquise'));
drop policy if exists nachfass_schreiben on public.nachfass;
create policy nachfass_schreiben on public.nachfass for all to authenticated
  using (public.darf('akquise', true)) with check (public.darf('akquise', true));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.nachfass'; exception when duplicate_object then null; end;
  end if;
end $$;

-- Server-Geheimnisse (z. B. Leseschlüssel des Zähler-Dienstes). Nur Cloud-Funktionen und der Agent kommen heran.
create table if not exists public.geheim (
  name     text primary key,
  wert     jsonb not null,
  geaendert timestamptz not null default now()
);
alter table public.geheim enable row level security;
revoke all on public.geheim from anon, authenticated;
