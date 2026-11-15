<script lang="ts">
  // Fenster des Organizers: am Handy ein Blatt von unten, am Computer mittig. Schließen per Wisch, Esc oder Tipp daneben.
  import type { Snippet } from "svelte";
  import Icon from "../Icon.svelte";
  import { modalAuf, modalSanft, modalZu } from "../../lib/bewegung";
  let { titel, onclose, children, fuss, breit = false, farbe = "var(--org)" }: { titel: string; onclose: () => void; children: Snippet; fuss?: Snippet; breit?: boolean; farbe?: string } = $props();
  let dlg: HTMLDialogElement | undefined = $state();
  $effect(() => { if (!dlg) return; modalAuf(dlg); return modalSanft(dlg); });
  export function zu() { return modalZu(dlg); }
  const id = "f" + Math.random().toString(36).slice(2, 8);
</script>

<dialog bind:this={dlg} class="of" class:breit aria-labelledby={id} onclose={onclose} style="--bereich: {farbe}">
  <div class="of__in">
    <div class="of__kopf">
      <h3 {id}>{titel}</h3>
      <button class="btn btn--quiet btn--icon" type="button" aria-label="Schließen" onclick={() => zu()}><Icon name="x" size={18} /></button>
    </div>
    <div class="of__b">{@render children()}</div>
    {#if fuss}<div class="of__f">{@render fuss()}</div>{/if}
  </div>
</dialog>

<style>
  .of { padding: 0; border: 0; background: transparent; width: 100%; max-width: min(560px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); color: var(--text); }
  .of.breit { max-width: min(760px, calc(100vw - 24px)); }
  .of::backdrop { background: rgba(4, 8, 16, .7); }
  .of__in { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; max-height: calc(100dvh - 24px); background: var(--panel); border: 1px solid var(--line-2); border-radius: 18px; overflow: hidden;
    box-shadow: 0 30px 80px -30px rgba(0, 0, 0, .8); }
  .of__kopf { display: flex; align-items: center; gap: 10px; padding: 16px 14px 6px 20px; }
  .of__kopf h3 { flex: 1; font-size: 1.12rem; }
  .of__b { overflow: auto; overscroll-behavior: contain; padding: 8px 20px 18px; display: grid; gap: 14px; align-content: start; }
  .of__f { display: flex; gap: 8px; align-items: center; padding: 12px 20px; border-top: 1px solid var(--line); background: var(--bg-2); }
  .of__f :global(.links) { margin-right: auto; }
  @media (max-width: 700px) {
    .of, .of.breit { max-width: 100vw; margin: auto 0 0; }
    .of__in { border-radius: 20px 20px 0 0; max-height: 94dvh; }
    .of__f { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
    .of__f :global(.btn--primary) { flex: 1; }
  }
  /* gemeinsame Bausteine der Formulare */
  .of :global(.seg) { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
  .of :global(.seg button) { flex: 1 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent;
    color: var(--text-2); font: inherit; font-size: .88rem; cursor: pointer; white-space: nowrap; transition: background-color .2s ease, color .2s ease, transform .3s var(--feder-schnell); }
  .of :global(.seg button.on) { background: var(--bereich); color: #0A1220; font-weight: 600; }
  .of :global(.seg button:active) { transform: scale(.95); }
  .of :global(.reihe) { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .of :global(.chips) { display: flex; flex-wrap: wrap; gap: 6px; }
  .of :global(.chip) { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent;
    color: var(--text-2); cursor: pointer; font: inherit; font-size: .86rem; }
  .of :global(.chip.on) { border-color: var(--c, var(--bereich)); color: var(--text); background: color-mix(in srgb, var(--c, var(--bereich)) 18%, transparent); }
  .of :global(.chip i) { width: 9px; height: 9px; border-radius: 50%; background: var(--c); }
  .of :global(.schalter) { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); }
  .of :global(.schalter small) { display: block; color: var(--steel); font-size: .8rem; }
  .of :global(.hinweis) { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: var(--bg-2); color: var(--text-2); font-size: .86rem; }
  .of :global(.hinweis svg) { flex: none; margin-top: 2px; color: var(--bereich); }
  .of :global(.btn--gefahr) { color: #FF8080 !important; background: transparent !important; border-color: transparent !important; box-shadow: none !important; }
</style>
