-- Social Media für Kunden: Wer in den Kunden die Kategorie „Social Media“ bekommt, hat im Bereich Social Media
-- automatisch einen eigenen Bereich (eigene Creatives, Bibliothek, Plan, Kanäle, Stilprofil, Aufträge an Claude).
--
-- • kundenkategorien.bereich = 'social' markiert die Kategorie (bleibt auch beim Umbenennen erhalten)
-- • social_kunden: je Rechnungskunde eine Zeile, angelegt und aktuell gehalten vom Auslöser an customers.
--   Kategorie entfernt → nicht mehr aktiv, Kanäle, Stil und Creatives bleiben erhalten
-- • social_kanaele: die Kanäle des Kunden (Plattform, Name, Link)
-- • social_auftraege: Aufträge an Claude (anlernen, Video, Karussell, Bild); der Agent exportiert offene Aufträge
--   ins private Repo, Claude liefert über den verschlüsselten Creatives-Eingang zurück
-- • social_creatives.kunde_id: leer = Medialytes eigene Creatives

-- ---------- Kategorie „Social Media“
alter table public.kundenkategorien add column if not exists bereich text;
do $$ begin
  alter table public.kundenkategorien add constraint kundenkategorien_bereich_chk check (bereich in ('social'));
exception when duplicate_object then null; end $$;
create unique index if not exists kundenkategorien_bereich_idx on public.kundenkategorien (bereich) where bereich is not null;

update public.kundenkategorien set bereich = 'social'
 where lower(btrim(name)) = 'social media' and not exists (select 1 from public.kundenkategorien where bereich = 'social');
insert into public.kundenkategorien (name, farbe, sortierung, bereich)
select 'Social Media', '#FB923C', 50, 'social'
 where not exists (select 1 from public.kundenkategorien where bereich = 'social')
   and not exists (select 1 from public.kundenkategorien where lower(btrim(name)) = 'social media');

-- ---------- Kunden im Social-Bereich
create table if not exists public.social_kunden (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid unique references public.customers(id) on delete cascade,
  name        text not null,
  aktiv       boolean not null default true,
  farbe       text not null default '#FB923C' check (farbe ~ '^#[0-9A-Fa-f]{6}$'),
  profil      jsonb not null default '{}'::jsonb,   -- Plan und Stil: Grundidee, Zielgruppe, Ton, Format, Aufbau, Stimme, Musik …
  angelernt   timestamptz,                          -- wann Claude den Stil zuletzt angelernt hat
  erstellt    timestamptz not null default now(),
  geaendert   timestamptz not null default now()
);

create table if not exists public.social_kanaele (
  id        uuid primary key default gen_random_uuid(),
  kunde_id  uuid not null references public.social_kunden(id) on delete cascade,
  plattform text not null check (plattform in ('instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'google')),
  name      text not null default '' check (length(name) <= 120),   -- z. B. @anyfacts
  url       text not null default '' check (length(url) <= 400),
  aktiv     boolean not null default true,
  erstellt  timestamptz not null default now()
);
create index if not exists social_kanaele_kunde_idx on public.social_kanaele (kunde_id);

create table if not exists public.social_auftraege (
  id           uuid primary key default gen_random_uuid(),
  kunde_id     uuid not null references public.social_kunden(id) on delete cascade,
  art          text not null check (art in ('anlernen', 'video', 'karussell', 'bild')),
  anzahl       int  not null default 1 check (anzahl between 1 and 10),
  kanaele      uuid[] not null default '{}',
  thema        text not null default '' check (length(thema) <= 2000),     -- leer = Claude wählt nach dem Stilprofil
  hinweise     text not null default '' check (length(hinweise) <= 4000),
  status       text not null default 'offen' check (status in ('offen', 'in_arbeit', 'fertig', 'abgebrochen', 'fehler')),
  ergebnis     text,
  geliefert    int  not null default 0,
  erstellt     timestamptz not null default now(),
  erstellt_von uuid references auth.users(id) on delete set null,
  geaendert    timestamptz not null default now(),
  erledigt     timestamptz
);
create index if not exists social_auftraege_kunde_idx on public.social_auftraege (kunde_id, erstellt desc);
create index if not exists social_auftraege_offen_idx on public.social_auftraege (status) where status in ('offen', 'in_arbeit');

alter table public.social_creatives add column if not exists kunde_id uuid references public.social_kunden(id) on delete cascade;
alter table public.social_creatives add column if not exists auftrag_id uuid references public.social_auftraege(id) on delete set null;
create index if not exists social_creatives_kunde_idx on public.social_creatives (kunde_id);

-- Zeitstempel
create or replace function public.social_geaendert() returns trigger language plpgsql as $$
begin new.geaendert := now(); return new; end $$;
drop trigger if exists social_kunden_geaendert on public.social_kunden;
create trigger social_kunden_geaendert before update on public.social_kunden for each row execute function public.social_geaendert();
drop trigger if exists social_auftraege_geaendert on public.social_auftraege;
create trigger social_auftraege_geaendert before update on public.social_auftraege for each row execute function public.social_geaendert();

-- Aufträge aus der App: nur eigene, nur offen, Kanäle müssen zum Kunden gehören
create or replace function public.social_auftrag_pruefen() returns trigger language plpgsql as $$
begin
  if exists (select 1 from unnest(new.kanaele) k where not exists (select 1 from public.social_kanaele c where c.id = k and c.kunde_id = new.kunde_id)) then
    raise exception 'Kanal gehört nicht zu diesem Kunden';
  end if;
  if new.status in ('fertig', 'abgebrochen', 'fehler') and new.erledigt is null then new.erledigt := now(); end if;
  if new.status in ('offen', 'in_arbeit') then new.erledigt := null; end if;
  return new;
end $$;
drop trigger if exists social_auftraege_pruefen on public.social_auftraege;
create trigger social_auftraege_pruefen before insert or update on public.social_auftraege for each row execute function public.social_auftrag_pruefen();

-- ---------- Kategorie an einem Kunden ⇒ Bereich im Social Media
create or replace function public.social_kunde_abgleichen() returns trigger
language plpgsql security definer set search_path = public as $$
declare kat uuid := (select id from public.kundenkategorien where bereich = 'social' limit 1);
begin
  if kat is null then return new; end if;
  if kat = any(coalesce(new.kategorien, '{}')) then
    insert into public.social_kunden (customer_id, name) values (new.id, coalesce(nullif(btrim(new.name), ''), 'Kunde'))
    on conflict (customer_id) do update set name = excluded.name, aktiv = true
      where social_kunden.name is distinct from excluded.name or not social_kunden.aktiv;
  else
    update public.social_kunden set aktiv = false, name = coalesce(nullif(btrim(new.name), ''), name)
     where customer_id = new.id and (aktiv or name is distinct from new.name);
  end if;
  return new;
end $$;
revoke all on function public.social_kunde_abgleichen() from public;
drop trigger if exists customers_social on public.customers;
create trigger customers_social after insert or update of kategorien, name on public.customers
  for each row execute function public.social_kunde_abgleichen();

-- Bestehende Kunden mit der Kategorie übernehmen
insert into public.social_kunden (customer_id, name)
select c.id, coalesce(nullif(btrim(c.name), ''), 'Kunde') from public.customers c
 where (select id from public.kundenkategorien where bereich = 'social' limit 1) = any(c.kategorien)
on conflict (customer_id) do nothing;

-- ---------- Rechte (Bereich „social“)
alter table public.social_kunden enable row level security;
alter table public.social_kanaele enable row level security;
alter table public.social_auftraege enable row level security;

drop policy if exists social_kunden_lesen on public.social_kunden;
create policy social_kunden_lesen on public.social_kunden for select to authenticated using (public.darf('social'));
drop policy if exists social_kunden_aendern on public.social_kunden;
create policy social_kunden_aendern on public.social_kunden for update to authenticated
  using (public.darf('social', true)) with check (public.darf('social', true));
-- Anlegen und Löschen nur über die Kunden (Auslöser bzw. Löschen des Rechnungskunden)
revoke insert, update, delete on public.social_kunden from authenticated;
grant select, update (name, farbe, profil) on public.social_kunden to authenticated;

drop policy if exists social_kanaele_lesen on public.social_kanaele;
create policy social_kanaele_lesen on public.social_kanaele for select to authenticated using (public.darf('social'));
drop policy if exists social_kanaele_schreiben on public.social_kanaele;
create policy social_kanaele_schreiben on public.social_kanaele for all to authenticated
  using (public.darf('social', true)) with check (public.darf('social', true));
grant select, insert, update, delete on public.social_kanaele to authenticated;

drop policy if exists social_auftraege_lesen on public.social_auftraege;
create policy social_auftraege_lesen on public.social_auftraege for select to authenticated using (public.darf('social'));
drop policy if exists social_auftraege_anlegen on public.social_auftraege;
create policy social_auftraege_anlegen on public.social_auftraege for insert to authenticated
  with check (public.darf('social', true) and status = 'offen' and erstellt_von = auth.uid() and geliefert = 0 and ergebnis is null);
drop policy if exists social_auftraege_aendern on public.social_auftraege;
create policy social_auftraege_aendern on public.social_auftraege for update to authenticated
  using (public.darf('social', true)) with check (public.darf('social', true));
drop policy if exists social_auftraege_loeschen on public.social_auftraege;
create policy social_auftraege_loeschen on public.social_auftraege for delete to authenticated
  using (public.darf('social', true) and status in ('abgebrochen', 'fehler', 'fertig'));
revoke update on public.social_auftraege from authenticated;
grant select, insert, delete on public.social_auftraege to authenticated;
grant update (status, thema, hinweise) on public.social_auftraege to authenticated;   -- abbrechen, erneut anstoßen

-- Kategorie lesen dürfen auch die, die nur Social Media sehen (für „Kunde hinzufügen“)
drop policy if exists kundenkategorien_lesen on public.kundenkategorien;
create policy kundenkategorien_lesen on public.kundenkategorien for select to authenticated
  using (public.darf('kunden') or public.darf('rechnungen') or (bereich = 'social' and public.darf('social')));

-- ---------- Befehl „social“: der Agent schreibt offene Aufträge und Stilprofile ins private Repo
create or replace function public.befehl_pruefen() returns trigger language plpgsql as $$
begin
  if new.art not in ('lauf', 'bauen', 'abbrechen', 'entscheidung', 'demo_loeschen', 'brief_senden', 'brief_vorschau',
                     'bewertung', 'neubau', 'neubau_zurueck', 'regel_verwerfen', 'regel_zurueck',
                     'kunde', 'kunde_agent_zurueck', 'kunde_loeschen', 'suchgebiete', 'analyse', 'social') then
    raise exception 'Unbekannter Befehl: %', new.art;
  end if;
  return new;
end $$;
drop policy if exists befehle_lesen on public.befehle;
create policy befehle_lesen on public.befehle for select to authenticated
  using (public.darf('akquise') or (art like 'kunde%' and public.darf('kunden')) or (art = 'social' and public.darf('social')));
drop policy if exists befehle_anlegen on public.befehle;
create policy befehle_anlegen on public.befehle for insert to authenticated
  with check (status = 'offen' and erstellt_von = auth.uid()
              and case when art like 'brief%' then public.darf('briefe', true)
                       when art like 'kunde%' then public.darf('kunden', true)
                       when art = 'social' then public.darf('social', true)
                       else public.darf('akquise', true) end);

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.social_kunden'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.social_kanaele'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.social_auftraege'; exception when duplicate_object then null; end;
  end if;
end $$;
