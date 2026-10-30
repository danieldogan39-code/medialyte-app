<script lang="ts">
  import { sb, fehler } from "../lib/supabase";
  import { daten } from "../lib/daten.svelte";
  import { vor } from "../lib/format";
  let { bezug, id, schreiben = false }: { bezug: "betrieb" | "anfrage" | "kunde"; id: string; schreiben?: boolean } = $props();
  let liste = $state<any[]>([]), text = $state(""), laeuft = $state(false);

  async function laden() {
    const { data } = await sb.from("verlauf").select("*").eq("bezug", bezug).eq("bezug_id", id).order("zeit", { ascending: false }).limit(100);
    liste = data ?? [];
  }
  $effect(() => { id; laden(); });

  async function senden(e: SubmitEvent) {
    e.preventDefault(); if (!text.trim()) return; laeuft = true;
    const { error } = await sb.from("verlauf").insert({ bezug, bezug_id: id, art: "notiz", text: text.trim() });
    laeuft = false;
    if (error) { daten.melden(fehler(error)); return; }
    text = ""; laden();
  }
  export function neu() { laden(); }
</script>

<section class="vl card">
  <h3>Verlauf</h3>
  {#if schreiben}
    <form class="vl__f" onsubmit={senden}>
      <textarea class="input" rows="2" placeholder="Notiz hinzufügen, z. B. Telefonat, Rückruf am …" bind:value={text}></textarea>
      <button class="btn btn--s" type="submit" disabled={laeuft || !text.trim()}>Notiz speichern</button>
    </form>
  {/if}
  {#if liste.length}
    <ol class="vl__l">
      {#each liste as v (v.id)}
        <li><span class="vl__m"><b>{daten.name(v.user_id) || "System"}</b> · {vor(v.zeit)}</span><p>{v.text}</p></li>
      {/each}
    </ol>
  {:else}<p class="muted">Noch keine Einträge.</p>{/if}
</section>

<style>
  .vl { padding: 20px; display: grid; gap: 14px; align-content: start; }
  .vl__f { display: grid; gap: 8px; justify-items: end; }
  .vl__l { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
  .vl__l li { display: grid; gap: 3px; padding-left: 14px; border-left: 2px solid var(--line-2); }
  .vl__m { font-size: .8rem; color: var(--steel); }
  .vl__m b { color: var(--text-2); font-weight: 500; }
  .vl__l p { white-space: pre-wrap; color: var(--text-2); }
</style>
