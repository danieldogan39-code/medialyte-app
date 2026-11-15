<script lang="ts">
  // Ein Baustein einer Lektion: Text, Merksatz, Formel, Rechenbeispiel, typischer Fehler, Klausurtipp, Tabelle, Grafik, Begriffe
  import Icon from "../Icon.svelte";
  import Grafik from "./Grafik.svelte";
  import { md, mdZeile, tex } from "../../lib/lernen/md";
  import type { Baustein } from "../../lib/lernen/typen";
  // loesung: Grafik direkt nach einem Beispiel gehört zur Lösung und bleibt bis „Lösung zeigen“ verborgen
  let { b, farbe, loesung }: { b: Baustein; farbe: string; loesung?: Extract<Baustein, { t: "grafik" }> } = $props();
  let offen = $state(false);
</script>

{#if b.t === "text"}
  <div class="md">{@html md(b.md)}</div>
{:else if b.t === "merke"}
  <aside class="box merke"><span class="kopf"><Icon name="sparkles" size={15} />{@html mdZeile(b.titel ?? "Merke")}</span><div class="md">{@html md(b.md)}</div></aside>
{:else if b.t === "formel"}
  <div class="formel">
    {#if b.name}<span class="kopf">{@html mdZeile(b.name)}</span>{/if}
    <div class="f">{@html tex(b.tex, true)}</div>
    {#if b.legende}<dl>{#each b.legende as [z, e]}<dt>{@html mdZeile(z)}</dt><dd>{@html mdZeile(e)}</dd>{/each}</dl>{/if}
  </div>
{:else if b.t === "beispiel"}
  <section class="box bsp">
    <span class="kopf"><Icon name="stift" size={15} />{@html mdZeile(b.titel)}</span>
    {#if b.aufgabe}<div class="md">{@html md(b.aufgabe)}</div>{/if}
    {#if offen || !b.aufgabe}
      <ol class="schritte">{#each b.schritte as s}<li class="md">{@html md(s)}</li>{/each}</ol>
      {#if b.ergebnis}<div class="erg md">{@html md(b.ergebnis)}</div>{/if}
      {#if loesung}<Grafik g={loesung.g} {farbe} />{#if loesung.unter}<div class="md unter">{@html md(loesung.unter)}</div>{/if}{/if}
    {:else}
      <button class="btn btn--s" onclick={() => (offen = true)}>Erst selbst probieren – dann Lösung zeigen</button>
    {/if}
  </section>
{:else if b.t === "fehler"}
  <aside class="box fehler"><span class="kopf"><Icon name="x" size={15} />Typischer Fehler</span><div class="md">{@html md(b.md)}</div></aside>
{:else if b.t === "klausur"}
  <aside class="box klausur"><span class="kopf"><Icon name="target" size={15} />Für die Klausur</span><div class="md">{@html md(b.md)}</div></aside>
{:else if b.t === "tabelle"}
  <div class="tab">
    {#if b.titel}<span class="kopf tt">{@html mdZeile(b.titel)}</span>{/if}
    <div class="tw"><table><thead><tr>{#each b.kopf as k}<th>{@html mdZeile(k)}</th>{/each}</tr></thead>
      <tbody>{#each b.zeilen as z}<tr>{#each z as c}<td class:num={typeof c === "number"}>{@html mdZeile(typeof c === "number" ? c.toLocaleString("de-DE") : c)}</td>{/each}</tr>{/each}</tbody></table></div>
  </div>
{:else if b.t === "grafik"}
  <div class="gw"><Grafik g={b.g} {farbe} />{#if b.unter}<div class="md unter">{@html md(b.unter)}</div>{/if}</div>
{:else if b.t === "begriffe"}
  <dl class="begr">{#each b.liste as [w, e]}<div><dt>{@html mdZeile(w)}</dt><dd class="md">{@html md(e)}</dd></div>{/each}</dl>
{:else if b.t === "quelle"}
  <p class="quelle">{@html mdZeile(b.md)}</p>
{/if}

<style>
  .md { color: var(--text-2); line-height: 1.65; font-size: 1rem; }
  .md :global(p) { margin: 0 0 .7em; }
  .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(b) { color: var(--text); font-weight: 600; }
  .md :global(mark) { background: color-mix(in srgb, var(--f) 26%, transparent); color: var(--text); padding: 0 3px; border-radius: 4px; }
  .md :global(ul), .md :global(ol) { margin: .2em 0 .8em; padding-left: 1.3em; display: grid; gap: .3em; }
  .md :global(.fb) { overflow-x: auto; padding: 4px 0; }
  .kopf { display: inline-flex; align-items: center; gap: 7px; font-size: .74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .box { display: grid; gap: 8px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--panel); }
  .merke { border-color: color-mix(in srgb, var(--f) 45%, transparent); background: color-mix(in srgb, var(--f) 9%, var(--panel)); }
  .merke .kopf { color: var(--f); }
  .bsp .kopf { color: var(--info); }
  .fehler { border-color: rgba(242, 122, 106, .35); background: rgba(242, 122, 106, .07); }
  .fehler .kopf { color: #F27A6A; }
  .klausur { border-color: rgba(231, 185, 74, .4); background: rgba(231, 185, 74, .07); }
  .klausur .kopf { color: var(--warn); }
  .schritte { margin: 0; padding-left: 1.4em; display: grid; gap: 6px; }
  .schritte li::marker { color: var(--info); font-weight: 700; }
  .erg { padding: 10px 12px; border-radius: 10px; background: rgba(76, 195, 138, .1); border: 1px solid rgba(76, 195, 138, .3); }
  .erg :global(b) { color: var(--ok); }
  .bsp .btn { justify-self: start; }
  .formel { display: grid; gap: 6px; padding: 14px 16px; border-radius: 14px; background: var(--bg-2); border: 1px solid var(--line-2); }
  .formel .kopf { color: var(--steel); }
  .f { overflow-x: auto; font-size: 1.12rem; color: var(--text); }
  .formel dl { margin: 4px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: .86rem; }
  .formel dt { color: var(--text); font-weight: 600; }
  .formel dd { margin: 0; color: var(--text-2); }
  .tab { display: grid; gap: 8px; }
  .tab .kopf { color: var(--steel); }
  .tab .tt { text-transform: none; letter-spacing: 0; font-size: .86rem; font-weight: 600; display: block; }
  .tab .tt :global(b) { color: var(--text-2); }
  .tw { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th { text-align: left; padding: 9px 12px; background: var(--panel-2); color: var(--text); font-weight: 600; border-bottom: 1px solid var(--line-2); }
  td { padding: 8px 12px; border-top: 1px solid var(--line); color: var(--text-2); vertical-align: top; }
  td.num { text-align: right; }
  .gw { display: grid; gap: 8px; }
  .unter { font-size: .88rem; }
  .begr { margin: 0; display: grid; gap: 8px; }
  .begr div { display: grid; grid-template-columns: minmax(120px, 28%) 1fr; gap: 12px; padding: 10px 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); }
  .begr dt { color: var(--text); font-weight: 600; }
  .begr dd { margin: 0; font-size: .92rem; }
  .quelle { margin: 0; font-size: .8rem; color: var(--steel); }
  @media (max-width: 560px) { .begr div { grid-template-columns: 1fr; gap: 2px; } }
</style>
