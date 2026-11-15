// Auto-Planung: verteilt offene Aufgaben in die freie Zeit.
// Reihenfolge: früheste Frist zuerst, dann Wichtigkeit, dann Alter. Jede Aufgabe kommt in die erste freie Lücke
// innerhalb der Arbeitszeit, mit Puffer zu Terminen, Trainings und anderen Blöcken, und nie mehr als die Tagesgrenze.
// Von Hand gesetzte (fixierte), erledigte und gerade laufende Aufgaben bleiben, wo sie sind.
import { MIN, TAG, beiMinute, minuten, plusTage, tagBeginn, tagKey, wochentag, keyZuDatum } from "./zeit";
import type { Aufgabe, Einstellungen, Gewohnheit } from "./typen";

export type Iv = [number, number];
export type Ergebnis = { neu: Map<string, string | null>; zuSpaet: Set<string>; ohnePlatz: Set<string> };

const RASTER = 5 * MIN;
const hoch = (t: number, r = RASTER) => Math.ceil(t / r) * r;

/** Belegte Zeiten durch Gewohnheiten mit fester Uhrzeit (z. B. Training Di/Fr/So 16:30) */
export function gewohnheitsZeiten(g: Gewohnheit[], von: Date, tage: number): Iv[] {
  const out: Iv[] = [];
  for (let i = 0; i < tage; i++) {
    const d = plusTage(tagBeginn(von), i), w = wochentag(d);
    for (const x of g) if (x.aktiv && x.uhrzeit && x.tage.includes(w)) { const s = beiMinute(d, minuten(x.uhrzeit)).getTime(); out.push([s, s + x.dauer_min * MIN]); }
  }
  return out;
}

export function planen(opt: { aufgaben: Aufgabe[]; belegt: Iv[]; gewohnheiten: Gewohnheit[]; einst: Einstellungen; jetzt?: number; tage?: number; nur?: Set<string>; loesen?: Set<string> }): Ergebnis {
  const { aufgaben, einst } = opt, jetzt = opt.jetzt ?? Date.now(), tage = opt.tage ?? 60;
  const start = hoch(jetzt, 15 * MIN);
  const busy: Iv[] = [...opt.belegt, ...gewohnheitsZeiten(opt.gewohnheiten, new Date(jetzt), tage + 1)];
  const last = new Map<string, number>();   // geplante Minuten je Tag
  const addLast = (s: number, min: number) => { const k = tagKey(s); last.set(k, (last.get(k) ?? 0) + min); };

  const offen = aufgaben.filter((a) => !a.erledigt);
  const zuPlanen: Aufgabe[] = [];
  for (const a of offen) {
    const g = a.geplant ? Date.parse(a.geplant) : null;
    const laeuft = g != null && g <= jetzt && g + a.dauer_min * MIN > jetzt;
    const darf = !opt.nur || opt.nur.has(a.id);
    if ((a.fixiert && !opt.loesen?.has(a.id)) || laeuft || !darf) { if (g != null) { busy.push([g, g + a.dauer_min * MIN]); addLast(g, a.dauer_min); } continue; }
    zuPlanen.push(a);
  }
  const fristMs = (a: Aufgabe) => (a.frist ? keyZuDatum(a.frist).getTime() : Infinity);
  zuPlanen.sort((a, b) => fristMs(a) - fristMs(b) || a.prio - b.prio || a.position - b.position || a.erstellt.localeCompare(b.erstellt));

  const puffer = einst.puffer_min * MIN, ws = minuten(einst.tag_start), we = minuten(einst.tag_ende);
  const neu = new Map<string, string | null>(), zuSpaet = new Set<string>(), ohnePlatz = new Set<string>();

  for (const a of zuPlanen) {
    const dauer = a.dauer_min * MIN;
    let gefunden: number | null = null;
    for (let i = 0; i <= tage && gefunden == null; i++) {
      const tag = plusTage(tagBeginn(start), i), w = wochentag(tag);
      if (!einst.wochenende && w >= 6) continue;
      if ((last.get(tagKey(tag)) ?? 0) + a.dauer_min > einst.tag_max_min && (last.get(tagKey(tag)) ?? 0) > 0) continue;
      const von = Math.max(beiMinute(tag, ws).getTime(), start), bis = beiMinute(tag, we).getTime();
      if (bis - von < dauer) continue;
      // belegte Zeiten des Tages, um den Puffer erweitert
      const heute = busy.filter(([s, e]) => e + puffer > von && s - puffer < bis).map(([s, e]) => [s - puffer, e + puffer] as Iv).sort((x, y) => x[0] - y[0]);
      let c = hoch(von);
      for (const [s, e] of heute) {
        if (s - c >= dauer) break;
        c = Math.max(c, hoch(e));
      }
      if (bis - c >= dauer) gefunden = c;
    }
    if (gefunden == null) { ohnePlatz.add(a.id); if (a.geplant && Date.parse(a.geplant) < jetzt) neu.set(a.id, null); continue; }
    busy.push([gefunden, gefunden + dauer]); addLast(gefunden, a.dauer_min);
    if (a.frist && gefunden > keyZuDatum(a.frist).getTime() + TAG - 1) zuSpaet.add(a.id);
    const iso = new Date(gefunden).toISOString();
    if (a.geplant == null || Date.parse(a.geplant) !== gefunden) neu.set(a.id, iso);
  }
  return { neu, zuSpaet, ohnePlatz };
}
