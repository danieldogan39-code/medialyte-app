import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { auth } from "./lib/auth.svelte";
import { swStarten } from "./lib/push";
import { B } from "./lib/rechnungen/blatt.svelte";
import { R } from "./lib/rechnungen/daten.svelte";
import { federCss } from "./lib/bewegung";
import { modalZu } from "./lib/bewegung";

// Federkurven als CSS-Variablen (für Übergänge in den Stilen)
document.documentElement.style.setProperty("--feder", federCss(0.5, 0.08));
document.documentElement.style.setProperty("--feder-weich", federCss(0.6, 0));
document.documentElement.style.setProperty("--feder-schnell", federCss(0.32, 0.1));

auth.init();
mount(App, { target: document.getElementById("app")! });
swStarten();

// Im Mac-/Windows-Programm: Links nach außen (Demos, WhatsApp, E-Mail, Telefon) im Standardprogramm öffnen
if ("__TAURI_INTERNALS__" in window) {
  document.addEventListener("click", async (e) => {
    const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (!/^(https?:|mailto:|tel:)/i.test(href)) return;
    e.preventDefault();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    openUrl(href);
  }, true);
}

// Android: Zurück-Taste schließt zuerst offene Fenster (Rechnungen-Blätter, PDF), geht dann eine Seite zurück, sonst App in den Hintergrund
const cap = (window as any).Capacitor;
if (cap?.isNativePlatform?.()) {
  const App = cap.Plugins?.App;
  App?.addListener("backButton", () => {
    const offen = [...document.querySelectorAll("dialog[open]")] as HTMLDialogElement[];
    if (offen.length) { modalZu(offen[offen.length - 1]); return; }
    if (B.liste.length) return B.zu(B.liste[B.liste.length - 1].id);
    if (R.pdf) { URL.revokeObjectURL(R.pdf.url); R.pdf = null; return; }
    if (location.hash && location.hash !== "#/" && history.length > 1) return history.back();
    App.minimizeApp();
  });
}

// Lichtkegel auf Karten: folgt dem Zeiger (nur Geräte mit Maus; ein Schreibzugriff pro Bild)
if (matchMedia("(hover: hover)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let karte: HTMLElement | null = null, x = 0, y = 0, geplant = false;
  addEventListener("pointermove", (e) => {
    const k = (e.target as HTMLElement)?.closest?.(".card") as HTMLElement | null;
    if (karte && karte !== k) { karte.style.removeProperty("--mx"); karte.style.removeProperty("--my"); }
    karte = k; if (!k) return; x = e.clientX; y = e.clientY;
    if (geplant) return; geplant = true;
    requestAnimationFrame(() => { geplant = false; if (!karte) return; const r = karte.getBoundingClientRect(); karte.style.setProperty("--mx", `${x - r.left}px`); karte.style.setProperty("--my", `${y - r.top}px`); });
  }, { passive: true });
}
