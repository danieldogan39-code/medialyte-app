// Spürbare Rückmeldung wie in nativen Apps (nur in der Android-App; im Browser und am Computer passiert nichts).
// leicht: Reiter, Schalter, Auswahl · mittel: wichtige Aktion bestätigt · erfolg/warnung: Ergebnis einer Aktion
type Art = "leicht" | "mittel" | "auswahl" | "erfolg" | "warnung";
const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
const nativ = !!cap?.isNativePlatform?.();
let H: any = null;
const h = () => (H ??= cap?.Plugins?.Haptics ?? (cap?.registerPlugin ? cap.registerPlugin("Haptics") : null));
let zuletzt = 0;

export function haptik(art: Art = "leicht") {
  if (!nativ) return;
  const jetzt = performance.now(); if (jetzt - zuletzt < 40) return; zuletzt = jetzt;   // nicht doppelt bei schnellem Tippen
  try {
    const p = h(); if (!p) return;
    if (art === "auswahl") p.selectionChanged?.()?.catch?.(() => {});
    else if (art === "erfolg") p.notification?.({ type: "SUCCESS" })?.catch?.(() => {});
    else if (art === "warnung") p.notification?.({ type: "WARNING" })?.catch?.(() => {});
    else p.impact?.({ style: art === "mittel" ? "MEDIUM" : "LIGHT" })?.catch?.(() => {});
  } catch { /* ohne Vibration weiter */ }
}
