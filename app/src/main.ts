import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { auth } from "./lib/auth.svelte";
import { swStarten } from "./lib/push";
import { B } from "./lib/rechnungen/blatt.svelte";
import { R } from "./lib/rechnungen/daten.svelte";

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
    if (B.liste.length) return B.zu(B.liste[B.liste.length - 1].id);
    if (R.pdf) { URL.revokeObjectURL(R.pdf.url); R.pdf = null; return; }
    if (offen.length) return offen[offen.length - 1].close();
    if (location.hash && location.hash !== "#/" && history.length > 1) return history.back();
    App.minimizeApp();
  });
}
