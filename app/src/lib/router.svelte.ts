// Einfache Navigation über den Teil nach dem #, damit es im Browser, im Programm und in der Android-App gleich funktioniert
class Router {
  pfad = $state(lesen());
  constructor() { addEventListener("hashchange", () => { this.pfad = lesen(); }); }
  get teile() { return this.pfad.split("/").filter(Boolean); }
  geh(p: string) { location.hash = "#" + p; }
}
// Verweise im Format des alten Cockpits (aus Benachrichtigungen und Lesezeichen) auf die Seiten der App
const ALT: [RegExp, (s: string) => string][] = [
  [/^kunde=(.+)$/, (s) => "/kunden/" + s], [/^tischbuch=(.+)$/, (s) => "/kunden/" + s], [/^nachfass=(.+)$/, (s) => "/nachfassen/" + s],
  [/^demo=(.+)$/, (s) => "/akquise/demo/" + s], [/^(website|tischbuecher)$/, () => "/kunden"], [/^(nachfass|nf-title)$/, () => "/nachfassen"],
  [/^(cost|kosten)$/, () => "/kosten"], [/^(kpis|rank-title|demos-title|mem-title|runs-title)$/, () => "/akquise/gastronomie"],
];
function lesen() {
  const roh = location.hash.replace(/^#/, "");
  for (const [re, f] of ALT) { const m = roh.match(re); if (m) { const p = f(decodeURIComponent(m[1] ?? "")); history.replaceState(null, "", "#" + p); return p; } }
  const h = roh;
  // Rücksprung aus Einladungs-/Wiederherstellungslinks (#access_token=…) zählt als Startseite
  return h.startsWith("/") ? h.split("?")[0] : "/";
}
export const router = new Router();
