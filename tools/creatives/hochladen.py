"""Fertige Creatives in die App schicken (Seite „Social Media“).

  python3 tools/creatives/hochladen.py <ordner> [<ordner> …]

Jeder Ordner ist ein Creative: creative.json (titel, art, serie, text, format, saeule, optional status/position/geplant)
und die Dateien (Bilder 01.jpg, 02.jpg …, bzw. video.mp4 + titelbild.jpg). Das Skript erzeugt das Vorschaubild,
bei Karussells ein ZIP mit allen Bildern und dem Text, verschlüsselt alles mit tools/creatives/schluessel.pub
und legt es im Zweig creatives-eingang ab. Den Rest erledigt .github/workflows/creatives.yml.
"""
import io, json, os, shutil, subprocess, sys, tarfile, tempfile, zipfile
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from schluessel import verschluesseln

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
TEIL = 45 * 1024 * 1024
GRENZE = 50 * 1024 * 1024
BILD = (".jpg", ".jpeg", ".png", ".webp")


def git(*a, cwd=REPO):
    return subprocess.run(["git", *a], cwd=cwd, check=True, capture_output=True, text=True).stdout


def vorbereiten(ordner: str, ziel: str) -> str:
    meta = json.load(open(os.path.join(ordner, "creative.json")))
    slug = meta.get("slug") or os.path.basename(os.path.normpath(ordner))
    assert meta.get("titel") and meta.get("art") in ("bild", "karussell", "video"), f"{slug}: titel/art fehlt"
    out = os.path.join(ziel, slug); os.makedirs(out)
    dateien = sorted(f for f in os.listdir(ordner) if f != "creative.json" and not f.startswith("."))
    infos = []
    for f in dateien:
        q = os.path.join(ordner, f)
        if os.path.getsize(q) > GRENZE:
            sys.exit(f"{slug}/{f}: größer als 50 MB – bitte kleiner exportieren")
        shutil.copy(q, os.path.join(out, f))
        info = {"name": f}
        if f.lower().endswith(BILD):
            with Image.open(q) as im: info.update(b=im.width, h=im.height)
        if f.lower().endswith(".mp4"):
            r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", q], capture_output=True, text=True)
            j = json.loads(r.stdout or "{}"); s = (j.get("streams") or [{}])[0]
            info.update(b=s.get("width"), h=s.get("height"), dauer=round(float(j.get("format", {}).get("duration", 0)), 1))
        infos.append(info)
    bilder = [f for f in dateien if f.lower().endswith(BILD) and not f.startswith("titelbild")]
    quelle = next((f for f in dateien if f.startswith("titelbild")), None) or (bilder[0] if bilder else None)
    if quelle:
        with Image.open(os.path.join(ordner, quelle)) as im:
            im = im.convert("RGB"); im.thumbnail((540, 960), Image.LANCZOS)
            im.save(os.path.join(out, "vorschau.jpg"), quality=82, optimize=True)
    if meta["art"] == "karussell" and bilder:
        with zipfile.ZipFile(os.path.join(out, "paket.zip"), "w", zipfile.ZIP_STORED) as z:
            for f in bilder: z.write(os.path.join(ordner, f), f"{slug}_{f}")
            if meta.get("text"): z.writestr(f"{slug}_text.txt", meta["text"] + "\n")
        infos.append({"name": "paket.zip", "anzeige": f"{slug}.zip", "art": "paket"})
    meta["dateien"] = infos
    json.dump(meta, open(os.path.join(out, "creative.json"), "w"), ensure_ascii=False)
    return slug


def main():
    ordner = sys.argv[1:]
    if not ordner:
        sys.exit(__doc__)
    pub = open(os.path.join(REPO, "tools/creatives/schluessel.pub")).read()
    with tempfile.TemporaryDirectory() as tmp:
        stapel = os.path.join(tmp, "stapel"); os.makedirs(stapel)
        slugs = [vorbereiten(o, stapel) for o in ordner]
        puffer = io.BytesIO()
        with tarfile.open(fileobj=puffer, mode="w") as t:
            for s in slugs: t.add(os.path.join(stapel, s), s)
        paket = verschluesseln(puffer.getvalue(), pub)
        git("fetch", "-q", "origin", "main")
        baum = os.path.join(tmp, "baum")
        git("worktree", "add", "-q", "-B", "creatives-eingang", baum, "origin/main")
        try:
            os.makedirs(os.path.join(baum, "eingang"))
            for i in range(0, len(paket), TEIL):
                open(os.path.join(baum, "eingang", f"lieferung.bin.{i // TEIL:03d}"), "wb").write(paket[i:i + TEIL])
            git("add", "eingang", cwd=baum)
            git("-c", "user.name=Medialyte", "-c", "user.email=info@medialyte.de", "commit", "-q", "-m",
                f"Creatives-Eingang: {len(slugs)} Creatives (verschlüsselt)", cwd=baum)
            git("push", "-q", "-f", "origin", "creatives-eingang", cwd=baum)
        finally:
            git("worktree", "remove", "--force", baum)
            git("branch", "-D", "creatives-eingang")
    print(f"Unterwegs: {len(slugs)} Creatives ({len(paket) / 1e6:.1f} MB verschlüsselt): " + ", ".join(slugs))


if __name__ == "__main__":
    main()
