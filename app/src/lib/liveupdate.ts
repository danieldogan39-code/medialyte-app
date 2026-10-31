// Android: neue Oberfläche automatisch, ohne Neuinstallation.
// Die App startet immer aus ihren eigenen Dateien (nie aus dem Netz). Im Hintergrund schaut sie nach, ob es ein neues,
// signiertes Oberflächen-Paket gibt, lädt es still herunter und nimmt es erst beim nächsten Start in Gebrauch
// (oder wenn sie nach längerer Pause aus dem Hintergrund zurückkommt). Startet ein neues Paket nicht sauber,
// springt sie von selbst auf das letzte funktionierende zurück (notifyAppReady bleibt dann aus).
import { istAndroidApp } from "./appupdate.svelte";

const KANAL = "https://api.github.com/repos/danieldogan39-code/medialyte-app/releases/tags/aktualisierung";
const SCHLUESSEL = (import.meta as any).env?.VITE_UPDATE_SCHLUESSEL as string | undefined;
const PAUSE = 10 * 60_000, SUCHABSTAND = 30 * 60_000;
type Manifest = { version: string; app: string; huelle: number; url: string; sha256: string; signatur: string };

const C = () => (window as any).Capacitor;
const plugin = (n: string) => { const c = C(); return c.Plugins[n] ||= c.registerPlugin(n); };
const verfuegbar = () => istAndroidApp() && !!C()?.isPluginAvailable?.("CapacitorUpdater");
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const merk = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem("ml-lu:" + k); localStorage.setItem("ml-lu:" + k, v); } catch { /* egal */ } return null; };

let wartet: string | null = null, letzteSuche = 0, imHintergrundSeit = 0, laeuft = false;

/** Beim Start sofort aufrufen: bestätigt, dass diese Oberfläche läuft (sonst Rückfall auf die vorige) */
export async function bestaetigen() {
  if (!verfuegbar()) return;
  try { await plugin("CapacitorUpdater").notifyAppReady(); } catch { /* ältere App ohne Baustein */ }
}

async function echt(m: Manifest) {
  if (!SCHLUESSEL || !m?.signatur) return false;
  const key = await crypto.subtle.importKey("spki", b64(SCHLUESSEL), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64(m.signatur), new TextEncoder().encode(`${m.version}|${m.sha256}|${m.huelle}|${m.url}`));
}

/** Im Hintergrund: neues Paket suchen, prüfen, herunterladen und für den nächsten Start vormerken */
export async function suchen() {
  if (!verfuegbar() || laeuft || navigator.onLine === false) return;
  laeuft = true; letzteSuche = Date.now();
  try {
    const U = plugin("CapacitorUpdater");
    const r = await fetch(KANAL, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
    if (!r.ok) return;
    const m = JSON.parse((await r.json())?.body || "{}") as Manifest;
    if (!m.version || !m.url || merk("abgelehnt") === m.version) return;
    // Passt das Paket zur installierten App? (Neue Handy-Funktionen brauchen erst die neue APK – dafür gibt es den Hinweis oben)
    const info = await plugin("App").getInfo();
    const huelle = parseInt(String(info?.version ?? "1").split(".")[0], 10) || 1;
    if (m.huelle > huelle) return;
    const jetzt = await U.current();
    if (jetzt?.bundle?.version === m.version) return;
    if (!(await echt(m))) { merk("abgelehnt", m.version); return; }   // nicht mit unserem Schlüssel signiert: nie einspielen
    const liste = (await U.list())?.bundles ?? [];
    let b = liste.find((x: any) => x.version === m.version && x.status !== "error");
    if (!b) b = await U.download({ url: m.url, version: m.version, checksum: m.sha256 });
    if (!b?.id) return;
    await U.next({ id: b.id });   // wird beim nächsten Start benutzt
    wartet = b.id;
  } catch { /* still weiter; nächster Versuch später */ }
  finally { laeuft = false; }
}

/** Vordergrund/Hintergrund beobachten: nach längerer Pause das vorbereitete Paket nehmen, sonst gelegentlich suchen */
export function beobachten() {
  if (!verfuegbar()) return;
  plugin("App").addListener("appStateChange", async ({ isActive }: { isActive: boolean }) => {
    if (!isActive) { imHintergrundSeit = Date.now(); return; }
    const weg = imHintergrundSeit ? Date.now() - imHintergrundSeit : 0;
    if (wartet && weg > PAUSE && !document.querySelector("dialog[open]")) {
      try { await plugin("CapacitorUpdater").set({ id: wartet }); } catch { /* dann beim nächsten Start */ }
      return;
    }
    if (Date.now() - letzteSuche > SUCHABSTAND) suchen();
  });
}
