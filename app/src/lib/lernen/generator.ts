// Rechenaufgaben aus einem Generator erzeugen: Zahlen würfeln, Bedingung prüfen, Lösung ausrechnen.
import { fuellen, wert, type Werte } from "./ausdruck";
import { zufall } from "./pruefen";
import type { Frage, Generator } from "./typen";

export function erzeuge(g: Generator, seed: number): Frage {
  const z = zufall(seed);
  for (let versuch = 0; versuch < 500; versuch++) {
    const w: Werte = {};
    for (const [n, d] of Object.entries(g.vars)) {
      if (Array.isArray(d)) w[n] = d[Math.floor(z.r() * d.length)];
      else { const s = d.schritt ?? 1, k = Math.round((d.bis - d.von) / s); w[n] = Math.round((d.von + z.ganz(0, k) * s) * 1e9) / 1e9; }
    }
    for (const [n, a] of g.hilfs ?? []) w[n] = wert(a, w);
    if (g.bedingung && !wert(g.bedingung, w)) continue;
    const antwort = wert(g.antwort, w);
    if (!Number.isFinite(antwort)) continue;
    return { id: g.id, typ: "zahl", frage: fuellen(g.frage, w), antwort, einheit: g.einheit, toleranz: g.toleranz, erkl: g.erkl ? fuellen(g.erkl, w) : undefined, tipp: g.tipp ? fuellen(g.tipp, w) : undefined };
  }
  throw new Error(`Generator ${g.id}: keine passenden Zahlen gefunden (Bedingung zu streng?)`);
}
