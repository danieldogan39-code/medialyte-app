// Einfache Navigation über den Teil nach dem #, damit es im Browser, im Programm und in der Android-App gleich funktioniert
class Router {
  pfad = $state(lesen());
  constructor() { addEventListener("hashchange", () => { this.pfad = lesen(); }); }
  get teile() { return this.pfad.split("/").filter(Boolean); }
  geh(p: string) { location.hash = "#" + p; }
}
function lesen() {
  const h = location.hash.replace(/^#/, "");
  // Rücksprung aus Einladungs-/Wiederherstellungslinks (#access_token=…) zählt als Startseite
  return h.startsWith("/") ? h.split("?")[0] : "/";
}
export const router = new Router();
