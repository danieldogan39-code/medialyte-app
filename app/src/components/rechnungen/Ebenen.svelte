<script lang="ts">
  // Fenster der Rechnungen (Blätter) und die PDF-Ansicht – überall in der App, damit Kunden, Rechnungen und Angebote
  // auch aus dem Kundenmenü heraus geöffnet werden können.
  import Icon from "../Icon.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { B } from "../../lib/rechnungen/blatt.svelte";
  import { modalAuf, modalSanft, modalZu } from "../../lib/bewegung";

  let pdfDlg: HTMLDialogElement | undefined = $state();
  $effect(() => { if (!pdfDlg) return; if (!pdfDlg.open) modalAuf(pdfDlg); return modalSanft(pdfDlg); });
  const pdfZu = () => { if (R.pdf) URL.revokeObjectURL(R.pdf.url); R.pdf = null; };
  // Schließen immer mit Bewegung: erst das Fenster wegschieben, nach dem „close“ wirklich entfernen
  function zu(id: number) {
    const d = document.querySelector<HTMLDialogElement>(`[data-blatt="${id}"] dialog`);
    if (d?.open) { if (!d.dataset.zu) modalZu(d); return; }
    B.zu(id);
  }
</script>

{#each B.liste as b (b.id)}{@const K = b.komp}<div data-blatt={b.id} style="display: contents"><K {...b.props} zu={() => zu(b.id)} /></div>{/each}

{#if R.pdf}
  <dialog class="pdf" bind:this={pdfDlg} aria-label={R.pdf.name} onclose={pdfZu}>
    <div class="pdf__k"><b>{R.pdf.name}</b><span class="sp"></span><a class="btn btn--s" href={R.pdf.url} download={R.pdf.name}>Speichern</a>
      <button class="btn btn--quiet btn--icon" onclick={() => modalZu(pdfDlg)} aria-label="Schließen"><Icon name="x" /></button></div>
    <iframe src={R.pdf.url} title={R.pdf.name}></iframe>
  </dialog>
{/if}

<style>
  .pdf::backdrop { background: rgba(4, 8, 16, .6); }
  .pdf { position: fixed; inset: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: rgba(4, 8, 16, .9); display: grid; grid-template-rows: auto 1fr; }
  .pdf__k { display: flex; align-items: center; gap: 10px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px; background: var(--panel); color: var(--text); }
  .sp { flex: 1; }
  .pdf iframe { width: 100%; height: 100%; border: 0; background: #fff; }
</style>
