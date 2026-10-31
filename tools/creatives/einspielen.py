"""Läuft in GitHub Actions: entschlüsselt die Lieferung aus eingang/, lädt die Dateien in den privaten
Supabase-Speicher „creatives“ und legt die Creatives in public.social_creatives an (bzw. aktualisiert sie).

Umgebung: SUPABASE_ACCESS_TOKEN, PROJECT_REF. Ausgaben: nur Kennungen und Anzahlen.
"""
import glob, io, json, mimetypes, os, sys, tarfile, urllib.error, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from schluessel import entschluesseln, privat_aus_secret

REF = os.environ["PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
BASIS = f"https://{REF}.supabase.co"
ERLAUBT = {"plattformen", "titel", "art", "serie", "text", "format", "saeule", "status", "position", "geplant", "notiz"}


def anfrage(url, methode="GET", daten=None, kopf=None):
    req = urllib.request.Request(url, data=daten, method=methode, headers=kopf or {})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def server_schluessel():
    code, body = anfrage(f"https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true", kopf={"Authorization": f"Bearer {TOKEN}"})
    if code >= 300:
        sys.exit(f"Schlüssel nicht abrufbar (HTTP {code})")
    keys = json.loads(body)
    k = next((x["api_key"] for x in keys if x.get("name") == "service_role" and x.get("api_key")), None) \
        or next((x["api_key"] for x in keys if x.get("type") == "secret" and x.get("api_key")), None)
    if not k:
        sys.exit("Kein Server-Schlüssel gefunden")
    print(f"::add-mask::{k}")
    return k


def main():
    teile = sorted(glob.glob("eingang/*.bin.*"))
    if not teile:
        sys.exit("Keine Lieferung in eingang/")
    paket = b"".join(open(t, "rb").read() for t in teile)
    tar = entschluesseln(paket, privat_aus_secret(TOKEN))
    key = server_schluessel()
    kopf = {"apikey": key}
    if not key.startswith("sb_secret_"):
        kopf["Authorization"] = f"Bearer {key}"

    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        mitglieder = [m for m in t.getmembers() if m.isfile()]
        ordner = {}
        for m in mitglieder:
            teil = m.name.split("/")
            if len(teil) != 2 or ".." in teil or teil[0].startswith("."):
                continue
            ordner.setdefault(teil[0], {})[teil[1]] = m
        n_dateien = 0
        for slug, dateien in sorted(ordner.items()):
            if "creative.json" not in dateien:
                print(f"{slug}: creative.json fehlt – übersprungen"); continue
            meta = json.loads(t.extractfile(dateien["creative.json"]).read())
            liste = []
            for name, m in sorted(dateien.items()):
                if name == "creative.json":
                    continue
                typ = mimetypes.guess_type(name)[0] or "application/octet-stream"
                pfad = f"{slug}/{name}"
                code, body = anfrage(f"{BASIS}/storage/v1/object/creatives/{urllib.parse.quote(pfad)}", "POST", t.extractfile(m).read(),
                                     {**kopf, "Content-Type": typ, "x-upsert": "true", "cache-control": "31536000"})
                if code >= 300:
                    sys.exit(f"{pfad}: Hochladen fehlgeschlagen (HTTP {code}) {body[:200]!r}")
                n_dateien += 1
                info = next((d for d in meta.get("dateien", []) if d.get("name") == name), {})
                art = info.get("art") or ("video" if typ.startswith("video/") else "titelbild" if name.startswith("titelbild") else
                                          "paket" if name.endswith(".zip") else "vorschau" if name.startswith("vorschau") else "bild")
                liste.append({"name": info.get("anzeige") or name, "pfad": pfad, "art": art, "groesse": m.size, "typ": typ,
                              **{k: info[k] for k in ("b", "h", "dauer") if k in info}})
            zeile = {k: v for k, v in meta.items() if k in ERLAUBT}
            zeile.update(slug=slug, dateien=[d for d in liste if d["art"] != "vorschau"],
                         vorschau=next((d["pfad"] for d in liste if d["art"] == "vorschau"), None))
            code, body = anfrage(f"{BASIS}/rest/v1/social_creatives?on_conflict=slug", "POST", json.dumps(zeile).encode(),
                                 {**kopf, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})
            if code >= 300:
                sys.exit(f"{slug}: Eintrag fehlgeschlagen (HTTP {code}) {body[:300]!r}")
            print(f"✓ {slug} ({len(liste)} Dateien)")
    print(f"Fertig: {len(ordner)} Creatives, {n_dateien} Dateien.")


if __name__ == "__main__":
    main()
