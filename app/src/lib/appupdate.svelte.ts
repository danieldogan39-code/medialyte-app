// Android-App: neue Version auf GitHub? Dann oben einen Hinweis zeigen (wie in der Rechnungs-App)
const RELEASES = "https://api.github.com/repos/danieldogan39-code/medialyte-app/releases?per_page=30";
class AppUpdate {
  neu = $state<{ v: string; url: string } | null>(null);
  async pruefen() {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.() || navigator.onLine === false) return;
    try {
      const info = await cap.Plugins?.App?.getInfo?.();
      const build = +(info?.build ?? 0); if (!build) return;
      const liste = await (await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" } })).json();
      const r = (Array.isArray(liste) ? liste : []).find((x: any) => String(x.tag_name || "").startsWith("android-v"));
      if (!r) return;
      const n = +String(r.tag_name).split(".").pop()!;
      if (n > build) {
        const a = (r.assets || []).find((x: any) => String(x.name).endsWith(".apk"));
        this.neu = { v: String(r.tag_name).replace(/^android-v/, ""), url: a?.browser_download_url || r.html_url };
      }
    } catch { /* ohne Hinweis weiter */ }
  }
}
export const appUpdate = new AppUpdate();
