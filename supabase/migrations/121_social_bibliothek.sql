-- Social Media als kleine Creative-Bibliothek: Favoriten, eigene Uploads aus der App, Reihenfolge = Posting-Reihenfolge
--
-- • favorit: Stern an einem Creative (für alle im Team gleich)
-- • eigen / hochgeladen_von: selbst in der App hochgeladen (nicht von Claude eingespielt)
-- • Wer „social“ schreiben darf, kann Creatives anlegen und Dateien in den Ordner „eigene/“ laden
-- • Neue Creatives stellen sich hinten an: Nummer 1 in der Übersicht ist immer das, was als Nächstes gepostet wird

alter table public.social_creatives add column if not exists favorit boolean not null default false;
alter table public.social_creatives add column if not exists eigen boolean not null default false;
alter table public.social_creatives add column if not exists hochgeladen_von uuid references auth.users(id) on delete set null;

drop policy if exists social_creatives_anlegen on public.social_creatives;
create policy social_creatives_anlegen on public.social_creatives for insert to authenticated
  with check (public.darf('social', true) and eigen and hochgeladen_von = auth.uid());

drop policy if exists creatives_hochladen on storage.objects;
create policy creatives_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'creatives' and public.darf('social', true) and name like 'eigene/%');

create or replace function public.social_vorne() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.position is null then
    new.position := coalesce((select max(position) from public.social_creatives), 0) + 1;
  end if;
  new.geaendert := now();
  return new;
end $$;
