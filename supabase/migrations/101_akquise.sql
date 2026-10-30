-- Medialyte-App: Akquise über alle Branchen
-- Kategorien → Betriebe → Demos → Briefe, dazu die Läufe des Agenten und Befehle aus der App an den Agenten.

create table if not exists public.kategorien (
  slug        text primary key check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  beschreibung text,
  icon        text not null default 'store',
  farbe       text not null default '#7C8CF5',
  sortierung  int not null default 100,
  aktiv       boolean not null default true,     -- Agent sucht in dieser Kategorie
  -- Wie der Agent sucht: Google-Suchbegriffe bzw. Place-Typen, Filter, Demo-Vorlage
  suche       jsonb not null default '{}'::jsonb,
  erstellt    timestamptz not null default now()
);

insert into public.kategorien (slug, name, beschreibung, icon, farbe, sortierung, suche) values
  ('gastronomie', 'Gastronomie', 'Restaurants, Cafés, Imbisse und Bars', 'utensils', '#F2994A', 10,
   '{"typen": ["restaurant", "cafe", "bar", "meal_takeaway"], "begriffe": [], "vorlage": "gastro"}'),
  ('handwerk', 'Handwerk', 'Elektriker, Maler, Tischler, Sanitär, Dachdecker und mehr', 'hammer', '#E2B93B', 20,
   '{"typen": ["electrician", "painter", "plumber", "roofing_contractor", "general_contractor"], "begriffe": ["Tischlerei", "Fliesenleger", "Gartenbau"], "vorlage": "handwerk"}'),
  ('gesundheit', 'Gesundheit', 'Praxen, Physiotherapie, Heilpraktiker', 'stethoscope', '#4FB6A5', 30,
   '{"typen": ["physiotherapist", "dentist", "doctor"], "begriffe": ["Heilpraktiker", "Ergotherapie", "Logopädie"], "vorlage": "praxis"}'),
  ('recht-steuern', 'Recht & Steuern', 'Kanzleien und Steuerberatung', 'scale', '#7C8CF5', 40,
   '{"typen": ["lawyer", "accounting"], "begriffe": ["Steuerberater", "Rechtsanwalt"], "vorlage": "kanzlei"}'),
  ('beauty', 'Beauty & Wellness', 'Friseure, Kosmetik, Nagelstudios, Massage', 'sparkles', '#E57BB4', 50,
   '{"typen": ["hair_care", "beauty_salon", "spa"], "begriffe": ["Kosmetikstudio", "Nagelstudio"], "vorlage": "beauty"}'),
  ('einzelhandel', 'Einzelhandel', 'Läden und Fachgeschäfte', 'shopping-bag', '#5BA4E6', 60,
   '{"typen": ["florist", "bakery", "jewelry_store", "clothing_store", "book_store"], "begriffe": [], "vorlage": "laden"}'),
  ('kfz', 'Kfz & Mobilität', 'Werkstätten, Reifen, Fahrschulen', 'car', '#9AA7BA', 70,
   '{"typen": ["car_repair", "car_wash"], "begriffe": ["Fahrschule", "Reifenservice"], "vorlage": "handwerk"}'),
  ('fitness', 'Sport & Fitness', 'Studios, Kampfsport, Yoga, Tanzschulen', 'dumbbell', '#56C271', 80,
   '{"typen": ["gym"], "begriffe": ["Yoga", "Tanzschule", "Kampfsport"], "vorlage": "studio"}'),
  ('dienstleistung', 'Dienstleistung', 'Reinigung, Umzug, Fotografie, Nachhilfe und mehr', 'briefcase', '#B48CF2', 90,
   '{"typen": ["moving_company"], "begriffe": ["Gebäudereinigung", "Fotograf", "Nachhilfe"], "vorlage": "dienstleistung"}')
on conflict (slug) do nothing;

-- Ein Betrieb, den der Agent gefunden hat oder den jemand von Hand anlegt.
-- Datensparsam wie bisher: Google-Inhalte (Name, Ort, Bewertung …) bleiben nur, solange die Demo online ist.
create table if not exists public.betriebe (
  id              uuid primary key default gen_random_uuid(),
  kategorie       text not null references public.kategorien(slug) on update cascade,
  place_id        text unique,
  name            text,
  branche         text,          -- z. B. „Italienisch“, „Elektriker“, „Zahnarzt“
  ort             text,
  gebiet          text,
  adresse         text,
  telefon         text,
  email           text,
  website_art     text,          -- keine, nur Social Media, Plattform, veraltet …
  plattform       text,
  bewertung       numeric(2,1),
  anzahl_bewertungen int,
  punkte          numeric(6,2),
  entfernung_km   numeric(7,2),
  maps_url        text,
  status          text not null default 'gefunden',
  notiz           text,
  daten           jsonb not null default '{}'::jsonb,
  erstellt        timestamptz not null default now(),
  geaendert       timestamptz not null default now()
);
create index if not exists betriebe_kat_idx on public.betriebe (kategorie, status, geaendert desc);

create table if not exists public.demos (
  slug        text primary key,
  betrieb_id  uuid references public.betriebe(id) on delete cascade,
  url         text,
  kurz        text,              -- Kurzlink im Brief
  vorlage     text,              -- Design-Vorlage / Welt
  version     text,
  erstellt    date,
  gebaut      timestamptz,
  loescht_am  date,
  geloescht   date,
  daten       jsonb not null default '{}'::jsonb
);
create index if not exists demos_betrieb_idx on public.demos (betrieb_id);

create table if not exists public.briefe (
  id          uuid primary key default gen_random_uuid(),
  betrieb_id  uuid references public.betriebe(id) on delete cascade,
  demo_slug   text references public.demos(slug) on delete set null,
  pdf         text,              -- Pfad oder Adresse des Brief-PDFs
  status      text not null default 'vorbereitet',
  vorbereitet date,
  verschickt  date,
  test        boolean not null default false,
  grund       text,
  daten       jsonb not null default '{}'::jsonb,
  unique (betrieb_id, demo_slug)
);

-- Läufe des Agenten (Suche, Bau, Versand)
create table if not exists public.laeufe (
  id         text primary key,
  kategorie  text references public.kategorien(slug) on update cascade,
  art        text not null default 'wochenlauf',
  start      timestamptz,
  ende       timestamptz,
  status     text,
  zahlen     jsonb not null default '{}'::jsonb,
  log        jsonb not null default '[]'::jsonb
);
create index if not exists laeufe_start_idx on public.laeufe (start desc);

-- Befehle aus der App an den Agenten (Wochenlauf starten, Brief verschicken, Demo löschen …).
-- Die App schreibt nur hierher; ausgeführt wird serverseitig. Kein GitHub-Schlüssel im Gerät.
create table if not exists public.befehle (
  id          uuid primary key default gen_random_uuid(),
  art         text not null,
  ziel        text,
  daten       jsonb not null default '{}'::jsonb,
  status      text not null default 'offen' check (status in ('offen', 'laeuft', 'erledigt', 'fehler')),
  ergebnis    text,
  erstellt_von uuid default auth.uid() references auth.users(id) on delete set null,
  erstellt    timestamptz not null default now(),
  erledigt    timestamptz
);
create index if not exists befehle_offen_idx on public.befehle (status, erstellt);

-- Wer hat wann was gemacht (Notizen, Statuswechsel) – an Betrieben und Anfragen
create table if not exists public.verlauf (
  id        uuid primary key default gen_random_uuid(),
  bezug     text not null check (bezug in ('betrieb', 'anfrage', 'kunde')),
  bezug_id  text not null,
  user_id   uuid default auth.uid() references auth.users(id) on delete set null,
  art       text not null default 'notiz',
  text      text,
  daten     jsonb not null default '{}'::jsonb,
  zeit      timestamptz not null default now()
);
create index if not exists verlauf_bezug_idx on public.verlauf (bezug, bezug_id, zeit desc);

create or replace function public.geaendert_setzen() returns trigger language plpgsql as $$
begin new.geaendert = now(); return new; end $$;
drop trigger if exists betriebe_geaendert on public.betriebe;
create trigger betriebe_geaendert before update on public.betriebe for each row execute function public.geaendert_setzen();

-- Zugriffsregeln
alter table public.kategorien enable row level security;
alter table public.betriebe enable row level security;
alter table public.demos enable row level security;
alter table public.briefe enable row level security;
alter table public.laeufe enable row level security;
alter table public.befehle enable row level security;
alter table public.verlauf enable row level security;

do $$
declare t text;
begin
  foreach t in array array['kategorien', 'betriebe', 'demos', 'laeufe'] loop
    execute format('drop policy if exists %1$s_lesen on public.%1$s', t);
    execute format('create policy %1$s_lesen on public.%1$s for select to authenticated using (public.darf(''akquise''))', t);
    execute format('drop policy if exists %1$s_schreiben on public.%1$s', t);
    execute format('create policy %1$s_schreiben on public.%1$s for all to authenticated using (public.darf(''akquise'', true)) with check (public.darf(''akquise'', true))', t);
  end loop;
end $$;

drop policy if exists briefe_lesen on public.briefe;
create policy briefe_lesen on public.briefe for select to authenticated using (public.darf('akquise') or public.darf('briefe'));
drop policy if exists briefe_schreiben on public.briefe;
create policy briefe_schreiben on public.briefe for all to authenticated
  using (public.darf('briefe', true)) with check (public.darf('briefe', true));

-- Befehle: lesen wer Akquise sieht; anlegen nur passend zur Art (Briefversand nur mit Brief-Recht); nie ändern
drop policy if exists befehle_lesen on public.befehle;
create policy befehle_lesen on public.befehle for select to authenticated using (public.darf('akquise'));
drop policy if exists befehle_anlegen on public.befehle;
create policy befehle_anlegen on public.befehle for insert to authenticated
  with check (status = 'offen' and erstellt_von = auth.uid()
              and case when art like 'brief%' then public.darf('briefe', true) else public.darf('akquise', true) end);

-- Verlauf: lesen/schreiben nach Bereich des Bezugs; eigene Einträge, nicht nachträglich änderbar
drop policy if exists verlauf_lesen on public.verlauf;
create policy verlauf_lesen on public.verlauf for select to authenticated using (
  case bezug when 'betrieb' then public.darf('akquise') when 'anfrage' then public.darf('anfragen') else public.darf('kunden') end);
drop policy if exists verlauf_anlegen on public.verlauf;
create policy verlauf_anlegen on public.verlauf for insert to authenticated with check (
  user_id = auth.uid() and
  case bezug when 'betrieb' then public.darf('akquise', true) when 'anfrage' then public.darf('anfragen', true) else public.darf('kunden', true) end);

-- Zahlen je Kategorie und Status (für Übersicht und Kategorien; es gelten die Zugriffsregeln des Aufrufers)
create or replace function public.akquise_zahlen()
returns table (kategorie text, status text, anzahl bigint, demos_online bigint)
language sql stable security invoker set search_path = public as $$
  select b.kategorie, b.status, count(*),
         count(*) filter (where exists (select 1 from public.demos d where d.betrieb_id = b.id and d.geloescht is null))
  from public.betriebe b group by b.kategorie, b.status
$$;
revoke all on function public.akquise_zahlen() from public, anon;
grant execute on function public.akquise_zahlen() to authenticated;
