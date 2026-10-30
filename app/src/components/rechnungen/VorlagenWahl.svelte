<script lang="ts">
  // Position aus Vorlagen (Standard-Positionen) wählen
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { BILL_SUFFIX, INTERVALS, billingOf, eur } from "../../lib/rechnungen/kern";
  let { zu, waehlen }: { zu: () => void; waehlen: (p: any) => void } = $props();
  let suche = $state(""), feld: HTMLInputElement | undefined = $state();
  const liste = $derived(R.products.filter((p) => !suche.trim() || `${p.name} ${p.details || ""}`.toLowerCase().includes(suche.trim().toLowerCase())));
  $effect(() => { if (R.products.length > 6) setTimeout(() => feld?.focus(), 200); });
</script>

<Blatt titel="Position aus Vorlagen" {zu}>
  <input class="input" type="search" placeholder="Vorlage suchen …" bind:value={suche} bind:this={feld}>
  {#if liste.length}
    <div class="liste">
      {#each liste as p (p.id)}
        <button class="zeile" onclick={() => { zu(); waehlen(p); }}>
          <span class="h"><b>{p.name}</b>{#if p.details}<small class="muted">{p.details}</small>{/if}</span>
          <span class="r"><b class="num">{eur(p.price)}{BILL_SUFFIX[billingOf(p)]}</b>{#if billingOf(p) === "once"}<span class="pill pill--plain">Pauschal</span>{:else}<span class="pill pill--plain pill--blau">Abo · {INTERVALS[billingOf(p)]}</span>{/if}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="card empty"><b>{R.products.length ? "Nichts gefunden" : "Noch keine Vorlagen"}</b>{#if !R.products.length}<p>Speichere oft genutzte Leistungen als Vorlage.</p>{/if}</div>
  {/if}
  <p class="muted klein">Neue Vorlagen legst du unter Einstellungen → Standard-Positionen an, oder du tippst bei einer Position auf „☆ Als Vorlage speichern“.</p>
</Blatt>

<style>
  .liste { display: grid; gap: 6px; }
  .zeile { display: flex; justify-content: space-between; gap: 12px; align-items: center; text-align: left; padding: 12px 14px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--bg-2); color: inherit; cursor: pointer; font: inherit; }
  @media (hover: hover) { .zeile:hover { border-color: var(--line-2); background: var(--panel-2); } }
  .h { display: grid; gap: 2px; min-width: 0; }
  .h b { color: var(--text); font-weight: 600; }
  .h small { font-size: .8rem; white-space: pre-line; }
  .r { display: grid; justify-items: end; gap: 4px; flex: none; }
  .r b { color: var(--text); }
  .klein { font-size: .84rem; margin: 0; }
</style>
