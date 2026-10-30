<script lang="ts">
  import { rueckfrage } from "../lib/frage.svelte";
  import { modalAuf, modalZu } from "../lib/bewegung";
  let dlg: HTMLDialogElement | undefined = $state();
  let okBtn: HTMLButtonElement | undefined = $state();
  let eingabe = $state("");
  const frei = $derived(!rueckfrage.offen?.tippen || eingabe.trim().toLowerCase() === rueckfrage.offen.tippen.toLowerCase());
  $effect(() => {
    if (!dlg) return;
    if (rueckfrage.offen && !dlg.open) { eingabe = ""; modalAuf(dlg, "voll"); if (!rueckfrage.offen.tippen) okBtn?.focus(); }
    if (!rueckfrage.offen && dlg.open) modalZu(dlg, "voll");
  });
</script>

<dialog bind:this={dlg} class="rf" aria-labelledby="rf-t" oncancel={(e) => { e.preventDefault(); rueckfrage.offen?.antwort(false); }}
  onclick={(e) => { if (e.target === dlg) rueckfrage.offen?.antwort(false); }}>
  {#if rueckfrage.offen}
    <div class="rf__b">
      <h2 id="rf-t">{rueckfrage.offen.titel}</h2>
      <p>{rueckfrage.offen.text}</p>
      {#if rueckfrage.offen.tippen}
        <label class="field"><span>Zur Sicherheit „{rueckfrage.offen.tippen}“ eintippen</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input class="input" bind:value={eingabe} autocomplete="off" autofocus onkeydown={(e) => { if (e.key === "Enter" && frei) rueckfrage.offen?.antwort(true); }}></label>
      {/if}
      <div class="rf__a">
        <button class="btn btn--quiet" type="button" onclick={() => rueckfrage.offen?.antwort(false)}>Abbrechen</button>
        <button bind:this={okBtn} class="btn {rueckfrage.offen.gefahr ? 'btn--gefahr' : 'btn--primary'}" type="button" disabled={!frei} onclick={() => rueckfrage.offen?.antwort(true)}>{rueckfrage.offen.ok}</button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .rf { width: min(440px, calc(100vw - 32px)); padding: 0; border: 1px solid var(--line-2); border-radius: 16px; background: var(--panel); color: var(--text-2);
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, .7); }
  .rf::backdrop { background: rgba(4, 8, 16, .6); }
  .rf__b { padding: 24px; display: grid; gap: 12px; }
  .rf__b h2 { font-size: 1.15rem; }
  .rf__b p { line-height: 1.55; }
  .rf__a { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  :global(.btn--gefahr) { background: #C93636; border-color: #D94444; color: #fff; font-weight: 600; }
  @media (hover: hover) { :global(.btn--gefahr:hover) { background: #D63E3E !important; } }
</style>
