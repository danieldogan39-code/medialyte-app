-- Organizer: persönlicher Planer (Termine, Aufgaben mit Auto-Planung, Gewohnheiten, Prüfungen, Kalender-Abos).
-- Ein eigener Bereich der App, den man beim Start statt „Medialyte“ wählt.
-- Grundsatz: Jeder sieht nur seine eigenen Einträge – auch der Inhaber sieht nicht die eines anderen Mitglieds.
-- Zusätzlich gilt wie überall: aktives Mitglied, Zwei-Faktor bestätigt, Recht „organizer“.

-- Zugang: seit 125 pro Konto (mitglieder.organizer), nicht über Rollenrechte

-- Darf ich in meinem Organizer arbeiten? (eigene Zeile + Recht + 2FA)
create or replace function public.org_meins(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() and public.darf('organizer', true)
$$;
revoke all on function public.org_meins(uuid) from public, anon;
grant execute on function public.org_meins(uuid) to authenticated;

-- Fächer bzw. Lebensbereiche (Mathe, Rechnungswesen, Medialyte, Training …): Farbe und Ordnung für alles andere
create table if not exists public.org_faecher (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  farbe      text not null default '#6FA8F0' check (farbe ~ '^#[0-9A-Fa-f]{6}$'),
  position   double precision not null default 0,
  archiviert boolean not null default false,
  erstellt   timestamptz not null default now()
);
create index if not exists org_faecher_user_idx on public.org_faecher (user_id);

-- Kalender-Abos (iCal-Adresse vom ISM-Portal, „Geheime Adresse“ aus Google Kalender …)
create table if not exists public.org_kalender (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name      text not null check (length(trim(name)) between 1 and 60),
  url       text not null check (url ~* '^(https|webcal)://[^\s/]+\.[^\s]+$' and length(url) <= 2000),
  art       text not null default 'sonstige' check (art in ('ism', 'google', 'sonstige')),
  farbe     text not null default '#8B98AD' check (farbe ~ '^#[0-9A-Fa-f]{6}$'),
  fach_id   uuid references public.org_faecher(id) on delete set null,
  zuletzt   timestamptz,
  fehler    text,
  erstellt  timestamptz not null default now()
);
create index if not exists org_kalender_user_idx on public.org_kalender (user_id);

-- Termine: feste Zeiten (Vorlesungen, Klausuren, Abgaben, private Termine). Importierte tragen kalender_id + extern_uid.
create table if not exists public.org_termine (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel       text not null check (length(trim(titel)) between 1 and 200),
  start       timestamptz not null,
  ende        timestamptz not null,
  ganztag     boolean not null default false,
  ort         text,
  art         text not null default 'termin' check (art in ('termin', 'vorlesung', 'klausur', 'abgabe', 'privat')),
  fach_id     uuid references public.org_faecher(id) on delete set null,
  notiz       text,
  kalender_id uuid references public.org_kalender(id) on delete cascade,
  extern_uid  text,
  erstellt    timestamptz not null default now(),
  geaendert   timestamptz not null default now(),
  check (ende >= start)
);
create index if not exists org_termine_user_start_idx on public.org_termine (user_id, start);
create unique index if not exists org_termine_extern_idx on public.org_termine (kalender_id, extern_uid);   -- eigene Termine: beide leer, zählen nicht als gleich

-- Aufgaben: mit Dauer und Frist plant die App sie selbst in freie Zeit (geplant). Fixiert = von Hand gesetzt, bleibt stehen.
create table if not exists public.org_aufgaben (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel     text not null check (length(trim(titel)) between 1 and 300),
  notiz     text,
  fach_id   uuid references public.org_faecher(id) on delete set null,
  dauer_min integer not null default 60 check (dauer_min between 5 and 720),
  frist     date,
  prio      smallint not null default 2 check (prio between 1 and 3),   -- 1 hoch, 2 normal, 3 niedrig
  geplant   timestamptz,
  fixiert   boolean not null default false,
  erledigt  timestamptz,
  position  double precision not null default 0,
  erstellt  timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists org_aufgaben_user_idx on public.org_aufgaben (user_id, erledigt, geplant);

-- Gewohnheiten (z. B. Training 3× pro Woche). Mit Uhrzeit und Wochentagen hält die Auto-Planung die Zeit frei.
create table if not exists public.org_gewohnheiten (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name      text not null check (length(trim(name)) between 1 and 60),
  icon      text not null default 'dumbbell',
  farbe     text not null default '#4CC38A' check (farbe ~ '^#[0-9A-Fa-f]{6}$'),
  pro_woche smallint not null default 3 check (pro_woche between 1 and 7),
  dauer_min integer not null default 90 check (dauer_min between 5 and 480),
  uhrzeit   time,
  tage      smallint[] not null default '{}' check (tage <@ array[1,2,3,4,5,6,7]::smallint[]),  -- 1 = Montag
  aktiv     boolean not null default true,
  position  double precision not null default 0,
  erstellt  timestamptz not null default now()
);
create index if not exists org_gewohnheiten_user_idx on public.org_gewohnheiten (user_id);

create table if not exists public.org_gewohnheit_log (
  gewohnheit_id uuid not null references public.org_gewohnheiten(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tag           date not null,
  erstellt      timestamptz not null default now(),
  primary key (gewohnheit_id, tag)
);
create index if not exists org_gewohnheit_log_user_idx on public.org_gewohnheit_log (user_id, tag);

-- Persönliche Einstellungen für die Auto-Planung
create table if not exists public.org_einstellungen (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  tag_start     time not null default '09:00',
  tag_ende      time not null default '18:00',
  puffer_min    integer not null default 15 check (puffer_min between 0 and 120),
  tag_max_min   integer not null default 360 check (tag_max_min between 30 and 720),   -- höchstens so viel geplante Arbeit pro Tag
  wochenende    boolean not null default true,
  geaendert     timestamptz not null default now(),
  check (tag_ende > tag_start)
);

-- Fremde Verweise nur auf eigene Fächer/Kalender (sonst könnte man fremde IDs „anhängen“)
create or replace function public.org_verweise_pruefen() returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb := to_jsonb(new);   -- nicht jede Tabelle hat jede Spalte: über JSON lesen
begin
  if n ? 'fach_id' and n ->> 'fach_id' is not null
     and not exists (select 1 from public.org_faecher f where f.id = (n ->> 'fach_id')::uuid and f.user_id = new.user_id) then
    raise exception 'Fach gehört nicht zu diesem Konto';
  end if;
  if n ? 'kalender_id' and n ->> 'kalender_id' is not null
     and not exists (select 1 from public.org_kalender k where k.id = (n ->> 'kalender_id')::uuid and k.user_id = new.user_id) then
    raise exception 'Kalender gehört nicht zu diesem Konto';
  end if;
  if n ? 'gewohnheit_id'
     and not exists (select 1 from public.org_gewohnheiten g where g.id = (n ->> 'gewohnheit_id')::uuid and g.user_id = new.user_id) then
    raise exception 'Gewohnheit gehört nicht zu diesem Konto';
  end if;
  if tg_table_name in ('org_termine', 'org_aufgaben', 'org_einstellungen') then
    new := jsonb_populate_record(new, jsonb_build_object('geaendert', now()));
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['org_faecher', 'org_kalender', 'org_termine', 'org_aufgaben', 'org_gewohnheiten', 'org_gewohnheit_log', 'org_einstellungen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_meins', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.org_meins(user_id)) with check (public.org_meins(user_id))', t || '_meins', t);
    execute format('drop trigger if exists %I on public.%I', t || '_pruefen', t);
    if t <> 'org_faecher' and t <> 'org_gewohnheiten' then
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.org_verweise_pruefen()', t || '_pruefen', t);
    end if;
  end loop;
end $$;

-- Live-Abgleich zwischen Handy und Mac
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.org_aufgaben'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.org_termine'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.org_gewohnheit_log'; exception when duplicate_object then null; end;
  end if;
end $$;
