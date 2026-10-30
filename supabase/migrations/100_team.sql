-- Medialyte-App: Team, Rollen und Rechte
-- Alle Skripte sind wiederholbar ausführbar (Deploy spielt bei jedem Push alle ein).
--
-- Grundsatz: Jede Tabelle der App ist per Row Level Security geschützt. Zugriff gibt es nur für
-- aktive Team-Mitglieder, nur mit bestätigter Zwei-Faktor-Anmeldung (aal2) und nur in den Bereichen,
-- die ihre Rolle erlaubt. Die Registrierung von außen ist abgeschaltet; neue Mitglieder lädt der Inhaber ein.

create table if not exists public.mitglieder (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  name      text not null,
  email     text,
  rolle     text not null check (rolle in ('inhaber', 'entwicklung', 'design', 'marketing', 'buchhaltung')),
  aktiv     boolean not null default true,
  erstellt  timestamptz not null default now()
);

-- Bereiche: akquise (Kategorien, Betriebe, Demos, Läufe), briefe (Versand kostet Geld), anfragen,
-- kunden, rechnungen, team, einstellungen
create table if not exists public.rechte (
  rolle     text not null,
  bereich   text not null,
  lesen     boolean not null default false,
  schreiben boolean not null default false,
  primary key (rolle, bereich)
);

-- Grundeinstellung der Rechte. Nur beim ersten Mal gesetzt; danach ändert sie der Inhaber in der App.
insert into public.rechte (rolle, bereich, lesen, schreiben) values
  ('inhaber', 'akquise', true, true), ('inhaber', 'briefe', true, true), ('inhaber', 'anfragen', true, true),
  ('inhaber', 'kunden', true, true), ('inhaber', 'rechnungen', true, true), ('inhaber', 'team', true, true),
  ('inhaber', 'einstellungen', true, true),
  ('entwicklung', 'akquise', true, true), ('entwicklung', 'anfragen', true, false), ('entwicklung', 'kunden', true, false),
  ('design', 'akquise', true, true), ('design', 'anfragen', true, false), ('design', 'kunden', true, false),
  ('marketing', 'akquise', true, true), ('marketing', 'briefe', true, true), ('marketing', 'anfragen', true, true),
  ('marketing', 'kunden', true, false),
  ('buchhaltung', 'akquise', true, false), ('buchhaltung', 'anfragen', true, false), ('buchhaltung', 'kunden', true, true),
  ('buchhaltung', 'rechnungen', true, true)
on conflict (rolle, bereich) do nothing;

-- Zwei-Faktor bestätigt? (Supabase setzt aal2 im Token nach erfolgreicher TOTP-Prüfung)
create or replace function public.zwei_faktor() returns boolean
language sql stable as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

-- Darf der angemeldete Nutzer in diesem Bereich lesen (bzw. schreiben)?
create or replace function public.darf(p_bereich text, p_schreiben boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select public.zwei_faktor() and exists (
    select 1 from public.mitglieder m join public.rechte r on r.rolle = m.rolle
    where m.user_id = auth.uid() and m.aktiv and r.bereich = p_bereich
      and (r.lesen or r.schreiben) and (not p_schreiben or r.schreiben))
$$;
revoke all on function public.darf(text, boolean) from public, anon;
grant execute on function public.darf(text, boolean) to authenticated;

-- Meine Rolle und meine Rechte (für die Oberfläche; auch vor der Zwei-Faktor-Prüfung lesbar)
create or replace function public.ich() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', m.user_id, 'name', m.name, 'email', m.email, 'rolle', m.rolle, 'aktiv', m.aktiv,
    'rechte', coalesce((select jsonb_object_agg(r.bereich, case when r.schreiben then 'schreiben' else 'lesen' end)
                        from public.rechte r where r.rolle = m.rolle and (r.lesen or r.schreiben)), '{}'::jsonb))
  from public.mitglieder m where m.user_id = auth.uid()
$$;
revoke all on function public.ich() from public, anon;
grant execute on function public.ich() to authenticated;

alter table public.mitglieder enable row level security;
alter table public.rechte enable row level security;

drop policy if exists mitglieder_lesen on public.mitglieder;
create policy mitglieder_lesen on public.mitglieder for select to authenticated
  using (user_id = auth.uid() or public.darf('team') or public.darf('akquise'));
drop policy if exists mitglieder_schreiben on public.mitglieder;
create policy mitglieder_schreiben on public.mitglieder for all to authenticated
  using (public.darf('team', true)) with check (public.darf('team', true));

drop policy if exists rechte_lesen on public.rechte;
create policy rechte_lesen on public.rechte for select to authenticated using (public.darf('team'));
drop policy if exists rechte_schreiben on public.rechte;
create policy rechte_schreiben on public.rechte for all to authenticated
  using (public.darf('team', true)) with check (public.darf('team', true));

-- Der Inhaber kann sich nicht selbst aussperren
create or replace function public.inhaber_schuetzen() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.rolle = 'inhaber')
     or (tg_op = 'UPDATE' and old.rolle = 'inhaber' and (new.rolle <> 'inhaber' or not new.aktiv)) then
    if (select count(*) from public.mitglieder where rolle = 'inhaber' and aktiv and user_id <> old.user_id) = 0 then
      raise exception 'Es muss immer mindestens ein aktiver Inhaber bleiben.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists mitglieder_inhaber on public.mitglieder;
create trigger mitglieder_inhaber before update or delete on public.mitglieder
  for each row execute function public.inhaber_schuetzen();

-- Erster Start: Das älteste bestehende Konto (Daniels Konto aus der Rechnungs-App) wird Inhaber.
insert into public.mitglieder (user_id, name, email, rolle)
select u.id, 'Daniel', u.email, 'inhaber' from auth.users u
where not exists (select 1 from public.mitglieder)
order by u.created_at limit 1
on conflict (user_id) do nothing;
