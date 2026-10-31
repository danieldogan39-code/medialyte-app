<script lang="ts">
  // Suchradar: alle Suchgebiete im Uhrzeigersinn, ein Strahl kreist und lässt jedes Gebiet aufleuchten, wenn er es überstreicht.
  // Der pulsierende Punkt ist das Gebiet, in dem der Agent als Nächstes sucht. Antippen zeigt ein Gebiet.
  // Bewegung nur über transform und opacity; beim ersten Anzeigen fährt das Radar hoch (Ringe, dann die Punkte reihum).
  import type { Gebiet } from "../lib/agent.svelte";
  import { datum, zahl } from "../lib/format";
  import { ruhig } from "../lib/bewegung";

  let { gebiete = [], index = 0, gross = false, seite = true }: { gebiete?: Gebiet[]; index?: number; gross?: boolean; seite?: boolean } = $props();
  const UMLAUF = 6;   // Sekunden pro Umdrehung des Strahls
  let wahl = $state<Gebiet | null>(null);
  const n = $derived(gebiete.length || 1);
  const jetzt = $derived(gebiete[(index ?? 0) % n]);
  const maxHits = $derived(Math.max(1, ...gebiete.map((g) => g.ohne_website ?? 0)));
  const zeige = $derived(wahl ?? jetzt);
  const durch = $derived(gebiete.filter((g) => g.zuletzt).length);
  const treffer = $derived(gebiete.reduce((a, g) => a + (g.ohne_website ?? 0), 0));
  function punkt(i: number) {
    const w = i / n, a = w * 2 * Math.PI, r = 170 * (0.42 + 0.5 * ((i * 7) % 5) / 4);
    return { x: 200 + Math.sin(a) * r, y: 200 - Math.cos(a) * r, w };
  }
  const still = ruhig();
</script>

<div class="radar-ganz" class:gross>
  <div class="radar" class:still>
    <svg viewBox="0 0 400 400" role="img" aria-label="Suchradar mit {gebiete.length} Gebieten, {durch} durchsucht, {treffer} Betriebe ohne Website">
      <defs>
        <radialGradient id="r-grund"><stop offset="0" stop-color="#7BAFFF" stop-opacity=".16" /><stop offset=".7" stop-color="#7BAFFF" stop-opacity=".04" /><stop offset="1" stop-color="#7BAFFF" stop-opacity="0" /></radialGradient>
        <radialGradient id="r-kern"><stop offset="0" stop-color="#fff" /><stop offset=".35" stop-color="#9CC3FF" /><stop offset="1" stop-color="#7BAFFF" stop-opacity="0" /></radialGradient>
      </defs>
      <circle cx="200" cy="200" r="192" fill="url(#r-grund)" />
      <g class="ringe">
        {#each [0.25, 0.5, 0.75, 1] as f, i}<circle class="ring" style="--i:{i}" cx="200" cy="200" r={170 * f} />{/each}
        {#each Array(72) as _, s}{@const a = (s / 72) * 2 * Math.PI}{@const l = s % 6 === 0 ? 10 : 4}
          <line class="tick" class:lang={s % 6 === 0} x1={200 + Math.sin(a) * 178} y1={200 - Math.cos(a) * 178} x2={200 + Math.sin(a) * (178 + l)} y2={200 - Math.cos(a) * (178 + l)} />{/each}
        <line class="spoke" x1="200" y1="30" x2="200" y2="370" /><line class="spoke" x1="30" y1="200" x2="370" y2="200" />
      </g>
      {#each gebiete as g, i (g.name + i)}
        {@const p = punkt(i)}{@const h = g.ohne_website ?? 0}{@const da = !!g.zuletzt}{@const r = da ? (h ? 3 + 5.5 * Math.sqrt(h / maxHits) : 2.6) : 2.2}
        <g class="pkt" class:treffer={da && h > 0} class:cur={i === (index ?? 0) % n} class:sel={wahl === g}
          style="--d: {(p.w * UMLAUF - UMLAUF).toFixed(2)}s; --e: {(0.5 + p.w * 0.9).toFixed(2)}s" role="button" tabindex="0" aria-label="{g.name}: {da ? `${h} ohne Website` : 'noch nicht durchsucht'}"
          onclick={() => (wahl = wahl === g ? null : g)} onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wahl = wahl === g ? null : g; } }}>
          {#if da && h}<circle class="echo" cx={p.x} cy={p.y} r={r} />{/if}
          {#if i === (index ?? 0) % n}<circle class="ziel" cx={p.x} cy={p.y} r={r + 4} /><circle class="ziel z2" cx={p.x} cy={p.y} r={r + 4} />{/if}
          <circle class="dot" cx={p.x} cy={p.y} r={r} fill={!da ? "#2A3F63" : h ? "#8DBBFF" : "#3D5F8F"} />
          <circle class="hit" cx={p.x} cy={p.y} r={r + 8} fill="transparent" />
        </g>
      {/each}
      <circle cx="200" cy="200" r="26" fill="url(#r-kern)" class="kern" />
      <circle cx="200" cy="200" r="4.5" fill="#fff" />
    </svg>
    <div class="strahl" aria-hidden="true" style="--u: {UMLAUF}s"></div>
  </div>
  {#if seite && zeige}
    <dl class="seite">
      <div class="kl">{wahl ? "Ausgewählt" : "Als Nächstes dran"}</div>
      <div class="gname">{zeige.name}</div>
      <dt>Zuletzt durchsucht</dt><dd>{zeige.zuletzt ? datum(zeige.zuletzt) : "noch nie"}</dd>
      <dt>Betriebe gefunden</dt><dd class="num">{zahl(zeige.restaurants ?? 0)}</dd>
      <dt>Davon ohne Website</dt><dd class="num hell">{zahl(zeige.ohne_website ?? 0)}</dd>
      <dt>Durchläufe</dt><dd class="num">{zahl(zeige.durchlaeufe ?? 0)}</dd>
      <div class="summe"><span><b class="num">{durch}</b> von {gebiete.length} Gebieten durchsucht</span><span><b class="num">{zahl(treffer)}</b> Betriebe ohne Website</span></div>
    </dl>
  {/if}
</div>

<style>
  .radar-ganz { display: grid; grid-template-columns: minmax(0, 1fr) minmax(200px, 250px); gap: 24px; align-items: center; }
  .radar-ganz.gross { grid-template-columns: minmax(0, 1fr) minmax(220px, 280px); }
  @media (max-width: 760px) { .radar-ganz, .radar-ganz.gross { grid-template-columns: minmax(0, 1fr); } }
  .radar { position: relative; width: min(100%, 440px); aspect-ratio: 1; margin: 0 auto; isolation: isolate; }
  .gross .radar { width: min(100%, 500px); }
  .radar svg { position: relative; z-index: 1; width: 100%; height: 100%; overflow: visible; }

  /* Strahl: ein weicher Fächer, der hinter seiner Kante ausläuft */
  .strahl { position: absolute; inset: 7.5%; border-radius: 50%; z-index: 0; pointer-events: none;
    background: conic-gradient(from 0deg, rgba(123, 175, 255, 0) 0deg, rgba(123, 175, 255, 0) 290deg, rgba(123, 175, 255, .08) 320deg, rgba(123, 175, 255, .34) 357deg, rgba(190, 216, 255, .75) 360deg);
    -webkit-mask: radial-gradient(circle, #000 0 69%, transparent 70.5%); mask: radial-gradient(circle, #000 0 69%, transparent 70.5%);
    animation: kreisen var(--u) linear infinite, an 1.4s cubic-bezier(.32, .72, 0, 1) .5s both; will-change: transform; }
  @keyframes kreisen { to { transform: rotate(360deg); } }
  @keyframes an { from { opacity: 0; } }

  /* Hochfahren: Ringe wachsen nacheinander auf, Skala blendet ein, Punkte erscheinen reihum */
  .ring { fill: none; stroke: rgba(123, 175, 255, .16); transform-box: view-box; transform-origin: 200px 200px; animation: wachsen .9s cubic-bezier(.32, .72, 0, 1) calc(var(--i) * .09s) both; }
  @keyframes wachsen { from { transform: scale(.2); opacity: 0; } }
  .tick { stroke: rgba(123, 175, 255, .18); stroke-width: 1; animation: an .8s ease .5s both; }
  .tick.lang { stroke: rgba(123, 175, 255, .36); }
  .spoke { stroke: rgba(123, 175, 255, .07); animation: an .8s ease .3s both; }
  .pkt { cursor: pointer; outline: none; }
  .pkt .dot, .pkt .echo, .pkt .ziel { transform-box: fill-box; transform-origin: center; }
  .pkt .dot { animation: auftauchen .7s cubic-bezier(.34, 1.56, .64, 1) var(--e) both, leuchten 6s linear var(--d) infinite; transition: transform .45s var(--feder-schnell); }
  .pkt.treffer .dot { filter: drop-shadow(0 0 5px rgba(141, 187, 255, .9)); }
  @keyframes auftauchen { from { transform: scale(0); } }
  /* Der Strahl streift den Punkt: kurz hell, dann klingt es ab (Takt = eine Umdrehung) */
  @keyframes leuchten { 0% { opacity: 1; } 4% { opacity: 1; } 45% { opacity: .55; } 100% { opacity: .55; } }
  .pkt:not(.treffer) .dot { animation: auftauchen .7s cubic-bezier(.34, 1.56, .64, 1) var(--e) both, leuchten-schwach 6s linear var(--d) infinite; }
  @keyframes leuchten-schwach { 0% { opacity: 1; } 40% { opacity: .7; } 100% { opacity: .7; } }
  .echo { fill: none; stroke: #8DBBFF; stroke-width: 1.4; animation: echo 6s cubic-bezier(.2, .6, .3, 1) var(--d) infinite; opacity: 0; }
  @keyframes echo { 0% { transform: scale(1); opacity: .9; } 22% { transform: scale(3.4); opacity: 0; } 100% { transform: scale(3.4); opacity: 0; } }
  .ziel { fill: none; stroke: #F3F5F9; stroke-width: 1.5; animation: ziel 2.2s cubic-bezier(.2, .6, .3, 1) infinite; }
  .ziel.z2 { animation-delay: 1.1s; }
  @keyframes ziel { from { transform: scale(.8); opacity: .95; } to { transform: scale(2.6); opacity: 0; } }
  .pkt.cur .dot { stroke: #fff; stroke-width: 1.6; }
  .pkt.sel .dot { stroke: #fff; stroke-width: 2.2; transform: scale(1.35); }
  @media (hover: hover) and (pointer: fine) { .pkt:hover .dot { transform: scale(1.4); } }
  .pkt:focus-visible .dot { stroke: var(--coral-2); stroke-width: 2.5; }
  .kern { transform-box: fill-box; transform-origin: center; animation: atmen 3s ease-in-out infinite; }
  @keyframes atmen { 50% { transform: scale(1.25); opacity: .7; } }
  .still .strahl, .still .echo, .still .ziel { animation: none; }
  .still .strahl { opacity: .5; }

  .seite { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; align-content: start; }
  .kl { grid-column: 1 / -1; color: var(--steel); font-size: .8rem; }
  .gname { grid-column: 1 / -1; color: var(--text); font-weight: 600; font-size: 1.15rem; margin-bottom: 4px; }
  .seite dt { color: var(--steel); font-size: .88rem; }
  .seite dd { margin: 0; text-align: right; color: var(--text); font-weight: 600; }
  .seite .hell { color: #9CC3FF; }
  .summe { grid-column: 1 / -1; display: grid; gap: 4px; margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--line); font-size: .84rem; color: var(--text-2); }
  .summe b { color: var(--text); }
  @media (prefers-reduced-motion: reduce) { .strahl, .echo, .ziel, .kern, .pkt .dot, .ring { animation: none !important; } }
</style>
