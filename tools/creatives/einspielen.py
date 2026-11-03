"""Läuft in GitHub Actions: entschlüsselt die Lieferung aus eingang/, lädt die Dateien in den privaten
Supabase-Speicher „creatives“ und legt die Creatives in public.social_creatives an (bzw. aktualisiert sie).

Je Ordner der Lieferung eins davon:
  creative.json  ein Creative (optional kunde_id und auftrag_id: zählt beim Auftrag als geliefert)
  profil.json    Stilprofil eines Social-Kunden {kunde_id, profil, auftrag_id?, ergebnis?} (Ergebnis von „Anlernen“)
  meldung.json   Stand eines Auftrags {auftrag_id, status: in_arbeit|fertig|fehler, ergebnis?}
  kunde.json     Social-Kunden einrichten {name, website?, kanaele: [{plattform, name, url}], profil}: legt den Kunden mit der
                 Kategorie „Social Media“ an (oder nimmt den gleichnamigen), trägt Kanäle und Stil ein

Umgebung: SUPABASE_ACCESS_TOKEN, PROJECT_REF. Ausgaben: nur Kennungen und Anzahlen.
"""
import glob, io, json, mimetypes, os, re, sys, tarfile, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(__file__))
from schluessel import entschluesseln, privat_aus_secret

REF = os.environ["PROJECT_REF"]
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
BASIS = f"https://{REF}.supabase.co"
ERLAUBT = {"plattformen", "titel", "art", "serie", "text", "format", "saeule", "status", "position", "geplant", "notiz", "kunde_id", "auftrag_id"}
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


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
        rest = lambda pfad, methode="GET", daten=None, prefer="return=minimal": anfrage(  # noqa: E731
            f"{BASIS}/rest/v1/{pfad}", methode, None if daten is None else json.dumps(daten).encode(),
            {**kopf, "Content-Type": "application/json", "Prefer": prefer})
        geliefert: dict[str, int] = {}
        for slug, dateien in sorted(ordner.items()):
            if "kunde.json" in dateien:
                kunde_einrichten(rest, slug, json.loads(t.extractfile(dateien["kunde.json"]).read()))
                continue
            if "profil.json" in dateien or "meldung.json" in dateien:
                melden(rest, slug, json.loads(t.extractfile(dateien.get("profil.json") or dateien["meldung.json"]).read()), "profil.json" in dateien)
                continue
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
            for k in ("kunde_id", "auftrag_id"):
                if zeile.get(k) is not None and not UUID.match(str(zeile[k])):
                    sys.exit(f"{slug}: {k} ungültig")
            zeile.update(slug=slug, dateien=[d for d in liste if d["art"] != "vorschau"],
                         vorschau=next((d["pfad"] for d in liste if d["art"] == "vorschau"), None))
            code, body = anfrage(f"{BASIS}/rest/v1/social_creatives?on_conflict=slug", "POST", json.dumps(zeile).encode(),
                                 {**kopf, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})
            if code >= 300:
                sys.exit(f"{slug}: Eintrag fehlgeschlagen (HTTP {code}) {body[:300]!r}")
            print(f"✓ {slug} ({len(liste)} Dateien)")
            if zeile.get("auftrag_id"):
                geliefert[zeile["auftrag_id"]] = geliefert.get(zeile["auftrag_id"], 0) + 1
        for aid, n in geliefert.items():   # Aufträge: geliefert hochzählen, bei Erreichen der Anzahl fertig
            code, body = rest(f"social_auftraege?id=eq.{aid}&select=anzahl,geliefert,status")
            a = (json.loads(body) or [None])[0] if code < 300 else None
            if not a:
                print(f"Auftrag {aid[:8]}: nicht gefunden"); continue
            g = a["geliefert"] + n
            neu = {"geliefert": g, "status": "fertig" if g >= a["anzahl"] else "in_arbeit"}
            if neu["status"] == "fertig":
                neu["ergebnis"] = f"{g} {'Creative' if g == 1 else 'Creatives'} geliefert – zur Freigabe in der App."
            if a["status"] == "abgebrochen":
                neu.pop("status")
            rest(f"social_auftraege?id=eq.{aid}", "PATCH", neu)
            print(f"Auftrag {aid[:8]}: {g}/{a['anzahl']} geliefert")
    print(f"Fertig: {len(ordner)} Lieferungen, {n_dateien} Dateien.")


def kunde_einrichten(rest, slug, m):
    """Kunden mit Kategorie „Social Media“ anlegen bzw. markieren, dann Kanäle und Stilprofil eintragen."""
    name = str(m.get("name") or "").strip()[:120]
    if not name or not isinstance(m.get("profil", {}), dict):
        sys.exit(f"{slug}: name fehlt")
    lies = lambda pfad: json.loads(rest(pfad)[1] or b"[]")  # noqa: E731
    kat = (lies("kundenkategorien?bereich=eq.social&select=id") or [None])[0]
    if not kat:
        sys.exit(f"{slug}: Kategorie Social Media fehlt")
    c = (lies(f"customers?name=ilike.{urllib.parse.quote(name)}&select=id,kategorien") or [None])[0]
    if c:
        if kat["id"] not in (c.get("kategorien") or []):
            rest(f"customers?id=eq.{c['id']}", "PATCH", {"kategorien": (c.get("kategorien") or []) + [kat["id"]]})
    else:
        firma = (lies("settings?select=user_id&order=updated_at.asc&limit=1") or [None])[0]
        if not firma:
            sys.exit(f"{slug}: Firmenkonto nicht gefunden")
        code, body = rest("customers", "POST", {"user_id": firma["user_id"], "name": name, "website": m.get("website") or None,
                                                "kategorien": [kat["id"]]}, "return=representation")
        if code >= 300:
            sys.exit(f"{slug}: Kunde nicht angelegt (HTTP {code}) {body[:300]!r}")
        c = json.loads(body)[0]
    k = (lies(f"social_kunden?customer_id=eq.{c['id']}&select=id,profil") or [None])[0]
    if not k:
        sys.exit(f"{slug}: Social-Bereich nicht angelegt")
    if m.get("profil"):
        rest(f"social_kunden?id=eq.{k['id']}", "PATCH", {"profil": {**(k.get("profil") or {}), **m["profil"]},
                                                         "angelernt": datetime.now(timezone.utc).isoformat()})
    da = {(x["plattform"], x["name"]) for x in lies(f"social_kanaele?kunde_id=eq.{k['id']}&select=plattform,name")}
    for kn in m.get("kanaele") or []:
        if (kn.get("plattform"), kn.get("name", "")) not in da:
            rest("social_kanaele", "POST", {"kunde_id": k["id"], "plattform": kn["plattform"], "name": kn.get("name", ""), "url": kn.get("url", "")})
    print(f"✓ Social-Kunde eingerichtet ({len(m.get('kanaele') or [])} Kanäle)")


def melden(rest, slug, m, profil):
    """Stilprofil eintragen bzw. den Stand eines Auftrags setzen."""
    aid = m.get("auftrag_id")
    if aid and not UUID.match(str(aid)):
        sys.exit(f"{slug}: auftrag_id ungültig")
    if profil:
        kid = str(m.get("kunde_id") or "")
        if not UUID.match(kid) or not isinstance(m.get("profil"), dict):
            sys.exit(f"{slug}: kunde_id oder profil fehlt")
        code, body = rest(f"social_kunden?id=eq.{kid}", "PATCH",
                          {"profil": m["profil"], "angelernt": datetime.now(timezone.utc).isoformat()})
        if code >= 300:
            sys.exit(f"{slug}: Stilprofil nicht gespeichert (HTTP {code}) {body[:300]!r}")
        print(f"✓ Stilprofil {kid[:8]}")
        if aid:
            m = {"auftrag_id": aid, "status": "fertig", "ergebnis": m.get("ergebnis") or "Stil angelernt – das Profil steht unter „Stil“."}
    if aid:
        st = m.get("status")
        if st not in ("in_arbeit", "fertig", "fehler"):
            sys.exit(f"{slug}: status ungültig")
        werte = {"status": st, **({"ergebnis": str(m["ergebnis"])[:2000]} if m.get("ergebnis") else {})}
        code, body = rest(f"social_auftraege?id=eq.{aid}&status=neq.abgebrochen", "PATCH", werte)
        if code >= 300:
            sys.exit(f"{slug}: Auftrag nicht gemeldet (HTTP {code}) {body[:300]!r}")
        print(f"✓ Auftrag {aid[:8]}: {st}")


if __name__ == "__main__":
    main()
