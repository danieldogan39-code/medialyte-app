<script lang="ts">
  // Zahl, die weich auf ihren neuen Wert zuläuft (wie die Zähler in iOS-Apps); beim ersten Anzeigen zählt sie hoch
  import { Tween } from "svelte/motion";
  import { federKurve, ruhig } from "../lib/bewegung";
  let { wert, format = (n: number) => Math.round(n).toLocaleString("de-DE") }: { wert: number; format?: (n: number) => string } = $props();
  const f = federKurve(0.9, 0);
  const t = new Tween(0, { duration: ruhig() ? 0 : f.ms, easing: f.easing });
  $effect(() => { t.set(+wert || 0); });
</script>
<span class="num" aria-label={format(+wert || 0)}><span aria-hidden="true">{format(t.current)}</span></span>
