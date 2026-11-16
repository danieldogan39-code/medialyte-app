<script lang="ts">
  // Ein Baustein einer Lektion: Text, Merksatz, Formel, Rechenbeispiel, typischer Fehler, Klausurtipp, Tabelle, Grafik, Begriffe
  import Icon from "../Icon.svelte";
  import Grafik from "./Grafik.svelte";
  import Regler from "./Regler.svelte";
  import { md, mdZeile, tex } from "../../lib/lernen/md";
  import type { Baustein } from "../../lib/lernen/typen";
  // loesung: Grafik direkt nach einem Beispiel gehört zur Lösung und bleibt bis „Lösung zeigen“ verborgen
  let { b, farbe, loesung }: { b: Baustein; farbe: string; loesung?: Extract<Baustein, { t: "grafik" }> } = $props();
  let offen = $state(false);
  // Beispiele mit Aufgabe: Lösung Schritt für Schritt aufdecken (sz = Anzahl gezeigter Schritte)
  let sz = $state(0);
  const alle = $derived(b.t === "beispiel" ? b.schritte.length : 0);
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
    {#if !b.aufgabe || (offen && sz >= alle)}
      <ol class="schritte">{#each b.schritte as s}<li class="md">{@html md(s)}</li>{/each}</ol>
      {#if b.ergebnis}<div class="erg md">{@html md(b.ergebnis)}</div>{/if}
      {#if loesung}<Grafik g={loesung.g} {farbe} />{#if loesung.unter}<div class="md unter">{@html md(loesung.unter)}</div>{/if}{/if}
    {:else if offen}
      <ol class="schritte">{#each b.schritte.slice(0, sz) as s}<li class="md neu">{@html md(s)}</li>{/each}</ol>
      <div class="sk">
        <button class="btn btn--s btn--primary org-primary" onclick={() => sz++}>Nächster Schritt ({sz + 1}/{alle})</button>
        <button class="btn btn--s btn--quiet" onclick={() => (sz = alle)}>Alles zeigen</button>
      </div>
    {:else}
      <div class="sk">
        <button class="btn btn--s" onclick={() => { offen = true; sz = 1; }}>Schritt für Schritt lösen</button>
        <button class="btn btn--s btn--quiet" onclick={() => { offen = true; sz = alle; }}>Ganze Lösung zeigen</button>
      </div>
    {/if}
  </section>
{:else if b.t === "fehler"}
  <aside class="box fehler"><span class="kopf"><Icon name="x" size={15} />Typischer Fehler</span><div class="md">{@html md(b.md)}</div></aside>
{:else if b.t === "klausur"}
  <aside class="box klausur"><span class="kopf"><Icon name="target" size={15} />Für die Klausur</span><div class="md">{@html md(b.md)}</div></aside>
{:else if b.t === "tabelle"}
  <div class="tab">
    {#if b.titel}<span class="kopf tt">{@html mdZeile(b.titel)}</span>{/if}
    <div class="tw"><table class:karten={b.kopf.length > 2 && b.zeilen.flat().filter((c) => typeof c === "number").length * 3 < b.zeilen.flat().length}><thead><tr>{#each b.kopf as k}<th>{@html mdZeile(k)}</th>{/each}</tr></thead>
      <tbody>{#each b.zeilen as z}<tr>{#each z as c, ci}<td class:num={typeof c === "number"} data-k={(b.kopf[ci] ?? "").replace(/[*$\\]/g, "")}>{@html mdZeile(typeof c === "number" ? c.toLocaleString("de-DE") : c)}</td>{/each}</tr>{/each}</tbody></table></div>
  </div>
{:else if b.t === "grafik"}
  <div class="gw"><Grafik g={b.g} {farbe} />{#if b.unter}<div class="md unter">{@html md(b.unter)}</div>{/if}</div>
{:else if b.t === "begriffe"}
  <dl class="begr">{#each b.liste as [w, e]}<div><dt>{@html mdZeile(w)}</dt><dd class="md">{@html md(e)}</dd></div>{/each}</dl>
{:else if b.t === "regler"}
  <Regler {b} {farbe} />
{:else if b.t === "aufdecken"}
  <section class="box auf">
    <span class="kopf"><Icon name="sparkles" size={15} />Kurz überlegen</span>
    <div class="md">{@html md(b.frage)}</div>
    {#if offen}<div class="md antw">{@html md(b.antwort)}</div>
    {:else}<button class="btn btn--s" onclick={() => (offen = true)}>Antwort aufdecken</button>{/if}
  </section>
{:else if b.t === "aktuell"}
  <aside class="akt">
    <span class="kopf"><Icon name="refresh" size={15} />{@html mdZeile(b.titel ?? "Aktueller Stand")}<small>Stand {b.stand}</small></span>
    <div class="zeilen">
      <span class="lab">Im Skript</span><div class="md">{@html md(b.skript)}</div>
      <span class="lab neu">Heute</span><div class="md">{@html md(b.aktuell)}</div>
    </div>
    <p class="qu">{@html mdZeile(b.quelle)}</p>
  </aside>
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
  .sk { display: flex; flex-wrap: wrap; gap: 8px; }
  .neu:last-child { animation: neu .45s cubic-bezier(.16, 1, .3, 1); }
  @keyframes neu { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .auf { border-color: rgba(142, 124, 255, .35); background: rgba(142, 124, 255, .06); }
  .auf .kopf { color: #CDB8FF; }
  .auf .btn { justify-self: start; }
  .antw { padding: 10px 12px; border-radius: 10px; background: rgba(142, 124, 255, .1); animation: neu .45s cubic-bezier(.16, 1, .3, 1); }
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
  td :global(.katex) { white-space: nowrap; }
  @media (max-width: 560px) {
    .tw table.karten thead { display: none; }
    .tw table.karten, .tw table.karten tbody, .tw table.karten tr, .tw table.karten td { display: block; width: 100%; }
    .tw table.karten tr { padding: 10px 12px; border-bottom: 1px solid var(--line); }
    .tw table.karten td { padding: 3px 0 !important; border: 0 !important; text-align: left !important; }
    .tw table.karten td::before { content: attr(data-k); display: block; font-size: .7rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--steel); }
    .tw table.karten td:first-child { font-weight: 600; color: var(--text); }
    .tw table.karten td:first-child::before { display: none; }
  }
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
  .akt { display: grid; gap: 8px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(111, 168, 240, .35); background: rgba(111, 168, 240, .07); font-size: .9rem; }
  .akt .kopf { display: flex; align-items: center; gap: 6px; color: #9CC4F5; font-weight: 600; }
  .akt .kopf small { margin-left: auto; color: var(--steel); font-weight: 500; font-size: .74rem; }
  .akt .zeilen { display: grid; grid-template-columns: 74px 1fr; gap: 6px 10px; align-items: start; }
  .akt .lab { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--steel); padding-top: 3px; }
  .akt .lab.neu { color: #9CC4F5; }
  .akt .md { color: var(--text-2); line-height: 1.5; }
  .akt .md :global(p) { margin: 0; }
  .akt .qu { margin: 0; font-size: .76rem; color: var(--steel); }
  .akt .qu :global(a) { color: #9CC4F5; }
</style>
