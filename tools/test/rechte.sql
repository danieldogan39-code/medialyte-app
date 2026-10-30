-- Rechte-Tests. Jeder Test gibt 'OK …' aus oder bricht mit Fehler ab.
\set ON_ERROR_STOP 1
insert into public.mitglieder (user_id, name, email, rolle) values
  ('00000000-0000-0000-0000-0000000000f1', 'Finn', 'finn@example.org', 'buchhaltung'),
  ('00000000-0000-0000-0000-0000000000a1', 'Aurelia', 'aurelia@example.org', 'marketing')
on conflict do nothing;
insert into public.anfragen (extern_id, name, firma) values ('T1', 'Test Kunde', 'Testfirma') on conflict do nothing;
insert into public.betriebe (kategorie, place_id, name) values ('gastronomie', 'P1', 'Testlokal') on conflict do nothing;

create or replace function pg_temp.als(uid text, aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text, false);
end $$;

-- Inhaber wurde automatisch angelegt
do $$ begin
  if (select rolle from public.mitglieder where user_id = '00000000-0000-0000-0000-00000000000d') <> 'inhaber' then raise exception 'Inhaber fehlt'; end if;
  raise notice 'OK Inhaber automatisch angelegt';
end $$;

set role authenticated;

-- 1) Inhaber ohne Zwei-Faktor sieht nichts
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal1');
do $$ begin if (select count(*) from public.anfragen) <> 0 then raise exception 'aal1 sieht Anfragen'; end if; raise notice 'OK ohne 2FA keine Daten'; end $$;
do $$ begin if (select public.ich() ->> 'rolle') <> 'inhaber' then raise exception 'ich() falsch'; end if; raise notice 'OK ich() vor 2FA'; end $$;

-- 2) Inhaber mit 2FA sieht alles
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal2');
do $$ begin if (select count(*) from public.anfragen) <> 1 or (select count(*) from public.betriebe) <> 1 then raise exception 'Inhaber sieht nicht alles'; end if; raise notice 'OK Inhaber sieht alles'; end $$;

-- 3) Fremdes Konto (kein Mitglied) sieht nichts, auch mit 2FA
select pg_temp.als('00000000-0000-0000-0000-0000000000ff', 'aal2');
do $$ begin if (select count(*) from public.anfragen) + (select count(*) from public.betriebe) + (select count(*) from public.mitglieder) <> 0 then raise exception 'Fremder sieht Daten'; end if; raise notice 'OK Fremder sieht nichts'; end $$;
do $$ begin
  begin insert into public.anfragen (name) values ('x'); raise exception 'Fremder durfte anlegen';
  exception when insufficient_privilege then raise notice 'OK Fremder darf nichts anlegen'; end;
end $$;

-- 4) Buchhaltung: Anfragen lesen, nicht ändern; Akquise lesen, nicht ändern; keine Briefe-Befehle
select pg_temp.als('00000000-0000-0000-0000-0000000000f1', 'aal2');
do $$ declare n int; begin
  if (select count(*) from public.anfragen) <> 1 then raise exception 'Buchhaltung sieht Anfragen nicht'; end if;
  update public.anfragen set status = 'spam'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Buchhaltung durfte Anfrage ändern'; end if;
  update public.betriebe set notiz = 'x'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Buchhaltung durfte Betrieb ändern'; end if;
  begin insert into public.befehle (art) values ('brief_senden'); raise exception 'Buchhaltung durfte Brief senden';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.rechte) <> 0 then raise exception 'Buchhaltung sieht Rechte-Tabelle'; end if;
  raise notice 'OK Buchhaltung nur lesend bei Anfragen/Akquise';
end $$;

-- 5) Marketing: Anfragen bearbeiten, Briefe-Befehl anlegen, Team nicht ändern
select pg_temp.als('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ declare n int; begin
  update public.anfragen set status = 'in_arbeit'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'Marketing darf Anfrage nicht bearbeiten'; end if;
  insert into public.befehle (art, ziel) values ('brief_senden', 'x');
  update public.mitglieder set rolle = 'inhaber' where user_id = auth.uid(); get diagnostics n = row_count;
  if n <> 0 then raise exception 'Marketing konnte sich zum Inhaber machen'; end if;
  begin insert into public.befehle (art, status) values ('wochenlauf', 'erledigt'); raise exception 'Befehl mit falschem Status';
  exception when insufficient_privilege then null; end;
  raise notice 'OK Marketing bearbeitet Anfragen, kann sich keine Rechte geben';
end $$;

-- 6) Inhaber kann sich nicht selbst aussperren
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal2');
do $$ begin
  begin update public.mitglieder set aktiv = false where user_id = auth.uid(); raise exception 'Inhaber ausgesperrt';
  exception when raise_exception then
    if sqlerrm like 'Es muss immer%' then raise notice 'OK letzter Inhaber geschützt'; else raise; end if;
  end;
end $$;

-- 7) anon sieht gar nichts
reset role; set role anon;
do $$ begin
  begin perform count(*) from public.anfragen; if (select count(*) from public.anfragen) > 0 then raise exception 'anon sieht Anfragen'; end if;
  exception when insufficient_privilege then null; end;
  raise notice 'OK anon sieht nichts';
end $$;
reset role;
select public.kategorie_raten('Tischlerei') = 'handwerk' and public.kategorie_raten('Pizzeria Roma') = 'gastronomie' as kategorie_raten_ok;
