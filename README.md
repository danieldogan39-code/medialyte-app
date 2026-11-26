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

## Organizer (persönlicher Bereich)

Nach dem Anmelden wählt man auf dem Startbildschirm zwischen **Medialyte** (Agentur) und dem **Organizer** – zwei eigenständige
Welten mit eigener Navigation in derselben App (`app/src/views/Start.svelte`, `app/src/views/organizer/`). Wer das Recht
`organizer` nicht hat, landet direkt in Medialyte.

- **Heute, Woche, Aufgaben, Gewohnheiten, Prüfungen.** Termine, Aufgaben mit Dauer/Frist/Wichtigkeit, Gewohnheiten (z. B. Training 3×/Woche) und Klausuren mit Countdown.
- **Auto-Planung** (`app/src/lib/organizer/planer.ts`): verteilt Aufgaben ohne feste Zeit in freie Lücken zwischen Terminen und Gewohnheiten – früheste Frist zuerst, mit Puffer und Tagesgrenze; Liegengebliebenes lässt sich mit einem Tipp neu einplanen.
- **Schnelleingabe**: „Mathe Kapitel 4 90min bis Fr !“ erkennt Fach, Dauer, Frist, feste Zeit und Wichtigkeit.
- **Kalender-Abos**: ISM-Stundenplan, Google („Geheime Adresse im iCal-Format“) oder jeder andere iCal-Link; die Cloud-Funktion `kalender` liest sie (Zeitzonen, Wiederholungen) und schreibt `org_termine`. `.ics`-Dateien lassen sich auch direkt einlesen.
- **Tagesroutine** (`org_routine`): feste Punkte und Fokusblöcke mit Niveau; die Auto-Planung plant nur in die Blöcke, schwere Fächer in Block 1. „Feste Lernblöcke einpassen“ zerlegt lange Blöcke und verteilt sie am selben Tag in die Routine.
- **Fahrzeit zur Uni**: um Vorlesungen und Prüfungen vor Ort wird je Weg die eingestellte Fahrzeit (Standard 45 Min.) freigehalten; Online-Termine (Zoom) brauchen keinen Weg.
- **Fächer** mit vollem Kalendernamen, Dozent, Prüfungsform, Link und Schwierigkeit; Termine und Aufgaben werden darüber automatisch zugeordnet.
- **Lernen** (`app/src/views/organizer/lernen/`, `app/src/lib/lernen/`): Kurse → Kapitel → Lektionen mit Erklärungen (Markdown + KaTeX), Grafiken (Funktionsgraph, Bilanz, T-Konten, Ablauf, Matrix …), durchgerechneten Beispielen und Abfragen (Multiple Choice, Rechnen, Buchungssatz, Zuordnen, Reihenfolge, Karteikarte, Freitext). Wiederholung nach Leitner-Kästen (`org_lernstand`), Rechentraining mit endlos neuen Aufgaben (deklarative Generatoren, sichere Ausdrücke ohne `eval`), Prüfungssimulation mit Zeitlimit und Notenschätzung (`org_pruefungslauf`). „Lernplan einplanen“ legt je Lektion eine Aufgabe mit Link an (`org_aufgaben.lektion`) und verteilt sie bis 3 Tage vor der Klausur, dazu eine kurze Prüfungssimulation je Fach. **Die Inhalte stehen nicht im Code**, sondern privat im Speicher-Bucket `organizer` (`<user>/lernen/<kurs>.json`, dazu die Original-Skripte unter `<user>/skripte/`); die App merkt sich die letzte Fassung für offline. Prüfen: `cd app && npx tsx scripts/lernen-pruefen.ts <ordner>`.
- **Hausarbeiten** (`app/src/views/organizer/arbeiten/`, `app/src/lib/arbeiten/`): je Arbeit Steckbrief (Forschungsfrage, Abgabe, Wortziel ± Toleranz), Vorgaben mit Regel-Checkliste (automatisch / teilweise / manuell, jede Regel mit Fundstelle), Material in Kategorien (Vorgaben, Quellen, Material, Entwürfe, Abgabe – privat unter `organizer/<user>/arbeiten/<id>/`), Quellenverwaltung (DOI/ISBN ausfüllen, Literaturverzeichnis und Kurzbelege aus den Mustern des Regelwerks, Warnung bei nicht zitierfähigen Quellen), KI-Nachweis (Tabelle im Format der Hochschul-Vorlage) und ein Prüfer für Word-Dateien (`docx.ts` liest .docx inkl. Formatvorlagen und Fußnoten, `pruefer.ts` prüft Umfang, Aufbau, Gliederung, Layout, Fußnoten, Zitate, Literaturverzeichnis, Sprache und Erklärungen; „Formatierung automatisch korrigieren“ schreibt eine korrigierte Fassung). Tabellen `org_arbeiten`, `org_arbeit_dateien`, `org_quellen`, `org_ki_nutzung`, `org_arbeit_pruefungen` (Migration 128). **Das Regelwerk steht nicht im Code**, sondern privat unter `organizer/<user>/arbeiten/regelwerk.json`.
- **Nur für freigeschaltete Konten**: Zugang über `mitglieder.organizer` (Migration 125, zunächst nur Daniel), nicht über Rollenrechte; freischalten nur direkt in der Datenbank. Jede Zeile in `org_*` gehört genau einem Konto.

## Sicherheit

- **Keine Daten ohne Anmeldung.** Jede Tabelle hat Row Level Security. Zugriff nur für aktive Team-Mitglieder,
  nur mit bestätigter Zwei-Faktor-Anmeldung (`aal2`) und nur in den Bereichen der eigenen Rolle (`public.darf()`).
- **Registrierung gesperrt.** Neue Mitglieder lädt der Inhaber ein (persönlicher Einmal-Link).
- **Keine Schlüssel im Gerät.** Im Gerät steht nur der öffentliche Supabase-Schlüssel. Der Agent und die Website
  schreiben über Server-Schlüssel, die nur in GitHub-Secrets bzw. Supabase liegen.
- **Website → App signiert.** medialyte.de schickt Buchungen mit HMAC-Signatur; der Schlüssel wird beim Deploy
  aus einem vorhandenen Secret abgeleitet und landet nie im Repository.
- **Datensparsam.** Anfragen ohne Auftrag werden nach 12 Monaten gelöscht; Google-Daten eines Betriebs nur, solange seine Demo online ist.

## Automatische Updates

Die App startet immer aus ihren eigenen Dateien (nie aus dem Netz). Neue Versionen kommen signiert im Hintergrund
und werden erst beim nächsten Start aktiv.

- **Mac/Windows:** Tauri-Updater. `desktop.yml` signiert die Builds und legt `latest.json` im Release `aktualisierung` ab.
  Mac bereitet das Update sofort vor, Windows installiert es beim Schließen des Fensters; „Jetzt neu starten“ geht auch.
- **Android:** Oberflächen-Pakete (Capgo Updater, ohne Capgo-Cloud). `web.yml` baut die Oberfläche, signiert das Paket
  (ECDSA P-256) und legt es samt Manifest im Release `aktualisierung` ab. Die App prüft die Signatur, lädt das Paket,
  nimmt es beim nächsten Start (oder nach 10 Minuten im Hintergrund) und springt zurück, wenn es nicht sauber startet.
- **Neue Handy-Funktionen** (Capacitor-Plugins, Android-Rechte): `mobile/huelle.txt` um eins erhöhen. Die neue APK
  heißt dann `<Stufe>.0.<Build>`; Pakete mit höherer Stufe warten, bis die neue APK installiert ist.
- **Schlüssel:** `tools/update/schluessel.sh` legt sie beim ersten Lauf an und hält sie in `private.update_schluessel`
  (Supabase). Im Repository steht keiner.

## Rechnungen und GoBD

- Ausgestellte Rechnungen sind unveränderbar (Datenbank-Regel, gilt auch für den Server). Korrekturen nur über Storno bzw. Storno + neue Rechnung.
- Nichts Ausgestelltes wird gelöscht: Rechnungen und verschickte Angebote lassen sich nur ausblenden (mit Grund). Gelöscht werden können nur Entwürfe – auch beim Löschen eines Kontos.
- Beim Abschließen legt der Server das PDF als Original-Beleg im privaten Speicher „belege“ ab (SHA-256-Prüfsumme). Danach wird immer genau dieses PDF ausgeliefert und verschickt. Ältere Rechnungen werden beim ersten Abruf nachträglich abgelegt und so gekennzeichnet.
- `beleg_protokoll`: unveränderliches Protokoll aller Anlagen, Änderungen und Löschungen von Rechnungen, Angeboten, Kunden und Firmendaten (wer, wann, alt → neu).
- Einstellungen → „Aufbewahrung & Betriebsprüfung“: GoBD-Export für einen Zeitraum (ZIP mit CSV, index.xml im GDPdU-Format, Protokoll, alle PDFs).
- Organisatorisch dazu: Verfahrensdokumentation, Datensicherung, Eingangsrechnungen im Originalformat aufbewahren.

## Ausgaben und Steuern

Unter Rechnungen gibt es die Reiter **Ausgaben** und **Steuern**.

- **Ausgaben** (`ausgaben`, Migration 130): was die Firma bezahlt hat, mit Kategorie und Steuerart – Inland (Vorsteuer), EU bzw. Nicht-EU ohne Umsatzsteuer (Reverse Charge, § 13b) oder ohne Vorsteuer. Offline-fähig wie die Rechnungen. Gespeichert werden nur die Zahlen, keine Belege.
- **Steuern** rechnet daraus und aus den Rechnungen: Umsatzsteuer je Voranmeldungszeitraum mit den Kennzahlen des ELSTER-Formulars (81, 86, 46/47, 84/85, 66, 67, 83), Gewinn nach Geldeingang (EÜR), eine Schätzung von Einkommen-, Gewerbesteuer und Soli auf den Gewinn, die Rücklage, die Fristen (Wochenenden und Hamburger Feiertage berücksichtigt) und die Grenzen (Gewerbesteuer-Freibetrag, Voranmeldungs-Rhythmus, Kleinunternehmer).
- Einstellungen: Soll- oder Ist-Versteuerung, Rhythmus, Dauerfristverlängerung, Gewerbe und Hebesatz liegen bei den Firmeneinstellungen (`settings.company.steuer`). Die persönlichen Angaben für die Einkommensteuer (übriges Einkommen, Abzüge, Kirchensteuer) liegen in `steuer_privat` und sind nur für das eigene Konto lesbar.
- Der Rechenkern ist `app/src/lib/rechnungen/steuer.ts` (reine Funktionen, Quellen und Rechtsstand im Kopf der Datei). Nachrechnen: `cd app && npx tsx scripts/steuer-pruefen.ts`. **Bei jedem Jahreswechsel prüfen:** Einkommensteuertarif und Soli-Freigrenze (`TARIFE`), Grenzen der Voranmeldung, Kennzahlen des Formulars.
- Es ist eine Schätzung, keine Steuerberatung: Abschreibungen über mehrere Jahre, private Nutzung, Verlustvorträge und geleistete Vorauszahlungen sind nicht berücksichtigt.

## Social Media (Creatives)

Fertige Creatives landen auf der Seite „Social Media“ (Bilder, Karussells, Videos mit Titelbild und Text).
Einspielen: `python3 tools/creatives/hochladen.py <ordner> …` – jeder Ordner enthält `creative.json`
(titel, art = bild|karussell|video, serie, text, format, saeule, optional status/position/geplant) und die Dateien
(`01.jpg …` bzw. `video.mp4` + `titelbild.jpg`, je höchstens 50 MB). Das Skript verschlüsselt alles mit
`tools/creatives/schluessel.pub` und legt es im Zweig `creatives-eingang` ab; „Creatives einspielen“ lädt es in den
privaten Speicher, trägt es ein und löscht den Zweig wieder. Neue Creatives stellen sich hinten in der Reihenfolge an
(Status „Zur Freigabe“).

- Reihenfolge = Posting-Reihenfolge: Die Nummer auf jeder Kachel zeigt, was als Nächstes dran ist (1 zuerst). Umsortieren per Ziehen;
  gepostete und verworfene stehen ohne Nummer dahinter. Die Übersicht zeigt die nächsten unter „Als Nächstes posten“.
- Bibliothek (`#/social/bibliothek`): alle Creatives mit Suche und Filtern (Favoriten, Eigene, Bilder, Karussells, Videos, Gepostet).
- Favoriten: Stern auf der Kachel oder der Detailseite (Spalte `favorit`).
- Eigene Uploads: „Hochladen“ in der App legt Bilder (eins = Einzelbild, mehrere = Karussell) oder ein Video im Ordner `eigene/`
  des Speichers ab und trägt es mit `eigen = true` ein (Recht „social“ schreiben).

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

- **Supabase aktualisieren:** automatisch bei Änderungen in `supabase/` (vorher `tools/test/run.sh`)
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

## Kundenlogos

Jeder Kunde hat sein eigenes Logo (Kundenliste, Kundenakte, Rechnungskunde). Es steht als kleines Bild
(längste Seite 256 px, als data-URL) in `customers.logo`, kommt also mit den Kunden mit, auch offline.

- **Automatisch:** „Kundenlogos holen“ (`tools/logos/holen.py`) läuft jede Nacht und nach jedem Datenbank-Update. Für
  Kunden ohne Logo sucht es auf der Website das Logo (Logo-Bild im Kopf, Logo aus den strukturierten Daten, App-Symbol,
  großes Favicon), sonst nimmt es das Logo der Demo. Von Hand hochgeladene Logos fasst es nie an.
- **Von Hand:** Kunde bearbeiten → „Logo hochladen“ (PNG, JPEG, WebP, SVG). „Entfernen“ lässt den Abruf es neu holen.
- Ohne Logo zeigt die App die Anfangsbuchstaben in einer festen Farbe.
