// Kundenlogos: Bilddatei → kleines PNG (höchstens 256 px, Seitenverhältnis bleibt) als data-URL für customers.logo
export const LOGO_MAX = 256;

function laden(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fehler) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fehler(new Error("Bild ließ sich nicht lesen"));
    img.src = url;
  });
}

/** Datei (PNG, JPEG, WebP, SVG, GIF) verkleinern und als PNG-data-URL zurückgeben */
export async function logoAusDatei(datei: File): Promise<string> {
  if (datei.size > 10 * 1024 * 1024) throw new Error("Die Datei ist größer als 10 MB.");
  const url = URL.createObjectURL(datei);
  try {
    const img = await laden(url);
    let w = img.naturalWidth || 512, h = img.naturalHeight || 512;  // SVG ohne Größe: quadratisch annehmen
    const g = LOGO_MAX / Math.max(w, h); w *= g; h *= g;  // längste Seite 256 px
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/png");
    if (out.length > 190000) out = c.toDataURL("image/webp", 0.9);
    if (out.length > 190000) throw new Error("Das Logo ist zu detailreich. Bitte eine einfachere Datei nehmen.");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Zwei Buchstaben für Kunden ohne Logo */
export function kuerzel(name: string) {
  const w = String(name || "?").replace(/\b(gmbh|ug|kg|ag|e\.?\s?k\.?|ohg|gbr|mbh|co\.?)\b/gi, "").trim().split(/[\s&+-]+/).filter(Boolean);
  return ((w[0]?.[0] ?? "?") + (w.length > 1 ? w[1][0] : (w[0]?.[1] ?? ""))).toUpperCase();
}

/** Ruhige, gleichbleibende Farbe je Name */
export function farbeVon(name: string) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 42%)`;
}
