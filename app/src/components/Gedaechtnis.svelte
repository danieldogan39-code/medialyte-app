<script lang="ts">
  // Design-Gedächtnis: was der Agent aus deinen Bewertungen gelernt hat – je Stilwelt und als Handwerk für alle
  import { auth } from "../lib/auth.svelte";
  import { daten, type Kategorie } from "../lib/daten.svelte";
  import { befehl } from "../lib/befehl";
  import { sb } from "../lib/supabase";
  import { vor } from "../lib/format";

  let { kat }: { kat: Kategorie } = $props();
  let g = $state<any>(null), reiter = $state<"welten" | "handwerk">("welten"), welt = $state(""), alle = $state<Record<string, boolean>>({});
  let verworfen = $state<Set<string>>(new Set());
  $effect(() => { sb.from("gedaechtnis").select("*").eq("kategorie", kat.slug).maybeSingle().then(({ data }) => {
    g = data?.daten ?? null; verworfen = new Set(g?.verworfen_ids ?? []); if (g?.welten?.length && !welt) welt = g.welten[0].key; }); });
  const w = $derived(g?.welten?.find((x: any) => x.key === welt));
  const darf = $derived(auth.darf("akquise", true));

  async function regel(id: string, weg: boolean) {
    const neu = new Set(verworfen); if (weg) neu.add(id); else neu.delete(id); verworfen = neu;
    await befehl(weg ? "regel_verwerfen" : "regel_zurueck", { id }, id, undefined);
    daten.melden(weg ? "Regel verworfen" : "Regel wiederhergestellt", weg ? { label: "Rückgängig", fn: () => regel(id, false) } : undefined);
  }
</script>

{#snippet regeln(titel: string, liste: any[], key: string)}
  <section class="rg">
    <h4>{titel}</h4>
    {#if liste?.length}
      <ul>
        {#each (alle[key] ? liste : liste.slice(0, 5)) as r (r.id)}
          <li class:weg={verworfen.has(r.id)}><span>{r.regel}</span><small class="muted">{r.belege} {r.belege === 1 ? "Beleg" : "Belege"}</small>
            {#if darf}<button class="x" onclick={() => regel(r.id, !verworfen.has(r.id))} aria-label={verworfen.has(r.id) ? "Wiederherstellen" : "Regel verwerfen"}>{verworfen.has(r.id) ? "↺" : "×"}</button>{/if}</li>
        {/each}
      </ul>
      {#if liste.length > 5}<button class="lnk" onclick={() => (alle[key] = !alle[key])}>{alle[key] ? "Weniger" : `Alle ${liste.length} anzeigen`}</button>{/if}
    {:else}<p class="muted">Noch nichts gelernt.</p>{/if}
  </section>
{/snippet}

{#if !g}
  <div class="card empty"><b>Noch kein Gedächtnis</b><p>Bewerte Demos mit 👍 oder 👎 – der Agent lernt daraus, was dir gefällt, und baut danach besser.</p></div>
{:else}
  <div class="kz">
    <div class="card"><small>Gelernt aus</small><b class="num">{g.gelernt}</b></div>
    <div class="card"><small>👍</small><b class="num">{g.hoch}</b></div>
    <div class="card"><small>👎</small><b class="num">{g.runter}</b></div>
    <div class="card"><small>Stand</small><b class="sm">{g.stand ? vor(g.stand) : "–"}</b></div>
  </div>
  <div class="seg" role="tablist">
    <button role="tab" aria-selected={reiter === "welten"} onclick={() => (reiter = "welten")}>Stilwelten</button>
    <button role="tab" aria-selected={reiter === "handwerk"} onclick={() => (reiter = "handwerk")}>Handwerk für alle</button>
  </div>
  {#if reiter === "welten"}
    <div class="chips">{#each g.welten as x (x.key)}<button class="chip" class:on={welt === x.key} onclick={() => (welt = x.key)}>{x.label} <span>+{x.vorbilder.length} / −{x.abgelehnt.length}</span></button>{/each}</div>
    {#if w}
      <p class="muted zaun">Diese Regeln gelten nur für {w.label}. Schriften der Vorbilder bleiben tabu, damit jede Demo eigen bleibt.</p>
      <div class="cols">
        {@render regeln("Gefällt dir", w.gut, w.key + "g")}
        {@render regeln("Gefällt dir nicht", w.meiden, w.key + "m")}
      </div>
      {#if w.vorbilder.length || w.abgelehnt.length}
        <h4 class="sec">Bewertete Demos</h4>
        <ul class="vb">
          {#each [...w.vorbilder.map((v: any) => ({ ...v, gut: true })), ...w.abgelehnt.map((v: any) => ({ ...v, gut: false }))] as v (v.key)}
            <li><span>{v.gut ? "👍" : "👎"}</span><span><b>{v.name}</b>{#if v.kommentar}<small class="muted"> – „{v.kommentar}“</small>{/if}{#if v.warum}<br><small class="muted">{v.warum}</small>{/if}</span></li>
          {/each}
        </ul>
      {/if}
    {/if}
  {:else}
    <div class="cols">
      {@render regeln("So baut der Agent", g.handwerk?.tun, "ht")}
      {@render regeln("Das vermeidet er", g.handwerk?.meiden, "hm")}
    </div>
  {/if}
{/if}

<style>
  .kz { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; max-width: 640px; }
  .kz .card { padding: 12px 14px; display: grid; }
  .kz small { color: var(--steel); font-size: .8rem; }
  .kz b { color: var(--text); font-size: 1.5rem; font-weight: 600; }
  .kz b.sm { font-size: 1rem; padding-top: 6px; }
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); margin-bottom: 14px; }
  .seg button { height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--steel); cursor: pointer; }
  .seg button[aria-selected="true"] { background: var(--panel-2); color: var(--text); }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; }
  .chip span { color: var(--steel); margin-left: 4px; font-size: .78rem; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .zaun { font-size: .84rem; margin-bottom: 12px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
  .rg { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; display: grid; gap: 10px; align-content: start; }
  .rg ul, .vb { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .rg li { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: start; font-size: .9rem; color: var(--text); }
  .rg li small { font-size: .74rem; white-space: nowrap; padding-top: 2px; }
  .rg li.weg span { text-decoration: line-through; color: var(--steel); }
  .x { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--line-2); background: transparent; color: var(--steel); cursor: pointer; line-height: 1; }
  .lnk { justify-self: start; border: 0; background: none; color: var(--text-2); text-decoration: underline; cursor: pointer; font: inherit; font-size: .86rem; padding: 0; }
  .sec { margin: 22px 0 10px; }
  .vb li { display: flex; gap: 10px; font-size: .9rem; color: var(--text-2); }
  .vb b { color: var(--text); font-weight: 500; }
  @media (max-width: 560px) { .kz { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
