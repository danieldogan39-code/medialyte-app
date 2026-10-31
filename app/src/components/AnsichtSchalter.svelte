<script lang="ts">
  // Umschalter Kacheln (stöbern) / Reihenfolge (sortieren), je Gerät gemerkt
  import Icon from "./Icon.svelte";
  import { social } from "../lib/social.svelte";
  import { haptik } from "../lib/haptik";
  const setzen = (a: "kacheln" | "reihe") => { if (social.ansicht !== a) { social.ansichtSetzen(a); haptik("auswahl"); } };
</script>

<div class="as" role="radiogroup" aria-label="Ansicht">
  <span class="as__g" class:rechts={social.ansicht === "reihe"} aria-hidden="true"></span>
  <button role="radio" aria-checked={social.ansicht === "kacheln"} class:on={social.ansicht === "kacheln"} onclick={() => setzen("kacheln")} title="Kacheln"><Icon name="raster" size={16} /><span>Kacheln</span></button>
  <button role="radio" aria-checked={social.ansicht === "reihe"} class:on={social.ansicht === "reihe"} onclick={() => setzen("reihe")} title="Reihenfolge"><Icon name="reihe" size={16} /><span>Reihenfolge</span></button>
</div>

<style>
  .as { position: relative; display: inline-grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); flex: none; }
  .as__g { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 9px; background: var(--panel-2);
    box-shadow: 0 4px 12px -6px rgba(0, 0, 0, .7), inset 0 0 0 1px var(--line-2); transition: transform .34s cubic-bezier(.32, .72, 0, 1); }
  .as__g.rechts { transform: translateX(100%); }
  button { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border: 0; background: none;
    color: var(--steel); font: inherit; font-size: .84rem; cursor: pointer; border-radius: 9px; transition: color .2s ease; white-space: nowrap; }
  button.on { color: var(--text); }
  button:active { transform: scale(.96); }
  button:focus-visible { outline: 2px solid var(--bereich); outline-offset: 1px; }
  @media (max-width: 420px) { button { padding: 0 10px; } button span { display: none; } }
  @media (prefers-reduced-motion: reduce) { .as__g { transition: none; } }
</style>
