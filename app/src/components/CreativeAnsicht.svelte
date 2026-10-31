<script lang="ts">
  // Kacheln oder Reihenfolge – je nach Umschalter. Am Handy wird in der Reihenfolge sortiert (Griff rechts),
  // die Kacheln lassen sich mit der Maus ziehen.
  import Icon from "./Icon.svelte";
  import CreativeGitter from "./CreativeGitter.svelte";
  import CreativeReihe from "./CreativeReihe.svelte";
  import { social, offen, type Creative } from "../lib/social.svelte";

  let { liste, schreiben = false, plattform = "", global = false, sortierbar = true }:
    { liste: Creative[]; schreiben?: boolean; plattform?: string; global?: boolean; sortierbar?: boolean } = $props();
  const maus = typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
  const mehrere = $derived(liste.filter(offen).length > 1);
</script>

{#if social.ansicht === "reihe"}
  <CreativeReihe {liste} {schreiben} {plattform} {global} {sortierbar} />
  {#if schreiben && sortierbar && mehrere}<p class="tipp"><Icon name="griff" size={14} />Am Griff rechts festhalten und schieben. Die Nummer ist die Reihenfolge zum Posten: 1 kommt als Nächstes.</p>{/if}
{:else}
  <CreativeGitter {liste} {schreiben} {plattform} {global} sortierbar={sortierbar && maus} />
  {#if schreiben && mehrere}
    <p class="tipp"><Icon name="reihe" size={14} />Die Nummer ist die Reihenfolge zum Posten: 1 kommt als Nächstes.
      {#if !sortierbar}Zum Sortieren die Suche leeren.{:else if maus}Kacheln ziehen oder{:else}Zum Umsortieren{/if}
      {#if sortierbar}<button class="lnk" onclick={() => social.ansichtSetzen("reihe")}>{maus ? "Reihenfolge öffnen" : "zur Reihenfolge wechseln"}</button>.{/if}</p>
  {/if}
{/if}

<style>
  .tipp { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; margin: 14px 0 0; font-size: .8rem; color: var(--steel); line-height: 1.45; }
  .tipp :global(svg) { flex: none; }
  .lnk { border: 0; background: none; padding: 0; font: inherit; color: var(--text-2); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
</style>
