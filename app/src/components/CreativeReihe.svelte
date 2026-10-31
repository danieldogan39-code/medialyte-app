<script lang="ts">
  // Reihenfolge zum Sortieren, gebaut fürs Handy: am Griff rechts greifen (sofort, ohne langes Drücken) und schieben.
  // Die anderen Zeilen weichen weich aus, die Lücke zeigt, wo das Creative landet, und alle Nummern zählen live mit.
  // Tastatur: Griff fokussieren, Pfeil hoch/runter verschiebt um einen Platz.
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import { daten } from "../lib/daten.svelte";
  import { haptik } from "../lib/haptik";
  import { ruhig } from "../lib/bewegung";
  import { social, STATUS, PLATTFORMEN, typenVon, offen, raenge, type Creative } from "../lib/social.svelte";
  import { fmtTag } from "../lib/socialformat";

  let { liste, schreiben = false, plattform = "", global = false, sortierbar = true }:
    { liste: Creative[]; schreiben?: boolean; plattform?: string; global?: boolean; sortierbar?: boolean } = $props();

  type Zug = { id: string; von: number; ziel: number; dy: number; faellt: boolean };
  let reihe = $state<Creative[]>([]);
  let zug = $state<Zug | null>(null);
  let still = $state(false);          // Übergänge kurz aus, wenn die neue Reihenfolge übernommen wird
  let ansage = $state("");            // für Bildschirmleser
  $effect(() => { const l = liste.filter(offen); if (!zug) reihe = l; });
  const erledigt = $derived(liste.filter((c) => !offen(c)));
  const darf = $derived(schreiben && sortierbar && reihe.length > 1);

  // Reihenfolge, wie sie nach dem Loslassen wäre – daraus die Nummern
  const vorschau = $derived.by(() => {
    if (!zug) return reihe;
    const n = [...reihe]; const [c] = n.splice(zug.von, 1); n.splice(zug.ziel, 0, c); return n;
  });
  const nummern = $derived(raenge(vorschau, global, social.sortiert()));
  const platz = (i: number) => {
    if (!zug) return i;
    const { von, ziel } = zug;
    if (i === von) return ziel;
    if (von < ziel && i > von && i <= ziel) return i - 1;
    if (von > ziel && i >= ziel && i < von) return i + 1;
    return i;
  };

  let ol: HTMLOListElement | undefined = $state();
  let schritt = $state(84);
  let startY = 0, zeigerY = 0, raf = 0, zeiger = -1, griffEl: HTMLElement | null = null;

  function runter(e: PointerEvent, i: number) {
    if (!darf || zug || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    griffEl = e.currentTarget as HTMLElement;
    griffEl.setPointerCapture(e.pointerId); zeiger = e.pointerId;
    const zeilen = [...(ol?.children ?? [])].filter((x) => x.classList.contains("zeile")) as HTMLElement[];
    schritt = zeilen.length > 1 ? zeilen[1].offsetTop - zeilen[0].offsetTop : zeilen[0]?.offsetHeight ?? 84;
    startY = zeigerY = e.clientY; startY += scrollY;
    zug = { id: reihe[i].id, von: i, ziel: i, dy: 0, faellt: false };
    haptik("mittel");
    griffEl.addEventListener("pointermove", bewegen);
    griffEl.addEventListener("pointerup", los);
    griffEl.addEventListener("pointercancel", abbruch);
    document.documentElement.classList.add("am-ziehen");
    rollen();
  }
  function bewegen(e: PointerEvent) { if (e.pointerId !== zeiger) return; zeigerY = e.clientY; folgen(); }
  function folgen() {
    if (!zug || zug.faellt) return;
    let dy = zeigerY + scrollY - startY;
    // an den Enden weich abbremsen statt hart anzuschlagen
    const min = -zug.von * schritt, max = (reihe.length - 1 - zug.von) * schritt;
    if (dy < min) dy = min - Math.min(40, (min - dy) * 0.25);
    if (dy > max) dy = max + Math.min(40, (dy - max) * 0.25);
    const ziel = Math.max(0, Math.min(reihe.length - 1, Math.round(zug.von + dy / schritt)));
    if (ziel !== zug.ziel) { haptik("auswahl"); ansage = `Platz ${nummern.get(zug.id) ?? ziel + 1}`; }
    zug.dy = dy; zug.ziel = ziel;
  }
  // am oberen/unteren Rand mitscrollen (oben Kopfzeile, unten Tab-Leiste am Handy)
  function rollen() {
    cancelAnimationFrame(raf);
    const lauf = () => {
      if (!zug || zug.faellt) return;
      const oben = 90, unten = innerHeight - (innerWidth <= 900 ? 120 : 70);
      const v = zeigerY < oben ? -Math.min(18, (oben - zeigerY) / 4) : zeigerY > unten ? Math.min(18, (zeigerY - unten) / 4) : 0;
      if (v) { scrollBy(0, v); folgen(); }
      raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
  }
  function aufraeumen() {
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove("am-ziehen");
    if (griffEl) {
      griffEl.removeEventListener("pointermove", bewegen); griffEl.removeEventListener("pointerup", los); griffEl.removeEventListener("pointercancel", abbruch);
      try { griffEl.releasePointerCapture(zeiger); } catch { /* schon frei */ }
    }
    griffEl = null; zeiger = -1;
  }
  const warte = (ms: number) => new Promise((r) => setTimeout(r, ruhig() ? 0 : ms));
  async function los(e?: PointerEvent) {
    if (e && e.pointerId !== zeiger) return;
    if (!zug) return;
    aufraeumen();
    const { id, von, ziel } = zug;
    zug.faellt = true; zug.dy = (ziel - von) * schritt;   // gleitet in die Lücke
    await warte(240);
    await uebernehmen(id, von, ziel);
  }
  async function abbruch() {
    if (!zug) return;
    aufraeumen();
    zug.faellt = true; zug.ziel = zug.von; zug.dy = 0;
    await warte(240);
    zug = null;
  }
  async function uebernehmen(id: string, von: number, ziel: number, fokus = false) {
    const neu = [...reihe]; const [c] = neu.splice(von, 1); neu.splice(ziel, 0, c);
    // zuerst die neue Position setzen (geschieht sofort, gespeichert wird im Hintergrund), damit nichts zurückspringt
    const speichern = von !== ziel ? social.verschieben(id, neu) : null;
    still = true; reihe = neu; zug = null;
    await tick();
    requestAnimationFrame(() => requestAnimationFrame(() => (still = false)));
    if (fokus) ol?.querySelector<HTMLElement>(`[data-griff="${id}"]`)?.focus();
    if (!speichern) return;
    haptik("erfolg");
    ansage = `${c.titel}: jetzt Platz ${raenge(neu, global, social.sortiert()).get(id)}`;
    try { await speichern; }
    catch (err: any) { daten.melden("Reihenfolge nicht gespeichert: " + (err?.message || err)); reihe = liste.filter(offen); }
  }
  function taste(e: KeyboardEvent, i: number) {
    if (!darf || zug) return;
    const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : e.key === "Home" ? -i : e.key === "End" ? reihe.length - 1 - i : 0;
    if (!d) return;
    e.preventDefault();
    const ziel = Math.max(0, Math.min(reihe.length - 1, i + d));
    if (ziel !== i) uebernehmen(reihe[i].id, i, ziel, true);
  }

  const bild = (c: Creative) => (c.vorschau ? social.bild[c.vorschau] : "");
  const aufPlattform = (c: Creative) => PLATTFORMEN.filter((p) => typenVon(c, p).length);
  const artText = (c: Creative) => c.art === "video" ? "Video" : c.art === "karussell" ? `${c.dateien.filter((d) => d.art === "bild").length} Seiten` : "Bild";
  const artIcon = (c: Creative) => (c.art === "video" ? "play" : c.art === "karussell" ? "stapel" : "image");
  const versatz = (c: Creative, i: number) => (zug && zug.id === c.id ? zug.dy : (platz(i) - i) * schritt);
</script>

{#snippet zeile(c: Creative, nr: number, griff: boolean, i: number)}
  <a class="z__link" href="#/social/c/{c.slug}" tabindex={zug ? -1 : 0} draggable="false">
    {#if nr}{#key nr}<span class="z__nr num">{nr}</span>{/key}{/if}
    <span class="z__bild">{#if bild(c)}<img src={bild(c)} alt="" draggable="false" loading="lazy" decoding="async">{/if}</span>
    <span class="z__t">
      <b>{c.titel}</b>
      <span class="z__m">
        <span class="z__art"><Icon name={artIcon(c)} size={12} />{artText(c)}</span>
        {#if !plattform}<span class="z__pf">{#each aufPlattform(c).slice(0, 4) as p (p.key)}<PlattformLogo name={p.key} size={15} rund={0.3} />{/each}</span>{/if}
        {#if c.status !== "freigegeben"}<span class="z__st z__st--{STATUS[c.status].ton}">{STATUS[c.status].name}</span>
        {:else if c.geplant}<span class="z__gp"><Icon name="calendar" size={11} />{fmtTag(c.geplant)}</span>{/if}
      </span>
    </span>
    {#if c.favorit}<span class="z__fav" title="Favorit"><Icon name="star" size={14} fill /></span>{/if}
  </a>
  {#if griff}
    <button class="z__griff" data-griff={c.id} aria-label="{c.titel} verschieben, Platz {nr} von {reihe.length}. Pfeiltasten hoch und runter."
      onpointerdown={(e) => runter(e, i)} onkeydown={(e) => taste(e, i)} oncontextmenu={(e) => e.preventDefault()}><Icon name="griff" size={20} /></button>
  {/if}
{/snippet}

{#if reihe.length}
  <ol class="reihe" bind:this={ol} class:zieht={!!zug} class:still>
    {#each reihe as c, i (c.id)}
      <li class="zeile" class:hoch={zug?.id === c.id} class:faellt={zug?.id === c.id && zug.faellt} style:transform="translate3d(0, {versatz(c, i)}px, 0)">
        {@render zeile(c, nummern.get(c.id) ?? i + 1, darf, i)}
      </li>
    {/each}
    {#if zug}<li class="luecke" aria-hidden="true" style:transform="translate3d(0, {zug.ziel * schritt}px, 0)"></li>{/if}
  </ol>
{/if}
<p class="sr" aria-live="polite">{ansage}</p>

{#if erledigt.length}
  <details class="erledigt" open={!reihe.length}>
    <summary><span>Gepostet und verworfen</span><span class="muted num">{erledigt.length}</span><Icon name="down" size={16} /></summary>
    <ol class="reihe reihe--aus">
      {#each erledigt as c, i (c.id)}<li class="zeile" class:verworfen={c.status === "verworfen"}>{@render zeile(c, 0, false, i)}</li>{/each}
    </ol>
  </details>
{/if}

<style>
  .reihe { position: relative; list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .zeile { position: relative; z-index: 1; display: flex; align-items: center; height: 76px; border-radius: 16px; background: var(--panel); border: 1px solid var(--line);
    transition: transform .34s cubic-bezier(.32, .72, 0, 1), box-shadow .25s ease, background-color .25s ease, border-color .25s ease; will-change: transform; }
  .still .zeile, .still .luecke { transition: none !important; }
  .zeile.hoch { z-index: 3; transition: box-shadow .25s ease, background-color .25s ease, border-color .25s ease; background: var(--panel-2);
    border-color: color-mix(in srgb, var(--bereich) 55%, var(--line)); box-shadow: 0 22px 44px -18px rgba(0, 0, 0, .85), 0 0 0 1px color-mix(in srgb, var(--bereich) 25%, transparent); }
  .zeile.hoch.faellt { transition: transform .24s cubic-bezier(.32, .72, 0, 1), box-shadow .24s ease; box-shadow: 0 6px 16px -10px rgba(0, 0, 0, .6); }
  .zeile.hoch .z__link { transform: scale(1.015); }
  .luecke { position: absolute; left: 0; right: 0; top: 0; height: 76px; z-index: 0; border-radius: 16px; pointer-events: none;
    border: 1.5px dashed color-mix(in srgb, var(--bereich) 55%, transparent); background: color-mix(in srgb, var(--bereich) 7%, transparent);
    transition: transform .34s cubic-bezier(.32, .72, 0, 1); }
  .zieht .z__link { pointer-events: none; }
  .z__link { flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; gap: 12px; padding: 0 4px 0 12px; color: inherit; border-radius: 16px;
    transition: transform .25s cubic-bezier(.32, .72, 0, 1); -webkit-touch-callout: none; }
  .z__nr { flex: none; min-width: 28px; height: 28px; padding: 0 7px; border-radius: 999px; display: grid; place-items: center; font-weight: 700; font-size: .88rem;
    background: var(--text); color: var(--bg); }
  .zieht .z__nr { animation: nr .32s cubic-bezier(.34, 1.56, .64, 1); }
  .zeile.hoch .z__nr { background: var(--bereich); color: #0A1220; }
  @keyframes nr { from { transform: scale(.7); opacity: .4; } }
  .z__bild { flex: none; width: 44px; height: 58px; border-radius: 9px; overflow: hidden; background: linear-gradient(160deg, var(--panel-2), var(--bg-2)); box-shadow: 0 0 0 1px var(--line); }
  .z__bild img { width: 100%; height: 100%; object-fit: cover; display: block; -webkit-user-drag: none; }
  .z__t { flex: 1; min-width: 0; display: grid; gap: 5px; }
  .z__t b { font-weight: 600; font-size: .94rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .z__m { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: .76rem; color: var(--steel); white-space: nowrap; overflow: hidden; }
  .z__art, .z__gp { display: inline-flex; align-items: center; gap: 4px; flex: none; }
  .z__pf { display: inline-flex; gap: 3px; flex: none; }
  .z__st { flex: none; padding: 1px 7px; border-radius: 999px; font-size: .7rem; }
  .z__st--gelb { background: rgba(231, 185, 74, .15); color: #EBC56B; }
  .z__st--blau { background: rgba(111, 168, 240, .15); color: #8DBBF5; }
  .z__st--grau { background: rgba(139, 152, 173, .15); color: #AEB9CA; }
  .z__fav { flex: none; color: #F7C65E; display: grid; }
  .z__griff { flex: none; align-self: stretch; width: 52px; display: grid; place-items: center; border: 0; background: transparent; color: var(--steel); cursor: grab;
    touch-action: none; -webkit-user-select: none; user-select: none; border-radius: 0 16px 16px 0; transition: color .2s ease, background-color .2s ease; }
  .z__griff:focus-visible { outline: 2px solid var(--bereich); outline-offset: -4px; }
  .zeile.hoch .z__griff { color: var(--bereich); cursor: grabbing; }
  .erledigt { margin-top: 22px; }
  .erledigt summary { list-style: none; display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 2px; font-size: .88rem; color: var(--text-2); }
  .erledigt summary::-webkit-details-marker { display: none; }
  .erledigt summary :global(svg) { margin-left: auto; color: var(--steel); transition: transform .3s cubic-bezier(.32, .72, 0, 1); }
  .erledigt[open] summary :global(svg) { transform: rotate(180deg); }
  .reihe--aus { margin-top: 6px; }
  .reihe--aus .zeile { opacity: .72; }
  .reihe--aus .zeile.verworfen { opacity: .5; }
  .reihe--aus .z__link { padding-right: 14px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); margin: 0; }
  @media (hover: hover) and (pointer: fine) {
    .reihe:not(.zieht) .zeile:hover { border-color: var(--line-2); }
    .z__griff:hover { color: var(--text); background: rgba(255, 255, 255, .04); }
  }
  @media (prefers-reduced-motion: reduce) { .zeile, .luecke, .z__link { transition: none !important; } .zieht .z__nr { animation: none; } }
  @media (max-width: 520px) {
    .zeile, .luecke { height: 72px; }
    .z__link { gap: 10px; padding-left: 10px; }
    .z__bild { width: 40px; height: 53px; }
  }
</style>
