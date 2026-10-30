# Medialyte-App

Ein Werkzeug für die ganze Agentur: Akquise über alle Branchen, Anfragen von medialyte.de, Kunden, Rechnungen und das Team.
Dieselbe Oberfläche läuft im Browser (app.medialyte.de), als Programm auf Mac und Windows und als Android-App.

## Aufbau

| Teil | Wo | Was |
|---|---|---|
| Oberfläche | `app/` | Svelte 5 + Vite, eine Seite, Navigation über `#/…` |
| Mac/Windows | `app/src-tauri/` | Tauri 2: eigenes Fenster, Links öffnen im Standardprogramm |
| Android | `mobile/` | Capacitor 8 mit den gebauten Dateien aus `app/dist` |
| Datenbank, Anmeldung | Supabase (EU, Paris), `supabase/` | Postgres mit Zugriffsregeln je Rolle, Zwei-Faktor-Pflicht |
| Cloud-Funktionen | `supabase/functions/` | `anfrage` (Buchungen von medialyte.de), `team` (Einladen, 2FA zurücksetzen, sperren) |
| Agent | Repo `website-agent` | sucht, baut Demos, Briefe; überträgt seinen Stand per `agent/cloud.py` |

## Sicherheit

- **Keine Daten ohne Anmeldung.** Jede Tabelle hat Row Level Security. Zugriff nur für aktive Team-Mitglieder,
  nur mit bestätigter Zwei-Faktor-Anmeldung (`aal2`) und nur in den Bereichen der eigenen Rolle (`public.darf()`).
- **Registrierung gesperrt.** Neue Mitglieder lädt der Inhaber ein (persönlicher Einmal-Link).
- **Keine Schlüssel im Gerät.** Im Gerät steht nur der öffentliche Supabase-Schlüssel. Der Agent und die Website
  schreiben über Server-Schlüssel, die nur in GitHub-Secrets bzw. Supabase liegen.
- **Website → App signiert.** medialyte.de schickt Buchungen mit HMAC-Signatur; der Schlüssel wird beim Deploy
  aus einem vorhandenen Secret abgeleitet und landet nie im Repository.
- **Datensparsam.** Anfragen ohne Auftrag werden nach 12 Monaten gelöscht; Google-Daten eines Betriebs nur, solange seine Demo online ist.

## Rollen

| Rolle | Standard |
|---|---|
| Inhaber | alles |
| Entwicklung, Design | Akquise bearbeiten, Anfragen und Kunden lesen |
| Marketing | Akquise, Briefe und Anfragen bearbeiten, Kunden lesen |
| Buchhaltung | Rechnungen und Kunden bearbeiten, Akquise und Anfragen lesen |

Die Rechte lassen sich in der App unter „Team & Rechte“ ändern.

## Einmalige Einrichtung

Repository-Secrets (Settings → Secrets and variables → Actions):

| Name | Wofür |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Datenbank, Anmelde-Einstellungen und Cloud-Funktionen einspielen; Android-Signatur |
| `IONOS_SFTP_HOST`, `IONOS_SFTP_USER`, `IONOS_SFTP_PASS` | app.medialyte.de hochladen, Buchungsformular verbinden |

Bei IONOS: Subdomain `app.medialyte.de` auf den Webspace-Ordner `/medialyte-app` zeigen lassen.
Im Repo `website-agent` zusätzlich das Secret `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys → Secret key).

## Abläufe (GitHub Actions)

- **Supabase aktualisieren:** von Hand (Actions → Run workflow)
- **App bauen und veröffentlichen (Web):** bei Änderungen in `app/`
- **Programme bauen (Mac, Windows):** von Hand oder bei neuer Version in `tauri.conf.json` → Releases
- **Android-App bauen:** von Hand oder bei Änderungen in `mobile/` → Releases

## Lokal

```bash
cd app && npm install && npm run dev          # Oberfläche auf http://localhost:5173
tools/test/run.sh                            # Datenbank-Regeln gegen lokales Postgres testen
```

## Etappen

1. Fundament: Datenbank, Rollen, Zwei-Faktor, Oberfläche mit Kategorien, Anfragen von medialyte.de, Gastro-Bestand (in Arbeit)
2. Alle Cockpit-Funktionen in die App (Briefe, Nachfassen, Zähler, Stimme, Kundenübernahme); altes Cockpit abschalten
3. Agent für alle Branchen: Suche je Kategorie, Demo-Vorlagen und Briefe je Branche
4. Rechnungen und Angebote in die App
