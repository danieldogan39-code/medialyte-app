-- Kunden: Website übernehmen (Domain, Impressum, Datenschutz, Fotos), Stand der Übernahme, Website-Agent, Tischbuch.
-- Der Agent spiegelt Eingaben und Stand hierher (agent/cloud.py); die App schickt Aufträge als Befehl „kunde“.

create table if not exists public.kunden (
  slug        text primary key,
  betrieb_id  uuid references public.betriebe(id) on delete set null,
  name        text not null default '',
  eingaben    jsonb not null default '{}'::jsonb,   -- domain, impressum{…}, datenschutz, fotos_aus, fotos_eigen, auftrag
  stand       jsonb not null default '{}'::jsonb,   -- stand, domain, vorschau, nameserver, mx, live_seit, fehler …
  betreuung   jsonb not null default '{}'::jsonb,   -- Website-Agent: aenderungen, kandidat
  aktualisiert timestamptz not null default now()
);
alter table public.kunden enable row level security;
drop policy if exists kunden_lesen on public.kunden;
create policy kunden_lesen on public.kunden for select to authenticated using (public.darf('kunden'));

-- Tischbuch-Link mit dem Schlüssel des Restaurants: nur wer Kunden bearbeiten darf
create table if not exists public.kunden_zugang (
  slug       text primary key references public.kunden(slug) on delete cascade,
  tischbuch  text
);
alter table public.kunden_zugang enable row level security;
drop policy if exists kunden_zugang_lesen on public.kunden_zugang;
create policy kunden_zugang_lesen on public.kunden_zugang for select to authenticated using (public.darf('kunden', true));

-- Feste Texte vom Agenten (z. B. Bausteine der Datenschutzerklärung), lesen für alle aktiven Mitglieder
create table if not exists public.texte (
  name   text primary key,
  daten  jsonb not null default '{}'::jsonb,
  geaendert timestamptz not null default now()
);
alter table public.texte enable row level security;
drop policy if exists texte_lesen on public.texte;
create policy texte_lesen on public.texte for select to authenticated using (public.ich() is not null);

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.kunden'; exception when duplicate_object then null; end;
  end if;
end $$;

-- Befehle: Kunden-Aufträge brauchen das Kunden-Recht, alles andere wie bisher
drop policy if exists befehle_lesen on public.befehle;
create policy befehle_lesen on public.befehle for select to authenticated
  using (public.darf('akquise') or (art like 'kunde%' and public.darf('kunden')));
drop policy if exists befehle_anlegen on public.befehle;
create policy befehle_anlegen on public.befehle for insert to authenticated
  with check (status = 'offen' and erstellt_von = auth.uid()
              and case when art like 'brief%' then public.darf('briefe', true)
                       when art like 'kunde%' then public.darf('kunden', true)
                       else public.darf('akquise', true) end);

create or replace function public.befehl_pruefen() returns trigger language plpgsql as $$
begin
  if new.art not in ('lauf', 'bauen', 'abbrechen', 'entscheidung', 'demo_loeschen', 'brief_senden', 'brief_vorschau',
                     'bewertung', 'neubau', 'neubau_zurueck', 'regel_verwerfen', 'regel_zurueck',
                     'kunde', 'kunde_agent_zurueck') then
    raise exception 'Unbekannter Befehl: %', new.art;
  end if;
  return new;
end $$;

-- Eigene Fotos der Kunden (ersetzen Google-Fotos): privat, Pfad <slug>/<nr>.jpg
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('kundenfotos', 'kundenfotos', false, 8388608, array['image/jpeg'])
      on conflict (id) do nothing;
    execute 'drop policy if exists kundenfotos_lesen on storage.objects';
    execute $p$create policy kundenfotos_lesen on storage.objects for select to authenticated
      using (bucket_id = 'kundenfotos' and public.darf('kunden'))$p$;
    execute 'drop policy if exists kundenfotos_schreiben on storage.objects';
    execute $p$create policy kundenfotos_schreiben on storage.objects for insert to authenticated
      with check (bucket_id = 'kundenfotos' and public.darf('kunden', true))$p$;
    execute 'drop policy if exists kundenfotos_ersetzen on storage.objects';
    execute $p$create policy kundenfotos_ersetzen on storage.objects for update to authenticated
      using (bucket_id = 'kundenfotos' and public.darf('kunden', true))$p$;
    execute 'drop policy if exists kundenfotos_loeschen on storage.objects';
    execute $p$create policy kundenfotos_loeschen on storage.objects for delete to authenticated
      using (bucket_id = 'kundenfotos' and public.darf('kunden', true))$p$;
  end if;
end $$;
