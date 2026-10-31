// Datumshilfen für Social Media (Kalender arbeitet mit Kalendertagen „JJJJ-MM-TT“, ohne Zeitzonen-Verschiebung)
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const ausIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const fmtTag = (s: string) => ausIso(s).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Alle Tage, die das Monatsblatt zeigt (volle Wochen, Montag zuerst) */
export function monatsblatt(jahr: number, monat: number) {
  const erster = new Date(jahr, monat, 1), versatz = (erster.getDay() + 6) % 7;
  const start = new Date(jahr, monat, 1 - versatz), tage: { iso: string; tag: number; imMonat: boolean }[] = [];
  const letzter = new Date(jahr, monat + 1, 0), n = Math.ceil((versatz + letzter.getDate()) / 7) * 7;
  for (let i = 0; i < n; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); tage.push({ iso: iso(d), tag: d.getDate(), imMonat: d.getMonth() === monat }); }
  return tage;
}
