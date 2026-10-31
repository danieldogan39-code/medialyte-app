// Neue App-Versionen:
// · Mac/Windows: der Tauri-Updater lädt signierte Versionen im Hintergrund; aktiv werden sie beim nächsten Start
//   (Mac sofort vorbereitet, Windows beim Schließen des Fensters). Nur wenn das nicht geht, wie früher per Download.
// · Android: die Oberfläche aktualisiert sich selbst (lib/liveupdate.ts). Nur neue Handy-Funktionen brauchen eine neue
//   APK – die lädt die App selbst herunter und startet die Installation.
// Die Liste der Versionen kommt von den GitHub-Releases (öffentlich, ohne Anmeldung).
const RELEASES = "https://api.github.com/repos/danieldogan39-code/medialyte-app/releases?per_page=30";
declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

type Datei = { name: string; url: string };
export type Stand = { android?: { v: string; build: number; apk: string }; programm?: { v: string; mac?: string; win?: string; msi?: string } };

const cap = () => (typeof window !== "undefined" ? (window as any).Capacitor : null);
export const istAndroidApp = () => !!cap()?.isNativePlatform?.() && cap()?.getPlatform?.() === "android";
export const istDesktop = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const plugin = (n: string) => { const C = cap(); return C.Plugins[n] ||= C.registerPlugin(n); };

function neuer(a: string, b: string) {  // ist Version a neuer als b?
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

class AppUpdate {
  stand = $state<Stand>({});
  /** Hinweis oben: neuere Version für dieses Gerät */
  neu = $state<{ v: string } | null>(null);
  /** Fortschritt beim Herunterladen (0–1), null = läuft nicht */
  fortschritt = $state<number | null>(null);
  meinBuild = $state(0);
  meineVersion = $state("");
  /** Mac/Windows: neue Version liegt bereit und ist beim nächsten Start aktiv */
  bereit = $state<{ v: string } | null>(null);
  #wartet: any = null;
  #geladen: Promise<Stand> | null = null;

  laden(neu = false): Promise<Stand> {
    if (this.#geladen && !neu) return this.#geladen;
    return (this.#geladen = (async () => {
      const liste = await (await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" } })).json();
      const rel = (Array.isArray(liste) ? liste : []).filter((r: any) => !r.draft && !r.prerelease);
      const dateien = (r: any): Datei[] => (r?.assets || []).map((a: any) => ({ name: String(a.name), url: String(a.browser_download_url) }));
      const s: Stand = {};
      const an = rel.find((r: any) => String(r.tag_name).startsWith("android-v") && dateien(r).some((d) => d.name.endsWith(".apk")));
      if (an) { const v = String(an.tag_name).replace(/^android-v/, ""); s.android = { v, build: +v.split(".").pop()!, apk: dateien(an).find((d) => d.name.endsWith(".apk"))!.url }; }
      const pr = rel.find((r: any) => String(r.tag_name).startsWith("app-v") && dateien(r).length);
      if (pr) {
        const d = dateien(pr);
        s.programm = { v: String(pr.tag_name).replace(/^app-v/, ""), mac: d.find((x) => x.name.endsWith(".dmg"))?.url,
          win: d.find((x) => x.name.endsWith("-setup.exe"))?.url, msi: d.find((x) => x.name.endsWith(".msi"))?.url };
      }
      this.stand = s;
      return s;
    })().catch((e) => { this.#geladen = null; throw e; }));
  }

  /** Beim Start: gibt es für dieses Gerät eine neuere Version? */
  async pruefen() {
    if (navigator.onLine === false) return;
    try {
      if (istAndroidApp()) {
        const info = await cap().Plugins?.App?.getInfo?.();
        this.meinBuild = +(info?.build ?? 0); this.meineVersion = String(info?.version ?? ""); if (!this.meinBuild) return;
        const s = await this.laden();
        if (s.android && s.android.build > this.meinBuild) this.neu = { v: s.android.v };
      } else if (istDesktop() && APP_VERSION) {
        if (await this.#programm().catch(() => false)) return;
        const s = await this.laden();   // Notlösung: Updater nicht erreichbar → Hinweis mit Download wie bisher
        if (s.programm && neuer(s.programm.v, APP_VERSION)) this.neu = { v: s.programm.v };
      }
    } catch { /* ohne Hinweis weiter */ }
  }

  /** Mac/Windows: signiertes Update suchen und im Hintergrund laden. true = Updater hat geantwortet. */
  async #programm(): Promise<boolean> {
    const { check } = await import("@tauri-apps/plugin-updater");
    const u = await check();
    if (!u) return true;
    await u.download();
    if (/Mac/i.test(navigator.userAgent)) {
      await u.install();   // ersetzt das Programm auf der Platte; das laufende Fenster bleibt unberührt
    } else {
      this.#wartet = u;    // Windows: der Installer schließt das Programm – deshalb erst beim Schließen
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      w.onCloseRequested(async (e) => {
        if (!this.#wartet) return;
        e.preventDefault();
        const x = this.#wartet; this.#wartet = null;
        try { await x.install(); } catch { /* dann beim nächsten Mal */ }
        await w.destroy();
      });
    }
    this.bereit = { v: u.version };
    return true;
  }

  /** „Jetzt neu starten“: vorbereitete Version sofort in Gebrauch nehmen */
  async neuStarten() {
    if (this.#wartet) { const x = this.#wartet; this.#wartet = null; await x.install(); return; }   // Windows: Installer übernimmt
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }

  /** Direkt-Link für das passende Installationsprogramm am Mac bzw. unter Windows */
  desktopDatei(s = this.stand) {
    const mac = /Mac/i.test(navigator.userAgent);
    return mac ? s.programm?.mac : s.programm?.win ?? s.programm?.msi;
  }

  /** Neueste Version auf dieses Gerät holen. Gibt einen Hinweis zurück, wenn etwas nicht klappt. */
  async installieren(): Promise<string | null> {
    const s = await this.laden(true);
    if (istAndroidApp()) {
      if (!s.android) return "Es gibt noch keine Android-Version zum Herunterladen.";
      return this.#apk(s.android.apk, s.android.v);
    }
    const url = istDesktop() ? this.desktopDatei(s) : null;
    if (!url) return "Für dieses Gerät gibt es kein Installationsprogramm.";
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);  // lädt direkt herunter (kein Umweg über die Release-Seite)
    return null;
  }

  async #apk(url: string, v: string): Promise<string | null> {
    if (this.fortschritt != null) return null;
    const Filesystem = plugin("Filesystem"), FileOpener = plugin("FileOpener");
    this.fortschritt = 0;
    const h = await Filesystem.addListener?.("progress", (p: any) => { if (p?.contentLength) this.fortschritt = Math.min(1, p.bytes / p.contentLength); }).catch?.(() => null);
    try {
      // Achtung: das native Herunterladen legt keine Unterordner an – deshalb direkt in den Cache-Ordner
      const pfad = `medialyte-${v}.apk`;
      await Filesystem.deleteFile({ path: pfad, directory: "CACHE" }).catch(() => {});
      const r = await Filesystem.downloadFile({ url, path: pfad, directory: "CACHE", recursive: true, progress: true });
      const ziel = r?.path ? (String(r.path).startsWith("file:") ? r.path : "file://" + r.path) : (await Filesystem.getUri({ path: pfad, directory: "CACHE" })).uri;
      this.fortschritt = 1;
      await FileOpener.open({ filePath: ziel, contentType: "application/vnd.android.package-archive", openWithDefault: true });
      return null;
    } catch (e: any) {
      // Notlösung: Android lädt die Datei selbst herunter (Benachrichtigung „Download abgeschlossen“ antippen)
      try { window.open(url, "_blank"); } catch { /* egal */ }
      const grund = String(e?.message || e).replace(/^Error downloading file:\s*/i, "");
      return `Direkt-Installation ging nicht (${grund.slice(0, 80)}). Der Download läuft jetzt über Android – danach die Datei antippen und installieren.`;
    } finally {
      h?.remove?.(); setTimeout(() => (this.fortschritt = null), 600);
    }
  }
}
export const appUpdate = new AppUpdate();
