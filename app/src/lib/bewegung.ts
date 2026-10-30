// Bewegung wie in iOS: echte Federkurven (gedämpfte Schwingung) statt starrer Zeitkurven.
// Läuft nur über transform und opacity (flüssig auch auf schwächeren Handys) und respektiert „Bewegung reduzieren“.

export const ruhig = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Feder nach Apple-Art: Dauer (Sekunden, wie SwiftUI .spring(duration:bounce:)) und Nachfedern 0 … 0.4.
 *  Liefert Verlauf x(t) für t in Sekunden und die Zeit, nach der die Feder sichtbar ruht. */
function feder(dauer = 0.5, bounce = 0) {
  const w = (2 * Math.PI) / dauer, z = Math.max(0.05, 1 - bounce);
  const x = (t: number) => {
    if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  };
  let ende = dauer; while (ende < dauer * 4 && Math.abs(1 - x(ende)) > 0.0015) ende += dauer / 20;
  return { x, ende };
}

/** Easing-Funktion für Svelte-Übergänge (t: 0 … 1 über die ganze Laufzeit) und die passende Laufzeit in ms */
export function federKurve(dauer = 0.5, bounce = 0) {
  const f = feder(dauer, bounce);
  return { easing: (t: number) => (t >= 1 ? 1 : f.x(t * f.ende)), ms: Math.round(f.ende * 1000) };
}

/** CSS-Kurve linear(…) für Übergänge und Web Animations; ältere Browser bekommen eine weiche Bézier-Kurve */
const cache: Record<string, string> = {};
export function federCss(dauer = 0.5, bounce = 0) {
  const k = dauer + ":" + bounce; if (cache[k]) return cache[k];
  const f = feder(dauer, bounce), n = 48, p: string[] = [];
  for (let i = 0; i <= n; i++) p.push(String(Math.round(f.x((i / n) * f.ende) * 10000) / 10000));
  p[n] = "1";
  const css = `linear(${p.join(", ")})`;
  const geht = typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", css);
  return (cache[k] = geht ? css : "cubic-bezier(.32, .72, 0, 1)");
}
export const federMs = (dauer = 0.5, bounce = 0) => Math.round(feder(dauer, bounce).ende * 1000);

const handy = () => matchMedia("(max-width: 640px)").matches;

/** Fenster (dialog) weich öffnen: am Handy als Blatt von unten, sonst leicht vergrößernd */
export function modalAuf(dlg: HTMLDialogElement, art: "blatt" | "voll" = "blatt") {
  if (!dlg.open) dlg.showModal();
  if (ruhig()) return;
  const unten = art === "blatt" && handy();
  const d = unten ? 0.5 : 0.42, b = unten ? 0.06 : 0.12;
  const easing = federCss(d, b), duration = federMs(d, b);
  dlg.animate(unten ? [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }]
                    : [{ opacity: 0, transform: "translateY(14px) scale(.965)" }, { opacity: 1, transform: "none" }], { duration, easing });
  try { dlg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: "ease-out", pseudoElement: "::backdrop" }); } catch { /* ältere Browser */ }
}
/** Fenster weich schließen, danach wirklich schließen (löst „close“ aus) */
export async function modalZu(dlg: HTMLDialogElement | undefined, art: "blatt" | "voll" = "blatt") {
  if (!dlg?.open || dlg.dataset.zu) return;
  if (ruhig()) { dlg.close(); return; }
  dlg.dataset.zu = "1";
  const unten = art === "blatt" && handy();
  const a = dlg.animate(unten ? [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }]
                              : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px) scale(.975)" }],
    { duration: unten ? 300 : 190, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
  try { dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: unten ? 300 : 190, easing: "ease-in", pseudoElement: "::backdrop", fill: "forwards" }); } catch { /* egal */ }
  await a.finished.catch(() => {});
  delete dlg.dataset.zu; dlg.close();
}
/** Escape und Klick daneben schließen das Fenster weich (statt hart) */
export function modalSanft(dlg: HTMLDialogElement, art: "blatt" | "voll" = "blatt") {
  const abbruch = (e: Event) => { e.preventDefault(); modalZu(dlg, art); };
  const klick = (e: MouseEvent) => { if (e.target === dlg) modalZu(dlg, art); };
  dlg.addEventListener("cancel", abbruch); dlg.addEventListener("click", klick);
  return () => { dlg.removeEventListener("cancel", abbruch); dlg.removeEventListener("click", klick); };
}

/** Gleitender Hintergrund für Reiter (role=tab mit aria-selected), wie der Segment-Schalter in iOS */
export function gleiter(box: HTMLElement, opt: { sel?: string; farbe?: string; linie?: boolean } = {}) {
  const sel = opt.sel ?? '[role="tab"][aria-selected="true"]';
  const g = document.createElement("span"); g.className = "gleiter"; g.setAttribute("aria-hidden", "true");
  box.classList.add("mit-gleiter"); if (opt.linie) box.classList.add("gleiter-linie"); box.prepend(g);
  if (opt.farbe) g.style.background = opt.farbe;
  let erst = true;
  const setzen = () => {
    const t = box.querySelector<HTMLElement>(sel);
    if (!t) { g.style.opacity = "0"; return; }
    g.style.transition = erst || ruhig() ? "none" : "";
    g.style.opacity = "1";
    g.style.width = t.offsetWidth + "px"; g.style.height = (opt.linie ? 2 : t.offsetHeight) + "px";
    g.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop + (opt.linie ? t.offsetHeight - 2 : 0)}px)`;
    if (erst) requestAnimationFrame(() => { erst = false; });
  };
  const mo = new MutationObserver(setzen); mo.observe(box, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "class"], childList: true });
  const ro = new ResizeObserver(setzen); ro.observe(box);
  requestAnimationFrame(setzen);
  return { destroy() { mo.disconnect(); ro.disconnect(); g.remove(); } };
}
