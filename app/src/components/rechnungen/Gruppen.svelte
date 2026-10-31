<script lang="ts">
  // Belege nach Kunde gruppiert, Neuestes oben; Gruppen mit offenen Posten sind aufgeklappt (wie in der Rechnungs-App)
  import type { Snippet } from "svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { rechnungenAnsicht as A } from "../../lib/rechnungen/ansicht.svelte";
  import { slide, fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { federKurve, ruhig } from "../../lib/bewegung";
  const auf = federKurve(0.5, 0);
  let { art, docs, gefiltert, zeile, zusammenfassung, neu }: {
    art: "inv" | "quo"; docs: any[]; gefiltert: boolean; zeile: Snippet<[any]>;
    zusammenfassung: (l: any[]) => { attention: boolean; line: string; right: { betrag?: string; text: string; ton: string } }; neu: (kunde: string) => void;
  } = $props();
  const docDate = (d: any) => (d.status === "draft" ? "9999-12-31" + (d.created_at || "") : String(d.issue_date || "") + (d.created_at || ""));
  const neuesteZuerst = (a: any, b: any) => docDate(b).localeCompare(docDate(a)) || String(b.number || "").localeCompare(String(a.number || ""), "de", { numeric: true });
  const gruppen = $derived.by(() => {
    const map = new Map<string, any[]>();
    for (const d of docs) { const k = d.customer_id || "none"; if (!map.has(k)) map.set(k, []); map.get(k)!.push(d); }
    return [...map.entries()].map(([k, list]) => ({ k, list: list.sort(neuesteZuerst), c: R.customer(k) })).sort((a, b) => neuesteZuerst(a.list[0], b.list[0]));
  });
</script>

{#each gruppen as g (g.k)}
  {@const sm = zusammenfassung(g.list)}{@const key = `${art}:${g.k}`}{@const modus = A.gruppen[key] ?? (gefiltert || sm.attention ? "open" : "closed")}
  {@const zeige = modus === "all" || gefiltert ? g.list : modus === "open" ? g.list.slice(0, 5) : []}{@const name = g.c ? g.c.name : g.list[0].customer?.name || "Ohne Kunde"}
  <section class="gr card" class:auf={modus !== "closed"} animate:flip={{ duration: ruhig() ? 0 : auf.ms, easing: auf.easing }} in:fade={{ duration: ruhig() ? 0 : 220 }}>
    <button class="gh" aria-expanded={modus !== "closed"} onclick={() => (A.gruppen[key] = modus !== "closed" ? "closed" : "open")}>
      <span class="nr num">{g.c?.number || "–"}</span>
      <span class="hm"><b>{name}</b><small class="muted">{sm.line}</small></span>
      <span class="hs">{#if sm.right.betrag}<b class="num">{sm.right.betrag}</b>{/if}<span class="pill pill--plain pill--{sm.right.ton}">{sm.right.text}</span></span>
      <svg class="pf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {#if modus !== "closed"}
      <div class="gb" transition:slide={{ duration: ruhig() ? 0 : auf.ms, easing: auf.easing }}>
        {#each zeige as d (d.id)}{@render zeile(d)}{/each}
        {#if zeige.length < g.list.length}<button class="mehr" onclick={() => (A.gruppen[key] = "all")}>Alle {g.list.length} anzeigen</button>{/if}
        {#if g.c}<button class="mehr neu" onclick={() => neu(g.k)}>+ {art === "inv" ? "Rechnung" : "Angebot"} für {name}</button>{/if}
      </div>
    {/if}
  </section>
{/each}

<style>
  .gr { padding: 0; overflow: hidden; margin-bottom: 8px; }
  .gh { width: 100%; display: grid; grid-template-columns: 58px minmax(0, 1fr) auto 20px; gap: 12px; align-items: center; padding: 12px 14px; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; font: inherit; }
  .nr { font-size: .78rem; color: var(--steel); }
  .hm { display: grid; gap: 2px; min-width: 0; }
  .hm b { color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hm small { font-size: .8rem; }
  .hs b { color: var(--text); font-weight: 600; }
  .hs { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
  .pf { width: 18px; height: 18px; color: var(--steel); transition: transform .5s var(--feder); }
  .auf .pf { transform: rotate(180deg); }
  .gb { display: grid; gap: 2px; padding: 0 8px 8px; border-top: 1px solid var(--line); padding-top: 6px; }
  .mehr { justify-self: start; border: 0; background: none; color: var(--text-2); cursor: pointer; font: inherit; font-size: .86rem; padding: 8px 10px; border-radius: 8px; }
  .mehr.neu { color: var(--coral-2); }
  @media (hover: hover) and (pointer: fine) { .gh:hover, .mehr:hover { background: var(--hover); } }
  @media (max-width: 520px) { .gh { grid-template-columns: minmax(0, 1fr) auto 18px; } .nr { display: none; } }
</style>
