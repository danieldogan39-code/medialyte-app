<script lang="ts">
  // Fenster für Formulare und Details der Rechnungen (Escape oder Klick daneben schließt)
  import type { Snippet } from "svelte";
  import Icon from "../Icon.svelte";
  import { modalAuf, modalSanft, modalZu } from "../../lib/bewegung";
  let { titel, zu, breit = false, children, fuss }: { titel: string; zu: () => void; breit?: boolean; children: Snippet; fuss?: Snippet } = $props();
  let dlg: HTMLDialogElement | undefined = $state();
  $effect(() => { if (!dlg) return; modalAuf(dlg); return modalSanft(dlg); });
</script>

<dialog bind:this={dlg} class="bl" class:breit onclose={zu} aria-label={titel}>
  <div class="bl__in">
    <header><h2>{titel}</h2><button class="btn btn--quiet btn--icon" onclick={() => modalZu(dlg)} aria-label="Schließen"><Icon name="x" /></button></header>
    <div class="bl__b">{@render children()}</div>
    {#if fuss}<footer>{@render fuss()}</footer>{/if}
  </div>
</dialog>

<style>
  .bl { padding: 0; border: 0; background: transparent; color: var(--text); width: min(720px, calc(100vw - 24px)); max-height: calc(100dvh - 32px); }
  .bl.breit { width: min(960px, calc(100vw - 24px)); }
  .bl::backdrop { background: rgba(4, 8, 16, .66); }
  .bl__in { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; max-height: calc(100dvh - 32px); background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius); overflow: hidden; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px 10px 22px; border-bottom: 1px solid var(--line); }
  header h2 { font-size: 1.15rem; }
  .bl__b { overflow: auto; padding: 18px 22px 22px; display: grid; gap: 14px; align-content: start; }
  footer { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; padding: 12px 16px; border-top: 1px solid var(--line); background: var(--bg-2); }
  @media (max-width: 640px) {
    .bl, .bl.breit { width: 100vw; max-width: 100vw; max-height: 100dvh; height: 100dvh; margin: 0; }
    .bl__in { max-height: 100dvh; height: 100dvh; border-radius: 0; }
    .bl__b { padding: 16px; }
    footer { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
  }
</style>
