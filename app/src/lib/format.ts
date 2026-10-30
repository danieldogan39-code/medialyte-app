const tz = "Europe/Berlin";
export const datum = (d?: string | null) => d ? new Date(d).toLocaleDateString("de-DE", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
export const datumKurz = (d?: string | null) => d ? new Date(d).toLocaleDateString("de-DE", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }) : "–";
export const zeit = (d?: string | null) => d ? new Date(d).toLocaleTimeString("de-DE", { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : "";
export const datumZeit = (d?: string | null) => d ? `${datumKurz(d)}, ${zeit(d)} Uhr` : "–";
export function vor(d?: string | null): string {
  if (!d) return "";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  const t = Math.round(s / 86400);
  return t === 1 ? "gestern" : t < 30 ? `vor ${t} Tagen` : datum(d);
}
export const zahl = (n?: number | null) => n == null ? "–" : n.toLocaleString("de-DE");
