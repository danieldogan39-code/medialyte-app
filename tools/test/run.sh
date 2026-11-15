#!/bin/bash
# Lokaler Test der Datenbank: Supabase-Nachbildung, bestehende Rechnungs-Migrationen, App-Migrationen (zweimal), Rechte-Tests
set -e
H=/var/tmp/mlpg; P="psql -h $H -p 5499 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists mltest" -c "create database mltest"
P="$P -d mltest"
$P -f "$(dirname $0)/shim.sql"
for f in ${RECHNUNGEN:-/home/claude/rechnungen/supabase/migrations}/*.sql; do $P -f "$f" >/dev/null; done
for i in 1 2; do for f in "$(dirname $0)"/../../supabase/migrations/*.sql; do $P -f "$f" >/dev/null; done; done
$P -f "$(dirname $0)/rechte.sql"
# Der iCal-Leser steckt zweimal drin (Cloud-Funktion und App für .ics-Dateien): beide müssen gleich sein
tail -n +2 "$(dirname $0)/../../app/src/lib/organizer/ics.ts" | cmp -s - "$(dirname $0)/../../supabase/functions/kalender/ics.ts" && echo "OK iCal-Leser in App und Cloud-Funktion gleich" || { echo "FEHLER: app/src/lib/organizer/ics.ts weicht von supabase/functions/kalender/ics.ts ab"; exit 1; }
