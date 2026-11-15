// Lernplan übernehmen: Zeilen aus der Tabelle „Lernplan bis 21.12.2026“ (kopiert oder als CSV) in Termine,
// Aufgaben und Gewohnheiten umwandeln. Spalten: Datum | Zeit | Fach | Was genau | Erledigt | Notiz
//   Vorlesung / Klausur  → Termin (Art vorlesung / klausur), Fach aus dem Titel erkannt
//   Training             → Gewohnheit „Training“ (Tage und Uhrzeit aus den Zeilen), keine Einzeltermine
//   alles andere         → Aufgabe mit festem Zeitblock (fixiert), Frist = derselbe Tag
import { norm } from "./schnell";
import { plusTage, tagBeginn, tagKey, wochentag } from "./zeit";

export type ImportZeile = { tag: Date; von: Date | null; bis: Date | null; fach: string; titel: string; erledigt: boolean; notiz: string | null };
export type ImportPlan = { termine: ImportZeile[]; aufgaben: ImportZeile[]; training: { tage: number[]; pro_woche: number; uhrzeit: string | null; dauer: number } | null; faecher: string[]; fehler: string[] };

function spalten(zeile: string): string[] {
  if (zeile.includes("\t")) return zeile.split("\t");
  // CSV mit Komma oder Semikolon, Felder evtl. in Anführungszeichen
  const trenn = (zeile.match(/;/g)?.length ?? 0) > (zeile.match(/,/g)?.length ?? 0) ? ";" : ",";
  const out: string[] = []; let akt = "", q = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') { if (q && zeile[i + 1] === '"') { akt += '"'; i++; } else q = !q; }
    else if (c === trenn && !q) { out.push(akt); akt = ""; }
    else akt += c;
  }
  out.push(akt); return out;
}

function tagLesen(s: string, heute: Date): Date | null {
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/);
  if (m) {
    let y = m[3] ? +m[3] : heute.getFullYear(); if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (!m[3] && d.getTime() < plusTage(tagBeginn(heute), -90).getTime()) d.setFullYear(y + 1);
    return d;
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]) : null;
}
function zeitLesen(s: string, tag: Date): [Date | null, Date | null] {
  const m = s.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) { const e = s.match(/(\d{1,2}):(\d{2})/); if (!e) return [null, null]; const a = new Date(tag); a.setHours(+e[1], +e[2], 0, 0); return [a, null]; }
  const a = new Date(tag), b = new Date(tag); a.setHours(+m[1], +m[2], 0, 0); b.setHours(+m[3], +m[4], 0, 0);
  return [a, b > a ? b : null];
}

export function lesen(text: string, heute = new Date()): ImportPlan {
  const plan: ImportPlan = { termine: [], aufgaben: [], training: null, faecher: [], fehler: [] };
  const trainings: ImportZeile[] = [];
  for (const roh of text.replace(/\r/g, "").split("\n")) {
    if (!roh.trim()) continue;
    const s = spalten(roh).map((x) => x.trim());
    if (s.length < 4) continue;
    const [d, z, fach, titel, erl = "", notiz = ""] = s;
    if (/^datum$/i.test(d) || /^fortschritt$/i.test(d)) continue;
    const tag = tagLesen(d, heute);
    if (!tag) { plan.fehler.push(`Datum nicht erkannt: „${d}“`); continue; }
    const [von, bis] = zeitLesen(z, tag);
    const zeile: ImportZeile = { tag, von, bis, fach, titel: titel || fach, erledigt: /^(true|wahr|ja|x|✓|1)$/i.test(erl), notiz: notiz || null };
    const f = norm(fach);
    if (f === "vorlesung" || f === "klausur") plan.termine.push(zeile);
    else if (f === "training") trainings.push(zeile);
    else if (titel) { plan.aufgaben.push(zeile); if (fach && !plan.faecher.includes(fach)) plan.faecher.push(fach); }
  }
  if (trainings.length) {
    // die häufigsten Wochentage (so oft, wie pro Woche trainiert wird)
    const wochen = new Set(trainings.map((t) => tagKey(plusTage(t.tag, -(wochentag(t.tag) - 1))))).size || 1;
    const proWoche = Math.max(1, Math.min(7, Math.round(trainings.length / wochen)));
    const zaehl = new Map<number, number>();
    for (const t of trainings) zaehl.set(wochentag(t.tag), (zaehl.get(wochentag(t.tag)) ?? 0) + 1);
    const tage = [...zaehl.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, proWoche).map(([w]) => w).sort();
    const zeiten = trainings.map((t) => t.von).filter(Boolean) as Date[];
    const haeufig = new Map<string, number>();
    for (const x of zeiten) { const k = `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; haeufig.set(k, (haeufig.get(k) ?? 0) + 1); }
    const uhrzeit = [...haeufig.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const dauern = trainings.filter((t) => t.von && t.bis).map((t) => (t.bis!.getTime() - t.von!.getTime()) / 60000);
    plan.training = { tage, pro_woche: proWoche, uhrzeit, dauer: dauern.length ? Math.round(dauern.sort((a, b) => a - b)[Math.floor(dauern.length / 2)]) : 90 };
  }
  return plan;
}

export const fristVon = (z: ImportZeile) => tagKey(z.tag);
