<script lang="ts">
  // Status eines Belegs (Rechnung oder Angebot), mit Hinweis „wartet“, solange die Änderung noch nicht übertragen ist
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { invStatus, quoteStatus } from "../../lib/rechnungen/status";
  let { doc, angebot = false }: { doc: any; angebot?: boolean } = $props();
  const s = $derived(angebot ? quoteStatus(doc) : invStatus(doc));
</script>
<span class="st">{#if R.pendingFor(doc.id)}<span class="pill pill--plain pill--gelb" title="Wird übertragen, sobald Internet da ist">⏳ wartet</span>{/if}<span class="pill pill--plain pill--{s.ton}">{s.label}</span></span>
<style>.st { display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }</style>
