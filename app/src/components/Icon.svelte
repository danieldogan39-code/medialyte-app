<script lang="ts">
  import { ICONS } from "../lib/icons";
  let { name, size = 18, fill = false }: { name: string; size?: number; fill?: boolean } = $props();
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICONS[name] ?? ICONS.store}</svg>
