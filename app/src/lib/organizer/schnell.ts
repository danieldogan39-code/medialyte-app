// Schnelleingabe: „Mathe Kapitel 3 90min bis Fr !“ → Aufgabe mit Fach, Dauer, Frist und Wichtigkeit.
// Erkannt wird: Dauer (90min, 1,5h, 2 Std), Frist (bis heute/morgen/Fr/20.12.), feste Zeit (morgen 14:00, Fr um 9),
// Wichtigkeit (! = hoch, ? = niedrig) und das Fach am Anfang (Name oder Anfang eines Namens).
import type { Fach } from "./typen";
import { plusTage, tagBeginn, tagKey, wochentag } from "./zeit";

export type Erkannt = { titel: string; dauer_min: number | null; frist: string | null; geplant: Date | null; prio: 1 | 2 | 3; fach: Fach | null; teile: string[] };

const WT: Record<string, number> = { mo: 1, montag: 1, di: 2, dienstag: 2, mi: 3, mittwoch: 3, do: 4, donnerstag: 4, fr: 5, freitag: 5, sa: 6, samstag: 6, so: 7, sonntag: 7 };
export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Passt ein Fach zu einem Text? (enthalten, oder jedes Wort des Fachs beginnt ein Wort im Text: „Wiss. Arbeiten“ ↔ „Wissenschaftliches Arbeiten“) */
const KUERZEL: Record<string, string> = { bwl: "betriebswirtschaft", vwl: "volkswirtschaft", rewe: "rechnungswesen", wiar: "wissenschaftliches arbeiten", kalk: "kalkulation" };
export function fachPasst(f: Fach, text: string): boolean {
  if (f.name_lang && fachPasst({ ...f, name: f.name_lang, name_lang: null }, text)) return true;
  const n = norm(text), fn = norm(f.name);
  if (KUERZEL[fn] && n.includes(KUERZEL[fn])) return true;
  if (fn.length >= 3 && (` ${n} `).includes(` ${fn}`)) return true;
  if (fn.length >= 4 && n.includes(fn)) return true;
  const worte = n.split(" "), fw = fn.split(" ").filter(Boolean);
  return fw.length > 0 && fw.every((x) => x.length >= 2 && worte.some((w) => w.startsWith(x))) && fw.join("").length >= 3;
}
export const fachFuer = (faecher: Fach[], text: string) => faecher.filter((f) => !f.archiviert).sort((a, b) => b.name.length - a.name.length).find((f) => fachPasst(f, text)) ?? null;

function tagAus(wort: string, heute = new Date()): Date | null {
  const w = wort.toLowerCase().replace(/\.$/, "");
  if (w === "heute") return tagBeginn(heute);
  if (w === "morgen") return plusTage(tagBeginn(heute), 1);
  if (w === "übermorgen" || w === "uebermorgen") return plusTage(tagBeginn(heute), 2);
  if (WT[w]) { const d = (WT[w] - wochentag(heute) + 7) % 7 || 7; return plusTage(tagBeginn(heute), d); }
  const m = w.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/);
  if (m) {
    let y = m[3] ? +m[3] : heute.getFullYear(); if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (!m[3] && d.getTime() < plusTage(tagBeginn(heute), -60).getTime()) d.setFullYear(y + 1);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
const TAGWORT = "(heute|morgen|übermorgen|uebermorgen|mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|\\d{1,2}\\.\\d{1,2}\\.?(?:\\d{2,4})?)";

export function erkennen(eingabe: string, faecher: Fach[], heute = new Date()): Erkannt {
  let t = " " + eingabe.trim() + " ";
  const teile: string[] = [];
  let dauer_min: number | null = null, frist: string | null = null, geplant: Date | null = null, prio: 1 | 2 | 3 = 2;

  t = t.replace(/\s(\d+(?:[.,]\d+)?)\s?(min|minuten|m|h|std|stunden|stunde)\.?(?=\s)/i, (_x, z, e) => {
    const n = parseFloat(z.replace(",", ".")); dauer_min = Math.round(/^m/i.test(e) ? n : n * 60);
    if (dauer_min < 5 || dauer_min > 720) dauer_min = null; else teile.push(`⏱ ${dauer_min} Min.`);
    return " ";
  });
  t = t.replace(new RegExp(`\\s(?:bis|frist|fällig)\\s+${TAGWORT}(?=\\s)`, "i"), (_x, w) => {
    const d = tagAus(w, heute); if (d) { frist = tagKey(d); teile.push(`bis ${d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}`); }
    return " ";
  });
  t = t.replace(new RegExp(`\\s(?:am\\s+)?${TAGWORT}\\s+(?:um\\s+)?(\\d{1,2})(?::(\\d{2}))?(?:\\s?uhr)?(?=\\s)`, "i"), (x, w, h, m) => {
    const d = tagAus(w, heute); if (!d || +h > 23 || +(m ?? 0) > 59) return x;
    d.setHours(+h, +(m ?? 0), 0, 0); geplant = d; teile.push(`📌 ${d.toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`);
    return " ";
  });
  t = t.replace(/\s(!{1,3})(?=\s)/, () => { prio = 1; teile.push("wichtig"); return " "; });
  t = t.replace(/\s\?(?=\s)/, () => { prio = 3; teile.push("unwichtig"); return " "; });
  const titel = t.replace(/\s+/g, " ").trim();
  const fach = fachFuer(faecher, titel.split(" ").slice(0, 4).join(" "));
  if (fach) teile.unshift(fach.name);
  return { titel, dauer_min, frist, geplant, prio, fach, teile };
}
