-- Social Media: Für welche Plattform und welchen Platz ist ein Creative gebaut?
-- ig-beitrag, ig-story (Instagram), fb-beitrag, fb-story (Facebook), yt (YouTube), li (LinkedIn)
alter table public.social_creatives add column if not exists plattformen text[] not null default '{}';
-- Erlaubte Plätze: Prüfregel social_creatives_plattformen_check, festgelegt in der jeweils neuesten Migration (119)

-- Bestehende Creatives einmalig zuordnen: Hochkant-Videos (9:16) passen als Beitrag und Story auf Instagram
-- und Facebook sowie als YouTube Short; Bilder im Format 3:4 sind Instagram- und Facebook-Beiträge.
-- (Nur solange 119 die Tabelle public.einmalig noch nicht angelegt hat; danach nie wieder.)
do $$ begin
  if to_regclass('public.einmalig') is null then
    update public.social_creatives set plattformen = case
        when art = 'video' then array['ig-beitrag', 'ig-story', 'fb-beitrag', 'fb-story', 'yt']
        else array['ig-beitrag', 'fb-beitrag'] end
    where plattformen = '{}';
  end if;
end $$;
