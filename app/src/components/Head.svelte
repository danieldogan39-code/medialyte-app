<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import { router } from "../lib/router.svelte";
  import { bereichVon } from "../lib/bereiche";
  const b = $derived(bereichVon(router.pfad));
  let { titel, text = "", zurueck = "", children }: { titel: string; text?: string; zurueck?: string; children?: Snippet } = $props();
</script>
<div class="head">
  <div class="head__t">
    {#if zurueck}<a class="head__back" href={zurueck}>← Zurück</a>{/if}
    <h1><span class="hi" style="--f: {b.farbe}" aria-hidden="true"><Icon name={b.icon} size={18} /></span><span>{titel}</span></h1>
    {#if text}<p class="muted">{text}</p>{/if}
  </div>
  {#if children}<div class="head__a">{@render children()}</div>{/if}
</div>
<style>
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 24px; }
  .head__t { display: grid; gap: 6px; min-width: 0; }
  .head__t p { max-width: 70ch; }
  .head__back { font-size: .86rem; color: var(--steel); }
  h1 { display: flex; align-items: center; gap: 12px; }
  .hi { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 11px; background: var(--f); color: #0A1220;
    box-shadow: 0 10px 24px -10px var(--f), inset 0 1px 0 rgba(255, 255, 255, .35); animation: hi .7s cubic-bezier(.34, 1.5, .64, 1) both; }
  @keyframes hi { from { transform: scale(.6) rotate(-8deg); opacity: 0; } }
  @media (max-width: 520px) { .hi { width: 32px; height: 32px; border-radius: 9px; } }
  .head__a { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
