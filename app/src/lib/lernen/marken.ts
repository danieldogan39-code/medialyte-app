// Skript-Markierungen (Sternfolien usw.): kleine Helfer für die Anzeige
import type { Kurs, Marke } from "./typen";

export const MARKEN: Marke[] = ["stern", "orange", "gelb", "grau", "exkurs", "uebersicht"];

/** [19, 21, 22, 23] → „19, 21–23“ */
export function bereiche(l: number[]) {
  const s = [...new Set(l)].sort((a, b) => a - b), out: string[] = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (s[j + 1] === s[j] + 1) j++; out.push(j > i ? `${s[i]}–${s[j]}` : `${s[i]}`); i = j; }
  return out.join(", ");
}

/** Je Markierung: wie viele Folien und Fragen der Kurs dazu hat */
export function markenZahlen(k: Kurs) {
  const out = new Map<Marke, { folien: number; fragen: number }>();
  for (const m of MARKEN) {
    if (!k.marken?.[m]) continue;
    const folien = new Set<number>(); let fragen = 0;
    for (const c of k.kapitel) for (const l of c.lektionen) { for (const n of l.marken?.[m] ?? []) folien.add(n); fragen += l.fragen.filter((f) => f.marke?.includes(m)).length; }
    out.set(m, { folien: folien.size, fragen });
  }
  return out;
}
