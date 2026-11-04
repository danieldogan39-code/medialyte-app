"""Kundenlogos automatisch holen (GitHub Actions „Kundenlogos holen“).

Für jeden Kunden ohne Logo: Website laden, das Logo suchen (Logo-Bild im Kopf der Seite, Logo aus den strukturierten
Daten, App-Symbol, großes Favicon), als PNG mit höchstens 256 px in customers.logo schreiben (logo_quelle 'website').
Ohne brauchbares Logo auf der Website, aber mit Demo: das Logo der Demo (logo_quelle 'demo').
Von Hand hochgeladene Logos bleiben immer unangetastet. Mit --neu werden automatisch geholte Logos erneuert.

Umgebung: SUPABASE_ACCESS_TOKEN, PROJECT_REF. Ausgaben: nur Anzahlen, nie Namen (das Repository ist öffentlich).
"""
from __future__ import annotations

import base64
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
MAX = 256
UA = "Mozilla/5.0 (compatible; Medialyte-Logo/1.0)"


# --------------------------------------------------------------------------- Datenbank (Management-API)
def sql(query: str):
    ref, token = os.environ["PROJECT_REF"], os.environ["SUPABASE_ACCESS_TOKEN"]
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", method="POST",
                                 data=json.dumps({"query": query}).encode(),
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"[]")


# --------------------------------------------------------------------------- Laden
def laden(url: str, max_bytes: int = 4_000_000) -> tuple[bytes, str, str] | None:
    if not re.match(r"^https?://", url):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=20) as r:
            daten = r.read(max_bytes + 1)
            if len(daten) > max_bytes:
                return None
            return daten, (r.headers.get("content-type") or "").lower(), r.geturl()
    except Exception:
        return None


# --------------------------------------------------------------------------- Logo auf der Seite finden
class Seite(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.kandidaten: list[tuple[int, str, str]] = []  # (Punkte, Art, Wert)
        self.tiefe_header = 0
        self.svg: list[str] | None = None
        self.svg_tiefe = 0
        self.n_img = 0
        self.ldjson = False
        self.ld = ""

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        merk = " ".join(a.get(k, "") for k in ("class", "id", "alt", "src", "title", "aria-label")).lower()
        if tag == "header" or "header" in a.get("class", "").lower() or a.get("role") == "banner":
            self.tiefe_header += 1
        if self.svg is not None:
            self.svg.append(self.get_starttag_text() or "")
            self.svg_tiefe += 1
            return
        if tag == "svg" and "logo" in merk:
            self.svg, self.svg_tiefe = [self.get_starttag_text() or ""], 1
            return
        if tag == "img":
            self.n_img += 1
            src = a.get("src") or a.get("data-src") or (a.get("srcset", "").split(",")[0].strip().split(" ")[0])
            if src and "logo" in merk:
                self.kandidaten.append((100 + (15 if self.tiefe_header else 0) + (10 if self.n_img <= 3 else 0), "url", src))
            elif src and self.tiefe_header and self.n_img <= 2:
                self.kandidaten.append((55, "url", src))  # erstes Bild im Kopf ist meist das Logo
        if tag == "link":
            rel, href, sizes = a.get("rel", "").lower(), a.get("href", ""), a.get("sizes", "")
            if not href:
                return
            groesse = max([int(x) for x in re.findall(r"(\d+)x\d+", sizes)] or [0])
            if "apple-touch-icon" in rel:
                self.kandidaten.append((70, "url", href))
            elif "icon" in rel:
                if href.lower().endswith(".svg") or "svg" in a.get("type", ""):
                    self.kandidaten.append((62, "url", href))
                else:
                    self.kandidaten.append((50 if groesse >= 96 else 25 if groesse >= 48 else 12, "url", href))
        if tag == "meta" and a.get("property", a.get("name", "")).lower() in ("og:logo", "logo"):
            self.kandidaten.append((90, "url", a.get("content", "")))
        if tag == "script" and a.get("type", "").lower() == "application/ld+json":
            self.ldjson, self.ld = True, ""

    def handle_startendtag(self, tag, attrs):
        if self.svg is not None:
            self.svg.append(self.get_starttag_text() or "")
            return
        self.handle_starttag(tag, attrs)
        if tag == "header":
            self.tiefe_header = max(0, self.tiefe_header - 1)

    def handle_endtag(self, tag):
        if self.svg is not None:
            self.svg.append(f"</{tag}>")
            self.svg_tiefe -= 1
            if self.svg_tiefe == 0:
                text = "".join(self.svg)
                if 'xmlns="' not in text[:300]:
                    text = text.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
                self.kandidaten.append((95 if self.tiefe_header else 80, "svg", text))
                self.svg = None
            return
        if tag == "header" and self.tiefe_header:
            self.tiefe_header -= 1
        if tag == "script" and self.ldjson:
            self.ldjson = False
            for m in re.finditer(r'"logo"\s*:\s*(?:\{[^{}]*?"url"\s*:\s*)?"([^"]+)"', self.ld):
                self.kandidaten.append((92, "url", m.group(1)))

    def handle_data(self, data):
        if self.svg is not None:
            self.svg.append(data.replace("&", "&amp;").replace("<", "&lt;"))
        elif self.ldjson:
            self.ld += data


# --------------------------------------------------------------------------- Bild aufbereiten
def png_aus(daten: bytes, art: str) -> str | None:
    """Bild → data-URL (PNG, längste Seite 256 px) oder None, wenn es kein brauchbares Logo ist."""
    from PIL import Image

    try:
        if "svg" in art or daten.lstrip()[:200].lower().find(b"<svg") >= 0:
            import cairosvg

            daten = cairosvg.svg2png(bytestring=daten, output_width=MAX * 2)
            raster_klein = False
        else:
            raster_klein = None
        img = Image.open(io.BytesIO(daten))
        if getattr(img, "format", "") == "ICO":
            groessen = sorted(img.info.get("sizes") or [img.size], key=lambda s: s[0] * s[1])
            img.size = groessen[-1]
        img.load()
        img = img.convert("RGBA")
    except Exception:
        return None
    w, h = img.size
    if raster_klein is None and max(w, h) < 48:
        return None  # winziges Favicon: lieber gar keins
    if w > 6 * h or h > 4 * w or w < 8 or h < 8:
        return None  # Banner oder Linie, kein Logo
    sichtbar = img.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not sichtbar:
        return None
    img = img.crop(sichtbar)  # leeren Rand entfernen
    farben = img.convert("RGB").resize((24, 24)).getcolors(24 * 24) or []
    if len(farben) <= 1:
        return None  # einfarbige Fläche
    f = MAX / max(img.size)
    img = img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))), Image.LANCZOS)
    for fmt, kw in (("PNG", {"optimize": True}), ("WEBP", {"quality": 90})):
        buf = io.BytesIO()
        img.save(buf, fmt, **kw)
        url = f"data:image/{fmt.lower()};base64," + base64.b64encode(buf.getvalue()).decode()
        if len(url) <= 190000:
            return url
    return None


def logo_von_website(website: str) -> str | None:
    basis = website.strip()
    if not basis:
        return None
    if not re.match(r"^https?://", basis):
        basis = "https://" + basis
    seite = laden(basis, 3_000_000)
    if not seite:
        return None
    html_text = seite[0].decode("utf-8", "replace")
    p = Seite()
    try:
        p.feed(html_text)
    except Exception:
        pass
    ziel = seite[2]
    kand = sorted(p.kandidaten, key=lambda k: -k[0])
    kand += [(30, "url", "/apple-touch-icon.png"), (10, "url", "/favicon.ico")]
    gesehen = set()
    for _, art, wert in kand[:14]:
        if art == "svg":
            url = png_aus(wert.encode(), "svg")
        else:
            if wert.startswith("data:image/"):
                kopf, _, inhalt = wert.partition(",")
                try:
                    daten = base64.b64decode(inhalt) if ";base64" in kopf else urllib.parse.unquote(inhalt).encode()
                except Exception:
                    continue
                url = png_aus(daten, kopf)
            else:
                absolut = urllib.parse.urljoin(ziel, wert)
                if absolut in gesehen:
                    continue
                gesehen.add(absolut)
                got = laden(absolut)
                url = png_aus(got[0], got[1] + " " + absolut.lower()) if got else None
        if url:
            return url
    return None


def logo_von_demo(slug: str) -> str | None:
    if not re.match(r"^[a-z0-9-]{3,80}$", slug or ""):
        return None
    got = laden(f"https://entwurf.medialyte.de/{slug}/logo.svg")
    return png_aus(got[0], "svg") if got and b"<svg" in got[0][:500].lower() else None


# --------------------------------------------------------------------------- Ablauf
def main(argv: list[str]) -> int:
    neu = "--neu" in argv
    bedingung = "c.logo is null" if not neu else "(c.logo is null or c.logo_quelle in ('website', 'demo'))"
    zeilen = sql(f"""select c.id::text as id, coalesce(nullif(btrim(c.website), ''), k.stand->>'domain', k.eingaben->>'domain', '') as website,
                            coalesce(c.kunde_slug, '') as slug
                     from public.customers c left join public.kunden k on k.slug = c.kunde_slug
                     where {bedingung}""")
    stand = {"kunden": len(zeilen), "website": 0, "demo": 0, "ohne": 0}
    for z in zeilen:
        if not UUID.match(z.get("id", "")):
            continue
        url, quelle = logo_von_website(z.get("website") or ""), "website"
        if not url and z.get("slug"):
            url, quelle = logo_von_demo(z["slug"]), "demo"
        if not url:
            stand["ohne"] += 1
            continue
        assert re.match(r"^data:image/(png|webp);base64,[A-Za-z0-9+/=]+$", url)
        schutz = "logo is null" if not neu else "(logo is null or logo_quelle in ('website', 'demo'))"
        sql(f"update public.customers set logo = '{url}', logo_quelle = '{quelle}' where id = '{z['id']}' and {schutz}")
        stand[quelle] += 1
    print(json.dumps(stand))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
