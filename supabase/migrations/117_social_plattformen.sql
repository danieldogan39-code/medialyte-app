-- Social Media: Für welche Plattform und welchen Platz ist ein Creative gebaut?
-- ig-beitrag, ig-story (Instagram), fb-beitrag, fb-story (Facebook), yt (YouTube), li (LinkedIn)
alter table public.social_creatives add column if not exists plattformen text[] not null default '{}';
alter table public.social_creatives drop constraint if exists social_creatives_plattformen_check;
alter table public.social_creatives add constraint social_creatives_plattformen_check
  check (plattformen <@ array['ig-beitrag', 'ig-story', 'fb-beitrag', 'fb-story', 'yt', 'li']::text[]);

-- Bestehende Creatives einmalig zuordnen: Hochkant-Videos (9:16) passen als Beitrag und Story auf Instagram
-- und Facebook sowie als YouTube Short; Bilder im Format 3:4 sind Instagram- und Facebook-Beiträge.
update public.social_creatives set plattformen = case
    when art = 'video' then array['ig-beitrag', 'ig-story', 'fb-beitrag', 'fb-story', 'yt']
    else array['ig-beitrag', 'fb-beitrag'] end
where plattformen = '{}';
