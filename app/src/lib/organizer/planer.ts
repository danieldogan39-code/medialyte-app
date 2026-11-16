// Auto-Planung: verteilt offene Aufgaben in die freie Zeit.
// Reihenfolge: früheste Frist zuerst, dann Wichtigkeit, dann Reihenfolge/Alter.
// Gibt es eine Tagesroutine mit Fokusblöcken, wird nur in diese Blöcke geplant – schwere Aufgaben bevorzugt in den Block mit
// höchstem Niveau, leichte in den mit niedrigem. Sonst gilt die Arbeitszeit aus den Einstellungen.
// Termine, Fahrten zur Uni, Gewohnheiten, feste Routine-Punkte und fixierte Aufgaben bleiben frei (mit Puffer).
// Eine Aufgabe mit „ab“ wird nicht vor diesem Tag geplant.
// Ein Lerncheck (Abschluss eines Kapitels) beginnt nie vor dem Ende der Lektionen, die im Kurs vor ihm dran sind –
// sonst rutscht er als kurze Aufgabe in eine frühe Lücke und läge vor seinem Kapitel.
// Lernchecks sind Wiederholung: Sie werden erst nach allem anderen verteilt. Reicht die Zeit vor der Klausur nicht für alles,
// bleiben zuerst Lernchecks ohne Termin – nie eine neue Lektion.
import { MIN, TAG, beiMinute, minuten, plusTage, tagBeginn, tagKey, wochentag, keyZuDatum } from "./zeit";
import type { Aufgabe, Einstellungen, Gewohnheit, Routine } from "./typen";

export type Iv = [number, number];
export type Ergebnis = { neu: Map<string, string | null>; zuSpaet: Set<string>; ohnePlatz: Set<string> };
type Fenster = { von: number; bis: number; niveau: number };

const RASTER = 5 * MIN;
const hoch = (t: number, r = RASTER) => Math.ceil(t / r) * r;

/** Uhrzeit einer Gewohnheit an einem Wochentag (eigene Zeit je Tag, sonst die allgemeine) */
export const zeitAm = (g: Gewohnheit, w: number): string | null => g.zeiten?.[String(w)] || g.uhrzeit || null;
/** Wann eine Gewohnheit an einem Tag stattfindet. Liegt zur Wunschzeit ein Termin oder Weg, rückt sie dahinter
 *  (bis spätestens 21:30 Ende) oder, wenn das nicht geht, davor – so kollidiert z. B. Training nie mit Vorlesung oder Kirche. */
export function gewohnheitAm(g: Gewohnheit, tag: Date | number, belegt: Iv[] = [], puffer = 15 * MIN): Iv | null {
  const d = tagBeginn(tag), w = wochentag(d), z = zeitAm(g, w);
  if (!g.aktiv || !z || !g.tage.includes(w)) return null;
  const dauer = g.dauer_min * MIN, s0 = beiMinute(d, minuten(z)).getTime();
  const d0 = d.getTime(), heute = belegt.filter(([s, e]) => e > d0 && s < d0 + TAG).sort((a, b) => a[0] - b[0]);
  const frei = (s: number) => !heute.some(([x, y]) => x - puffer < s + dauer && y + puffer > s);
  if (frei(s0)) return [s0, s0 + dauer];
  const spaet = beiMinute(d, 21 * 60 + 30).getTime(), frueh = beiMinute(d, 7 * 60 + 30).getTime();
  for (const [, y] of heute) { const s = hoch(y + puffer, 15 * MIN); if (s > s0 && s + dauer <= spaet && frei(s)) return [s, s + dauer]; }
  for (const [x] of [...heute].reverse()) { const s = Math.floor((x - puffer - dauer) / (15 * MIN)) * 15 * MIN; if (s < s0 && s >= frueh && frei(s)) return [s, s + dauer]; }
  return [s0, s0 + dauer];   // geht nicht anders: Wunschzeit (wird als Überschneidung gemeldet)
}
/** Belegte Zeiten durch Gewohnheiten mit fester Uhrzeit (z. B. Training Mo/Mi/Sa) */
export function gewohnheitsZeiten(g: Gewohnheit[], von: Date, tage: number, belegt: Iv[] = []): Iv[] {
  const out: Iv[] = [];
  for (let i = 0; i < tage; i++) {
    const d = plusTage(tagBeginn(von), i);
    for (const x of g) { const iv = gewohnheitAm(x, d, belegt); if (iv) out.push(iv); }
  }
  return out;
}
/** Routine-Punkte (ohne Fokusblöcke) als belegte Zeiten */
export function routineZeiten(r: Routine[], von: Date, tage: number): Iv[] {
  const out: Iv[] = [];
  for (let i = 0; i < tage; i++) {
    const d = plusTage(tagBeginn(von), i), w = wochentag(d);
    for (const x of r) if (x.aktiv && x.art !== "block" && x.tage.includes(w)) { const s = beiMinute(d, minuten(x.start)).getTime(); out.push([s, s + x.dauer_min * MIN]); }
  }
  return out;
}

export function planen(opt: {
  aufgaben: Aufgabe[]; belegt: Iv[]; gewohnheiten: Gewohnheit[]; einst: Einstellungen; routine?: Routine[]; niveauVon?: (a: Aufgabe) => number;
  jetzt?: number; tage?: number; nur?: Set<string>; loesen?: Set<string>;
  /** harte Grenze (z. B. Klausurbeginn bei Lernaufgaben): danach ist die Aufgabe wertlos, also nie dahinter planen */
  spaetestens?: (a: Aufgabe) => number | null;
}): Ergebnis {
  const { aufgaben, einst } = opt, jetzt = opt.jetzt ?? Date.now(), tage = opt.tage ?? 60, routine = (opt.routine ?? []).filter((r) => r.aktiv);
  const start = hoch(jetzt, 15 * MIN);
  // belegte Zeiten; Puffer zu Terminen, Fahrten und Gewohnheiten (Routine-Punkte und eigene Blöcke sind schon die Pause)
  const puffer = einst.puffer_min * MIN;
  const busy: [number, number, number][] = [...opt.belegt.map(([s, e]) => [s, e, puffer] as [number, number, number]),
    // Gewohnheiten (z. B. Training) mit Puffer – danach erst duschen/umziehen; Routine-Punkte ohne
    ...gewohnheitsZeiten(opt.gewohnheiten, new Date(jetzt), tage + 1, opt.belegt).map(([s, e]) => [s, e, puffer] as [number, number, number]),
    ...routineZeiten(routine, new Date(jetzt), tage + 1).map(([s, e]) => [s, e, 0] as [number, number, number])];
  const last = new Map<string, number>();   // geplante Minuten je Tag
  const addLast = (s: number, min: number) => { const k = tagKey(s); last.set(k, (last.get(k) ?? 0) + min); };

  const zuPlanen: Aufgabe[] = [];
  for (const a of aufgaben.filter((x) => !x.erledigt)) {
    const g = a.geplant ? Date.parse(a.geplant) : null;
    const laeuft = g != null && g <= jetzt && g + a.dauer_min * MIN > jetzt;
    const darf = !opt.nur || opt.nur.has(a.id);
    if ((a.fixiert && !opt.loesen?.has(a.id)) || laeuft || !darf) { if (g != null) { busy.push([g, g + a.dauer_min * MIN, 0]); addLast(g, a.dauer_min); } continue; }
    zuPlanen.push(a);
  }
  const fristMs = (a: Aufgabe) => (a.frist ? keyZuDatum(a.frist).getTime() : Infinity);
  // Aufgaben mit festem Zeitfenster (ab … Frist, z. B. Schreibplan-Etappen) zuerst – sonst füllen flexible Lernaufgaben das Fenster,
  // und die Etappen landen hinter ihrer Frist und in falscher Reihenfolge
  const eng = (a: Aufgabe) => (a.ab && a.frist ? 0 : 1);
  const reihe = (a: Aufgabe, b: Aufgabe) => eng(a) - eng(b) || fristMs(a) - fristMs(b) || a.prio - b.prio || a.position - b.position || a.erstellt.localeCompare(b.erstellt);
  const istLerncheck = (a: Aufgabe) => !!a.lektion?.includes("/lerncheck");
  zuPlanen.sort((a, b) => Number(istLerncheck(a)) - Number(istLerncheck(b)) || reihe(a, b));
  // Vorgänger im Kurs je Lerncheck (Prüfungssimulationen zählen nicht mit)
  const kursVon = (a: Aufgabe) => (a.lektion && !a.lektion.endsWith("/pruefung") ? a.lektion.split("/")[0] : null);
  const vorgaenger = new Map<string, Aufgabe[]>(), wirdGeplant = new Set(zuPlanen.map((a) => a.id)), endeNeu = new Map<string, number>();
  { const davor = new Map<string, Aufgabe[]>();
    for (const a of aufgaben.filter((x) => !x.erledigt && kursVon(x)).sort(reihe)) { const k = kursVon(a)!, v = davor.get(k) ?? []; if (v.length && istLerncheck(a)) vorgaenger.set(a.id, [...v]); v.push(a); davor.set(k, v); } }

  const ws = minuten(einst.tag_start), we = minuten(einst.tag_ende);
  const mitBloecken = routine.some((r) => r.art === "block");
  /** Arbeitsfenster eines Tages: Fokusblöcke der Routine, sonst die Arbeitszeit */
  const fensterVon = (tag: Date): Fenster[] => {
    const w = wochentag(tag);
    const bl = routine.filter((r) => r.art === "block" && r.tage.includes(w));
    if (bl.length) return bl.map((r) => { const s = beiMinute(tag, minuten(r.start)).getTime(); return { von: s, bis: s + r.dauer_min * MIN, niveau: r.niveau ?? 2 }; });
    if (mitBloecken) return [];   // Routine-Tag ohne Blöcke (z. B. Sonntag): frei
    return [{ von: beiMinute(tag, ws).getTime(), bis: beiMinute(tag, we).getTime(), niveau: 2 }];
  };
  /** erste freie Zeit in einem Fenster */
  const luecke = (f: Fenster, dauer: number, nichtVor = 0): number | null => {
    const von = Math.max(f.von, start, nichtVor), bis = f.bis;
    if (bis - von < dauer) return null;
    const drin = busy.filter(([s, e, p]) => e + p > von && s - p < bis).map(([s, e, p]) => [s - p, e + p] as Iv).sort((x, y) => x[0] - y[0]);
    let c = hoch(von);
    for (const [s, e] of drin) { if (s - c >= dauer) break; c = Math.max(c, hoch(e)); }
    return bis - c >= dauer ? c : null;
  };

  const neu = new Map<string, string | null>(), zuSpaet = new Set<string>(), ohnePlatz = new Set<string>();
  const tagIdx = (t: number) => Math.round((tagBeginn(t).getTime() - tagBeginn(start).getTime()) / TAG);
  /** Suche in einem Tagesbereich [von, bis] (Indizes ab heute): Fokusblöcke oder (extra) die ganze freie Arbeitszeit */
  const suche = (a: Aufgabe, von: number, bis: number, extra: boolean, ueberlast = false, nichtVor = 0): number | null => {
    const dauer = a.dauer_min * MIN, soll = opt.niveauVon?.(a) ?? (a.prio === 1 ? 1 : a.prio === 3 ? 3 : 2);
    for (let i = Math.max(0, von); i <= Math.min(tage, bis); i++) {
      const tag = plusTage(tagBeginn(start), i), w = wochentag(tag);
      if (!einst.wochenende && w >= 6) continue;
      if (!ueberlast && (last.get(tagKey(tag)) ?? 0) + a.dauer_min > einst.tag_max_min && (last.get(tagKey(tag)) ?? 0) > 0) continue;
      // freie Tage der Routine (keine Fokusblöcke) bleiben frei; „kleine“ Tage mit ein, zwei Blöcken (z. B. Sonntag) bekommen keine Zusatzzeit
      if (extra && !ueberlast && mitBloecken && fensterVon(tag).length < 3) continue;
      const fenster = extra ? [{ von: beiMinute(tag, ws).getTime(), bis: beiMinute(tag, we).getTime(), niveau: 2 }]
        : fensterVon(tag).sort((x, y) => Math.abs(x.niveau - soll) - Math.abs(y.niveau - soll) || x.von - y.von);
      for (const f of fenster) { const c = luecke(f, dauer, nichtVor); if (c != null) return c; }
    }
    return null;
  };
  for (const a of zuPlanen) {
    const dauer = a.dauer_min * MIN;
    const ab = a.ab ? Math.max(0, tagIdx(keyZuDatum(a.ab).getTime())) : 0;
    const harte = opt.spaetestens?.(a) ?? null;
    const grenze = harte != null ? Math.min(tage, tagIdx(harte) - 1) : tage;   // letzter erlaubter Tag (Tag vor der Klausur)
    const frist = Math.min(a.frist ? tagIdx(keyZuDatum(a.frist).getTime()) : tage, grenze);
    // 1. Fokusblöcke ab „ab“ bis zur Frist, 2. sonstige freie Zeit, 3. notfalls früher als „ab“, 4. nach der Frist (aber nie nach der harten Grenze),
    // 5. bei harter Grenze notfalls über das Tageslimit hinaus – lieber ein voller Tag als eine Lektion nach der Klausur
    const platz = (nichtVor: number): number | null => {
      const t0 = nichtVor ? Math.max(0, tagIdx(nichtVor)) : 0, von = Math.max(ab, t0);
      let g = suche(a, von, frist, false, false, nichtVor);
      if (g == null && mitBloecken) g = suche(a, von, frist, true, false, nichtVor);
      if (g == null && ab > t0) g = suche(a, t0, ab - 1, false, false, nichtVor) ?? (mitBloecken ? suche(a, t0, ab - 1, true, false, nichtVor) : null);
      if (g == null && frist < grenze) g = suche(a, Math.max(frist + 1, t0), grenze, false, false, nichtVor) ?? (mitBloecken ? suche(a, Math.max(frist + 1, t0), grenze, true, false, nichtVor) : null);
      if (g == null && harte != null) g = suche(a, t0, grenze, true, true, nichtVor);
      return g;
    };
    // Lerncheck: nicht vor dem Ende der Lektionen davor; ist danach bis zur Klausur nichts mehr frei, dann so spät wie möglich davor
    const vEnde = Math.max(0, ...(vorgaenger.get(a.id) ?? []).map((v) => endeNeu.get(v.id) ?? (!wirdGeplant.has(v.id) && v.geplant ? Date.parse(v.geplant) + v.dauer_min * MIN : 0)));
    let gefunden = vEnde > start ? platz(vEnde) : null;
    if (gefunden == null && !(vEnde > start)) gefunden = platz(0);
    // kein Platz: die alte Zeit ist für andere freigegeben worden, also nicht behalten (sonst überschneidet sie sich)
    if (gefunden == null) { ohnePlatz.add(a.id); if (a.geplant) neu.set(a.id, null); continue; }
    busy.push([gefunden, gefunden + dauer, 0]); addLast(gefunden, a.dauer_min); endeNeu.set(a.id, gefunden + dauer);
    // Lernaufgaben: deren Frist ist nur ein Richtwert – zu spät ist nur, was nach der Klausur läge
    if (harte != null ? gefunden + dauer > harte : a.frist && gefunden > keyZuDatum(a.frist).getTime() + TAG - 1) zuSpaet.add(a.id);
    const iso = new Date(gefunden).toISOString();
    if (a.geplant == null || Date.parse(a.geplant) !== gefunden) neu.set(a.id, iso);
  }
  return { neu, zuSpaet, ohnePlatz };
}
