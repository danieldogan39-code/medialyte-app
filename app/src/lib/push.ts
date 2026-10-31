// Benachrichtigungen: im Browser per Web-Push, in der Android-App über Firebase Cloud Messaging (echte App-Nachrichten).
// Beides läuft über den Zähler-Dienst (Cloud-Funktion „zaehler“), der Schlüssel des Dienstes bleibt auf dem Server.
import { sb } from "./supabase";

const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
export const istProgramm = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "Capacitor" in window);
export const istAndroid = !!cap?.isNativePlatform?.() && cap?.getPlatform?.() === "android";
const PN = () => cap?.Plugins?.PushNotifications;
const TOKEN_KEY = "medialyte-fcm-token";

// Ob die Android-App mit Firebase gebaut wurde (sonst würde das Anmelden die App beenden)
let fcmBereit: Promise<boolean> | null = null;
const fcmGebaut = () => (fcmBereit ??= fetch("fcm.json").then((r) => (r.ok ? r.json() : null)).then((j) => !!j?.an).catch(() => false));

export const kannPush = () => (istAndroid ? !!PN() : !istProgramm && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol === "https:");

let reg: Promise<ServiceWorkerRegistration | null> | null = null;
export function swStarten() {
  if (istAndroid) { nativStarten(); return; }
  if (istProgramm || !("serviceWorker" in navigator) || location.protocol !== "https:") return;
  reg = navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch(() => null);
  // Klick auf eine Benachrichtigung bei offener App: dorthin springen
  navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.typ === "ziel" && e.data.hash) location.hash = e.data.hash; });
}
const registrierung = () => reg ?? Promise.resolve(null);

/** Ziele im Format des alten Cockpits (#kunde=…, #nachfass=…, #demo=…) auf die Seiten der App übersetzen (wie sw.js) */
export function ziel(url: string) {
  const h = String(url || "").split("#")[1] || "";
  const m = h.match(/^(kunde|nachfass|demo|tischbuch)=(.+)$/);
  if (m) {
    const s = decodeURIComponent(m[2]);
    if (m[1] === "kunde" || m[1] === "tischbuch") return "#/kunden/" + s;
    if (m[1] === "nachfass") return "#/nachfassen/" + s;
    return "#/akquise/demo/" + s;
  }
  if (h === "website" || h.startsWith("tischbuecher")) return "#/kunden";
  if (h.startsWith("/")) return "#" + h;
  return "#/";
}

async function rufen(body: Record<string, unknown>) {
  const { data, error } = await sb.functions.invoke("zaehler", { body });
  if (error || !data?.ok) throw new Error(data?.error ?? "Dienst nicht erreichbar");
  return data;
}
export async function pushInfo(): Promise<{ vapid: string | null; fcm?: boolean; geraete: number | null }> { return rufen({ aktion: "push_info" }); }
const gemerkt = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };

export async function pushAktiv(): Promise<boolean> {
  if (istAndroid) {
    if (!PN() || !gemerkt()) return false;
    const p = await PN().checkPermissions().catch(() => null);
    return p?.receive === "granted";
  }
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
  if (istAndroid) return "Android · Medialyte-App";
  return (/Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Gerät")
    + (matchMedia("(display-mode: standalone)").matches ? " · App" : " · Browser") + " · Medialyte-App";
}

// ---------- Android-App
let warteAufToken: ((t: string) => void) | null = null, tokenFehler: ((e: Error) => void) | null = null, gestartet = false;
async function nativStarten() {
  const pn = PN(); if (!pn || gestartet) return; gestartet = true;
  if (!(await fcmGebaut())) return;
  await pn.createChannel?.({ id: "medialyte", name: "Medialyte", description: "Demos, Rückrufe, Anfragen, Tischbuch", importance: 4, visibility: 1, vibration: true }).catch(() => {});
  await pn.createChannel?.({ id: "dringend", name: "Dringend", description: "Gäste, die auf Antwort warten", importance: 5, visibility: 1, vibration: true }).catch(() => {});
  pn.addListener("registration", (t: { value: string }) => {
    const alt = gemerkt();
    try { localStorage.setItem(TOKEN_KEY, t.value); } catch { /* egal */ }
    if (warteAufToken) { warteAufToken(t.value); warteAufToken = null; tokenFehler = null; }
    else if (alt && alt !== t.value) rufen({ aktion: "push_an", fcm: t.value, geraet: geraet() }).then(() => rufen({ aktion: "push_aus", fcm: alt })).catch(() => {});
  });
  pn.addListener("registrationError", (e: { error?: string }) => { tokenFehler?.(new Error(e?.error || "Anmeldung bei Google fehlgeschlagen")); warteAufToken = null; tokenFehler = null; });
  // Tippen auf eine Nachricht: an die passende Stelle der App
  pn.addListener("pushNotificationActionPerformed", (a: any) => { const u = a?.notification?.data?.url; if (u) location.hash = ziel(u); });
  // Nachricht, während die App offen ist: Android zeigt sie trotzdem als echte Benachrichtigung (presentationOptions),
  // die Seite holt sich zusätzlich den neuen Stand
  pn.addListener("pushNotificationReceived", () => { dispatchEvent(new Event("ml:anfragen")); });
  // schon eingeschaltet: Token auffrischen (Google tauscht ihn ab und zu aus)
  if (gemerkt()) { const p = await pn.checkPermissions().catch(() => null); if (p?.receive === "granted") pn.register().catch(() => {}); }
}
async function nativAn(): Promise<string | null> {
  const pn = PN();
  if (!pn) return "Diese App-Version kann noch keine Benachrichtigungen. Bitte die neueste Android-App installieren.";
  if (!(await fcmGebaut())) return "Diese App-Version kann noch keine Benachrichtigungen. Bitte die neueste Android-App installieren.";
  await nativStarten();
  let p = await pn.checkPermissions();
  if (p.receive !== "granted") p = await pn.requestPermissions();
  if (p.receive !== "granted") return "Benachrichtigungen sind blockiert. Erlaube sie in den Android-Einstellungen unter Apps → Medialyte → Benachrichtigungen.";
  const token = await new Promise<string>((ok, fehler) => {
    warteAufToken = ok; tokenFehler = fehler;
    setTimeout(() => fehler(new Error("Google hat nicht geantwortet. Bitte gleich nochmal versuchen.")), 20000);
    pn.register().catch(fehler);
  });
  const info = await pushInfo().catch(() => null);
  if (info && info.fcm === false) return "Die App ist angemeldet, aber der Server kann noch keine Android-Nachrichten schicken. Das richte ich gerade ein.";
  await rufen({ aktion: "push_an", fcm: token, geraet: geraet() });
  return null;
}

export async function pushAn(): Promise<string | null> {
  if (istAndroid) return nativAn();
  if (!kannPush()) return "Dieses Gerät kann hier keine Benachrichtigungen empfangen.";
  const info = await pushInfo().catch(() => null);
  if (!info?.vapid) return "Benachrichtigungen gehen, sobald der Zähler-Dienst bei Cloudflare eingerichtet ist.";
  if ((await Notification.requestPermission()) !== "granted") return "Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen des Browsers für diese Seite.";
  const r = await registrierung(); if (!r) return "Der Hintergrunddienst ließ sich nicht starten.";
  const s = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(info.vapid) }));
  await rufen({ aktion: "push_an", abo: s.toJSON(), geraet: geraet() });
  return null;
}
export async function pushAus() {
  if (istAndroid) {
    const t = gemerkt(); if (!t) return;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* egal */ }
    await rufen({ aktion: "push_aus", fcm: t }).catch(() => {});
    await PN()?.unregister?.().catch(() => {});
    return;
  }
  const r = await registrierung(); const s = await r?.pushManager.getSubscription();
  if (!s) return;
  const ep = s.endpoint; await s.unsubscribe();
  await rufen({ aktion: "push_aus", endpoint: ep }).catch(() => {});
}
/** Probe: dieses Gerät zur Sicherheit neu anmelden, dann an alle Geräte senden; Ergebnis in klaren Worten */
export async function pushProbe(): Promise<string> {
  try {
    if (istAndroid) { const t = gemerkt(); if (t) await rufen({ aktion: "push_an", fcm: t, geraet: geraet() }); }
    else { const s = await (await registrierung())?.pushManager.getSubscription(); if (s) await rufen({ aktion: "push_an", abo: s.toJSON(), geraet: geraet() }); }
  } catch { /* Probe trotzdem versuchen */ }
  const r = await pushTest();
  const f: string[] = r.fehler ?? [];
  if (r.gesendet == null) return "Probe abgeschickt.";
  if (!r.geraete) return "Es ist kein Gerät angemeldet. Schalte die Benachrichtigungen aus und wieder ein.";
  const kurz = `Probe an ${r.gesendet} von ${r.geraete} ${r.geraete === 1 ? "Gerät" : "Geräten"} zugestellt.`;
  return f.length ? `${kurz} Problem: ${f[0]}` : r.gesendet ? `${kurz} Kommt nichts an, prüfe die Benachrichtigungs-Erlaubnis in den Einstellungen des Geräts.` : kurz;
}
export const pushTest = (): Promise<{ gesendet: number | null; geraete: number | null; fehler?: string[] }> => rufen({ aktion: "push_test" });
