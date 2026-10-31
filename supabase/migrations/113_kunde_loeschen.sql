-- Kunden löschen: neuer Befehl „kunde_loeschen“ (der Agent baut die Website ab und entfernt den Kunden)
create or replace function public.befehl_pruefen() returns trigger language plpgsql as $$
begin
  if new.art not in ('lauf', 'bauen', 'abbrechen', 'entscheidung', 'demo_loeschen', 'brief_senden', 'brief_vorschau',
                     'bewertung', 'neubau', 'neubau_zurueck', 'regel_verwerfen', 'regel_zurueck',
                     'kunde', 'kunde_agent_zurueck', 'kunde_loeschen', 'suchgebiete', 'analyse') then
    raise exception 'Unbekannter Befehl: %', new.art;
  end if;
  return new;
end $$;
