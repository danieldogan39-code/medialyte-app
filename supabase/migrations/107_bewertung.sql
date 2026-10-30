-- Medialyte-App, Etappe 2c: Demos bewerten, neu generieren, Favoriten, Design-Gedächtnis

create table if not exists public.bewertungen (
  slug        text primary key,
  version     text,
  daumen      int not null default 0 check (daumen between -1 and 1),
  kommentar   text,
  neubau      jsonb,              -- {wunsch, modus: ueberarbeiten|neu, zeit, version}
  favorit     boolean not null default false,
  zeit        timestamptz,
  geaendert_von uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.bewertungen enable row level security;
drop policy if exists bewertungen_lesen on public.bewertungen;
create policy bewertungen_lesen on public.bewertungen for select to authenticated using (public.darf('akquise'));
drop policy if exists bewertungen_schreiben on public.bewertungen;
create policy bewertungen_schreiben on public.bewertungen for all to authenticated
  using (public.darf('akquise', true)) with check (public.darf('akquise', true));

-- Was der Agent aus den Bewertungen gelernt hat (Stilwelten, Handwerk) – nur der Agent schreibt
create table if not exists public.gedaechtnis (
  kategorie text primary key references public.kategorien(slug) on update cascade on delete cascade,
  daten     jsonb not null default '{}'::jsonb,
  geaendert timestamptz not null default now()
);
alter table public.gedaechtnis enable row level security;
drop policy if exists gedaechtnis_lesen on public.gedaechtnis;
create policy gedaechtnis_lesen on public.gedaechtnis for select to authenticated using (public.darf('akquise'));

-- Neue Befehle
create or replace function public.befehl_pruefen() returns trigger language plpgsql as $$
begin
  if new.art not in ('lauf', 'bauen', 'abbrechen', 'entscheidung', 'demo_loeschen', 'brief_senden', 'brief_vorschau',
                     'bewertung', 'neubau', 'neubau_zurueck', 'regel_verwerfen', 'regel_zurueck') then
    raise exception 'Unbekannter Befehl: %', new.art;
  end if;
  return new;
end $$;
