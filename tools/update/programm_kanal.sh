#!/usr/bin/env bash
# Nach dem Bauen von Mac und Windows: latest.json für den Tauri-Updater schreiben und im Release „aktualisierung“ ablegen.
set -euo pipefail
V=$(jq -r .version app/src-tauri/tauri.conf.json); TAG="app-v$V"
gh release view "$TAG" --json assets -q '.assets[].name' > "$RUNNER_TEMP/namen"
MAC=$(grep -E '\.app\.tar\.gz$' "$RUNNER_TEMP/namen" | head -1 || true)
WIN=$(grep -E -- '-setup\.exe$' "$RUNNER_TEMP/namen" | head -1 || true)
[ -n "$MAC" ] && [ -n "$WIN" ] || { echo "::error::Update-Dateien fehlen im Release $TAG"; cat "$RUNNER_TEMP/namen"; exit 1; }
mkdir -p "$RUNNER_TEMP/sig"; gh release download "$TAG" -p "$MAC.sig" -p "$WIN.sig" -D "$RUNNER_TEMP/sig" --clobber
B="https://github.com/$GITHUB_REPOSITORY/releases/download/$TAG"
jq -n --arg v "$V" --arg ms "$(cat "$RUNNER_TEMP/sig/$MAC.sig")" --arg mu "$B/$MAC" --arg ws "$(cat "$RUNNER_TEMP/sig/$WIN.sig")" --arg wu "$B/$WIN" \
  --arg d "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{version: $v, notes: "Medialyte \($v)", pub_date: $d, platforms: {
     "darwin-aarch64": {signature: $ms, url: $mu}, "darwin-x86_64": {signature: $ms, url: $mu},
     "windows-x86_64": {signature: $ws, url: $wu}}}' > "$RUNNER_TEMP/latest.json"
gh release view aktualisierung > /dev/null 2>&1 || gh release create aktualisierung --prerelease --title "Automatische Updates" \
  --notes "{}" --latest=false || true
gh release upload aktualisierung "$RUNNER_TEMP/latest.json" --clobber
echo "Programm-Update $V bereitgestellt (Mac: $MAC, Windows: $WIN)."
