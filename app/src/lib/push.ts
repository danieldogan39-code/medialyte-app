// Benachrichtigungen per Web-Push (wie im Cockpit): Abo beim Zähler-Dienst über die Cloud-Funktion „zaehler“,
// der Schlüssel des Dienstes bleibt auf dem Server. Geht im Browser und als installierte Web-App (Android: Chrome).
import { sb } from "./supabase";

export const istProgramm = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "Capacitor" in window);
export const kannPush = () => !istProgramm && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol === "https:";

let reg: Promise<ServiceWorkerRegistration | null> | null = null;
export function swStarten() {
  if (istProgramm || !("serviceWorker" in navigator) || location.protocol !== "https:") return;
  reg = navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch(() => null);
  // Klick auf eine Benachrichtigung bei offener App: dorthin springen
  navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.typ === "ziel" && e.data.hash) location.hash = e.data.hash; });
}
const registrierung = () => reg ?? Promise.resolve(null);

async function rufen(body: Record<string, unknown>) {
  const { data, error } = await sb.functions.invoke("zaehler", { body });
  if (error || !data?.ok) throw new Error(data?.error ?? "Dienst nicht erreichbar");
  return data;
}
export async function pushInfo(): Promise<{ vapid: string | null; geraete: number | null }> { return rufen({ aktion: "push_info" }); }
export async function pushAktiv(): Promise<boolean> {
  if (!kannPush()) return false;
  const r = await registrierung(); const s = await r?.pushManager.getSubscription();
  return !!s && Notification.permission === "granted";
}
function bytes(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
}
function geraet() {
  const ua = navigator.userAgent;
  return (/Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Gerät")
    + (matchMedia("(display-mode: standalone)").matches ? " · App" : " · Browser") + " · Medialyte-App";
}
export async function pushAn(): Promise<string | null> {
  if (!kannPush()) return "Dieses Gerät kann hier keine Benachrichtigungen empfangen. Öffne app.medialyte.de im Browser (am Handy in Chrome).";
  const info = await pushInfo().catch(() => null);
  if (!info?.vapid) return "Benachrichtigungen gehen, sobald der Zähler-Dienst bei Cloudflare eingerichtet ist.";
  if ((await Notification.requestPermission()) !== "granted") return "Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen des Browsers für diese Seite.";
  const r = await registrierung(); if (!r) return "Der Hintergrunddienst ließ sich nicht starten.";
  const s = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(info.vapid) }));
  await rufen({ aktion: "push_an", abo: s.toJSON(), geraet: geraet() });
  await rufen({ aktion: "push_test" }).catch(() => {});
  return null;
}
export async function pushAus() {
  const r = await registrierung(); const s = await r?.pushManager.getSubscription();
  if (!s) return;
  const ep = s.endpoint; await s.unsubscribe();
  await rufen({ aktion: "push_aus", endpoint: ep }).catch(() => {});
}
export const pushTest = () => rufen({ aktion: "push_test" });
