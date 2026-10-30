-- Medialyte-App: Anfragen (Terminbuchungen und Rückrufwünsche von medialyte.de, später auch aus Demos und Telefon)

create table if not exists public.anfragen (
  id          uuid primary key default gen_random_uuid(),
  extern_id   text unique,                 -- Buchungsnummer der Website, verhindert Doppelte
  eingang     timestamptz not null default now(),
  quelle      text not null default 'website',
  art         text not null default 'termin' check (art in ('termin', 'rueckruf', 'nachricht')),
  status      text not null default 'neu'
              check (status in ('neu', 'in_arbeit', 'termin', 'angebot', 'gewonnen', 'verloren', 'spam')),
  pruefen     boolean not null default false,   -- verstecktes Feld ausgefüllt: vermutlich Bot
  name        text,
  firma       text,
  branche     text,
  kategorie   text references public.kategorien(slug) on update cascade on delete set null,
  website     text,
  ort         text,
  groesse     text,
  email       text,
  telefon     text,
  whatsapp_ok boolean not null default false,
  anliegen    text[] not null default '{}',
  nachricht   text,
  format      text,                        -- video, telefon, vor-ort
  termin      timestamptz,
  dauer_min   int,
  rueckruf    text,                        -- Zeitfenster bei Rückrufwunsch
  zugewiesen  uuid references auth.users(id) on delete set null,
  betrieb_id  uuid references public.betriebe(id) on delete set null,
  daten       jsonb not null default '{}'::jsonb,   -- Herkunft (Seite, Referrer, UTM) und Rohdaten
  geaendert   timestamptz not null default now()
);
create index if not exists anfragen_eingang_idx on public.anfragen (eingang desc);
create index if not exists anfragen_status_idx on public.anfragen (status, termin);

drop trigger if exists anfragen_geaendert on public.anfragen;
create trigger anfragen_geaendert before update on public.anfragen for each row execute function public.geaendert_setzen();

alter table public.anfragen enable row level security;
drop policy if exists anfragen_lesen on public.anfragen;
create policy anfragen_lesen on public.anfragen for select to authenticated using (public.darf('anfragen'));
drop policy if exists anfragen_schreiben on public.anfragen;
create policy anfragen_schreiben on public.anfragen for update to authenticated
  using (public.darf('anfragen', true)) with check (public.darf('anfragen', true));
drop policy if exists anfragen_anlegen on public.anfragen;
create policy anfragen_anlegen on public.anfragen for insert to authenticated with check (public.darf('anfragen', true));
-- Löschen nur für den Inhaber (Datenschutz-Löschung nach 12 Monaten übernimmt ein Zeitplan)
drop policy if exists anfragen_loeschen on public.anfragen;
create policy anfragen_loeschen on public.anfragen for delete to authenticated using (public.darf('team', true));

-- Branche aus dem Formular grob einer Kategorie zuordnen
create or replace function public.kategorie_raten(p text) returns text language sql immutable as $$
  select case
    when p ~* '(restaurant|gastro|café|cafe|bar|imbiss|pizzer|bistro|bäck|catering)' then 'gastronomie'
    when p ~* '(handwerk|elektr|maler|tischler|sanitär|heizung|dach|bau|fliesen|garten|schreiner|metall)' then 'handwerk'
    when p ~* '(praxis|arzt|ärzt|zahn|physio|therap|heilprakt|pflege|gesund)' then 'gesundheit'
    when p ~* '(kanzlei|anwalt|recht|steuer|notar)' then 'recht-steuern'
    when p ~* '(friseur|kosmetik|beauty|nagel|massage|wellness|spa)' then 'beauty'
    when p ~* '(laden|shop|handel|geschäft|boutique|juwel|blumen)' then 'einzelhandel'
    when p ~* '(kfz|auto|werkstatt|reifen|fahrschul)' then 'kfz'
    when p ~* '(fitness|sport|yoga|tanz|studio)' then 'fitness'
    when coalesce(p, '') = '' then null
    else 'dienstleistung' end
$$;

-- Live-Aktualisierung in der App
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.anfragen'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.befehle'; exception when duplicate_object then null; end;
  end if;
end $$;

-- Datenschutz: Anfragen ohne Auftrag werden nach 12 Monaten gelöscht (wie in der Datenschutzerklärung zugesagt)
create or replace function public.anfragen_aufraeumen() returns int
language sql security definer set search_path = public as $$
  with weg as (delete from public.anfragen where eingang < now() - interval '12 months' and status <> 'gewonnen' returning 1)
  select count(*)::int from weg
$$;
revoke all on function public.anfragen_aufraeumen() from public, anon, authenticated;
do $$
begin
  begin create extension if not exists pg_cron; exception when others then null; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('anfragen-aufraeumen') where exists (select 1 from cron.job where jobname = 'anfragen-aufraeumen');
    perform cron.schedule('anfragen-aufraeumen', '17 3 * * *', 'select public.anfragen_aufraeumen()');
  end if;
end $$;
