"""Prüft den Speicher „creatives“: Dateityp, Größe und ob Videos abspielbar ausgeliefert werden (Teilabruf/Range).
Gibt nur Pfade, Typen und Größen aus – keine Inhalte."""
import json, os, sys, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
from einspielen import BASIS, anfrage, server_schluessel

key = server_schluessel()
kopf = {"apikey": key, **({} if key.startswith("sb_secret_") else {"Authorization": f"Bearer {key}"})}
code, body = anfrage(f"{BASIS}/rest/v1/social_creatives?select=slug,dateien&art=eq.video", kopf=kopf)
for c in json.loads(body):
    for d in c["dateien"]:
        if d.get("art") != "video": continue
        p = d["pfad"]
        code, body = anfrage(f"{BASIS}/storage/v1/object/info/authenticated/creatives/{p}", kopf=kopf)
        info = json.loads(body) if code < 300 else {"fehler": code}
        code2, b2 = anfrage(f"{BASIS}/storage/v1/object/sign/creatives/{p}", "POST", json.dumps({"expiresIn": 120}).encode(), {**kopf, "Content-Type": "application/json"})
        url = BASIS + "/storage/v1" + json.loads(b2)["signedURL"]
        req = urllib.request.Request(url, headers={"Range": "bytes=0-1023"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                h = dict(r.headers); erst = r.read(12)
                print(p, "| info:", {k: info.get(k) for k in ("content_type", "size", "metadata")} if "fehler" not in info else info,
                      "| Abruf:", r.status, h.get("Content-Type"), h.get("Content-Range"), h.get("Accept-Ranges"), "| Anfang:", erst[4:12])
        except urllib.error.HTTPError as e:
            print(p, "| Abruf-Fehler", e.code, e.read()[:200])
