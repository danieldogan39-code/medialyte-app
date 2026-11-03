<script lang="ts">
  // Claude beauftragen: Videos, Karussells oder Einzelbilder im angelernten Stil des Kunden.
  // Ohne Thema sucht Claude passende Themen aus dem Stilprofil aus und wiederholt keine bisherigen.
  import Icon from "./Icon.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import { modalAuf, modalSanft, modalZu } from "../lib/bewegung";
  import { daten } from "../lib/daten.svelte";
  import { haptik } from "../lib/haptik";
  import { social, plattform, AUFTRAGSART, type Auftrag, type SocialKunde } from "../lib/social.svelte";

  let { kunde, onclose, art: start = "video" }: { kunde: SocialKunde; onclose: () => void; art?: Auftrag["art"] } = $props();
  let dlg: HTMLDialogElement | undefined = $state();
  $effect(() => { if (!dlg) return; modalAuf(dlg); return modalSanft(dlg); });

  const kanaele = $derived(social.kanaeleVon(kunde.id));
  let art = $state<Auftrag["art"]>(start), anzahl = $state(1), thema = $state(""), hinweise = $state(""), laeuft = $state(false), fehler = $state("");
  let wahl = $state<string[]>(social.kanaeleVon(kunde.id).map((k) => k.id));
  const umschalten = (id: string) => (wahl = wahl.includes(id) ? wahl.filter((x) => x !== id) : [...wahl, id]);
  const ARTEN: Auftrag["art"][] = ["video", "karussell", "bild"];
  const ohneStil = $derived(!kunde.angelernt);

  async function los() {
    if (laeuft) return;
    fehler = ""; laeuft = true;
    try {
      await social.beauftragen({ kunde_id: kunde.id, art, anzahl: art === "anlernen" ? 1 : anzahl, kanaele: wahl, thema: thema.trim(), hinweise: hinweise.trim() });
      haptik("erfolg");
      daten.melden(art === "anlernen" ? "Claude lernt den Stil an" : `Claude ist beauftragt: ${anzahl} ${anzahl === 1 ? AUFTRAGSART[art].name : AUFTRAGSART[art].mehr}`);
      await modalZu(dlg);
    } catch (e: any) { fehler = "Nicht beauftragt: " + (e?.message || e); }
    finally { laeuft = false; }
  }
</script>

<dialog bind:this={dlg} class="hl" aria-labelledby="sb-t" onclose={onclose}>
  <div class="hl__in">
    <div class="kopf">
      <h3 id="sb-t">{art === "anlernen" ? "Stil anlernen" : "Claude beauftragen"}</h3>
      <button class="btn btn--quiet btn--icon" onclick={() => modalZu(dlg)} aria-label="Schließen" disabled={laeuft}><Icon name="x" /></button>
    </div>

    {#if art === "anlernen"}
      <p class="muted">Claude sieht sich die Kanäle von {kunde.name} an und schreibt auf, wie die Creatives gebaut sind: Format, Aufbau, Figuren, Bild, Stimme, Musik und Texte. Das Profil steht danach unter „Stil &amp; Kanäle“ und lässt sich jederzeit ändern.</p>
    {:else}
      <div class="field"><span>Was soll Claude bauen?</span>
        <div class="seg" role="radiogroup" aria-label="Art">
          {#each ARTEN as a (a)}
            <button type="button" role="radio" aria-checked={art === a} class:on={art === a} onclick={() => (art = a)}><Icon name={AUFTRAGSART[a].icon} size={15} />{AUFTRAGSART[a].name}</button>
          {/each}
        </div>
      </div>
      <div class="field"><span>Wie viele?</span>
        <div class="zaehler">
          <button type="button" class="btn btn--icon" onclick={() => (anzahl = Math.max(1, anzahl - 1))} disabled={anzahl <= 1} aria-label="Eins weniger">−</button>
          <b class="num" aria-live="polite">{anzahl}</b>
          <button type="button" class="btn btn--icon" onclick={() => (anzahl = Math.min(10, anzahl + 1))} disabled={anzahl >= 10} aria-label="Eins mehr">+</button>
        </div>
      </div>
    {/if}

    {#if kanaele.length}
      <div class="field"><span>{art === "anlernen" ? "Welche Kanäle ansehen?" : "Für welche Kanäle?"}</span>
        <div class="kn">
          {#each kanaele as k (k.id)}
            <button type="button" class="chip" class:on={wahl.includes(k.id)} aria-pressed={wahl.includes(k.id)} onclick={() => umschalten(k.id)}>
              <PlattformLogo name={k.plattform} size={16} rund={0.3} />{k.name || plattform(k.plattform)?.name}</button>
          {/each}
        </div>
      </div>
    {:else}
      <p class="hinweis"><Icon name="link" size={15} />Noch keine Kanäle eingetragen. Unter „Stil &amp; Kanäle“ reichen Name und Link.</p>
    {/if}

    {#if art !== "anlernen"}
      {#if ohneStil}<p class="hinweis"><Icon name="sparkles" size={15} />Der Stil ist noch nicht angelernt. Claude lernt ihn vor dem ersten Creative an und hält sich dann daran.</p>{/if}
      <label class="field"><span>Thema <small class="muted">optional</small></span>
        <textarea class="input" bind:value={thema} rows="3" maxlength="2000" placeholder="z. B. Warum gähnen wir? – leer lassen, dann sucht Claude Themen aus, die zum Kanal passen und noch nicht dran waren."></textarea></label>
    {/if}
    <label class="field"><span>Hinweise <small class="muted">optional</small></span>
      <textarea class="input" bind:value={hinweise} rows="2" maxlength="4000" placeholder={art === "anlernen" ? "Worauf soll Claude besonders achten?" : "z. B. diesmal mit Frage am Ende, höchstens 45 Sekunden"}></textarea></label>

    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <div class="fuss">
      <button class="btn" onclick={() => modalZu(dlg)} disabled={laeuft}>Abbrechen</button>
      <button class="btn btn--primary" onclick={los} disabled={laeuft || (art === "anlernen" && !wahl.length)}>{laeuft ? "Wird übergeben …" : art === "anlernen" ? "Anlernen lassen" : "Beauftragen"}</button>
    </div>
    <p class="muted klein">Claude holt offene Aufträge mehrmals am Tag ab. Fertige Creatives erscheinen hier zur Freigabe.</p>
  </div>
</dialog>

<style>
  .hl { padding: 0; border: 0; background: transparent; width: 100%; max-width: min(560px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); color: var(--text); }
  .hl::backdrop { background: rgba(4, 8, 16, .72); }
  .hl__in { display: grid; gap: 14px; padding: 20px; background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius); max-height: calc(100dvh - 24px); overflow: auto; overscroll-behavior: contain; }
  .kopf { display: flex; align-items: center; gap: 10px; }
  .kopf h3 { flex: 1; margin: 0; font-size: 1.15rem; }
  .hl__in > p { margin: 0; font-size: .92rem; }
  .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); }
  .seg button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); font: inherit; font-size: .9rem; cursor: pointer; transition: background-color .16s ease, color .16s ease; }
  .seg button.on { background: var(--bereich); color: #0A1220; font-weight: 600; }
  .seg button:active { transform: scale(.97); }
  .zaehler { display: inline-flex; align-items: center; gap: 14px; }
  .zaehler .btn { font-size: 1.2rem; line-height: 1; }
  .zaehler b { min-width: 2ch; text-align: center; font-size: 1.3rem; }
  .kn { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px 0 8px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font: inherit; font-size: .86rem; }
  .chip.on { border-color: var(--bereich); color: var(--text); background: color-mix(in srgb, var(--bereich) 14%, transparent); }
  .field small { font-weight: 400; }
  .hinweis { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: var(--bg-2); color: var(--text-2); font-size: .86rem; margin: 0; }
  .hinweis :global(svg) { flex: none; margin-top: 2px; color: var(--bereich); }
  .fehler { margin: 0; color: #FF8080; font-size: .88rem; }
  .fuss { display: flex; justify-content: flex-end; gap: 8px; }
  .klein { font-size: .8rem; margin: -4px 0 0 !important; text-align: right; }
  @media (max-width: 700px) {
    .hl { max-width: 100vw; margin: auto 0 0; }
    .hl__in { border-radius: var(--radius) var(--radius) 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); max-height: 92dvh; }
    .fuss .btn { flex: 1; justify-content: center; }
    .klein { text-align: left; }
  }
</style>
