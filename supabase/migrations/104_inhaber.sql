-- Medialyte-App: Der Inhaber ist geschützt
-- - Einen Inhaber kann niemand außer ihm selbst ändern, sperren oder entfernen (auch nicht, wer Team-Rechte hat).
-- - Zum Inhaber machen kann nur ein Inhaber.
-- - Die Rechte der Rolle „Inhaber“ sind fest (alles).
-- Serverseitige Abläufe (Cloud-Funktionen mit vollem Zugriff) prüfen das selbst, siehe functions/team.

create or replace function public.ist_inhaber() returns boolean
language sql stable security definer set search_path = public as $$
  select public.zwei_faktor() and exists (
    select 1 from public.mitglieder where user_id = auth.uid() and rolle = 'inhaber' and aktiv)
$$;
revoke all on function public.ist_inhaber() from public, anon;
grant execute on function public.ist_inhaber() to authenticated;

-- bewusst ohne security definer: current_user muss die Rolle des Aufrufers zeigen
create or replace function public.inhaber_unantastbar() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return coalesce(new, old); end if;   -- Server prüft selbst
  if tg_op in ('UPDATE', 'DELETE') and old.rolle = 'inhaber' and old.user_id is distinct from auth.uid() then
    raise exception 'Den Inhaber kann nur er selbst ändern.';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.rolle = 'inhaber' and (tg_op = 'INSERT' or old.rolle <> 'inhaber') and not public.ist_inhaber() then
    raise exception 'Zum Inhaber machen kann nur ein Inhaber.';
  end if;
  return coalesce(new, old);
end $$;
-- Name mit „0“: Trigger laufen alphabetisch, dieser zuerst (klarere Meldung als „letzter Inhaber“)
drop trigger if exists mitglieder_0_inhaber_unantastbar on public.mitglieder;
create trigger mitglieder_0_inhaber_unantastbar before insert or update or delete on public.mitglieder
  for each row execute function public.inhaber_unantastbar();

create or replace function public.inhaber_rechte_fest() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and coalesce(new.rolle, old.rolle) = 'inhaber' then
    raise exception 'Der Inhaber hat immer alle Rechte.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists rechte_inhaber_fest on public.rechte;
create trigger rechte_inhaber_fest before insert or update or delete on public.rechte
  for each row execute function public.inhaber_rechte_fest();
