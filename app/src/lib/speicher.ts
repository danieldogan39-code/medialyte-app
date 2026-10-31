// Gerätespeicher wie in nativen Apps: Jede Seite zeigt sofort den zuletzt geladenen Stand und holt im Hintergrund
// nur das Neue. Gehalten im Arbeitsspeicher (sofort) und im Speicher des Geräts (nach dem nächsten Start sofort da).
//   let liste = $state(lies("anfragen:offen", []));            // beim Öffnen: letzter Stand, kein leeres Warten
//   ... .then((r) => (liste = merk("anfragen:offen", r.data ?? [])));   // frische Daten übernehmen und merken
const PREFIX = "ml-s1:";
const MAX = 900_000;   // große Einträge nur im Arbeitsspeicher (das Gerät hat für alle Seiten zusammen ~5 MB)
const mem = new Map<string, unknown>();
const offen = new Map<string, unknown>();
let geplant = false;

export function lies<T>(schluessel: string, ersatz: T): T {
  if (mem.has(schluessel)) return mem.get(schluessel) as T;
  try {
    const roh = localStorage.getItem(PREFIX + schluessel);
    if (roh != null) { const v = JSON.parse(roh) as T; mem.set(schluessel, v); return v; }
  } catch { /* nicht lesbar: frisch laden */ }
  return ersatz;
}

/** Ob es für diesen Schlüssel schon einen Stand gibt (dann keine Platzhalter zeigen) */
export const hat = (schluessel: string) => { if (mem.has(schluessel)) return true; try { return localStorage.getItem(PREFIX + schluessel) != null; } catch { return false; } };

export function merk<T>(schluessel: string, wert: T): T {
  mem.set(schluessel, wert);
  offen.set(schluessel, wert);
  if (!geplant) {
    geplant = true;
    const schreiben = () => {
      geplant = false;
      for (const [k, v] of offen) {
        try {
          const s = JSON.stringify(v);
          if (s.length > MAX) localStorage.removeItem(PREFIX + k); else localStorage.setItem(PREFIX + k, s);
        } catch { /* Speicher voll: bleibt im Arbeitsspeicher */ }
      }
      offen.clear();
    };
    // erst schreiben, wenn das Gerät gerade nichts zu tun hat (blockiert keine Animation)
    if ("requestIdleCallback" in window) (window as any).requestIdleCallback(schreiben, { timeout: 2000 }); else setTimeout(schreiben, 300);
  }
  return wert;
}

/** Beim Abmelden: alles Gespeicherte vom Gerät entfernen */
export function leeren() {
  mem.clear(); offen.clear();
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k); } catch { /* egal */ }
}
