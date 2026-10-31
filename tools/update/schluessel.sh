#!/usr/bin/env bash
# Schlüssel für automatische Updates holen (und beim allerersten Lauf erzeugen).
# Sie liegen geschützt in der Supabase-Datenbank (Schema „private“, nur mit Server-Zugang lesbar), nie im Repository.
#   bash tools/update/schluessel.sh               → VITE_UPDATE_SCHLUESSEL (öffentlich, für die App)
#   bash tools/update/schluessel.sh oberflaeche   → zusätzlich OBERFLAECHE_PRIVAT (Oberflächen-Pakete signieren)
#   bash tools/update/schluessel.sh programm      → zusätzlich TAURI_SIGNING_PRIVATE_KEY(_PASSWORD), TAURI_UPDATER_PUBKEY
# Benötigt SUPABASE_ACCESS_TOKEN, PROJECT_REF, node (und für „programm“ npm ci in app/).
set -euo pipefail
WAS="${1:-}"
DIR="$(cd "$(dirname "$0")" && pwd)"
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "::error::Secret SUPABASE_ACCESS_TOKEN fehlt."; exit 1; }
q() {
  jq -n --arg q "$1" '{query: $q}' > "$RUNNER_TEMP/uq.json"
  curl -sS --fail-with-body -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @"$RUNNER_TEMP/uq.json"
}
q "create schema if not exists private;
   revoke all on schema private from public, anon, authenticated;
   create table if not exists private.update_schluessel (name text primary key, privat text not null, passwort text,
     oeffentlich text not null, erstellt timestamptz not null default now());
   revoke all on private.update_schluessel from public, anon, authenticated;" > /dev/null
hol() { q "select privat, coalesce(passwort, '') as passwort, oeffentlich from private.update_schluessel where name = '$1'" > "$RUNNER_TEMP/uk.json"; jq 'length' "$RUNNER_TEMP/uk.json"; }

# Oberflächen-Pakete (Android): ECDSA P-256
if [ "$(hol oberflaeche)" = "0" ]; then
  node "$DIR/oberflaeche.mjs" neu > "$RUNNER_TEMP/neu.json"
  q "insert into private.update_schluessel (name, privat, oeffentlich) values ('oberflaeche', \$k\$$(jq -r .privat "$RUNNER_TEMP/neu.json")\$k\$, \$p\$$(jq -r .oeffentlich "$RUNNER_TEMP/neu.json")\$p\$) on conflict (name) do nothing" > /dev/null
  rm -f "$RUNNER_TEMP/neu.json"; hol oberflaeche > /dev/null; echo "Neuer Schlüssel für Oberflächen-Updates angelegt."
fi
echo "VITE_UPDATE_SCHLUESSEL=$(jq -r '.[0].oeffentlich' "$RUNNER_TEMP/uk.json")" >> "$GITHUB_ENV"
if [ "$WAS" = "oberflaeche" ]; then
  P=$(jq -r '.[0].privat' "$RUNNER_TEMP/uk.json"); echo "::add-mask::$P"; echo "OBERFLAECHE_PRIVAT=$P" >> "$GITHUB_ENV"
fi

# Programm-Updates (Mac/Windows): Tauri-Signatur
if [ "$WAS" = "programm" ]; then
  if [ "$(hol programm)" = "0" ]; then
    PASS=$(openssl rand -hex 24); echo "::add-mask::$PASS"
    (cd "$DIR/../../app" && npx tauri signer generate --ci -f -p "$PASS" -w "$RUNNER_TEMP/tauri.key" > /dev/null)
    q "insert into private.update_schluessel (name, privat, passwort, oeffentlich) values ('programm', \$k\$$(cat "$RUNNER_TEMP/tauri.key")\$k\$, \$w\$${PASS}\$w\$, \$p\$$(cat "$RUNNER_TEMP/tauri.key.pub")\$p\$) on conflict (name) do nothing" > /dev/null
    rm -f "$RUNNER_TEMP/tauri.key" "$RUNNER_TEMP/tauri.key.pub"; hol programm > /dev/null; echo "Neuer Schlüssel für Programm-Updates angelegt."
  fi
  K=$(jq -r '.[0].privat' "$RUNNER_TEMP/uk.json"); W=$(jq -r '.[0].passwort' "$RUNNER_TEMP/uk.json")
  echo "::add-mask::$K"; echo "::add-mask::$W"
  { echo "TAURI_SIGNING_PRIVATE_KEY=$K"; echo "TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$W"; echo "TAURI_UPDATER_PUBKEY=$(jq -r '.[0].oeffentlich' "$RUNNER_TEMP/uk.json")"; } >> "$GITHUB_ENV"
fi
rm -f "$RUNNER_TEMP/uk.json" "$RUNNER_TEMP/uq.json"
