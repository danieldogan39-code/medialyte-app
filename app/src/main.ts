import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { auth } from "./lib/auth.svelte";

auth.init();
mount(App, { target: document.getElementById("app")! });

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
