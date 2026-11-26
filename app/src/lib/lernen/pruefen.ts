// Antworten prüfen und Wiederholungen planen – ohne Oberfläche, damit es sich testen lässt.
import type { Frage, Stand, Zelle } from "./typen";

/** „1.234,5“, „1234,5“, „1,234.5“, „-12 %“, „3/4“ → Zahl; null, wenn nicht lesbar */
export function zahlLesen(s: string): number | null {
  let t = s.trim().replace(/\s|€|%|EUR|TEUR|Stück|Stk\.?|ME|GE/gi, "").replace(/[−–]/g, "-");
  if (!t) return null;
  const bruch = t.match(/^(-?\d+)\/(\d+)$/);
  if (bruch) return Number(bruch[2]) ? Number(bruch[1]) / Number(bruch[2]) : null;
  const komma = t.lastIndexOf(","), punkt = t.lastIndexOf(".");
  if (komma >= 0 && punkt >= 0) t = komma > punkt ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (komma >= 0) t = (t.match(/,/g)!.length > 1 ? t.replace(/,/g, "") : t.replace(",", "."));
  else if (punkt >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");   // „1.234“ = Tausender
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return null;
  const n = Number(t); return Number.isFinite(n) ? n : null;
}

/** Standard-Toleranz: 1 % vom Betrag, mindestens 0,01 (Rundung auf Cent oder zwei Stellen) */
export const toleranz = (f: { antwort: number; toleranz?: number }) => f.toleranz ?? Math.max(0.01, Math.abs(f.antwort) * 0.001);

export type Antwort =
  | { typ: "mc"; wahl: number[] }
  | { typ: "wahr"; wahl: boolean }
  | { typ: "zahl"; text: string }
  | { typ: "buchung"; soll: [string, string][]; haben: [string, string][] }
  | { typ: "zuordnen"; wahl: (number | null)[] }
  | { typ: "reihe"; folge: number[] }
  | { typ: "tabelle"; werte: string[] }          // Eingaben in Lesereihenfolge (nur die auszufüllenden Zellen)
  | { typ: "selbst"; note: 0 | 1 | 2 };          // 0 = nicht gewusst, 1 = teilweise, 2 = gewusst

// ---------- Tabellen zum Selbstausfüllen
export type TabFrage = Extract<Frage, { typ: "tabelle" }>;
export const istEingabe = (z: Zelle): z is Exclude<Zelle, string> => typeof z !== "string";
/** die auszufüllenden Zellen in Lesereihenfolge */
export const eingaben = (f: TabFrage) => f.zeilen.flatMap((r, i) => r.map((z, j) => ({ z, i, j }))).filter((x) => istEingabe(x.z)) as { z: Exclude<Zelle, string>; i: number; j: number }[];
const glatt = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9%€+\-<>=/]/g, "");
export function zelleRichtig(z: Exclude<Zelle, string>, wert: string): boolean {
  const t = (wert ?? "").trim(); if (!t) return false;
  if ("z" in z) { const k = [zahlLesen(t)]; if (/^-?\d{1,3}\.\d{3}$/.test(t)) k.push(Number(t)); return k.some((n) => n != null && Math.abs(n - z.z) <= (z.tol ?? Math.max(0.01, Math.abs(z.z) * 0.001)) + 1e-9); }
  if ("w" in z) return glatt(t) === glatt(z.w);
  return z.e.some((x) => glatt(x) === glatt(t));
}
export const zelleLoesung = (z: Exclude<Zelle, string>) => ("z" in z ? de(z.z, 4) : "w" in z ? z.w : z.e[0]);
/** Vorrat für die Einsetz-Zellen: alle richtigen Begriffe (auch doppelte) plus die falschen aus f.vorrat */
export const vorratVon = (f: TabFrage) => [...eingaben(f).flatMap((x) => ("w" in x.z ? [x.z.w] : [])), ...(f.vorrat ?? [])];

/** Anteil richtig (0–1) */
export function bewerten(f: Frage, a: Antwort): number {
  switch (f.typ) {
    case "mc": {
      if (a.typ !== "mc") return 0;
      const r = new Set(f.richtig), w = new Set(a.wahl);
      return r.size === w.size && [...r].every((x) => w.has(x)) ? 1 : 0;
    }
    case "wahr": return a.typ === "wahr" && a.wahl === f.wahr ? 1 : 0;
    case "zahl": {
      if (a.typ !== "zahl") return 0;
      // „8.372“ kann 8372 (deutsch) oder 8,372 (Punkt als Komma) heißen – beides gelten lassen
      const t = a.text.trim(), kandidaten = [zahlLesen(t)];
      if (/^-?\d{1,3}\.\d{3}$/.test(t)) kandidaten.push(Number(t));
      return kandidaten.some((n) => n != null && Math.abs(n - f.antwort) <= toleranz(f) + 1e-9) ? 1 : 0;
    }
    case "buchung": {
      if (a.typ !== "buchung") return 0;
      const seite = (soll: [string, number][], ein: [string, string][]) => {
        const z = ein.filter(([k, b]) => k && b.trim()).map(([k, b]) => [k, zahlLesen(b)] as const);
        if (z.length !== soll.length || z.some(([, b]) => b == null)) return false;
        const rest = [...soll];
        for (const [k, b] of z) { const i = rest.findIndex(([k2, b2]) => k2 === k && Math.abs(b2 - (b as number)) < 0.005); if (i < 0) return false; rest.splice(i, 1); }
        return true;
      };
      return seite(f.soll, a.soll) && seite(f.haben, a.haben) ? 1 : 0;
    }
    case "zuordnen": {
      if (a.typ !== "zuordnen") return 0;
      return f.elemente.every(([, g], i) => a.wahl[i] === g) ? 1 : 0;
    }
    case "reihe": return a.typ === "reihe" && a.folge.length === f.elemente.length && a.folge.every((x, i) => x === i) ? 1 : 0;
    case "tabelle": {
      if (a.typ !== "tabelle") return 0;
      const e = eingaben(f); return e.length ? e.filter((x, n) => zelleRichtig(x.z, a.werte[n] ?? "")).length / e.length : 0;
    }
    case "karte": case "frei": return a.typ === "selbst" ? a.note / 2 : 0;
  }
}

/** Wie viele Elemente einer Zuordnung richtig sind (für Teilpunkte in der Prüfung) */
export function teilpunkte(f: Frage, a: Antwort): number {
  if (f.typ === "zuordnen" && a.typ === "zuordnen") return f.elemente.filter(([, g], i) => a.wahl[i] === g).length / f.elemente.length;
  return bewerten(f, a);
}

// ---------- Leitner-Kästen: 0 neu, 1 wackelig … 5 sitzt
export const ABSTAND = [0, 1, 3, 7, 14, 30];   // Tage bis zur nächsten Wiederholung je Kasten

/** Neuer Stand nach einer Antwort. bis = letzter sinnvoller Wiederholungstag (Tag vor der Klausur) */
export function weiter(s: Stand | undefined, schluessel: string, anteil: number, heute: string, bis?: string): Stand {
  const alt = s ?? { schluessel, box: 0, faellig: null, richtig: 0, falsch: 0, zuletzt: null };
  let box: number;
  if (anteil >= 1) box = Math.min(5, alt.box + 1);
  else if (anteil > 0) box = Math.max(1, alt.box);       // teilweise: Kasten halten
  else box = 1;
  const tage = anteil >= 1 ? ABSTAND[box] : anteil > 0 ? 1 : 0;
  let faellig = plus(heute, tage);
  if (bis && bis > heute && faellig > bis) faellig = bis;  // vor der Klausur alles noch einmal sehen
  return { schluessel, box, faellig, richtig: alt.richtig + (anteil >= 1 ? 1 : 0), falsch: alt.falsch + (anteil < 1 ? 1 : 0), zuletzt: new Date().toISOString() };
}
function plus(tag: string, n: number) {
  const [y, m, d] = tag.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

/** Beherrschung 0–1 aus den Kästen (Kasten 4+ zählt voll) */
export const beherrschung = (boxen: number[]) => (boxen.length ? boxen.reduce((n, b) => n + Math.min(1, b / 4), 0) / boxen.length : 0);

/** Deterministischer Zufall für Rechenaufgaben */
export function zufall(seed: number) {
  let s = seed >>> 0 || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  return { r, ganz: (a: number, b: number) => a + Math.floor(r() * (b - a + 1)), aus: <T>(l: T[]) => l[Math.floor(r() * l.length)] };
}

/** Zahl deutsch formatiert */
export const de = (n: number, stellen = 2) => n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: stellen });

/** Richtige Lösung als kurzer Text (Markdown) */
export function loesungText(f: Frage): string {
  switch (f.typ) {
    case "mc": return f.richtig.map((i) => f.optionen[i]).join(" · ");
    case "wahr": return f.wahr ? "Richtig" : "Falsch";
    case "zahl": return `${de(f.antwort, 4)}${f.einheit ? " " + f.einheit : ""}`;
    case "buchung": return `${f.soll.map(([k, b]) => `${k} ${de(b)}`).join(", ")} **an** ${f.haben.map(([k, b]) => `${k} ${de(b)}`).join(", ")}`;
    case "zuordnen": return f.elemente.map(([e, g]) => `${e} → ${f.gruppen[g]}`).join(" · ");
    case "reihe": return f.elemente.map((e, i) => `${i + 1}. ${e}`).join("  ");
    case "tabelle": return f.zeilen.map((r) => r.map((z) => (istEingabe(z) ? `**${zelleLoesung(z)}**` : z)).join(" | ")).join("  \n");
    case "karte": case "frei": return f.antwort;
  }
}
/** Schwierigkeit 1–3: aus der Frage, sonst nach Aufgabenart (ankreuzen leicht, selbst rechnen/buchen/ausfüllen mittel, frei schreiben schwer) */
export const stufeVon = (f: Frage): 1 | 2 | 3 => f.stufe ?? (f.typ === "mc" || f.typ === "wahr" ? 1 : f.typ === "frei" ? 3 : 2);
export const STUFE = ["", "Leicht", "Mittel", "Schwer"];
/** Aufgaben zum Selbermachen: rechnen, buchen, Tabellen ausfüllen */
export const istPraxis = (f: Frage) => f.typ === "tabelle" || f.typ === "buchung" || f.typ === "zahl";
/** Punkte einer Frage in der Prüfungssimulation */
export const punkteVon = (f: Frage) => f.punkte ?? (f.typ === "tabelle" ? Math.min(8, Math.max(2, Math.ceil(eingaben(f).length / 2))) : ({ mc: 1, wahr: 1, zahl: 3, buchung: 3, zuordnen: 2, reihe: 2, karte: 2, frei: 6 } as const)[f.typ]);
