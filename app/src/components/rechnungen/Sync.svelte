<script lang="ts">
  // Synchronisierung: was noch auf Übertragung wartet und was nicht geklappt hat (nochmal / verwerfen)
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { fmtDateTime } from "../../lib/rechnungen/kern";
  let { zu }: { zu: () => void } = $props();
  const online = () => navigator.onLine !== false;
  const jetzt = () => versuche(async () => { if (!online()) throw new Error("Kein Internet – ich übertrage automatisch, sobald du wieder online bist."); await R.flush(); zu(); await R.loadAll(); });
  const verwerfen = async (i: number) => { if (!(await frage("Änderung verwerfen?", "Diese Änderung verwerfen? Sie wird nicht übertragen.", "Verwerfen", true))) return; zu(); R.drop(i).catch(() => {}); };
</script>

<Blatt titel="Synchronisierung" {zu}>
  <p class="muted">{online() ? "Du bist online." : "Du bist gerade offline."} Alles, was du ohne Internet machst, wird auf diesem Gerät gespeichert und automatisch in die Cloud übertragen, sobald du wieder online bist.</p>
  {#if R.failed.length}
    <h3>Nicht übertragen</h3>
    <div class="liste">{#each R.failed as o, i (o.uid)}
      <div class="z bad"><span><b>{R.opLabel(o)}</b><small>{fmtDateTime(o.at)} · {o.error}</small></span>
        <span class="k"><button class="btn btn--s" onclick={() => { zu(); R.retry(i).catch(() => {}); }}>Nochmal</button><button class="btn btn--s del" onclick={() => verwerfen(i)}>Verwerfen</button></span></div>{/each}</div>
  {/if}
  <h3>{R.outbox.length ? `Wartet auf Übertragung (${R.outbox.length})` : "Nichts ausstehend"}</h3>
  {#if R.outbox.length}
    <div class="liste">{#each R.outbox as o (o.uid)}<div class="z"><span><b>{R.opLabel(o)}</b><small>{fmtDateTime(o.at)}</small></span></div>{/each}</div>
  {:else}<p class="muted">Alles ist in der Cloud.</p>{/if}
  <p class="muted klein">Letzter Abgleich: {R.syncedAt ? fmtDateTime(R.syncedAt) : "–"}</p>
  {#snippet fuss()}<button class="btn btn--primary" onclick={jetzt}>Jetzt synchronisieren</button>{/snippet}
</Blatt>

<style>
  p { margin: 0; line-height: 1.5; }
  .liste { display: grid; gap: 6px; }
  .z { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); }
  .z.bad { border-color: rgba(242, 74, 74, .45); }
  .z span:first-child { display: grid; gap: 2px; min-width: 0; }
  .z b { color: var(--text); font-weight: 500; font-size: .92rem; }
  .z small { color: var(--steel); font-size: .78rem; }
  .k { display: flex; gap: 6px; flex: none; }
  .del { color: #FF8080; }
  .klein { font-size: .82rem; }
</style>
