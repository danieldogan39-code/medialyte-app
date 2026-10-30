-- Ein Kundenmenü für alles: Rechnungskunden (customers) und Website-Kunden (kunden) gehören zusammen.
-- Die Verknüpfung steht beim Rechnungskunden (kunde_slug = slug der Website). Ohne Fremdschlüssel, weil der Agent die
-- Website-Kunden neu schreibt; die alte Rechnungs-App kennt die Spalte nicht und lässt sie unverändert.
alter table public.customers add column if not exists kunde_slug text;
create unique index if not exists customers_kunde_slug_idx on public.customers (kunde_slug) where kunde_slug is not null;

-- Einmalig: gleichnamige Kunden verknüpfen (nur eindeutige Treffer)
do $$
begin
  if to_regclass('public.kunden') is not null then
    update public.customers c set kunde_slug = t.slug
    from (
      select k.slug, min(c2.id::text)::uuid as cid
      from public.kunden k join public.customers c2 on lower(btrim(c2.name)) = lower(btrim(k.name))
      group by k.slug having count(*) = 1
    ) t
    where c.id = t.cid and c.kunde_slug is null
      and not exists (select 1 from public.customers x where x.kunde_slug = t.slug);
  end if;
end $$;
