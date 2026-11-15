-- Organizer, Teil 2:
--  • Zugang pro Konto statt pro Rolle: nur wer in „mitglieder“ organizer = true hat (Daniel). Alle anderen sehen nur die Agentur.
--  • Tagesroutine (Aufwachen, Fokusblöcke mit Niveau, Essen, Sport, Schlafen) – die Auto-Planung plant in die Blöcke.
--  • Fahrzeit zur Uni (hin und zurück) wird freigehalten; Aufgaben können ein „frühestens“-Datum haben.
--  • Fächer mit Details (voller Name für den Kalender, Dozent, Prüfung, Link, Schwierigkeit).

-- ---------- Zugang nur für ausgewählte Konten
alter table public.mitglieder add column if not exists organizer boolean not null default false;
-- Beim ersten Mal: der erste Inhaber (Daniel) bekommt den Organizer
do $$ begin
  if not exists (select 1 from public.mitglieder where organizer) then
    update public.mitglieder set organizer = true
    where user_id = (select user_id from public.mitglieder where rolle = 'inhaber' and aktiv order by erstellt limit 1);
  end if;
end $$;
-- Das Rollenrecht „organizer“ aus 124 entfällt (sonst bekäme jede Rolle mit Recht Zugang)
delete from public.rechte where bereich = 'organizer';

create or replace function public.org_meins(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() and public.zwei_faktor()
    and exists (select 1 from public.mitglieder m where m.user_id = auth.uid() and m.aktiv and m.organizer)
$$;

-- ich(): „organizer“ erscheint in den Rechten nur für freigeschaltete Konten
create or replace function public.ich() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', m.user_id, 'name', m.name, 'email', m.email, 'rolle', m.rolle, 'aktiv', m.aktiv,
    'rechte', coalesce((select jsonb_object_agg(r.bereich, case when r.schreiben then 'schreiben' else 'lesen' end)
                        from public.rechte r where r.rolle = m.rolle and (r.lesen or r.schreiben) and r.bereich <> 'organizer'), '{}'::jsonb)
              || case when m.organizer then '{"organizer": "schreiben"}'::jsonb else '{}'::jsonb end)
  from public.mitglieder m where m.user_id = auth.uid()
$$;

-- Niemand kann sich den Organizer selbst freischalten (auch nicht über „Team & Rechte“): nur der Server/Datenbank-Zugang
create or replace function public.organizer_schuetzen() returns trigger language plpgsql as $$
begin
  if new.organizer is distinct from old.organizer and current_user in ('authenticated', 'anon') then
    raise exception 'Der Organizer wird nicht über die App freigeschaltet.';
  end if;
  return new;
end $$;
drop trigger if exists mitglieder_organizer on public.mitglieder;
create trigger mitglieder_organizer before update on public.mitglieder for each row execute function public.organizer_schuetzen();

-- ---------- Fächer: Details
alter table public.org_faecher add column if not exists name_lang text;      -- „Wirtschaftsmathematik“ (so heißt es im Kalender)
alter table public.org_faecher add column if not exists dozent text;
alter table public.org_faecher add column if not exists pruefung text;       -- „Klausur 120 Min.“, „Hausarbeit 3.000 Wörter“ …
alter table public.org_faecher add column if not exists link text;           -- Skript, Moodle
alter table public.org_faecher add column if not exists notiz text;
alter table public.org_faecher add column if not exists niveau smallint not null default 2;   -- 1 schwer (Block 1), 2 normal, 3 leicht
do $$ begin
  alter table public.org_faecher add constraint org_faecher_niveau_chk check (niveau between 1 and 3);
exception when duplicate_object then null; end $$;

-- ---------- Aufgaben: frühestens ab
alter table public.org_aufgaben add column if not exists ab date;

-- ---------- Termine: Fahrt (null = automatisch: Vorlesungen/Prüfungen vor Ort)
alter table public.org_termine add column if not exists fahrt boolean;

-- ---------- Einstellungen: Fahrzeit (ein Weg)
alter table public.org_einstellungen add column if not exists fahrzeit_min integer not null default 45;
do $$ begin
  alter table public.org_einstellungen add constraint org_einst_fahrzeit_chk check (fahrzeit_min between 0 and 180);
exception when duplicate_object then null; end $$;

-- ---------- Tagesroutine
create table if not exists public.org_routine (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel     text not null check (length(trim(titel)) between 1 and 80),
  start     time not null,
  dauer_min integer not null default 30 check (dauer_min between 5 and 600),
  tage      smallint[] not null default '{1,2,3,4,5}' check (tage <@ array[1,2,3,4,5,6,7]::smallint[]),
  art       text not null default 'fix' check (art in ('block', 'fix', 'flex')),   -- block = Arbeitszeit, fix = bleibt, flex = darf ausfallen
  niveau    smallint check (niveau between 1 and 3),                              -- nur Blöcke: 1 höchstes … 3 niedriges Niveau
  aktiv     boolean not null default true,
  erstellt  timestamptz not null default now()
);
create index if not exists org_routine_user_idx on public.org_routine (user_id);
alter table public.org_routine enable row level security;
drop policy if exists org_routine_meins on public.org_routine;
create policy org_routine_meins on public.org_routine for all to authenticated using (public.org_meins(user_id)) with check (public.org_meins(user_id));
