-- Social Media: TikTok als Plattform (tt-video, tt-foto = Foto-Beitrag, tt-story)
alter table public.social_creatives drop constraint if exists social_creatives_plattformen_check;
alter table public.social_creatives add constraint social_creatives_plattformen_check
  check (plattformen <@ array['ig-beitrag', 'ig-story', 'fb-beitrag', 'fb-story', 'yt', 'li',
                              'gm-logo', 'gm-titel', 'gm-foto', 'gm-beitrag', 'gm-leistung',
                              'tt-video', 'tt-foto', 'tt-story']::text[]);

-- Einmalige Datenschritte merken, damit sie beim nächsten Deploy nicht wieder laufen
-- (sonst kämen z. B. Plattformen zurück, die jemand in der App abgewählt hat)
create table if not exists public.einmalig (name text primary key, erledigt timestamptz not null default now());
alter table public.einmalig enable row level security;   -- nur für Migrationen, die App liest sie nicht
insert into public.einmalig (name) values ('social-plattformen-start') on conflict do nothing;   -- 117 lief bereits

-- Bestehende Hochkant-Videos sind auch für TikTok gebaut
do $$ begin
  if not exists (select 1 from public.einmalig where name = 'social-tiktok-videos') then
    update public.social_creatives set plattformen = plattformen || array['tt-video']
    where art = 'video' and not ('tt-video' = any(plattformen));
    insert into public.einmalig (name) values ('social-tiktok-videos');
  end if;
end $$;
