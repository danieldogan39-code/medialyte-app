<script lang="ts">
  // Interaktiver Baustein: Regler verschieben → Werte, Graph und Balken rechnen sich live neu.
  import type { Baustein } from "../../lib/lernen/typen";
  import Grafik from "./Grafik.svelte";
  import { md, mdZeile } from "../../lib/lernen/md";
  import { wert, zahlText, type Werte } from "../../lib/lernen/ausdruck";
  import Icon from "../Icon.svelte";
  let { b, farbe = "var(--org)" }: { b: Extract<Baustein, { t: "regler" }>; farbe?: string } = $props();

  let stand = $state<Record<string, number>>(Object.fromEntries(b.regler.map((r) => [r.id, r.start])));
  const sicher = (f: string, w: Werte) => { try { const v = wert(f, w); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
  // Reglerwerte + Hilfsgrößen (der Reihe nach berechnet)
  const w = $derived.by(() => { const o: Werte = { ...stand }; for (const [n, f] of b.hilfs ?? []) o[n] = sicher(f, o); return o; });
  const zeig = (v: number, st = 2) => (Number.isFinite(v) ? zahlText(v, st, false, false) : "–");
  const grafik = $derived.by(() => {
    if (!b.graph) return null;
    const g = b.graph;
    return { art: "graph" as const, x: g.x, y: g.y, kurven: g.kurven, xName: g.xName, yName: g.yName,
      punkte: (g.punkte ?? []).map((p) => ({ x: sicher(p.x, w), y: sicher(p.y, w), name: p.name })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
      flaeche: g.flaeche ? { f: g.flaeche.f, g: g.flaeche.g, von: sicher(g.flaeche.von, w), bis: sicher(g.flaeche.bis, w) } : undefined };
  });
  const balken = $derived((b.balken ?? []).map((x) => ({ ...x, v: sicher(x.f, w) })));
  const bmax = $derived(Math.max(1e-9, ...balken.map((x) => Math.abs(x.v)).filter(Number.isFinite)));
  const FARBEN = ["#8E7CFF", "#4FC7D4", "#F2995A", "#4CC38A", "#E7B94A", "#F27A6A"];
  function zuruecksetzen() { stand = Object.fromEntries(b.regler.map((r) => [r.id, r.start])); }
</script>

<section class="rg">
  <div class="kopf"><span class="ic"><Icon name="sparkles" size={15} /></span><b>{@html mdZeile(b.titel)}</b><span class="tag">Zum Ausprobieren</span></div>
  {#if b.md}<div class="md">{@html md(b.md)}</div>{/if}
  <div class="regler">
    {#each b.regler as r (r.id)}
      <label>
        <span class="rk"><span>{@html mdZeile(r.name)}</span><b class="num">{zeig(stand[r.id], 4)}{r.einheit ? " " + r.einheit : ""}</b></span>
        <input type="range" min={r.von} max={r.bis} step={r.schritt ?? 1} bind:value={stand[r.id]} style="--p: {((stand[r.id] - r.von) / (r.bis - r.von)) * 100}%" />
      </label>
    {/each}
  </div>
  {#if b.werte?.length}
    <div class="werte">
      {#each b.werte as x}<div class:hervor={x.hervor}><span>{@html mdZeile(x.name)}</span><b class="num">{zeig(sicher(x.f, w), x.stellen ?? 2)}{x.einheit ? " " + x.einheit : ""}</b></div>{/each}
    </div>
  {/if}
  {#if grafik}<Grafik g={grafik} {farbe} werte={w} />{/if}
  {#if balken.length}
    <div class="bk">
      {#each balken as x, i}
        <div class="bz"><span class="bn">{@html mdZeile(x.name)}</span><span class="bb"><i style="width: {Number.isFinite(x.v) ? Math.max(0, (Math.abs(x.v) / bmax) * 100) : 0}%; background: {x.farbe ?? FARBEN[i % FARBEN.length]}"></i></span><b class="num">{zeig(x.v)}{b.einheit ? " " + b.einheit : ""}</b></div>
      {/each}
    </div>
  {/if}
  {#if b.unter}<div class="md unter">{@html md(b.unter)}</div>{/if}
  <button class="btn btn--s btn--quiet zr" onclick={zuruecksetzen}>Zurücksetzen</button>
</section>

<style>
  .rg { display: grid; gap: 14px; padding: 16px; border-radius: 18px; border: 1px solid rgba(142, 124, 255, .35); background: linear-gradient(160deg, rgba(142, 124, 255, .08), rgba(79, 199, 212, .04)); }
  .kopf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: rgba(142, 124, 255, .2); color: #CDB8FF; }
  .tag { margin-left: auto; font-size: .7rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #CDB8FF; }
  .md { color: var(--text-2); line-height: 1.6; }
  .md :global(p) { margin: 0 0 .5em; }
  .regler { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 12px 18px; }
  .regler label { display: grid; gap: 6px; }
  .rk { display: flex; justify-content: space-between; gap: 10px; font-size: .88rem; color: var(--text-2); }
  .rk b { color: var(--text); }
  input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 28px; background: transparent; cursor: pointer; touch-action: pan-y; }
  input[type="range"]::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, #8E7CFF var(--p), rgba(203, 215, 235, .14) var(--p)); }
  input[type="range"]::-moz-range-track { height: 6px; border-radius: 3px; background: rgba(203, 215, 235, .14); }
  input[type="range"]::-moz-range-progress { height: 6px; border-radius: 3px; background: #8E7CFF; }
  input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; margin-top: -9px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, .4), 0 0 0 4px rgba(142, 124, 255, .35); }
  input[type="range"]::-moz-range-thumb { width: 22px; height: 22px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, .4), 0 0 0 4px rgba(142, 124, 255, .35); }
  .werte { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: 8px; }
  .werte div { display: grid; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--bg-2); }
  .werte span { font-size: .78rem; color: var(--steel); }
  .werte b { font-size: 1.15rem; }
  .werte .hervor { background: rgba(142, 124, 255, .16); box-shadow: inset 0 0 0 1px rgba(142, 124, 255, .4); }
  .bk { display: grid; gap: 8px; }
  .bz { display: grid; grid-template-columns: minmax(90px, 30%) 1fr auto; align-items: center; gap: 10px; font-size: .86rem; }
  .bn { color: var(--text-2); }
  .bb { height: 12px; border-radius: 6px; background: rgba(203, 215, 235, .08); overflow: hidden; }
  .bb i { display: block; height: 100%; border-radius: 6px; transition: width .25s cubic-bezier(.32, .72, 0, 1); }
  .unter { font-size: .9rem; }
  .zr { justify-self: start; }
  @media (max-width: 560px) { .bz { grid-template-columns: 1fr auto; } .bb { grid-column: 1 / -1; grid-row: 2; } }
</style>
