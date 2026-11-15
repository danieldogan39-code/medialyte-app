// Zeit-Helfer des Organizers. Gerechnet wird in der Ortszeit des Geräts (Daniel: Hamburg).
export const MIN = 60_000, STD = 3_600_000, TAG = 86_400_000;

/** „2026-11-16“ für einen Zeitpunkt (Ortszeit) */
export function tagKey(d: Date | number | string): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
/** Mitternacht (Ortszeit) des Tages */
export function tagBeginn(d: Date | number | string): Date {
  const x = typeof d === "string" ? keyZuDatum(d) : new Date(d);
  x.setHours(0, 0, 0, 0); return x;
}
export function keyZuDatum(k: string): Date { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
export function plusTage(d: Date | number, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
/** Montag der Woche */
export function wochenBeginn(d: Date | number): Date { const x = tagBeginn(d); return plusTage(x, -(wochentag(x) - 1)); }
/** 1 = Montag … 7 = Sonntag */
export const wochentag = (d: Date | number) => { const w = new Date(d).getDay(); return w === 0 ? 7 : w; };
/** „09:30“ → Minuten seit Mitternacht */
export const minuten = (hhmm: string | null | undefined) => { if (!hhmm) return 0; const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
/** Zeitpunkt aus Tag + Minuten seit Mitternacht */
export const beiMinute = (tag: Date, min: number) => { const x = new Date(tag); x.setHours(0, 0, 0, 0); x.setMinutes(min); return x; };

const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", o);
const FUHR = f({ hour: "2-digit", minute: "2-digit" }), FTAG = f({ weekday: "long", day: "numeric", month: "long" }), FKURZ = f({ weekday: "short", day: "numeric", month: "short" }),
  FWT = f({ weekday: "short" }), FDM = f({ day: "numeric", month: "numeric" }), FMON = f({ month: "long", year: "numeric" });
export const uhr = (d: Date | string | number) => FUHR.format(new Date(d));
export const tagLang = (d: Date | string | number) => FTAG.format(new Date(d));
export const tagKurz = (d: Date | string | number) => FKURZ.format(new Date(d));
export const wt = (d: Date | string | number) => FWT.format(new Date(d)).replace(".", "");
export const dm = (d: Date | string | number) => FDM.format(new Date(d));
export const monat = (d: Date | string | number) => FMON.format(new Date(d));

/** „1 Std. 30 Min.“ / „45 Min.“ */
export function dauer(min: number): string {
  min = Math.round(min);
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}
export const dauerKurz = (min: number) => (min < 60 ? `${Math.round(min)}m` : min % 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${min / 60}h`);

/** Ganze Tage von heute bis zum Tag (0 = heute, 1 = morgen, negativ = vorbei) */
export function tageBis(d: Date | string | number): number {
  return Math.round((tagBeginn(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? keyZuDatum(d) : new Date(d)).getTime() - tagBeginn(Date.now()).getTime()) / TAG);
}
export function relativTag(d: Date | string | number): string {
  const n = tageBis(d);
  if (n === 0) return "heute"; if (n === 1) return "morgen"; if (n === -1) return "gestern";
  if (n > 1 && n < 7) return wt(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? keyZuDatum(d) : d);
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}
export function countdown(n: number): string {
  if (n <= 0) return n === 0 ? "heute" : "vorbei";
  if (n === 1) return "morgen";
  if (n < 14) return `in ${n} Tagen`;
  const w = Math.floor(n / 7), r = n % 7;
  return r ? `in ${w} Wo. ${r} T.` : `in ${w} Wochen`;
}
export const gruss = () => { const h = new Date().getHours(); return h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend"; };
