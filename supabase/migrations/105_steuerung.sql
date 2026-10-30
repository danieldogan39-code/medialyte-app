-- Medialyte-App, Etappe 2a: Agent aus der App steuern
-- - Kandidaten-Board: Entscheidung je Betrieb (bauen / offen / nie), Stufe A/B/C
-- - Live-Stand eines laufenden Wochenlaufs
-- - Brief-PDFs im privaten Speicher (nur mit Akquise- oder Brief-Recht lesbar)
-- - Befehle: wann an den Agenten übergeben

alter table public.betriebe add column if not exists entscheidung text check (entscheidung in ('bauen', 'offen', 'nie'));
alter table public.betriebe add column if not exists stufe text;
alter table public.laeufe add column if not exists live jsonb;
alter table public.befehle add column if not exists uebergeben timestamptz;

-- Realtime: laufender Lauf und Betriebe live in der App
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.laeufe'; exception when duplicate_object then null; end;
  end if;
end $$;

-- Befehle: erlaubte Arten (alles andere lehnt die Datenbank ab)
create or replace function public.befehl_pruefen() returns trigger language plpgsql as $$
begin
  if new.art not in ('lauf', 'bauen', 'abbrechen', 'entscheidung', 'demo_loeschen', 'brief_senden', 'brief_vorschau') then
    raise exception 'Unbekannter Befehl: %', new.art;
  end if;
  return new;
end $$;
drop trigger if exists befehle_pruefen on public.befehle;
create trigger befehle_pruefen before insert on public.befehle for each row execute function public.befehl_pruefen();

-- Brief-PDFs: privater Speicher
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('briefe', 'briefe', false) on conflict (id) do nothing;
    execute 'drop policy if exists briefe_pdf_lesen on storage.objects';
    execute $p$create policy briefe_pdf_lesen on storage.objects for select to authenticated
      using (bucket_id = 'briefe' and (public.darf('briefe') or public.darf('akquise')))$p$;
  end if;
end $$;
