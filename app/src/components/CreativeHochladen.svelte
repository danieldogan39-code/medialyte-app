<script lang="ts">
  // Eigenes Creative hochladen: Bilder (eins = Einzelbild, mehrere = Karussell in der gewählten Reihenfolge) oder ein Video.
  // Es stellt sich hinten in der Reihenfolge an und erscheint auf den gewählten Plattformen.
  import Icon from "./Icon.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import { modalAuf, modalSanft, modalZu } from "../lib/bewegung";
  import { daten } from "../lib/daten.svelte";
  import { haptik } from "../lib/haptik";
  import { router } from "../lib/router.svelte";
  import { social, PLATTFORMEN, PLAETZE, groesse, type Creative } from "../lib/social.svelte";

  let { onclose }: { onclose: () => void } = $props();
  let dlg: HTMLDialogElement | undefined = $state();
  $effect(() => { if (!dlg) return; modalAuf(dlg); return modalSanft(dlg); });

  type Wahl = { f: File; url: string; id: string };
  let wahl = $state<Wahl[]>([]);
  let titel = $state(""), text = $state(""), saeule = $state(""), status = $state<Creative["status"]>("freigegeben");
  let plaetze = $state<string[]>([]), laeuft = $state(""), fehler = $state(""), ueber = $state(false);
  let eingabe: HTMLInputElement | undefined = $state();

  const video = $derived(wahl.find((w) => w.f.type.startsWith("video/")));
  const art = $derived(video ? "Video" : wahl.length > 1 ? `Karussell · ${wahl.length} Seiten` : wahl.length ? "Einzelbild" : "");
  // passende Plätze vorschlagen, solange noch nichts gewählt ist
  $effect(() => {
    if (plaetze.length || !wahl.length) return;
    plaetze = video ? ["ig-beitrag", "fb-beitrag", "yt", "tt-video"] : ["ig-beitrag", "fb-beitrag", "li"];
  });

  function dazu(files: FileList | File[] | null) {
    fehler = "";
    const neu = [...(files ?? [])].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!neu.length) { fehler = "Nur Bilder und Videos."; return; }
    const mitVideo = neu.some((f) => f.type.startsWith("video/"));
    if (mitVideo && (neu.length > 1 || wahl.length)) { fehler = "Ein Video bitte einzeln hochladen."; return; }
    if (video) { fehler = "Ein Video bitte einzeln hochladen."; return; }
    const gross = neu.find((f) => f.size > 50 * 1024 * 1024);
    if (gross) { fehler = `„${gross.name}“ ist größer als 50 MB.`; return; }
    wahl = [...wahl, ...neu.map((f) => ({ f, url: URL.createObjectURL(f), id: Math.random().toString(36).slice(2) }))];
    if (!titel) titel = neu[0].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  }
  function weg(w: Wahl) { URL.revokeObjectURL(w.url); wahl = wahl.filter((x) => x !== w); }
  function schieben(i: number, d: number) { const j = i + d; if (j < 0 || j >= wahl.length) return; const n = [...wahl]; [n[i], n[j]] = [n[j], n[i]]; wahl = n; }
  const umschalten = (k: string) => (plaetze = plaetze.includes(k) ? plaetze.filter((x) => x !== k) : [...plaetze, k]);

  async function speichern() {
    if (laeuft || !wahl.length) return;
    fehler = ""; laeuft = "Lädt hoch …";
    try {
      const c = await social.hochladen({ dateien: wahl.map((w) => w.f), titel, text, plattformen: plaetze, saeule: saeule || null, status }, (t) => (laeuft = t || laeuft));
      haptik("erfolg"); daten.melden("Hochgeladen");
      for (const w of wahl) URL.revokeObjectURL(w.url);
      await modalZu(dlg);
      router.geh(`/social/c/${c.slug}`);
    } catch (e: any) { fehler = "Hochladen hat nicht geklappt: " + (e?.message || e); }
    finally { laeuft = ""; }
  }
  const gruppen = $derived(PLATTFORMEN.map((p) => ({ p, l: PLAETZE.filter((x) => x.plattform === p.key && (!video || !["gm-logo", "gm-titel", "tt-foto"].includes(x.key))) })).filter((g) => g.l.length));
</script>

<dialog bind:this={dlg} class="hl" aria-labelledby="hl-t" onclose={() => { for (const w of wahl) URL.revokeObjectURL(w.url); onclose(); }}>
  <div class="hl__in">
    <div class="kopf">
      <h3 id="hl-t">Creative hochladen</h3>
      <button class="btn btn--quiet btn--icon" onclick={() => modalZu(dlg)} aria-label="Schließen" disabled={!!laeuft}><Icon name="x" /></button>
    </div>

    <input bind:this={eingabe} class="sr" type="file" accept="image/*,video/*" multiple onchange={(e) => { dazu(e.currentTarget.files); e.currentTarget.value = ""; }}>
    {#if !wahl.length}
      <button class="ablage" class:ueber onclick={() => eingabe?.click()}
        ondragover={(e) => { e.preventDefault(); ueber = true; }} ondragleave={() => (ueber = false)}
        ondrop={(e) => { e.preventDefault(); ueber = false; dazu(e.dataTransfer?.files ?? null); }}>
        <span class="ablage__i"><Icon name="upload" size={22} /></span>
        <b>Bilder oder ein Video wählen</b>
        <small>Ein Bild wird ein Einzelbild, mehrere werden ein Karussell. Bis 50 MB je Datei.</small>
      </button>
    {:else}
      <div class="wahl">
        {#each wahl as w, i (w.id)}
          <figure class="wk">
            {#if w.f.type.startsWith("video/")}<video src={w.url} muted playsinline preload="metadata"></video>{:else}<img src={w.url} alt="">{/if}
            {#if wahl.length > 1}<span class="wk__nr num">{i + 1}</span>{/if}
            <figcaption>
              {#if wahl.length > 1}
                <button class="mini" onclick={() => schieben(i, -1)} disabled={i === 0 || !!laeuft} aria-label="Nach vorne"><Icon name="left" size={14} /></button>
                <button class="mini" onclick={() => schieben(i, 1)} disabled={i === wahl.length - 1 || !!laeuft} aria-label="Nach hinten"><Icon name="right" size={14} /></button>
              {/if}
              <span class="sp">{groesse(w.f.size)}</span>
              <button class="mini" onclick={() => weg(w)} disabled={!!laeuft} aria-label="Entfernen"><Icon name="trash" size={14} /></button>
            </figcaption>
          </figure>
        {/each}
        {#if !video}<button class="wk wk--plus" onclick={() => eingabe?.click()} disabled={!!laeuft} aria-label="Weitere Bilder"><Icon name="plus" size={22} /></button>{/if}
      </div>
      <p class="muted klein">{art}</p>
    {/if}

    <label class="field"><span>Titel</span><input class="input" bind:value={titel} maxlength="120" placeholder="Wofür ist das Creative?"></label>
    <label class="field"><span>Text zum Posten</span><textarea class="input" bind:value={text} rows="5" placeholder="Bildunterschrift mit Hashtags"></textarea></label>

    <div class="field"><span>Wo es laufen soll</span>
      <div class="pl">
        {#each gruppen as g (g.p.key)}
          <div class="pl__z"><span class="pl__k"><PlattformLogo name={g.p.key} size={22} rund={0.3} /><span>{g.p.name}</span></span>
            <span class="pl__c">{#each g.l as x (x.key)}<button type="button" class="chip" class:on={plaetze.includes(x.key)} aria-pressed={plaetze.includes(x.key)} onclick={() => umschalten(x.key)}>{x.name}</button>{/each}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="g2">
      {#if social.plan.saeulen?.length}
        <label class="field"><span>Content-Säule</span>
          <select class="input" bind:value={saeule}><option value="">Keine</option>{#each social.plan.saeulen as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</select></label>
      {/if}
      <label class="field"><span>Status</span>
        <select class="input" bind:value={status}><option value="freigegeben">Freigegeben</option><option value="pruefen">Zur Freigabe</option></select></label>
    </div>

    {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}
    <div class="fuss">
      <button class="btn" onclick={() => modalZu(dlg)} disabled={!!laeuft}>Abbrechen</button>
      <button class="btn btn--primary" onclick={speichern} disabled={!wahl.length || !!laeuft}>{laeuft || "Hochladen"}</button>
    </div>
  </div>
</dialog>

<style>
  .hl { padding: 0; border: 0; background: transparent; width: 100%; max-width: min(640px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); color: var(--text); }
  .hl::backdrop { background: rgba(4, 8, 16, .72); }
  .hl__in { display: grid; gap: 14px; padding: 20px; background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius); max-height: calc(100dvh - 24px); overflow: auto; overscroll-behavior: contain; }
  .kopf { display: flex; align-items: center; gap: 10px; }
  .kopf h3 { flex: 1; margin: 0; font-size: 1.15rem; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .ablage { display: grid; justify-items: center; gap: 8px; padding: 30px 18px; border-radius: 16px; border: 1.5px dashed var(--line-2); background: var(--bg-2);
    color: var(--text-2); cursor: pointer; text-align: center; font: inherit; transition: border-color .2s ease, background-color .2s ease; }
  .ablage.ueber, .ablage:focus-visible { border-color: var(--bereich); background: color-mix(in srgb, var(--bereich) 8%, var(--bg-2)); }
  .ablage b { color: var(--text); font-weight: 600; }
  .ablage small { color: var(--steel); font-size: .84rem; max-width: 36ch; }
  .ablage__i { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: color-mix(in srgb, var(--bereich) 16%, transparent); color: var(--bereich); }
  .wahl { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
  .wk { position: relative; margin: 0; border-radius: 12px; overflow: hidden; background: var(--bg-2); border: 1px solid var(--line); display: grid; }
  .wk img, .wk video { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; }
  .wk__nr { position: absolute; left: 6px; top: 6px; min-width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; padding: 0 6px;
    background: var(--text); color: var(--bg); font-weight: 700; font-size: .8rem; }
  .wk figcaption { display: flex; align-items: center; gap: 2px; padding: 4px; font-size: .72rem; color: var(--steel); }
  .wk .sp { flex: 1; text-align: center; white-space: nowrap; overflow: hidden; }
  .wk--plus { place-items: center; min-height: 140px; border-style: dashed; color: var(--text-2); cursor: pointer; font: inherit; }
  .mini { width: 30px; height: 30px; border: 0; border-radius: 8px; display: grid; place-items: center; background: transparent; color: var(--text-2); cursor: pointer; }
  .mini:disabled { opacity: .35; cursor: default; }
  .mini:not(:disabled):active { transform: scale(.92); }
  .klein { font-size: .84rem; margin: -6px 0 0; }
  .pl { display: grid; gap: 8px; }
  .pl__z { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 6px 10px; }
  .pl__k { display: inline-flex; align-items: center; gap: 8px; font-size: .86rem; color: var(--text-2); }
  .pl__c { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { height: 30px; padding: 0 11px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .82rem; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .g2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .fehler { margin: 0; color: #FF8080; font-size: .88rem; }
  .fuss { display: flex; justify-content: flex-end; gap: 8px; }
  @media (max-width: 700px) {
    .hl { max-width: 100vw; margin: auto 0 0; }
    .hl__in { border-radius: var(--radius) var(--radius) 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); max-height: 92dvh; }
    .pl__z { grid-template-columns: 1fr; }
    .wk .sp { visibility: hidden; }
    .fuss .btn { flex: 1; justify-content: center; }
  }
</style>
