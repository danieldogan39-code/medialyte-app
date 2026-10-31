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
  begin insert into public.befehle (art, status) values ('lauf', 'erledigt'); raise exception 'Befehl mit falschem Status';
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

-- 8) Agenten-Schalter: Inhaber schaltet, Marketing nicht; nur „aktiv“ ist änderbar
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal2');
do $$ declare n int; begin
  update public.agenten set aktiv = false where schluessel = 'nachfass'; get diagnostics n = row_count;
  if n <> 1 or (select geaendert_von from public.agenten where schluessel = 'nachfass') <> auth.uid() then raise exception 'Inhaber kann nicht schalten'; end if;
  begin update public.agenten set name = 'x' where schluessel = 'nachfass'; raise exception 'Name änderbar';
  exception when insufficient_privilege then null; end;
  raise notice 'OK Inhaber schaltet Agenten';
end $$;
select pg_temp.als('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ declare n int; begin
  if (select count(*) from public.agenten) = 0 then raise exception 'Marketing sieht Agenten nicht'; end if;
  update public.agenten set aktiv = true; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Marketing durfte schalten'; end if;
  raise notice 'OK Marketing sieht Agenten, schaltet nicht';
end $$;
reset role;
do $$ begin
  if (select count(*) from public.kategorien where aktiv) <> 1 then raise exception 'Kategorien-Start falsch'; end if;
  raise notice 'OK nur Gastronomie startet aktiv';
end $$;

-- 9) Inhaber geschützt: Ein Mitglied mit Team-Rechten kann den Inhaber nicht ändern und niemanden zum Inhaber machen
insert into public.rechte (rolle, bereich, lesen, schreiben) values ('marketing', 'team', true, true)
  on conflict (rolle, bereich) do update set lesen = true, schreiben = true;
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin
  begin update public.mitglieder set aktiv = false where rolle = 'inhaber'; raise exception 'Inhaber gesperrt durch Marketing';
  exception when raise_exception then if sqlerrm not like 'Den Inhaber kann nur er selbst%' then raise; end if; end;
  begin update public.mitglieder set rolle = 'inhaber' where user_id = '00000000-0000-0000-0000-0000000000f1'; raise exception 'Marketing machte Inhaber';
  exception when raise_exception then if sqlerrm not like 'Zum Inhaber machen kann nur%' then raise; end if; end;
  begin update public.rechte set schreiben = false where rolle = 'inhaber' and bereich = 'team'; raise exception 'Inhaber-Rechte geändert';
  exception when raise_exception then if sqlerrm not like 'Der Inhaber hat immer%' then raise; end if; end;
  raise notice 'OK Inhaber unantastbar für andere';
end $$;
-- Der Inhaber selbst darf seinen Namen ändern
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal2');
do $$ declare n int; begin
  update public.mitglieder set name = 'Daniel' where user_id = auth.uid(); get diagnostics n = row_count;
  if n <> 1 then raise exception 'Inhaber kann sich nicht ändern'; end if;
  raise notice 'OK Inhaber ändert sich selbst';
end $$;
reset role;

-- 10) Befehle: nur bekannte Arten
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal2');
do $$ begin
  insert into public.befehle (art, ziel) values ('entscheidung', 'P1');
  begin insert into public.befehle (art) values ('rm -rf'); raise exception 'unbekannter Befehl angenommen';
  exception when raise_exception then if sqlerrm not like 'Unbekannter Befehl%' then raise; end if; end;
  raise notice 'OK nur bekannte Befehle';
end $$;
reset role;

-- 11) Geheimnisse: für niemanden in der App lesbar, auch nicht für den Inhaber
insert into public.geheim (name, wert) values ('test', '{"x": 1}') on conflict do nothing;
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal2');
do $$ begin
  begin perform 1 from public.geheim; raise exception 'Geheimnis lesbar';
  exception when insufficient_privilege then raise notice 'OK Geheimnisse nicht lesbar'; end;
  insert into public.nachfass (slug, status) values ('test-demo', 'rueckruf');
  raise notice 'OK Nachfassen schreibbar';
end $$;
reset role;

-- 12) Kunden: lesen mit Kunden-Recht, Tischbuch-Link und Aufträge nur mit Schreibrecht
insert into public.kunden (slug, name) values ('test-kunde', 'Test') on conflict do nothing;
insert into public.kunden_zugang (slug, tischbuch) values ('test-kunde', 'https://x/#k=geheim') on conflict do nothing;
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ declare n int; begin
  select count(*) into n from public.kunden; if n <> 1 then raise exception 'Marketing sieht Kunden nicht'; end if;
  select count(*) into n from public.kunden_zugang; if n <> 0 then raise exception 'Marketing sieht Tischbuch-Link'; end if;
  begin insert into public.befehle (art, ziel) values ('kunde', 'test-kunde'); raise exception 'Marketing darf Kunden-Auftrag';
  exception when insufficient_privilege then null; end;
  raise notice 'OK Kunden nur lesen für Marketing';
end $$;
select pg_temp.als('00000000-0000-0000-0000-0000000000f1', 'aal2');
do $$ declare n int; begin
  select count(*) into n from public.kunden_zugang; if n <> 1 then raise exception 'Buchhaltung sieht Tischbuch-Link nicht'; end if;
  insert into public.befehle (art, ziel, daten) values ('kunde', 'test-kunde', '{"art": "vorschau"}');
  begin insert into public.befehle (art) values ('lauf'); raise exception 'Buchhaltung darf Lauf starten';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.befehle where art = 'kunde'; if n <> 1 then raise exception 'Kunden-Auftrag nicht lesbar'; end if;
  raise notice 'OK Kunden-Aufträge für Buchhaltung';
end $$;
reset role;

-- 13) Cockpit-Daten: Akquise liest, Buchhaltung ohne Akquise-Lesen? (hat lesen) – Befehle suchgebiete/analyse bekannt
insert into public.agent_daten (name, daten) values ('cockpit', '{"x": 1}') on conflict do nothing;
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal2');
do $$ declare n int; begin
  select count(*) into n from public.agent_daten; if n <> 1 then raise exception 'Cockpit-Daten nicht lesbar'; end if;
  insert into public.befehle (art, daten) values ('suchgebiete', '{"liste": []}'), ('analyse', '{}');
  raise notice 'OK Cockpit-Daten und neue Befehle';
end $$;
reset role;

-- 14) Rechnungen im Team: Daten gehören dem Firmenkonto; Buchhaltung liest/schreibt, Marketing sieht nichts
insert into public.settings (user_id, company) values ('00000000-0000-0000-0000-00000000000d', '{"name": "Medialyte"}') on conflict do nothing;
delete from public.customers where name = 'Aktan GmbH';   -- Datenpflege aus 112, für den Test ohne Belang
insert into public.customers (user_id, name) values ('00000000-0000-0000-0000-00000000000d', 'Testkunde');
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-0000000000f1', 'aal2');
do $$ declare n int; c uuid; begin
  select count(*) into n from public.customers; if n <> 1 then raise exception 'Buchhaltung sieht Rechnungskunden nicht (%)', n; end if;
  insert into public.customers (name) values ('Neu von Finn') returning id into c;
  if (select user_id from public.customers where id = c) <> '00000000-0000-0000-0000-00000000000d' then raise exception 'Neuer Kunde gehört nicht dem Firmenkonto'; end if;
  insert into public.invoices (customer_id, status) values (c, 'draft');
  begin insert into public.invoices (customer_id, status, number) values (c, 'open', 'RE1'); raise exception 'ausgestellte Rechnung direkt angelegt';
  exception when insufficient_privilege then null; end;
  raise notice 'OK Rechnungen für Buchhaltung';
end $$;
-- 14b) Einzelne Rechnungen löschen: Entwurf, offene Rechnung und Original mit Storno/Ersatzrechnung
reset role;
do $$ declare c uuid; o uuid; begin
  select id into c from public.customers where name = 'Testkunde';
  insert into public.invoices (user_id, customer_id, status, number, issue_date) values ('00000000-0000-0000-0000-00000000000d', c, 'open', 'L-1', current_date);
  insert into public.invoices (user_id, customer_id, status, number, issue_date) values ('00000000-0000-0000-0000-00000000000d', c, 'cancelled', 'L-2', current_date) returning id into o;
  insert into public.invoices (user_id, customer_id, status, kind, number, issue_date, ref_invoice_id) values ('00000000-0000-0000-0000-00000000000d', c, 'paid', 'storno', 'L-3', current_date, o);
  insert into public.invoices (user_id, customer_id, status, number, issue_date, ref_invoice_id) values ('00000000-0000-0000-0000-00000000000d', c, 'open', 'L-4', current_date, o);
  insert into public.invoices (user_id, customer_id, status) values ('00000000-0000-0000-0000-00000000000d', c, 'draft');
end $$;
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ declare n int; begin
  delete from public.invoices where number like 'L-%'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Marketing konnte Rechnungen löschen'; end if;
end $$;
select pg_temp.als('00000000-0000-0000-0000-0000000000f1', 'aal2');
do $$ declare n int; begin
  delete from public.invoices where number = 'L-1'; get diagnostics n = row_count; if n <> 1 then raise exception 'offene Rechnung nicht gelöscht'; end if;
  delete from public.invoices where number = 'L-2'; get diagnostics n = row_count; if n <> 1 then raise exception 'stornierte Rechnung nicht gelöscht'; end if;
  if (select ref_invoice_id from public.invoices where number = 'L-4') is not null then raise exception 'Bezug der Ersatzrechnung nicht geleert'; end if;
  delete from public.invoices where number = 'L-3'; get diagnostics n = row_count; if n <> 1 then raise exception 'Stornorechnung nicht gelöscht'; end if;
  delete from public.invoices where status = 'draft'; get diagnostics n = row_count; if n < 1 then raise exception 'Entwurf nicht gelöscht'; end if;
  begin update public.invoices set notes = 'x' where number = 'L-4'; raise exception 'ausgestellte Rechnung geändert';
  exception when raise_exception then if sqlerrm not like 'Ausgestellte%' then raise; end if; end;
  raise notice 'OK einzelne Rechnungen löschen';
end $$;
select pg_temp.als('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ declare n int; begin
  select count(*) into n from public.customers; if n <> 0 then raise exception 'Marketing sieht Rechnungskunden'; end if;
  select count(*) into n from public.invoices; if n <> 0 then raise exception 'Marketing sieht Rechnungen'; end if;
  raise notice 'OK Rechnungen für Marketing gesperrt';
end $$;
-- ohne Zwei-Faktor (alte Rechnungs-App): nur die eigenen Daten wie bisher
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal1');
do $$ declare n int; begin
  select count(*) into n from public.customers; if n <> 2 then raise exception 'Inhaber ohne 2FA sieht eigene Daten nicht (%)', n; end if;
  raise notice 'OK alte Rechnungs-App läuft weiter';
end $$;
select pg_temp.als('00000000-0000-0000-0000-0000000000f1', 'aal1');
do $$ declare n int; begin
  select count(*) into n from public.customers; if n <> 0 then raise exception 'ohne 2FA sichtbar'; end if;
  raise notice 'OK ohne Zwei-Faktor kein Team-Zugriff';
end $$;
reset role;

-- 15) Kundenkategorien: wer Rechnungen oder Kunden schreiben darf, pflegt sie; Kunden bekommen beliebig viele
reset role;
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-0000000000f1', 'aal2');
do $$ declare k uuid; begin
  insert into public.kundenkategorien (name, farbe) values ('Stammkunde', '#123456') returning id into k;
  update public.customers set kategorien = kategorien || k where name = 'Testkunde';
  if not exists (select 1 from public.customers where k = any(kategorien)) then raise exception 'Kategorie nicht am Kunden'; end if;
  begin insert into public.kundenkategorien (name, farbe) values ('x', 'rot'); raise exception 'ungültige Farbe angenommen';
  exception when check_violation then null; end;
  raise notice 'OK Kundenkategorien';
end $$;
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal1');
do $$ begin
  if exists (select 1 from public.kundenkategorien) then raise exception 'Kategorien ohne Zwei-Faktor sichtbar'; end if;
  raise notice 'OK Kundenkategorien nur mit Zwei-Faktor';
end $$;
reset role;

-- Social Media: Marketing sieht und ändert Creatives, Buchhaltung sieht nichts, ohne Zwei-Faktor nichts; Anlegen nur per Server
insert into public.social_creatives (slug, titel, art, status) values ('test-a', 'Test A', 'bild', 'pruefen'), ('test-b', 'Test B', 'video', 'freigegeben');
do $$ begin
  if (select position from public.social_creatives where slug = 'test-b') >= (select position from public.social_creatives where slug = 'test-a') then raise exception 'neues Creative nicht oben'; end if;
  if (select count(*) from storage.buckets where id = 'creatives' and not public) <> 1 then raise exception 'Speicher fehlt oder öffentlich'; end if;
  raise notice 'OK Creatives: Reihenfolge und privater Speicher';
end $$;
set role authenticated;
select pg_temp.als('00000000-0000-0000-0000-0000000000a1', 'aal2');
do $$ begin
  if (select count(*) from public.social_creatives) <> 2 then raise exception 'Marketing sieht Creatives nicht'; end if;
  update public.social_creatives set status = 'freigegeben', geplant = '2026-11-03', position = 5 where slug = 'test-a';
  if (select status from public.social_creatives where slug = 'test-a') <> 'freigegeben' then raise exception 'Marketing kann nicht freigeben'; end if;
  update public.social_plan set inhalt = inhalt || '{"idee":"x"}'::jsonb where id = 1;
  if (select inhalt->>'idee' from public.social_plan) <> 'x' then raise exception 'Plan nicht änderbar'; end if;
  begin insert into public.social_creatives (slug, titel, art) values ('x', 'x', 'bild'); raise exception 'Marketing durfte anlegen';
  exception when insufficient_privilege then null; end;
  raise notice 'OK Social für Marketing';
end $$;
select pg_temp.als('00000000-0000-0000-0000-0000000000f1', 'aal2');
do $$ begin
  if exists (select 1 from public.social_creatives) or exists (select 1 from public.social_plan) then raise exception 'Buchhaltung sieht Social'; end if;
  update public.social_creatives set status = 'verworfen';
  if exists (select 1 from public.social_creatives where status = 'verworfen') then raise exception 'Buchhaltung konnte ändern'; end if;
  raise notice 'OK Social nicht für Buchhaltung';
end $$;
select pg_temp.als('00000000-0000-0000-0000-00000000000d', 'aal1');
do $$ begin
  if exists (select 1 from public.social_creatives) then raise exception 'Creatives ohne Zwei-Faktor sichtbar'; end if;
  raise notice 'OK Social nur mit Zwei-Faktor';
end $$;
reset role;

-- Plattformen: nur bekannte Plätze erlaubt
do $$ begin
  update public.social_creatives set plattformen = array['ig-story', 'li', 'gm-foto'] where slug = 'test-a';
  begin update public.social_creatives set plattformen = array['tiktok'] where slug = 'test-a'; raise exception 'unbekannte Plattform angenommen';
  exception when check_violation then null; end;
  raise notice 'OK Plattformen';
end $$;

-- TikTok: Daten-Schritt läuft nur einmal (später angelegte oder geänderte Creatives bleiben, wie sie sind)
\ir ../../supabase/migrations/119_social_tiktok.sql
do $$ begin
  if not exists (select 1 from public.einmalig where name = 'social-tiktok-videos') then raise exception 'Marker fehlt'; end if;
  if exists (select 1 from public.social_creatives where slug = 'test-b' and 'tt-video' = any(plattformen)) then raise exception 'Daten-Schritt lief erneut'; end if;
  update public.social_creatives set plattformen = array['tt-video', 'tt-story'] where slug = 'test-b';
  raise notice 'OK TikTok und einmalige Schritte';
end $$;

-- Alle Migrationen lassen sich erneut einspielen, auch wenn schon Google- und TikTok-Plätze vergeben sind
update public.social_creatives set plattformen = array['gm-foto', 'tt-video'] where slug = 'test-b';
\ir ../../supabase/migrations/117_social_plattformen.sql
\ir ../../supabase/migrations/118_social_google.sql
\ir ../../supabase/migrations/119_social_tiktok.sql
do $$ begin raise notice 'OK Migrationen wiederholbar'; end $$;
