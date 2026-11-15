-- Hausarbeiten im Organizer: Arbeiten mit Vorgaben, Material (Dateien im Bucket organizer), Quellen,
-- KI-Nachweis und die Ergebnisse des automatischen Prüfers. Alles gehört genau einem Konto (org_meins).

create table if not exists public.org_arbeiten (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel        text not null check (length(trim(titel)) between 1 and 300),
  thema        text check (length(thema) <= 1000),
  frage        text check (length(frage) <= 1000),
  fach_id      uuid references public.org_faecher(id) on delete set null,
  art          text not null default 'hausarbeit' check (art in ('hausarbeit', 'baustein', 'praesentation', 'thesis', 'sonstiges')),
  abgabe       timestamptz,
  woerter_ziel integer check (woerter_ziel between 50 and 100000),
  toleranz     smallint not null default 10 check (toleranz between 0 and 50),
  min_quellen  smallint check (min_quellen between 0 and 500),
  max_zitate   smallint check (max_zitate between 0 and 500),
  sprache      text not null default 'de' check (sprache in ('de', 'en')),
  zitierweise  text not null default 'fussnoten' check (zitierweise in ('fussnoten', 'harvard')),
  status       text not null default 'idee' check (status in ('idee', 'recherche', 'schreiben', 'korrektur', 'abgegeben')),
  aufgabe      text check (length(aufgabe) <= 30000),
  haken        jsonb not null default '{}'::jsonb,          -- abgehakte Regeln der Checkliste
  notiz        text check (length(notiz) <= 20000),
  erstellt     timestamptz not null default now()
);
create index if not exists org_arbeiten_user_idx on public.org_arbeiten (user_id);

create table if not exists public.org_arbeit_dateien (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  arbeit_id uuid not null references public.org_arbeiten(id) on delete cascade,
  kategorie text not null default 'material' check (kategorie in ('vorgabe', 'quelle', 'material', 'entwurf', 'abgabe')),
  name      text not null check (length(name) between 1 and 300),
  pfad      text not null check (length(pfad) between 1 and 600),
  groesse   bigint not null default 0,
  typ       text,
  notiz     text check (length(notiz) <= 5000),
  erstellt  timestamptz not null default now()
);
create index if not exists org_arbeit_dateien_idx on public.org_arbeit_dateien (arbeit_id);

create table if not exists public.org_quellen (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  arbeit_id uuid not null references public.org_arbeiten(id) on delete cascade,
  typ       text not null default 'buch' check (typ in ('buch', 'sammelwerk', 'zeitschrift', 'internet', 'statistik', 'gesetz', 'sonstiges')),
  daten     jsonb not null default '{}'::jsonb check (jsonb_typeof(daten) = 'object'),
  datei_id  uuid references public.org_arbeit_dateien(id) on delete set null,
  notiz     text check (length(notiz) <= 10000),
  erstellt  timestamptz not null default now()
);
create index if not exists org_quellen_idx on public.org_quellen (arbeit_id);

create table if not exists public.org_ki_nutzung (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  arbeit_id  uuid not null references public.org_arbeiten(id) on delete cascade,
  datum      date not null default current_date,
  tool       text not null check (length(tool) between 1 and 200),
  zweck      text not null check (length(zweck) between 1 and 2000),
  prompt     text not null check (length(prompt) between 1 and 20000),
  ergebnis   text check (length(ergebnis) <= 20000),
  textstelle text check (length(textstelle) <= 2000),
  erstellt   timestamptz not null default now()
);
create index if not exists org_ki_nutzung_idx on public.org_ki_nutzung (arbeit_id);

create table if not exists public.org_arbeit_pruefungen (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  arbeit_id uuid not null references public.org_arbeiten(id) on delete cascade,
  datei     text not null check (length(datei) between 1 and 300),
  woerter   integer,
  fehler    smallint not null default 0,
  hinweise  smallint not null default 0,
  ergebnis  jsonb not null default '[]'::jsonb,
  erstellt  timestamptz not null default now()
);
create index if not exists org_arbeit_pruefungen_idx on public.org_arbeit_pruefungen (arbeit_id, erstellt desc);

do $$ declare t text; begin
  foreach t in array array['org_arbeiten', 'org_arbeit_dateien', 'org_quellen', 'org_ki_nutzung', 'org_arbeit_pruefungen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_meins', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.org_meins(user_id)) with check (public.org_meins(user_id))', t || '_meins', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Verweise nur auf eigene Zeilen (Arbeit, Fach, Datei)
create or replace function public.org_arbeit_verweise() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new);
begin
  if j ? 'arbeit_id' and j ->> 'arbeit_id' is not null and not exists (select 1 from public.org_arbeiten a where a.id = (j ->> 'arbeit_id')::uuid and a.user_id = new.user_id) then
    raise exception 'Arbeit gehört nicht zu diesem Konto' using errcode = '42501';
  end if;
  if j ? 'fach_id' and j ->> 'fach_id' is not null and not exists (select 1 from public.org_faecher f where f.id = (j ->> 'fach_id')::uuid and f.user_id = new.user_id) then
    raise exception 'Fach gehört nicht zu diesem Konto' using errcode = '42501';
  end if;
  if j ? 'datei_id' and j ->> 'datei_id' is not null and not exists (select 1 from public.org_arbeit_dateien d where d.id = (j ->> 'datei_id')::uuid and d.user_id = new.user_id) then
    raise exception 'Datei gehört nicht zu diesem Konto' using errcode = '42501';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['org_arbeiten', 'org_arbeit_dateien', 'org_quellen', 'org_ki_nutzung', 'org_arbeit_pruefungen'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_verweise', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.org_arbeit_verweise()', t || '_verweise', t);
  end loop;
end $$;

-- Aufgaben im Organizer können zu einer Arbeit gehören (Schreibplan)
alter table public.org_aufgaben add column if not exists arbeit_id uuid references public.org_arbeiten(id) on delete set null;
create or replace function public.org_aufgabe_arbeit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.arbeit_id is not null and not exists (select 1 from public.org_arbeiten a where a.id = new.arbeit_id and a.user_id = new.user_id) then
    raise exception 'Arbeit gehört nicht zu diesem Konto' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists org_aufgaben_arbeit_verweise on public.org_aufgaben;
create trigger org_aufgaben_arbeit_verweise before insert or update of arbeit_id on public.org_aufgaben for each row execute function public.org_aufgabe_arbeit();
