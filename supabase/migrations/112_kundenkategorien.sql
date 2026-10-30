-- Kunden selbst kategorisieren: eigene Kategorien (Name, Farbe, Reihenfolge), je Kunde beliebig viele.
create table if not exists public.kundenkategorien (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 40),
  farbe      text not null default '#8B98AD' check (farbe ~ '^#[0-9A-Fa-f]{6}$'),
  sortierung int  not null default 0,
  erstellt   timestamptz not null default now()
);
create unique index if not exists kundenkategorien_name_idx on public.kundenkategorien (lower(btrim(name)));
alter table public.kundenkategorien enable row level security;
drop policy if exists kundenkategorien_lesen on public.kundenkategorien;
create policy kundenkategorien_lesen on public.kundenkategorien for select to authenticated
  using (public.darf('kunden') or public.darf('rechnungen'));
drop policy if exists kundenkategorien_schreiben on public.kundenkategorien;
create policy kundenkategorien_schreiben on public.kundenkategorien for all to authenticated
  using (public.darf('kunden', true) or public.darf('rechnungen', true))
  with check (public.darf('kunden', true) or public.darf('rechnungen', true));
grant select, insert, update, delete on public.kundenkategorien to authenticated;

alter table public.customers add column if not exists kategorien uuid[] not null default '{}';

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.kundenkategorien'; exception when others then null; end;
end $$;

-- Startkategorien (nur beim allerersten Mal; danach bestimmst du sie selbst)
insert into public.kundenkategorien (name, farbe, sortierung)
select * from (values ('Website', '#6FA8F0', 10), ('Werbung', '#E7B94A', 20), ('Kundenmanagement', '#4CC38A', 30), ('Design & Logo', '#A78BFA', 40)) v(name, farbe, sortierung)
where not exists (select 1 from public.kundenkategorien);

-- Aktan GmbH (Juwelier Rubin) ist Website-Kunde: www.rubin-gold.de
do $$
declare
  web uuid := (select id from public.kundenkategorien where lower(name) = 'website' limit 1);
  firma uuid := coalesce((select user_id from public.settings order by updated_at asc limit 1),
                         (select user_id from public.mitglieder where rolle = 'inhaber' order by user_id limit 1));
begin
  if web is null then return; end if;
  update public.customers
     set website = coalesce(nullif(btrim(website), ''), 'rubin-gold.de'),
         kategorien = (select array_agg(distinct x) from unnest(kategorien || web) x)
   where (name ilike '%aktan%' or name ilike '%rubin%') and not (web = any(kategorien));
  if not exists (select 1 from public.customers where name ilike '%aktan%' or name ilike '%rubin%') and firma is not null then
    insert into public.customers (user_id, name, website, kategorien) values (firma, 'Aktan GmbH', 'rubin-gold.de', array[web]);
  end if;
end $$;
