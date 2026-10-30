-- Alles, was das alte Cockpit zusätzlich zeigte: Kosten, Suchgebiete, Einstellungen, Zahlen, Lauf-Details, Vorschaubilder

alter table public.laeufe add column if not exists daten jsonb not null default '{}'::jsonb;

-- Stand des Agenten als benannte Pakete (z. B. „cockpit“), vom Agenten geschrieben, für die Akquise lesbar
create table if not exists public.agent_daten (
  name      text primary key,
  daten     jsonb not null default '{}'::jsonb,
  geaendert timestamptz not null default now()
);
alter table public.agent_daten enable row level security;
drop policy if exists agent_daten_lesen on public.agent_daten;
create policy agent_daten_lesen on public.agent_daten for select to authenticated using (public.darf('akquise'));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.agent_daten'; exception when duplicate_object then null; end;
  end if;
end $$;

create or replace function public.befehl_pruefen() returns trigger language plpgsql as $$
begin
  if new.art not in ('lauf', 'bauen', 'abbrechen', 'entscheidung', 'demo_loeschen', 'brief_senden', 'brief_vorschau',
                     'bewertung', 'neubau', 'neubau_zurueck', 'regel_verwerfen', 'regel_zurueck',
                     'kunde', 'kunde_agent_zurueck', 'suchgebiete', 'analyse') then
    raise exception 'Unbekannter Befehl: %', new.art;
  end if;
  return new;
end $$;

-- Vorschaubilder des Design-Gedächtnisses (privat, lesen mit Akquise-Recht)
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('gedaechtnis', 'gedaechtnis', false) on conflict (id) do nothing;
    execute 'drop policy if exists gedaechtnis_bilder_lesen on storage.objects';
    execute $p$create policy gedaechtnis_bilder_lesen on storage.objects for select to authenticated
      using (bucket_id = 'gedaechtnis' and public.darf('akquise'))$p$;
  end if;
end $$;
