<script lang="ts">
  // Fortschrittsring (0 … 1), weich animiert
  let { wert = 0, size = 44, dicke = 5, farbe = "var(--org)", children }: { wert?: number; size?: number; dicke?: number; farbe?: string; children?: import("svelte").Snippet } = $props();
  const r = $derived((size - dicke) / 2), u = $derived(2 * Math.PI * r);
</script>
<span class="ring" style="width:{size}px;height:{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(203,215,235,.12)" stroke-width={dicke}/>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={farbe} stroke-width={dicke} stroke-linecap="round"
      stroke-dasharray={u} stroke-dashoffset={u * (1 - Math.max(0, Math.min(1, wert)))} transform="rotate(-90 {size / 2} {size / 2})"/>
  </svg>
  {#if children}<span class="in">{@render children()}</span>{/if}
</span>
<style>
  .ring { position: relative; display: inline-grid; place-items: center; flex: none; }
  .ring svg { position: absolute; inset: 0; }
  .ring svg circle:last-child { transition: stroke-dashoffset .9s var(--feder-weich); }
  .in { position: relative; display: grid; place-items: center; font-size: .78rem; font-weight: 600; color: var(--text); }
</style>
