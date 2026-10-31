-- Social Media: fertige Creatives (Bilder, Karussells, Videos) mit Texten zum Herunterladen,
-- dazu der Plan (Grundidee, roter Faden, Content-Säulen) und ein Kalender.
-- Die Dateien liegen im privaten Speicher „creatives“; neue Creatives spielt der Ablauf
-- .github/workflows/creatives.yml ein (Server-Schlüssel nur dort).

-- Rechte: neuer Bereich „social“ (nur beim ersten Mal gesetzt, danach in „Team & Rechte“ änderbar)
insert into public.rechte (rolle, bereich, lesen, schreiben) values
  ('inhaber', 'social', true, true), ('marketing', 'social', true, true), ('design', 'social', true, true),
  ('entwicklung', 'social', true, false)
on conflict (rolle, bereich) do nothing;

create table if not exists public.social_creatives (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  titel     text not null,
  art       text not null check (art in ('bild', 'karussell', 'video')),
  serie     text,
  text      text not null default '',            -- Bildunterschrift für Instagram
  format    text,                                 -- z. B. „1080 × 1440“
  status    text not null default 'pruefen' check (status in ('pruefen', 'freigegeben', 'gepostet', 'verworfen')),
  saeule    text,                                 -- Content-Säule aus dem Plan
  dateien   jsonb not null default '[]'::jsonb,   -- [{name, pfad, art: bild|video|titelbild|paket, groesse, b, h}]
  vorschau  text,                                 -- Pfad des kleinen Vorschaubilds
  position  double precision,                     -- Reihenfolge (per Ziehen sortiert)
  geplant   date,                                 -- Tag im Kalender
  notiz     text,
  erstellt  timestamptz not null default now(),
  geaendert timestamptz not null default now()
);
create index if not exists social_creatives_pos_idx on public.social_creatives (position);
create index if not exists social_creatives_geplant_idx on public.social_creatives (geplant) where geplant is not null;

-- Neue Creatives erscheinen oben; jede Änderung setzt den Zeitstempel
create or replace function public.social_vorne() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.position is null then
    new.position := coalesce((select min(position) from public.social_creatives), 0) - 1;
  end if;
  new.geaendert := now();
  return new;
end $$;
drop trigger if exists social_creatives_vorne on public.social_creatives;
create trigger social_creatives_vorne before insert or update on public.social_creatives
  for each row execute function public.social_vorne();

-- Der Plan: ein einziges Dokument (Grundidee, roter Faden, Zielgruppe, Ton, Rhythmus, Säulen)
create table if not exists public.social_plan (
  id        int primary key default 1 check (id = 1),
  inhalt    jsonb not null default '{}'::jsonb,
  geaendert timestamptz not null default now(),
  geaendert_von uuid references auth.users(id) on delete set null
);
insert into public.social_plan (id, inhalt) values (1, jsonb_build_object(
  'idee', 'Medialyte zeigt Betrieben, dass ihre Website Kunden bringen soll statt Arbeit zu machen. Und dass wir Website, System und KI-Agent aus einer Hand bauen.',
  'faden', 'Problem erkennen, Lösung verstehen, sehen wie wir arbeiten, Kontakt aufnehmen. Jeder Post zahlt auf eine dieser Stufen ein. Immer dieselbe Bildsprache: Navy, Koralle, Outfit-Schrift und echte Oberflächen statt Stockfotos.',
  'zielgruppe', 'Inhaber kleiner und mittlerer Betriebe in ganz Deutschland mit alter oder ohne Website: Gastronomie, Salons, Handwerk, Praxen, Kanzleien.',
  'ton', 'Direkt und per du. Provokant im Einstieg, sachlich in der Erklärung. Keine Fachbegriffe, keine leeren Versprechen.',
  'rhythmus', '3 Posts pro Woche: ein Video, ein Karussell und ein Einzelbild oder Einblick.',
  'saeulen', jsonb_build_array(
    jsonb_build_object('id', 'wachruetteln', 'name', 'Wachrütteln', 'farbe', '#FF5757', 'text', 'Kurze, provokante Videos mit Stimme. Sie zeigen das Problem: Ohne gute Website wirst du übersehen.'),
    jsonb_build_object('id', 'wissen', 'name', 'Wissen', 'farbe', '#F7C65E', 'text', 'Karussells zum Speichern: woran man eine schwache Website erkennt und was hilft.'),
    jsonb_build_object('id', 'einblicke', 'name', 'Einblicke', 'farbe', '#8AB0FF', 'text', 'Sachlich zeigen, was wir bauen: Websites, Dashboard, KI-Agent und Design.'),
    jsonb_build_object('id', 'angebot', 'name', 'Angebot', 'farbe', '#4EDC8F', 'text', 'Einzelposts mit klarer Handlung: Erstgespräch, WhatsApp, Angebot in 48 Stunden.')
  )))
on conflict (id) do nothing;

alter table public.social_creatives enable row level security;
alter table public.social_plan enable row level security;

drop policy if exists social_creatives_lesen on public.social_creatives;
create policy social_creatives_lesen on public.social_creatives for select to authenticated using (public.darf('social'));
drop policy if exists social_creatives_aendern on public.social_creatives;
create policy social_creatives_aendern on public.social_creatives for update to authenticated
  using (public.darf('social', true)) with check (public.darf('social', true));
drop policy if exists social_creatives_loeschen on public.social_creatives;
create policy social_creatives_loeschen on public.social_creatives for delete to authenticated using (public.darf('social', true));
-- Anlegen nur über den Einspiel-Ablauf (Server-Schlüssel)

drop policy if exists social_plan_lesen on public.social_plan;
create policy social_plan_lesen on public.social_plan for select to authenticated using (public.darf('social'));
drop policy if exists social_plan_aendern on public.social_plan;
create policy social_plan_aendern on public.social_plan for update to authenticated
  using (public.darf('social', true)) with check (public.darf('social', true));

-- Privater Dateispeicher (max. 50 MB je Datei)
insert into storage.buckets (id, name, public, file_size_limit)
values ('creatives', 'creatives', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists creatives_lesen on storage.objects;
create policy creatives_lesen on storage.objects for select to authenticated
  using (bucket_id = 'creatives' and public.darf('social'));
drop policy if exists creatives_loeschen on storage.objects;
create policy creatives_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'creatives' and public.darf('social', true));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.social_creatives'; exception when duplicate_object then null; end;
  end if;
end $$;
