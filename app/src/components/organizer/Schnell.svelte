<script lang="ts">
  // Schnelleingabe: eine Zeile tippen, die App erkennt Fach, Dauer, Frist, feste Zeit und Wichtigkeit
  import Fenster from "./Fenster.svelte";
  import Icon from "../Icon.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { erkennen } from "../../lib/organizer/schnell";
  import { tagKey } from "../../lib/organizer/zeit";

  let { text = "", onclose }: { text?: string; onclose: () => void } = $props();
  let fenster: Fenster | undefined = $state();
  let eingabe = $state(text), laeuft = $state(false);
  const e = $derived(erkennen(eingabe, org.faecher));
  const BEISPIELE = ["Mathe Kapitel 4 rechnen 90min bis Fr", "Rechnungswesen Probeklausur 2h bis 17.12. !", "Zahnarzt morgen 14:30 45min", "Lebenslauf aktualisieren 30min ?"];

  async function anlegen(ev?: Event) {
    ev?.preventDefault();
    if (!e.titel || laeuft) return;
    laeuft = true;
    const r = await org.aufgabeSpeichern({ titel: e.titel, fach_id: e.fach?.id ?? null, dauer_min: e.dauer_min ?? 60, frist: e.frist ?? (e.geplant ? tagKey(e.geplant) : null), prio: e.prio,
      geplant: e.geplant ? e.geplant.toISOString() : null, fixiert: !!e.geplant }, true);
    laeuft = false;
    if (r) { eingabe = ""; fenster?.zu(); }
  }
</script>

<Fenster bind:this={fenster} titel="Schnell hinzufügen" {onclose}>
  <form class="f" onsubmit={anlegen}>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input gross" bind:value={eingabe} placeholder="Was steht an?" autofocus enterkeyhint="done" autocomplete="off">
    {#if eingabe.trim()}
      <div class="erkannt">
        <span class="t">{e.titel || "…"}</span>
        <span class="chips">
          {#each e.teile as x}<span class="pill pill--plain" style={e.fach && x === e.fach.name ? `background: color-mix(in srgb, ${e.fach.farbe} 20%, transparent); color: ${e.fach.farbe}` : ""}>{x}</span>{/each}
          {#if !e.dauer_min}<span class="pill pill--plain muted">⏱ 60 Min. (Standard)</span>{/if}
          {#if !e.geplant}<span class="pill pill--plain pill--lila"><Icon name="wand" size={12} />wird automatisch eingeplant</span>{/if}
        </span>
      </div>
    {:else}
      <div class="beispiele">
        <small class="muted">So geht's – einfach drauflos tippen:</small>
        {#each BEISPIELE as b}<button type="button" onclick={() => (eingabe = b)}>{b}</button>{/each}
      </div>
    {/if}
  </form>
  {#snippet fuss()}
    <button class="btn btn--quiet links" type="button" onclick={() => blatt.auf({ art: "aufgabe", a: { titel: e.titel, fach_id: e.fach?.id ?? null, dauer_min: e.dauer_min ?? 60, frist: e.frist, prio: e.prio } })}>Mehr Optionen</button>
    <button class="btn btn--quiet" type="button" onclick={() => blatt.auf({ art: "termin", t: { titel: e.titel } })}><Icon name="calendar" size={15} />Termin</button>
    <button class="btn btn--primary org-primary" type="button" disabled={!e.titel || laeuft} onclick={() => anlegen()}>Hinzufügen</button>
  {/snippet}
</Fenster>

<style>
  .f { display: grid; gap: 14px; }
  .gross { font-size: 1.1rem; min-height: 52px; }
  .erkannt { display: grid; gap: 8px; padding: 12px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); }
  .erkannt .t { color: var(--text); font-weight: 500; }
  .erkannt .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .beispiele { display: grid; gap: 6px; }
  .beispiele button { text-align: left; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--line); background: transparent; color: var(--text-2); font: inherit; font-size: .9rem; cursor: pointer; }
  @media (hover: hover) and (pointer: fine) { .beispiele button:hover { background: var(--hover); color: var(--text); } }
</style>
