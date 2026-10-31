// Kunden: Website übernehmen (wie früher im Cockpit) und Tischbücher aus dem Zähler-Dienst
import { sb } from "./supabase";

export type Impressum = { firma: string; vertreten: string; strasse: string; plz_ort: string; telefon: string; email: string; ust_id: string; register: string };
export type Eingaben = { name?: string; slug?: string; domain?: string; impressum?: Partial<Impressum>; datenschutz?: string; fotos_aus?: number[]; fotos_eigen?: number[]; auftrag?: { art: string; zeit: string } };
export type Stand = { stand?: string; domain?: string; vorschau?: string; nameserver?: string[]; mx?: string[]; live_seit?: string; fehler?: string | null; aktualisiert?: string; auftrag_erledigt?: string };
export type Aenderung = { id: string; zeit: string; auftrag: string; zusammenfassung: string; status: string; gruppe: string; live_seit?: string };
export type Kunde = { slug: string; betrieb_id: string | null; name: string; eingaben: Eingaben; stand: Stand; betreuung: { aenderungen?: Aenderung[]; kandidat?: any }; aktualisiert: string };
export type DemoInfo = { fotos: string[]; adresse: { strasse?: string; plz_ort?: string }; reservierung: boolean; karte: boolean; fehler?: boolean };

export const STAND: Record<string, { name: string; ton: string }> = {
  baut: { name: "Wird gebaut", ton: "gelb" },
  vorschau: { name: "Vorschau fertig", ton: "blau" },
  wartet: { name: "Wartet auf Nameserver", ton: "gelb" },
  live: { name: "Live", ton: "gruen" },
  fehler: { name: "Hat nicht geklappt", ton: "rot" },
};

export const IMPRESSUM: { k: keyof Impressum; label: string; hinweis?: string; pflicht?: boolean; breit?: boolean; typ?: string }[] = [
  { k: "firma", label: "Name oder Firma", hinweis: "z. B. Lokal am Eck GmbH oder Inhaber Ada Eck", pflicht: true, breit: true },
  { k: "vertreten", label: "Vertreten durch", hinweis: "bei GmbH: Geschäftsführer", breit: true },
  { k: "strasse", label: "Straße und Nr.", pflicht: true },
  { k: "plz_ort", label: "PLZ und Ort", pflicht: true },
  { k: "telefon", label: "Telefon", pflicht: true, typ: "tel" },
  { k: "email", label: "E-Mail", pflicht: true, typ: "email" },
  { k: "ust_id", label: "USt-IdNr.", hinweis: "falls vorhanden" },
  { k: "register", label: "Registereintrag", hinweis: "z. B. Amtsgericht Hamburg, HRB 12345" },
];

export function domainVorschlag(name: string) {
  let t = String(name || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/&/g, "und");
  t = t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (t.slice(0, 40).replace(/-+$/, "") || "ihr-betrieb") + ".de";
}
export function domainPruefen(text: string) {
  let d = String(text || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/^\.+|\.+$/g, "");
  if (d.startsWith("www.")) d = d.slice(4);
  return /^(?!-)[a-z0-9äöüß-]{1,63}(?:\.[a-z0-9äöüß-]{1,63})*\.[a-z]{2,24}$/.test(d) && !/(^|\.)-|-(\.|$)/.test(d) ? d : "";
}

/** Aus der Demo selbst: Google-Fotos (in derselben Reihenfolge wie beim Bauen), Adresse, Reservierung, Karte */
const demoCache: Record<string, DemoInfo> = {};
export async function demoLesen(url: string): Promise<DemoInfo> {
  if (demoCache[url]) return demoCache[url];
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const html = await r.text(), fotos: string[] = [];
    for (let u of html.match(/https:\/\/lh3\.googleusercontent\.com\/[^"'\s)<>,]+/g) ?? []) { u = u.replace(/&amp;/g, "&"); if (!fotos.includes(u)) fotos.push(u); }
    const adresse: DemoInfo["adresse"] = {}, m = html.match(/google\.com\/maps\/dir\/\?api=1&(?:amp;)?destination=([^"'&]+)/);
    if (m) {
      const t = decodeURIComponent(m[1].replace(/\+/g, " ")).split(",").map((z) => z.trim()), plz = t.find((z) => /^\d{5}\s+\S/.test(z));
      if (plz && t[0] !== plz) { adresse.strasse = t[0]; adresse.plz_ort = plz; }
    }
    return (demoCache[url] = { fotos, adresse, reservierung: /data-reservierung/.test(html), karte: /data-karte/.test(html) });
  } catch {
    return { fotos: [], adresse: {}, reservierung: true, karte: false, fehler: true };
  }
}

/** Datenschutz-Vorlage aus den Bausteinen des Agenten (nur, was die Seite wirklich hat) */
export async function datenschutzVorlage(d: DemoInfo): Promise<string> {
  const { data } = await sb.from("texte").select("daten").eq("name", "datenschutz").maybeSingle();
  const teile: { wenn: string | null; text: string }[] = data?.daten?.teile ?? [];
  return teile.filter((t) => !t.wenn || (d as any)[t.wenn]).map((t) => t.text).join("\n\n");
}

/** Bild verkleinern (max. 2000 px) und als JPEG in den privaten Speicher laden */
export async function fotoHochladen(slug: string, nr: number, datei: File): Promise<string | null> {
  const bmp = await createImageBitmap(datei, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const f = Math.min(1, 2000 / Math.max(bmp.width, 1)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.86));
  if (!blob) return "Bild ließ sich nicht lesen";
  const { error } = await sb.storage.from("kundenfotos").upload(`${slug}/${nr}.jpg`, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "0" });
  return error ? error.message : null;
}

// ---------- Tischbuch (aus dem Zähler-Dienst, nur durchgereicht, nirgends gespeichert)
export type Lage = { name?: string; offen?: number; offen_seit?: string; heute_tische?: number; heute_personen?: number; kommend?: number; woche?: number; letzte?: string;
  geraete?: number; pause_alle?: boolean; pause_bis?: string; auto_regel?: { an: boolean; max: number }; demo?: boolean; telefon?: string; mail_aktiv?: boolean };
export const WARTEN_MS = 60 * 60000;  // ab einer Stunde ohne Antwort wartet ein Gast
export const wartet = (l?: Lage | null) => !!(l && l.offen && l.offen_seit && Date.now() - Date.parse(l.offen_seit) > WARTEN_MS);
export function dauer(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000)); if (m < 60) return m + " Min.";
  const h = Math.round(m / 60); if (h < 36) return h + " Std.";
  const t = Math.round(h / 24); return t + (t === 1 ? " Tag" : " Tagen");
}
export const personen = (n?: number) => { n = Number(n) || 0; return n + (n === 1 ? " Person" : " Personen"); };
export function hinweise(l: Lage): [string, string][] {
  const z: [string, string][] = [];
  if (wartet(l)) z.push(["rot", (l.offen === 1 ? "Ein Gast wartet" : `Die älteste von ${l.offen} Anfragen wartet`) + ` seit ${dauer(Date.now() - Date.parse(l.offen_seit!))} auf Antwort.`]);
  if (!l.geraete) z.push(["gelb", "Keine Benachrichtigungen eingeschaltet: Das Restaurant sieht neue Anfragen nur, wenn es selbst nachschaut."]);
  if (l.pause_alle) z.push(["gelb", "Online-Anfragen sind pausiert."]);
  else if (l.pause_bis) z.push(["gelb", `Online-Anfragen pausiert bis ${l.pause_bis.split("-").reverse().join(".")}.`]);
  if (!z.length) z.push(["gruen", `Benachrichtigungen auf ${l.geraete === 1 ? "1 Gerät" : l.geraete + " Geräten"}` + (l.auto_regel?.an ? ` · bestätigt automatisch bis ${personen(l.auto_regel.max)}` : "") + "."]);
  return z;
}
export async function tischbuecher(): Promise<{ lokale: Record<string, Lage> | null; fehler?: string }> {
  const { data, error } = await sb.functions.invoke("zaehler", { body: { aktion: "tischbuecher" } });
  if (error || !data?.ok) return { lokale: null, fehler: data?.error ?? "Der Dienst ist gerade nicht erreichbar." };
  return { lokale: data.lokale ?? null, fehler: data.lokale ? undefined : data.hinweis };
}
export async function tischbuch(slug: string): Promise<{ lokal?: Lage; anfragen?: any[]; heute?: string; fehler?: string }> {
  const { data, error } = await sb.functions.invoke("zaehler", { body: { aktion: "tischbuch", slug } });
  if (error || !data?.ok) {
    let m = data?.error as string | undefined;
    try { m = m ?? (await (error as any)?.context?.json())?.error; } catch { /* egal */ }
    return { fehler: m ?? "Der Dienst ist gerade nicht erreichbar." };
  }
  return data;
}

/** Stand inklusive gerade laufendem Auftrag (Befehl abgeschickt, aber noch nicht fertig gebaut) */
export function standMit(k: Kunde | null, befehle: any[]): Stand & { art?: string } {
  const s: Stand = k?.stand ?? {};
  const b = befehle.find((x) => x.art === "kunde" && x.status !== "fehler");
  if (b && (!s.aktualisiert || Date.parse(b.erstellt) > Date.parse(s.aktualisiert))) return { ...s, stand: "baut", art: b.daten?.auftrag, fehler: null };
  const f = befehle.find((x) => x.art === "kunde");
  if (f?.status === "fehler" && (!s.aktualisiert || Date.parse(f.erstellt) > Date.parse(s.aktualisiert))) return { ...s, stand: "fehler", fehler: String(f.ergebnis ?? "").replace(/^Fehler:\s*/, "") };
  return s;
}

/** Gewonnenen Kunden wieder aus dem Kundenmenü nehmen: im Nachfassen „Kein Interesse“, der Betrieb ist nicht mehr „Kunde“ */
export async function kundeAufheben(slug: string, grund = "Kunde gelöscht") {
  const { data: nf } = await sb.from("nachfass").select("*").eq("slug", slug).maybeSingle();
  const zeit = new Date().toISOString();
  const verlauf = [...(((nf as any)?.verlauf ?? []) as any[]), { zeit, status: "kein_interesse", notiz: grund }].slice(-50);
  await sb.from("nachfass").upsert({ slug, status: "kein_interesse", wieder: null, notiz: (nf as any)?.notiz ?? "", verlauf, zeit });
  const { data: d } = await sb.from("demos").select("betrieb_id").eq("slug", slug).maybeSingle();
  if ((d as any)?.betrieb_id) await sb.from("betriebe").update({ status: "abgelehnt" }).eq("id", (d as any).betrieb_id).eq("status", "kunde");
}
