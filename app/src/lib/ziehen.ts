// Ziehen und Ablegen für Maus, Stift und Finger (HTML-Drag-and-Drop geht auf Android nicht).
// Maus: nach ein paar Pixeln Bewegung · Finger: kurz gedrückt halten (sonst scrollt die Seite wie gewohnt).
// Gezogen wird eine schwebende Kopie; das Original bleibt als Platzhalter stehen.
import { haptik } from "./haptik";
import { ruhig } from "./bewegung";

export type ZiehOpt = {
  aus?: boolean;
  start?: () => void;
  bewegt?: (x: number, y: number, unter: HTMLElement | null) => void;
  ende?: (x: number, y: number, unter: HTMLElement | null, abgebrochen: boolean) => void;
};

export function ziehbar(node: HTMLElement, opt: ZiehOpt) {
  let o = opt;
  let sx = 0, sy = 0, x = 0, y = 0, typ = "", warte: any = null, aktiv = false, id = -1;
  let kopie: HTMLElement | null = null, rect: DOMRect | null = null, raf = 0;

  const unter = () => (document.elementFromPoint(x, y) as HTMLElement | null);
  const stopTouch = (e: TouchEvent) => { if (aktiv) e.preventDefault(); };
  const klickWeg = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  function beginnen() {
    warte = null; aktiv = true;
    rect = node.getBoundingClientRect();
    kopie = node.cloneNode(true) as HTMLElement;
    Object.assign(kopie.style, {
      position: "fixed", left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px",
      margin: "0", zIndex: "1000", pointerEvents: "none", willChange: "transform",
      transition: ruhig() ? "none" : "transform .28s cubic-bezier(.32,.72,0,1), box-shadow .28s ease",
      boxShadow: "0 30px 60px -18px rgba(0,0,0,.75)", borderRadius: getComputedStyle(node).borderRadius,
    });
    kopie.classList.add("zieh-kopie");
    document.body.append(kopie);
    requestAnimationFrame(() => { if (kopie) kopie.style.transform = `translate(${x - sx}px, ${y - sy}px) scale(1.04) rotate(-1deg)`; });
    node.classList.add("zieh-quelle");
    document.documentElement.classList.add("am-ziehen");
    haptik("mittel");
    o.start?.();
    rollen();
  }
  // am oberen/unteren Rand mitscrollen
  function rollen() {
    cancelAnimationFrame(raf);
    const schritt = () => {
      if (!aktiv) return;
      const rand = 90, v = y < rand ? -(rand - y) / 5 : y > innerHeight - rand ? (y - (innerHeight - rand)) / 5 : 0;
      if (v) { scrollBy(0, v); o.bewegt?.(x, y, unter()); }
      raf = requestAnimationFrame(schritt);
    };
    raf = requestAnimationFrame(schritt);
  }
  function beenden(abgebrochen: boolean) {
    clearTimeout(warte); warte = null;
    removeEventListener("pointermove", bewegen); removeEventListener("pointerup", los); removeEventListener("pointercancel", abbruch);
    if (!aktiv) return;
    aktiv = false; cancelAnimationFrame(raf);
    const u = unter();
    document.documentElement.classList.remove("am-ziehen");
    node.classList.remove("zieh-quelle");
    o.ende?.(x, y, u, abgebrochen);
    const k = kopie; kopie = null;
    if (k) {
      // Kopie gleitet an den neuen Platz des Originals und verschwindet dort
      const r = node.getBoundingClientRect();
      if (!ruhig() && r.width && rect) {
        k.style.transition = "transform .32s cubic-bezier(.32,.72,0,1), opacity .32s ease, box-shadow .32s ease";
        k.style.transform = `translate(${r.left - rect.left}px, ${r.top - rect.top}px) scale(${r.width / rect.width})`;
        k.style.boxShadow = "none"; k.style.opacity = "0";
        setTimeout(() => k.remove(), 340);
      } else k.remove();
    }
    addEventListener("click", klickWeg, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", klickWeg, { capture: true }), 60);
    haptik("leicht");
  }
  function bewegen(e: PointerEvent) {
    if (e.pointerId !== id) return;
    x = e.clientX; y = e.clientY;
    const weg = Math.hypot(x - sx, y - sy);
    if (!aktiv) {
      if (typ === "touch") { if (weg > 10) beenden(true); return; }   // Finger bewegt sich: das ist Scrollen
      if (weg > 6) beginnen(); else return;
    }
    if (kopie) kopie.style.transform = `translate(${x - sx}px, ${y - sy}px) scale(1.04) rotate(-1deg)`;
    o.bewegt?.(x, y, unter());
  }
  const los = (e: PointerEvent) => { if (e.pointerId === id) beenden(false); };
  const abbruch = (e: PointerEvent) => { if (e.pointerId === id) beenden(true); };
  function runter(e: PointerEvent) {
    if (o.aus || (e.pointerType === "mouse" && e.button !== 0) || (e.target as HTMLElement).closest("input, textarea, select, button, [data-nicht-ziehen]")) return;
    id = e.pointerId; typ = e.pointerType; sx = x = e.clientX; sy = y = e.clientY;
    addEventListener("pointermove", bewegen); addEventListener("pointerup", los); addEventListener("pointercancel", abbruch);
    if (typ === "touch") warte = setTimeout(beginnen, 320);
  }
  const keinMenue = (e: Event) => { if (aktiv || warte) e.preventDefault(); };
  node.addEventListener("pointerdown", runter);
  node.addEventListener("contextmenu", keinMenue);
  node.addEventListener("dragstart", (e) => e.preventDefault());
  addEventListener("touchmove", stopTouch, { passive: false });
  return {
    update(n: ZiehOpt) { o = n; },
    destroy() {
      beenden(true);
      node.removeEventListener("pointerdown", runter); node.removeEventListener("contextmenu", keinMenue);
      removeEventListener("touchmove", stopTouch);
    },
  };
}
