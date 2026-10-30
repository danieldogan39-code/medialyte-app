<script lang="ts">
  import type { Snippet } from "svelte";
  let { titel, text = "", zurueck = "", children }: { titel: string; text?: string; zurueck?: string; children?: Snippet } = $props();
</script>
<div class="head">
  <div class="head__t">
    {#if zurueck}<a class="head__back" href={zurueck}>← Zurück</a>{/if}
    <h1>{titel}</h1>
    {#if text}<p class="muted">{text}</p>{/if}
  </div>
  {#if children}<div class="head__a">{@render children()}</div>{/if}
</div>
<style>
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 24px; }
  .head__t { display: grid; gap: 6px; min-width: 0; }
  .head__t p { max-width: 70ch; }
  .head__back { font-size: .86rem; color: var(--steel); }
  .head__a { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
