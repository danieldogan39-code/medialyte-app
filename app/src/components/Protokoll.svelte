<script lang="ts">
  import { hat, lies, merk } from "../lib/speicher";
  // Protokoll: jeder Lauf des Agenten mit Dauer, Ergebnis und vollständigem Log; der letzte fehlgeschlagene ist offen
  import { LAUF_STATUS } from "../lib/agent.svelte";
  import { sb } from "../lib/supabase";
  import { datumZeit } from "../lib/format";
  import type { Kategorie } from "../lib/daten.svelte";

  let { kat }: { kat: Kategorie } = $props();
  let laeufe = $state<any[]>(lies("protokoll:" + kat.slug, [])), geladen = $state(hat("protokoll:" + kat.slug)), offen = $state<Record<string, boolean>>({});
  async function laden() {
    const { data } = await sb.from("laeufe").select("*").eq("kategorie", kat.slug).order("start", { ascending: false }).limit(30);
    if (data) laeufe = merk("protokoll:" + kat.slug, data); geladen = true;
    if (laeufe[0]?.status === "fehler" && offen[laeufe[0].id] === undefined) offen[laeufe[0].id] = true;
  }
  $effect(() => { kat.slug; laden(); });
  $effect(() => { const f = () => laden(); addEventListener("ml:laeufe", f); return () => removeEventListener("ml:laeufe", f); });

  function dauer(l: any) {
    if (!l.ende || !l.start) return "";
    const s = Math.max(1, Math.round((Date.parse(l.ende) - Date.parse(l.start)) / 1000));
    return s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`;
  }
  const zeilen = (l: any): string[] => [...(l.log ?? []), ...(l.daten?.fehler ? ["Fehler: " + l.daten.fehler] : []),
    ...((l.daten?.fehler_details ?? []) as any[]).map((f) => "Fehler: " + (typeof f === "string" ? f : [f.name, f.fehler ?? f.grund].filter(Boolean).join(": ")))];
</script>

{#if laeufe.length}
  <div class="runs">
    {#each laeufe as l (l.id)}
      {@const st = LAUF_STATUS[l.status] ?? { name: l.status ?? "–", ton: "grau", zeichen: "·" }}
      <details class="card run" bind:open={offen[l.id]}>
        <summary>
          <span class="pill pill--plain pill--{st.ton}">{st.zeichen} {st.name}</span>
          <span class="wann">{datumZeit(l.start)}{#if l.daten?.probe}<small>Probelauf</small>{/if}{#if l.daten?.nur_manuell}<small>nur deine Auswahl</small>{/if}{#if dauer(l)}<small>{dauer(l)}</small>{/if}</span>
          <span class="nums"><span><b class="num">{(l.daten?.demos ?? []).length || l.zahlen?.Demos || 0}</b> Demos</span><span><b class="num">{(l.daten?.gebiete ?? []).length}</b> Gebiete</span>{#if l.zahlen?.Fehler}<span class="rot"><b class="num">{l.zahlen.Fehler}</b> Fehler</span>{/if}</span>
        </summary>
        {#if l.daten?.ki_ausfall}<p class="ausfall"><b>{l.daten.ki_ausfall.grund}</b> · nichts gebaut. Aufträge bleiben offen und kommen im nächsten Lauf dran.{#if l.daten.ki_ausfall.fehler}<br><small>{l.daten.ki_ausfall.fehler}</small>{/if}</p>{/if}
        {#if (l.daten?.demo_namen ?? []).length}<p class="muted klein">Neue Demos: {l.daten.demo_namen.join(", ")}</p>{/if}
        <div class="zahlen">{#each Object.entries(l.zahlen ?? {}) as [k, v]}<span><b class="num">{v}</b> {k}</span>{/each}</div>
        {#if offen[l.id]}
          <pre class="term">{#each zeilen(l) as z}<span class:err={z.startsWith("Fehler")}>› {z}
</span>{/each}{#if !zeilen(l).length}Kein Protokoll gespeichert.{/if}</pre>
        {/if}
      </details>
    {/each}
  </div>
{:else if geladen}
  <div class="card empty"><b>Noch keine Läufe</b><p>Hier erscheint jeder Lauf des Agenten in dieser Kategorie mit Ergebnis und vollständigem Protokoll.</p></div>
{/if}

<style>
  .runs { display: grid; gap: 8px; }
  .run { padding: 0; }
  .run summary { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 16px; cursor: pointer; list-style: none; }
  .run summary::-webkit-details-marker { display: none; }
  .wann { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; color: var(--text); flex: 1; min-width: 180px; }
  .wann small { font-size: .74rem; color: var(--steel); padding: 1px 7px; border-radius: 999px; background: rgba(255, 255, 255, .05); }
  .nums { display: flex; gap: 14px; font-size: .84rem; color: var(--steel); }
  .nums b { color: var(--text); font-weight: 600; }
  .nums .rot b { color: #FF8080; }
  .run > p, .zahlen { margin: 0 16px 10px; }
  .klein { font-size: .84rem; }
  .ausfall { padding: 10px 12px; border-radius: var(--radius-s); background: rgba(242, 74, 74, .12); color: #FF9C9C; font-size: .88rem; }
  .zahlen { display: flex; gap: 6px 16px; flex-wrap: wrap; font-size: .8rem; color: var(--steel); }
  .zahlen b { color: var(--text-2); }
  .term { margin: 0 12px 12px; max-height: 420px; overflow: auto; padding: 12px 14px; border-radius: 8px; background: #060B14; color: #9FB0C8;
    font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
  .term .err { color: #FF8C8C; }
</style>
