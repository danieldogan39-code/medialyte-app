// Service Worker der Medialyte-App: nur für Benachrichtigungen (Web-Push vom Zähler-Dienst), kein Zwischenspeicher.
// Die Nachrichten kommen mit Zielen im Format des alten Cockpits (#kunde=…, #nachfass=…, #demo=…) und werden
// hier auf die Seiten der App übersetzt.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

function ziel(url) {
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

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titel: e.data && e.data.text() }; }
  const titel = d.titel || d.title || "Medialyte";
  e.waitUntil(self.registration.showNotification(titel, {
    body: d.text || d.body || "", tag: d.tag || undefined, renotify: !!d.tag, requireInteraction: !!d.dringend,
    icon: "icon-512.png", badge: "icon-512.png", data: { ziel: ziel(d.url) },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.ziel) || "#/";
  e.waitUntil((async () => {
    const offen = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of offen) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.postMessage({ typ: "ziel", hash });
        return;
      }
    }
    await self.clients.openWindow(new URL("./" + hash, self.registration.scope).href);
  })());
});
