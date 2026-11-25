<script lang="ts">
  // Skript-Markierung an einem Baustein oder einer Frage: z. B. grüner Stern = Sternfolie (besonders klausurrelevant)
  import { bereiche } from "../../lib/lernen/marken";
  import type { Marke, MarkenInfo } from "../../lib/lernen/typen";
  let { marke, legende, folien, wort = "S." }: { marke?: Marke[]; legende?: Partial<Record<Marke, MarkenInfo>>; folien?: number[]; wort?: string } = $props();
  const da = $derived((marke ?? []).filter((m) => legende?.[m]));
</script>

{#if da.length}
  <span class="mk">
    {#each da as m (m)}
      {@const i = legende![m]!}
      <span class="c {i.ton}" title={i.name}>{#if m === "stern"}<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3l-6.1 3.3 1.4-6.8L2.2 9.1l6.9-.8z" fill="currentColor" /></svg>{/if}{i.kurz}</span>
    {/each}
    {#if folien?.length}<small>{wort} {bereiche(folien)}</small>{/if}
  </span>
{/if}

<style>
  .mk { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; vertical-align: middle; }
  .c { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: 999px; font-size: .68rem; font-weight: 600; letter-spacing: .02em; white-space: nowrap;
    color: var(--t); background: color-mix(in srgb, var(--t) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 28%, transparent); }
  .c svg { flex: none; }
  .gruen { --t: #4FD67C; }
  .gelb { --t: #EBCB4B; }
  .orange { --t: #F59B4E; }
  .grau { --t: #A9B4C6; }
  .blass { --t: #8B98AD; }
  small { color: var(--steel); font-size: .7rem; font-variant-numeric: tabular-nums; }
</style>
