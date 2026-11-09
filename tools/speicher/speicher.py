"""Speicher-Aufräumen (Supabase): Bericht und gezieltes Löschen.
Läuft in GitHub Actions. Das Repository ist öffentlich – daher stehen im Log nur Summen.
Der ausführliche Bericht wird mit dem übergebenen öffentlichen Schlüssel (Eingabe „pub“) verschlüsselt und als Artefakt abgelegt.
Zum Löschen wird eine Liste von Speicherpfaden übergeben, verschlüsselt mit tools/creatives/schluessel.pub (Eingabe „liste“).
Der Speicher „belege“ (GoBD-Archiv) wird nie angefasst."""
import base64, json, os, sys, urllib.parse
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "creatives"))
from einspielen import BASIS, REF, TOKEN, anfrage, server_schluessel
from schluessel import verschluesseln, entschluesseln, privat_aus_secret

GESCHUETZT = {"belege"}

def sql(q):
    code, body = anfrage(f"https://api.supabase.com/v1/projects/{REF}/database/query", "POST", json.dumps({"query": q}).encode(),
                         {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    if code >= 300: sys.exit(f"SQL fehlgeschlagen (HTTP {code}) {body[:300]!r}")
    return json.loads(body)

def bericht():
    r = {}
    r["buckets"] = sql("select bucket_id, count(*) n, coalesce(sum((metadata->>'size')::bigint),0) bytes from storage.objects group by 1 order by 3 desc")
    r["db"] = sql("select pg_database_size(current_database()) bytes")
    r["tabellen"] = sql("select n.nspname||'.'||c.relname t, pg_total_relation_size(c.oid) bytes from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' order by 2 desc limit 15")
    r["objekte"] = sql("select bucket_id, name, (metadata->>'size')::bigint bytes, created_at, updated_at from storage.objects order by bucket_id, name")
    try: r["creatives"] = sql("select c.slug, c.titel, c.status, c.art, c.serie, c.erstellt, c.geaendert, c.geplant, c.favorit, c.eigen, c.hochgeladen_von, c.plattformen, c.dateien, c.vorschau, k.name kunde from public.social_creatives c left join public.social_kunden k on k.id=c.kunde_id order by c.erstellt")
    except SystemExit as e: r["creatives_fehler"] = str(e)
    try: r["spalten_creatives"] = sql("select column_name from information_schema.columns where table_schema='public' and table_name='social_creatives'")
    except SystemExit: pass
    for b in r["buckets"]: print(f"{b['bucket_id']}: {b['n']} Dateien, {int(b['bytes'])/1e6:.1f} MB")
    print(f"Datenbank: {int(r['db'][0]['bytes'])/1e6:.1f} MB")
    pub = os.environ.get("PUB", "").strip()
    if pub:
        open("bericht.bin", "wb").write(verschluesseln(json.dumps(r, default=str, ensure_ascii=False).encode(), pub))
        print("Bericht verschlüsselt abgelegt.")

def loeschen():
    paket = base64.b64decode(os.environ["LISTE"].strip())
    auftrag = json.loads(entschluesseln(paket, privat_aus_secret(TOKEN)))
    key = server_schluessel(); kopf = {"apikey": key, "Content-Type": "application/json", **({} if key.startswith("sb_secret_") else {"Authorization": f"Bearer {key}"})}
    gesamt = 0
    for bucket, pfade in auftrag.get("objekte", {}).items():
        if bucket in GESCHUETZT: print(f"{bucket}: geschützt – übersprungen"); continue
        for i in range(0, len(pfade), 100):
            teil = pfade[i:i + 100]
            code, body = anfrage(f"{BASIS}/storage/v1/object/{bucket}", "DELETE", json.dumps({"prefixes": teil}).encode(), kopf)
            if code >= 300: sys.exit(f"{bucket}: Löschen fehlgeschlagen (HTTP {code})")
            gesamt += len(json.loads(body or b"[]"))
        print(f"{bucket}: {len(pfade)} Pfade angefragt")
    for slug in auftrag.get("creatives", []):   # Einträge in der App entfernen
        code, _ = anfrage(f"{BASIS}/rest/v1/social_creatives?slug=eq.{urllib.parse.quote(slug)}", "DELETE", None, {**kopf, "Prefer": "return=minimal"})
        if code >= 300: sys.exit(f"Creative-Eintrag: Löschen fehlgeschlagen (HTTP {code})")
    print(f"Gelöscht: {gesamt} Dateien, {len(auftrag.get('creatives', []))} Creative-Einträge.")

if __name__ == "__main__":
    {"bericht": bericht, "loeschen": loeschen}[sys.argv[1]]()
