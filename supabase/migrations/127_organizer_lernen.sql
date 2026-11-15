-- Lernbereich des Organizers: Lernstand je Frage (Leitner-Kästen), gelesene Lektionen,
-- Prüfungssimulationen und die Verknüpfung von Aufgaben mit Lektionen.
-- Die Inhalte selbst liegen in der App; hier steht nur, was du schon kannst.

create table if not exists public.org_lernstand (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  schluessel text not null check (length(schluessel) between 1 and 120),   -- kurs/lektion/frage, „gelesen:kurs/lektion“ oder „gen:kurs/generator“
  box        smallint not null default 0 check (box between 0 and 5),
  faellig    date,
  richtig    integer not null default 0 check (richtig >= 0),
  falsch     integer not null default 0 check (falsch >= 0),
  zuletzt    timestamptz,
  primary key (user_id, schluessel)
);
alter table public.org_lernstand enable row level security;
drop policy if exists org_lernstand_meins on public.org_lernstand;
create policy org_lernstand_meins on public.org_lernstand for all to authenticated using (public.org_meins(user_id)) with check (public.org_meins(user_id));

create table if not exists public.org_pruefungslauf (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kurs     text not null check (kurs in ('mathe', 'rewe', 'im', 'bwl')),
  punkte   numeric(6,1) not null check (punkte >= 0),
  max      numeric(6,1) not null check (max > 0),
  dauer_s  integer not null check (dauer_s >= 0),
  fehler   text[] not null default '{}',
  erstellt timestamptz not null default now()
);
create index if not exists org_pruefungslauf_user_idx on public.org_pruefungslauf (user_id, kurs);
alter table public.org_pruefungslauf enable row level security;
drop policy if exists org_pruefungslauf_meins on public.org_pruefungslauf;
create policy org_pruefungslauf_meins on public.org_pruefungslauf for all to authenticated using (public.org_meins(user_id)) with check (public.org_meins(user_id));

-- Aufgabe → Lektion („kurs/lektion“), damit der Plan direkt in die Lektion führt
alter table public.org_aufgaben add column if not exists lektion text;
do $$ begin
  alter table public.org_aufgaben add constraint org_aufgaben_lektion_chk check (lektion is null or lektion ~ '^(mathe|rewe|im|bwl)/[a-z0-9-]{1,40}$');
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on public.org_lernstand, public.org_pruefungslauf to authenticated;

-- Eigene Dateien des Organizers (z. B. Vorlesungsskripte als Lerngrundlage): privat, Pfad <user_id>/…
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
      values ('organizer', 'organizer', false, 209715200)
      on conflict (id) do nothing;
    execute 'drop policy if exists organizer_dateien on storage.objects';
    execute $p$create policy organizer_dateien on storage.objects for all to authenticated
      using (bucket_id = 'organizer' and split_part(name, '/', 1) = auth.uid()::text and public.org_meins(auth.uid()))
      with check (bucket_id = 'organizer' and split_part(name, '/', 1) = auth.uid()::text and public.org_meins(auth.uid()))$p$;
  end if;
end $$;
