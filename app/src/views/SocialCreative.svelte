<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { frage } from "../lib/frage.svelte";
  import { router } from "../lib/router.svelte";
  import { haptik } from "../lib/haptik";
  import { social, STATUS, ART, PLATTFORMEN, PLAETZE, groesse, offen, type Creative, type Datei } from "../lib/social.svelte";
  import PlattformLogo from "../components/PlattformLogo.svelte";
  import { istAndroidApp } from "../lib/appupdate.svelte";

  let { slug }: { slug: string } = $props();
  const schreiben = $derived(auth.darf("social", true));
  $effect(() => { if (!social.liste.length) social.laden(); return social.live(); });
  const c = $derived(social.liste.find((x) => x.slug === slug));
  const nr = $derived(c && offen(c) ? social.sortiert().filter(offen).findIndex((x) => x.id === c.id) + 1 : 0);

  const bilder = $derived((c?.dateien ?? []).filter((d) => d.art === "bild"));
  const video = $derived((c?.dateien ?? []).find((d) => d.art === "video"));
  const titelbild = $derived((c?.dateien ?? []).find((d) => d.art === "titelbild"));
  const paket = $derived((c?.dateien ?? []).find((d) => d.art === "paket"));
  let url = $state<Record<string, string>>({});
  $effect(() => {
    if (!c) return;
    const pfade = [...bilder, ...(video ? [video] : []), ...(titelbild ? [titelbild] : [])].map((d) => d.pfad);
    social.links(pfade).then((u) => { const m: Record<string, string> = {}; pfade.forEach((p, i) => (m[p] = u[i])); url = m; });
  });

  // Blättern im Karussell
  let streifen: HTMLElement | undefined = $state(), seite = $state(0);
  const gehe = (i: number) => streifen?.scrollTo({ left: i * streifen.clientWidth, behavior: "smooth" });
  const gescrollt = () => { if (streifen) seite = Math.round(streifen.scrollLeft / streifen.clientWidth); };

  // Herunterladen
  let laedt = $state(""), fortschritt = $state("");
  async function holen(dateien: Datei[], schluessel: string) {
    if (laedt) return;
    laedt = schluessel;
    try { await social.herunterladen(dateien, (t) => (fortschritt = t)); haptik("erfolg"); }
    catch (e: any) { daten.melden("Herunterladen hat nicht geklappt: " + (e?.message || e)); }
    finally { laedt = ""; fortschritt = ""; }
  }
  const alles = $derived.by(() => {
    if (!c) return [] as Datei[];
    if (c.art === "video") return [video, titelbild].filter(Boolean) as Datei[];
    if (c.art === "karussell") return istAndroidApp() || !paket ? bilder : [paket];
    return bilder;
  });

  // Text
  let bearbeiten = $state(false), entwurf = $state("");
  async function kopieren() {
    if (!c) return;
    try { await navigator.clipboard.writeText(c.text); }
    catch { const t = document.createElement("textarea"); t.value = c.text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
    haptik("erfolg"); daten.melden("Text kopiert");
  }
  async function textSpeichern() {
    if (!c) return;
    try { await social.setzen(c.id, { text: entwurf }); bearbeiten = false; daten.melden("Text gespeichert"); }
    catch (e: any) { daten.melden("Nicht gespeichert: " + e.message); }
  }

  async function setzen(werte: Partial<Creative>, meldung?: string) {
    if (!c) return;
    try { await social.setzen(c.id, werte); if (meldung) { haptik("erfolg"); daten.melden(meldung); } }
    catch (e: any) { daten.melden("Nicht gespeichert: " + e.message); }
  }
  async function loeschen() {
    if (!c) return;
    if (!(await frage(`„${c.titel}“ löschen?`, "Das Creative mit allen Dateien und dem Text wird endgültig aus der App gelöscht.", "Löschen", true))) return;
    try { await social.loeschen(c); daten.melden("Creative gelöscht"); router.geh("/social"); }
    catch (e: any) { daten.melden("Nicht gelöscht: " + e.message); }
  }
  async function platzUmschalten(k: string) {
    if (!c) return;
    let neu = c.plattformen?.includes(k) ? c.plattformen.filter((x) => x !== k) : [...(c.plattformen ?? []), k];
    // Ein Instagram-Reel (Hochkant-Video) passt immer auch als YouTube Short und als TikTok-Video
    if (k === "ig-beitrag" && neu.includes(k) && c.art === "video" && c.dateien.some((d) => d.art === "video" && (d.h ?? 1) > (d.b ?? 0)))
      neu = [...new Set([...neu, "yt", "tt-video"])];
    await setzen({ plattformen: neu });
    haptik("auswahl");
  }
  const datum = (s: string) => new Date(s).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  const DATEIART: Record<string, string> = { bild: "Bild", video: "Video", titelbild: "Titelbild", paket: "Alle Bilder als ZIP" };
</script>

{#if !c}
  {#if social.laedt}<div class="skelett" aria-label="Lade …"><i></i><i></i></div>
  {:else}<div class="card empty"><b>Creative nicht gefunden</b><p>Vielleicht wurde es gelöscht.</p><a class="btn" href="#/social">Zu den Creatives</a></div>{/if}
{:else}
  <Head titel={c.titel} text={[c.serie, ART[c.art], c.format].filter(Boolean).join(" · ")} zurueck={social.zuletzt || "#/social"}>
    <span class="pill pill--{STATUS[c.status].ton}">{STATUS[c.status].name}</span>
    {#if nr}<span class="pill pill--plain" title="Posting-Reihenfolge">Nr. {nr}</span>{/if}
    {#if schreiben}<button class="btn btn--s stern" class:an={c.favorit} aria-pressed={!!c.favorit} onclick={() => setzen({ favorit: !c.favorit }, c.favorit ? "Aus Favoriten entfernt" : "Zu Favoriten hinzugefügt")}><Icon name="star" size={15} fill={!!c.favorit} />{c.favorit ? "Favorit" : "Favorisieren"}</button>
    {:else if c.favorit}<span class="pill pill--plain"><Icon name="star" size={12} fill />Favorit</span>{/if}
  </Head>

  <div class="lage">
    <div class="vorschau">
      {#if c.art === "video" && video}
        <div class="rahmen rahmen--video">
          {#if url[video.pfad]}<!-- svelte-ignore a11y_media_has_caption --><video src={url[video.pfad]} poster={titelbild ? url[titelbild.pfad] : undefined} controls playsinline preload="metadata"></video>{/if}
        </div>
        {#if titelbild && url[titelbild.pfad]}<div class="titel"><img src={url[titelbild.pfad]} alt="Titelbild"><span><b>Titelbild</b><small class="muted">{titelbild.b && titelbild.h ? `${titelbild.b} × ${titelbild.h} px` : ""}</small></span></div>{/if}
      {:else}
        <div class="rahmen" style="aspect-ratio: {bilder[0]?.b && bilder[0]?.h ? `${bilder[0].b} / ${bilder[0].h}` : '3 / 4'}">
          <div class="streifen" bind:this={streifen} onscroll={gescrollt}>
            {#each bilder as d, i (d.pfad)}<div class="folie">{#if url[d.pfad]}<img src={url[d.pfad]} alt="Bild {i + 1}" loading={i ? "lazy" : "eager"} draggable="false">{/if}</div>{/each}
          </div>
          {#if bilder.length > 1}
            {#if seite > 0}<button class="pfeil pfeil--l" aria-label="Vorheriges Bild" onclick={() => gehe(seite - 1)}><Icon name="left" size={18} /></button>{/if}
            {#if seite < bilder.length - 1}<button class="pfeil pfeil--r" aria-label="Nächstes Bild" onclick={() => gehe(seite + 1)}><Icon name="right" size={18} /></button>{/if}
            <span class="zaehler num">{seite + 1} / {bilder.length}</span>
          {/if}
        </div>
        {#if bilder.length > 1}<div class="punkte">{#each bilder as _, i}<button class:on={i === seite} aria-label="Bild {i + 1}" onclick={() => gehe(i)}></button>{/each}</div>{/if}
      {/if}
    </div>

    <div class="infos">
      <section class="card block">
        <div class="block__k"><b>Herunterladen</b>{#if fortschritt}<span class="muted klein">{fortschritt}</span>{/if}</div>
        <button class="btn btn--primary gross" disabled={!!laedt} onclick={() => holen(alles, "alles")}>
          <Icon name="download" size={17} />{laedt === "alles" ? "Lädt …" : c.art === "video" ? "Video und Titelbild" : c.art === "karussell" ? `Alle ${bilder.length} Bilder` : "Bild herunterladen"}</button>
        {#if istAndroidApp()}<p class="muted klein">Öffnet das Teilen-Menü: direkt an Instagram schicken oder in der Galerie speichern.</p>{/if}
        <ul class="dateien">
          {#each c.dateien as d (d.pfad)}
            <li>
              <span class="ico"><Icon name={d.art === "video" ? "play" : d.art === "paket" ? "stapel" : "image"} size={15} /></span>
              <span class="d"><b>{DATEIART[d.art] ?? d.name}{d.art === "bild" && bilder.length > 1 ? " " + (bilder.indexOf(d) + 1) : ""}</b><small class="muted">{[d.b && d.h ? `${d.b} × ${d.h}` : "", d.dauer ? d.dauer.toLocaleString("de-DE") + " s" : "", groesse(d.groesse)].filter(Boolean).join(" · ")}</small></span>
              <button class="btn btn--quiet btn--icon btn--s" aria-label="{DATEIART[d.art] ?? d.name} herunterladen" disabled={!!laedt} onclick={() => holen([d], d.pfad)}><Icon name={laedt === d.pfad ? "refresh" : "download"} size={16} /></button>
            </li>
          {/each}
        </ul>
      </section>

      <section class="card block">
        <div class="block__k"><b>Bildunterschrift</b>
          <span class="knoepfe">
            {#if schreiben && !bearbeiten}<button class="btn btn--quiet btn--s" onclick={() => { entwurf = c.text; bearbeiten = true; }}>Bearbeiten</button>{/if}
            {#if !bearbeiten}<button class="btn btn--s" onclick={kopieren}><Icon name="copy" size={14} />Kopieren</button>{/if}
          </span></div>
        {#if bearbeiten}
          <textarea class="input text-edit" bind:value={entwurf} rows="10"></textarea>
          <div class="knoepfe"><button class="btn btn--s btn--primary" onclick={textSpeichern}>Speichern</button><button class="btn btn--quiet btn--s" onclick={() => (bearbeiten = false)}>Abbrechen</button></div>
        {:else if c.text}<p class="text">{c.text}</p>
        {:else}<p class="muted klein">Noch kein Text.</p>{/if}
      </section>

      <section class="card block">
        <div class="block__k"><b>Plattformen</b><span class="muted klein">Wofür ist es gebaut?</span></div>
        <div class="pl">
          {#each PLATTFORMEN as p (p.key)}
            {@const plaetze = PLAETZE.filter((x) => x.plattform === p.key && (p.key !== "youtube" || c.art === "video") && (x.key !== "tt-video" || c.art === "video") && (x.key !== "tt-foto" || c.art !== "video"))}
            {#if plaetze.length}
              <div class="pl__z" style="--p: {p.farbe}">
                <span class="pl__n"><PlattformLogo name={p.key} size={28} rund={0.3} />{p.name}</span>
                <span class="pl__k">{#each plaetze as x (x.key)}
                  <button class:on={c.plattformen?.includes(x.key)} aria-pressed={c.plattformen?.includes(x.key)} disabled={!schreiben} onclick={() => platzUmschalten(x.key)}>{x.key === "yt" ? (c.dateien.some((d) => d.art === "video" && (d.h ?? 0) > (d.b ?? 0)) ? "Shorts" : "Video") : (x.key.endsWith("beitrag") && !x.key.startsWith("gm")) || x.key === "li" ? (c.art === "video" ? (x.key === "li" ? "Video" : "Reel") : c.art === "karussell" ? "Mehrseitig" : "Beitrag") : x.name}</button>
                {/each}</span>
              </div>
            {/if}
          {/each}
        </div>
      </section>

      <section class="card block">
        <div class="block__k"><b>Status und Planung</b></div>
        <div class="seg" role="radiogroup" aria-label="Status">
          {#each Object.entries(STATUS) as [k, s] (k)}
            <button role="radio" aria-checked={c.status === k} class:on={c.status === k} class="seg--{s.ton}" disabled={!schreiben}
              onclick={() => setzen({ status: k as Creative["status"] }, `Status: ${s.name}`)}>{s.name}</button>
          {/each}
        </div>
        <div class="zwei">
          <label class="field"><span>Geplant für</span><input class="input" type="date" value={c.geplant ?? ""} disabled={!schreiben} onchange={(e) => setzen({ geplant: (e.currentTarget as HTMLInputElement).value || null }, "Planung gespeichert")}></label>
          <label class="field"><span>Content-Säule</span>
            <select class="input" value={c.saeule ?? ""} disabled={!schreiben} onchange={(e) => setzen({ saeule: (e.currentTarget as HTMLSelectElement).value || null }, "Säule gespeichert")}>
              <option value="">Keine</option>
              {#each social.plan.saeulen ?? [] as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
            </select></label>
        </div>
        <label class="field"><span>Notiz</span><textarea class="input" rows="2" placeholder="z. B. mit Musik aus der Instagram-Bibliothek posten" disabled={!schreiben} value={c.notiz ?? ""} onchange={(e) => setzen({ notiz: (e.currentTarget as HTMLTextAreaElement).value || null })}></textarea></label>
      </section>

      <p class="meta muted">Erstellt am {datum(c.erstellt)}{c.format ? " · " + c.format + " px" : ""}</p>
      {#if schreiben}<button class="btn btn--quiet weg" onclick={loeschen}><Icon name="trash" size={15} />Creative löschen</button>{/if}
    </div>
  </div>
{/if}

<style>
  .lage { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 420px); gap: 28px; align-items: start; }
  .vorschau { position: sticky; top: 24px; display: grid; gap: 12px; justify-items: center; min-width: 0; }
  .rahmen { position: relative; width: min(100%, 520px); border-radius: 18px; overflow: hidden; background: var(--bg-2); box-shadow: 0 30px 60px -30px rgba(0, 0, 0, .8), 0 0 0 1px var(--line); }
  .rahmen--video { width: min(100%, 380px); aspect-ratio: 9 / 16; }
  .rahmen video { width: 100%; height: 100%; display: block; background: #000; object-fit: contain; }
  .streifen { display: flex; width: 100%; height: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; }
  .streifen::-webkit-scrollbar { display: none; }
  .folie { flex: 0 0 100%; scroll-snap-align: start; }
  .folie img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pfeil { position: absolute; top: 50%; width: 38px; height: 38px; margin-top: -19px; border-radius: 50%; border: 0; display: grid; place-items: center;
    background: rgba(10, 18, 32, .7); color: #fff; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); cursor: pointer; }
  .pfeil--l { left: 10px; } .pfeil--r { right: 10px; }
  .zaehler { position: absolute; right: 10px; top: 10px; padding: 3px 9px; border-radius: 999px; background: rgba(10, 18, 32, .7); color: #fff; font-size: .76rem; }
  .punkte { display: flex; gap: 6px; }
  .punkte button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 50%; background: var(--line-2); cursor: pointer; transition: background-color .2s ease, transform .3s var(--feder-schnell); }
  .punkte button.on { background: var(--bereich); transform: scale(1.3); }
  .titel { display: flex; gap: 12px; align-items: center; width: min(100%, 380px); }
  .titel img { width: 56px; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 8px; box-shadow: 0 0 0 1px var(--line); }
  .titel span { display: grid; gap: 2px; font-size: .86rem; }
  .infos { display: grid; gap: 14px; min-width: 0; }
  .block { display: grid; gap: 12px; padding: 16px 18px; }
  .block__k { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .block__k b { font-weight: 600; color: var(--text); }
  .klein { font-size: .82rem; }
  .gross { width: 100%; min-height: 46px; }
  .dateien { list-style: none; margin: 0; padding: 0; display: grid; }
  .dateien li { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); }
  .dateien .ico { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--bereich) 14%, transparent); color: var(--bereich); }
  .dateien .d { flex: 1; display: grid; min-width: 0; font-size: .88rem; }
  .dateien .d b { font-weight: 500; color: var(--text); }
  .dateien .d small { font-size: .76rem; }
  .knoepfe { display: flex; gap: 6px; flex-wrap: wrap; }
  .text { white-space: pre-wrap; margin: 0; font-size: .92rem; line-height: 1.55; color: var(--text-2); user-select: text; -webkit-user-select: text; max-height: 420px; overflow: auto; }
  .text-edit { font-size: .92rem; line-height: 1.5; }
  .seg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); }
  .seg button { min-height: 34px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); font: inherit; font-size: .8rem; cursor: pointer; padding: 0 4px;
    transition: background-color .25s ease, color .25s ease; }
  .seg button.on.seg--gelb { background: rgba(231, 185, 74, .2); color: #EBC56B; }
  .seg button.on.seg--gruen { background: rgba(76, 195, 138, .2); color: #6FD3A2; }
  .seg button.on.seg--blau { background: rgba(111, 168, 240, .2); color: #8DBBF5; }
  .seg button.on.seg--grau { background: rgba(139, 152, 173, .2); color: #AEB9CA; }
  .pl { display: grid; gap: 8px; }
  .pl__z { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .pl__n { display: inline-flex; align-items: center; gap: 10px; font-size: .9rem; color: var(--text); }
  .pl__l { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: var(--p); background: color-mix(in srgb, var(--p) 15%, transparent); }
  .pl__k { display: flex; gap: 6px; }
  .pl__k button { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--steel); font: inherit; font-size: .8rem; cursor: pointer;
    transition: background-color .2s ease, color .2s ease, border-color .2s ease; }
  .pl__k button.on { background: color-mix(in srgb, var(--p) 20%, transparent); border-color: color-mix(in srgb, var(--p) 55%, transparent); color: var(--text); }
  .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .meta { font-size: .8rem; margin: 0; }
  .weg { justify-self: start; color: #FF8080; }
  @media (max-width: 900px) {
    .lage { grid-template-columns: minmax(0, 1fr); }
    .vorschau { position: static; }
  }
  @media (max-width: 420px) { .seg { grid-template-columns: 1fr 1fr; } .zwei { grid-template-columns: 1fr; } }
  .stern.an { color: #F7C65E; border-color: rgba(247, 198, 94, .4); }
</style>
