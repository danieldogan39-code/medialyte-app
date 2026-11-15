// Literaturverzeichnis und Kurzbelege aus den Mustern des Regelwerks erzeugen.
// Muster: {Platzhalter}; Teile in [ … ] fallen weg, wenn ein Platzhalter darin leer ist.
import type { Quelle, Regelwerk } from "./typen";

export type Werte = Record<string, string | undefined>;

export function fuellen(muster: string, w: Werte): string {
  const leer = (k: string) => !w[k] || !String(w[k]).trim();
  let s = muster.replace(/\[([^\[\]]*)\]/g, (_, teil: string) => {
    const ph = [...teil.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return ph.length && ph.some(leer) ? "" : teil;
  });
  s = s.replace(/\{(\w+)\}/g, (_, k: string) => (leer(k) ? "" : String(w[k]).trim()));
  return s.replace(/\s{2,}/g, " ").replace(/\s+([,.:;])/g, "$1").replace(/([,.:;])\1+/g, "$1").replace(/\(\s*\)/g, "").trim().replace(/\s*[:,]$/, "");
}

const nachname = (a: string) => a.split(",")[0].trim();
// „Burmann, Christoph“ → „Burmann, C.“; „Rosenstiel, Lutz von“ → „Rosenstiel, L. von“; Institutionen (ohne Komma) bleiben
function kurzform(a: string) {
  const [n, ...r] = a.split(","); const v = r.join(",").trim(); if (!v) return n.trim();
  const teile = v.split(/\s+/).map((t) => (/^(von|van|de|der|den|zu|da|di|le|la)$/i.test(t) || /^[A-ZÄÖÜ]\.(-[A-ZÄÖÜ]\.)?$/.test(t) ? t : t.split("-").map((x) => x[0]?.toUpperCase() + ".").join("-")));
  return `${n.trim()}, ${teile.join(" ")}`;
}
/** ISM: LV „Nachname, V.; Nachname, V.“ (ab 7: erste 6 + „et al.“), Kurzbeleg „Müller“, „Müller/Schmidt“, „Müller et al.“ */
export function autoren(q: Quelle, rw: Regelwerk | null) {
  const z = (rw?.zitieren as any) ?? {};
  const trennLang: string = z.autoren_trenner_lv ?? "; ", trennKurz: string = z.autoren_trenner ?? "/", ua: string = z.ua ?? "et al.";
  const maxLang: number = z.max_autoren_lv ?? 6, maxKurz: number = z.max_autoren_kurz ?? 2;
  const a = (q.daten.autoren ?? []).map((x) => x.trim()).filter(Boolean);
  const h = (q.daten.hrsg ?? []).map((x) => x.trim()).filter(Boolean);
  const liste = (l: string[]) => (l.length > maxLang ? l.slice(0, maxLang).map(kurzform).join(trennLang) + ` ${ua}` : l.map(kurzform).join(trennLang));
  const lang = a.length ? liste(a) : h.length ? `${liste(h)} (Hrsg.)` : "o. V.";
  const namen = (a.length ? a : h).map(nachname);
  const kurz = namen.length === 0 ? "o. V." : namen.length > maxKurz ? `${namen[0]} ${ua}` : namen.join(trennKurz);
  return { lang, kurz, hrsg: liste(h) };
}
export function werte(q: Quelle, rw: Regelwerk | null, seite?: string): Werte {
  const d = q.daten, au = autoren(q, rw);
  return { Autoren: au.lang, AutorenKurz: au.kurz, Hrsg: au.hrsg, Jahr: d.jahr || "o. J.", Titel: d.titel, Untertitel: d.untertitel,
    Ort: d.ort || (q.typ === "buch" || q.typ === "sammelwerk" ? "o. O." : undefined), Auflage: d.auflage && Number.parseInt(d.auflage) >= 2 ? String(Number.parseInt(d.auflage)) : undefined, Verlag: d.verlag, Sammelwerk: d.sammelwerk, Zeitschrift: d.zeitschrift, Jahrgang: d.jahrgang,
    Heft: d.heft, Seiten: d.seiten, Seite: seite, URL: d.url, Abruf: d.abruf ? d.abruf.split("-").reverse().join(".") : undefined, DOI: d.doi };
}
export function lvEintrag(q: Quelle, rw: Regelwerk | null): string {
  const m = rw?.zitieren.lv_muster.find((x) => x.typ === q.typ) ?? rw?.zitieren.lv_muster.find((x) => x.typ === "sonstiges");
  const w = werte(q, rw);
  if (m) return fuellen(m.muster, w);
  return fuellen("{Autoren} ({Jahr}): {Titel}[. {Untertitel}][, {Zeitschrift}][, {Jahrgang}][, {Heft}][, {Ort}: {Verlag}][, S. {Seiten}][, {URL}][, abgerufen am {Abruf}].", w);
}
export function kurzbeleg(q: Quelle, rw: Regelwerk | null, seite: string, direkt: boolean): string {
  const art = `${q.typ}-${direkt ? "direkt" : "indirekt"}`;
  const m = rw?.zitieren.beispiele.find((x) => x.art === art) ?? rw?.zitieren.beispiele.find((x) => x.art.endsWith(direkt ? "-direkt" : "-indirekt"));
  const w = werte(q, rw, seite);
  if (m) return fuellen(m.muster, w);
  return fuellen(`${direkt ? "" : (rw?.zitieren.indirekt_praefix ?? "vgl.") + " "}{AutorenKurz} {Jahr}[: {Seite}]`, w);
}
/** Prüft eine Quelle gegen die Verbotsliste und auf fehlende Pflichtangaben */
export function warnungen(q: Quelle, rw: Regelwerk | null): string[] {
  const out: string[] = [], d = q.daten, text = `${lvEintrag(q, rw)} ${d.url ?? ""}`;
  for (const v of rw?.quellen.verboten ?? []) { try { if (new RegExp(v.muster, "i").test(text)) out.push(`${v.name}: ${v.grund}`); } catch { /* ungültiges Muster */ } }
  if (!d.autoren?.length && !d.hrsg?.length && !out.some((x) => /o\. V\./.test(x))) out.push("Autor oder herausgebende Institution eintragen – Quellen ohne Autor (o. V.) sind an der ISM nicht zitierfähig");
  if (!d.jahr) out.push("Jahr fehlt (sonst „o. J.“)");
  if (!d.titel) out.push("Titel fehlt");
  if (q.typ === "internet" && !d.url) out.push("URL fehlt");
  if (q.typ === "internet" && !d.abruf) out.push("Abrufdatum fehlt");
  if (q.typ === "zeitschrift" && (!d.zeitschrift || !d.seiten)) out.push("Zeitschrift und Seitenbereich angeben");
  if ((q.typ === "buch" || q.typ === "sammelwerk") && !d.verlag) out.push("Verlag fehlt");
  if (q.typ === "sammelwerk" && !d.sammelwerk) out.push("Titel des Sammelwerks fehlt");
  return out;
}
export const sortiert = (l: Quelle[], rw: Regelwerk | null) => [...l].sort((a, b) => lvEintrag(a, rw).localeCompare(lvEintrag(b, rw), "de", { sensitivity: "base" }));
