-- Social Media: Google-Unternehmensprofil (Google Maps) als weitere Plattform
-- gm-logo, gm-titel (Titelbild), gm-foto, gm-beitrag (Updates), gm-leistung (Produkte/Leistungen)
alter table public.social_creatives drop constraint if exists social_creatives_plattformen_check;
alter table public.social_creatives add constraint social_creatives_plattformen_check
  check (plattformen <@ array['ig-beitrag', 'ig-story', 'fb-beitrag', 'fb-story', 'yt', 'li',
                              'gm-logo', 'gm-titel', 'gm-foto', 'gm-beitrag', 'gm-leistung']::text[]);
