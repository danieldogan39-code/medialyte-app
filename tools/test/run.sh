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
