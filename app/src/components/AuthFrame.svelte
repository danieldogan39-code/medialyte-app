<script lang="ts">
  import type { Snippet } from "svelte";
  let { titel, text = "", children }: { titel: string; text?: string; children: Snippet } = $props();
</script>
<div class="gate">
  <div class="af">
    <img class="af__wm" src="./wordmark.svg" alt="Medialyte" width="150" height="29">
    <div class="af__box card">
      <div class="af__head"><h1>{titel}</h1>{#if text}<p class="muted">{text}</p>{/if}</div>
      {@render children()}
    </div>
    <p class="af__foot muted">Geschützt mit Zwei-Faktor-Anmeldung</p>
  </div>
</div>
<style>
  .af { width: min(400px, 100%); display: grid; gap: 22px; justify-items: center; }
  .af__wm { height: 26px; width: auto; }
  .af__box { width: 100%; padding: 28px; display: grid; gap: 20px; }
  .af__head { display: grid; gap: 6px; }
  .af__head h1 { font-size: 1.35rem; }
  .af__foot { font-size: .8rem; }
</style>
