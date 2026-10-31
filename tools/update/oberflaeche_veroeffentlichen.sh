#!/usr/bin/env bash
# Nach dem Bauen der Oberfläche: Paket für die Android-App schnüren, signieren und im Release „aktualisierung“ ablegen.
# Die App holt das Manifest aus dem Text dieses Releases (api.github.com, ohne Anmeldung) und das Paket als Datei.
set -euo pipefail
V="$(jq -r .version app/package.json)-${GITHUB_RUN_NUMBER}"
rm -rf "$RUNNER_TEMP/oberflaeche"; cp -r app/dist "$RUNNER_TEMP/oberflaeche"
# wie in der APK: Firebase-Konfiguration vorhanden → Benachrichtigungen an
if jq -e '.client[0].client_info.android_client_info.package_name == "de.medialyte.app"' mobile/android/app/google-services.json > /dev/null 2>&1; then
  echo '{"an":true}' > "$RUNNER_TEMP/oberflaeche/fcm.json"
fi
node tools/update/oberflaeche.mjs paket "$RUNNER_TEMP/oberflaeche" "$RUNNER_TEMP/oberflaeche-$V.zip" "$V" > "$RUNNER_TEMP/manifest.json"
gh release view aktualisierung > /dev/null 2>&1 || gh release create aktualisierung --prerelease --title "Automatische Updates" \
  --notes "{}" --latest=false || true
gh release upload aktualisierung "$RUNNER_TEMP/oberflaeche-$V.zip" --clobber
gh release edit aktualisierung --notes-file "$RUNNER_TEMP/manifest.json"
# ältere Pakete aufräumen (die letzten fünf bleiben)
gh release view aktualisierung --json assets -q '.assets[] | select(.name | startswith("oberflaeche-")) | [.createdAt, .name] | @tsv' \
  | sort -r | tail -n +6 | cut -f2 | while read -r alt; do gh release delete-asset aktualisierung "$alt" -y || true; done
echo "Oberfläche $V veröffentlicht ($(du -h "$RUNNER_TEMP/oberflaeche-$V.zip" | cut -f1))."
