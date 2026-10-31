<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { router } from "../lib/router.svelte";
  import { ROLLEN } from "../lib/status";
  import Uebersicht from "./Uebersicht.svelte";
  import Akquise from "./Akquise.svelte";
  import Kategorie from "./Kategorie.svelte";
  import Betrieb from "./Betrieb.svelte";
  import Anfragen from "./Anfragen.svelte";
  import Team from "./Team.svelte";
  import Nachfassen from "./Nachfassen.svelte";
  import Rechnungen from "./Rechnungen.svelte";
  import Kunden from "./Kunden.svelte";
  import Kunde from "./Kunde.svelte";
  import Kosten from "./Kosten.svelte";
  import Einstellungen from "./Einstellungen.svelte";
  import DemoWeiter from "./DemoWeiter.svelte";
  import Rueckfrage from "../components/Rueckfrage.svelte";
  import { appUpdate } from "../lib/appupdate.svelte";
  import Ebenen from "../components/rechnungen/Ebenen.svelte";
  import RechnungsKunde from "./RechnungsKunde.svelte";
  import { R } from "../lib/rechnungen/daten.svelte";
  import { bereichVon, BEREICHE } from "../lib/bereiche";
  const farbe = (p: string) => BEREICHE.find((b) => b.pfad === p)?.farbe ?? "#8B98AD";
  import { fly, fade } from "svelte/transition";
  import { federKurve, gleiter, ruhig } from "../lib/bewegung";
  // Seitenwechsel: neue Seite gleitet sanft herein (Unterreiter derselben Seite bleiben stehen)
  const rein = federKurve(0.5, 0), toastRein = federKurve(0.45, 0.18);
  // Rechnungsdaten im Hintergrund (für Rechnungen und das Kundenmenü), auch ohne Internet
  $effect(() => { if (auth.darf("rechnungen")) { R.meldung = (t) => daten.melden(t); R.starten(); } });
  $effect(() => { setTimeout(() => appUpdate.pruefen(), 4000); });

  let offen = $state(false);   // Navigation auf dem Handy
  $effect(() => { daten.laden(); });
  $effect(() => { router.pfad; offen = false; window.scrollTo(0, 0); });
  // „/“ springt in das Suchfeld der Seite (wie im Cockpit)
  $effect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) return;
      const s = document.querySelector<HTMLInputElement>("main .search input, main input[type=search]");
      if (s) { e.preventDefault(); s.focus(); }
    };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  });

  const t = $derived(router.teile);
  const seite = $derived(t[0] === "akquise" && t[1] && t[1] !== "betrieb" && t[1] !== "demo" ? "akquise/" + t[1] : t.slice(0, 3).join("/"));
  const aktiv = (p: string) => (p === "/" ? router.pfad === "/" : router.pfad.startsWith(p));
</script>

<div class="shell">
  <header class="top">
    <button class="btn btn--quiet btn--icon top__menu" aria-label="Menü" aria-expanded={offen} onclick={() => (offen = !offen)}><Icon name="menu" /></button>
    <a class="brand" href="#/"><img src="./mono.svg" alt="" width="26" height="20"><img src="./wordmark.svg" alt="Medialyte" class="brand__wm" width="104" height="20"></a>
  </header>

  <nav class="side" class:is-open={offen} aria-label="Hauptnavigation">
    <a class="brand side__brand" href="#/"><img src="./mono.svg" alt="" width="26" height="20"><img src="./wordmark.svg" alt="Medialyte" class="brand__wm" width="104" height="20"></a>
    <div class="nav" style="--aktiv: {bereichVon(router.pfad).farbe}" use:gleiter={{ sel: "a.on" }}>
      <a href="#/" style="--f: {farbe("/")}" class:on={aktiv("/")}><span class="ni"><Icon name="home" size={15} /></span>Übersicht</a>
      {#if auth.darf("anfragen")}<a href="#/anfragen" style="--f: {farbe("/anfragen")}" class:on={aktiv("/anfragen")}><span class="ni"><Icon name="inbox" size={15} /></span>Anfragen{#if daten.neueAnfragen}{#key daten.neueAnfragen}<span class="badge num pop">{daten.neueAnfragen}</span>{/key}{/if}</a>{/if}
      {#if auth.darf("akquise")}<a href="#/akquise" style="--f: {farbe("/akquise")}" class:on={aktiv("/akquise")}><span class="ni"><Icon name="layers" size={15} /></span>Akquise</a>{/if}
      {#if auth.darf("akquise")}<a href="#/nachfassen" style="--f: {farbe("/nachfassen")}" class:on={aktiv("/nachfassen")}><span class="ni"><Icon name="phone" size={15} /></span>Nachfassen{#if daten.nachfassHeute}{#key daten.nachfassHeute}<span class="badge badge--b num pop">{daten.nachfassHeute}</span>{/key}{/if}</a>{/if}
      {#if auth.darf("kunden") || auth.darf("rechnungen")}<a href="#/kunden" style="--f: {farbe("/kunden")}" class:on={aktiv("/kunden")}><span class="ni"><Icon name="users" size={15} /></span>Kunden{#if daten.tischbuchWartet}{#key daten.tischbuchWartet}<span class="badge num pop" title="Gäste warten auf Antwort">{daten.tischbuchWartet}</span>{/key}{/if}</a>{/if}
      {#if auth.darf("rechnungen")}<a href="#/rechnungen" style="--f: {farbe("/rechnungen")}" class:on={aktiv("/rechnungen")}><span class="ni"><Icon name="receipt" size={15} /></span>Rechnungen</a>{/if}
      {#if auth.darf("akquise")}<a href="#/kosten" style="--f: {farbe("/kosten")}" class:on={aktiv("/kosten")}><span class="ni"><Icon name="scale" size={15} /></span>Kosten</a>{/if}
      {#if auth.darf("team")}<a href="#/team" style="--f: {farbe("/team")}" class:on={aktiv("/team")}><span class="ni"><Icon name="shield" size={15} /></span>Team & Rechte</a>{/if}
      <a href="#/einstellungen" style="--f: {farbe("/einstellungen")}" class:on={aktiv("/einstellungen")}><span class="ni"><Icon name="settings" size={15} /></span>Einstellungen</a>
    </div>
    <div class="me">
      <span class="me__av" aria-hidden="true">{auth.ich?.name?.[0] ?? "?"}</span>
      <span class="me__t"><b>{auth.ich?.name}</b><small>{ROLLEN[auth.ich?.rolle ?? ""] ?? ""}</small></span>
      <button class="btn btn--quiet btn--icon" title="Abmelden" aria-label="Abmelden" onclick={() => auth.abmelden()}><Icon name="logout" size={17} /></button>
    </div>
  </nav>
  <button class="scrim" class:is-open={offen} aria-label="Menü schließen" tabindex={offen ? 0 : -1} aria-hidden={!offen} onclick={() => (offen = false)}></button>

  <main class="main" style="--bereich: {bereichVon(router.pfad).farbe}">
    {#if appUpdate.neu}<div class="upd"><span>Neue App-Version {appUpdate.neu.v} verfügbar. Einfach herunterladen und über die alte installieren – deine Daten bleiben erhalten.</span><a class="btn btn--s btn--primary" href={appUpdate.neu.url} target="_blank" rel="noopener">Herunterladen</a><button class="btn btn--quiet btn--s" onclick={() => (appUpdate.neu = null)}>Später</button></div>{/if}
    {#key seite}
    <div class="seite" in:fly={{ y: ruhig() ? 0 : 14, duration: ruhig() ? 0 : rein.ms, easing: rein.easing, opacity: 0 }}>
    {#if t[0] === "anfragen"}<Anfragen id={t[1]} />
    {:else if t[0] === "akquise" && t[1] === "betrieb" && t[2]}<Betrieb id={t[2]} />
    {:else if t[0] === "akquise" && t[1] === "demo" && t[2]}<DemoWeiter slug={t[2]} />
    {:else if t[0] === "kosten"}<Kosten />
    {:else if t[0] === "einstellungen"}<Einstellungen />
    {:else if t[0] === "akquise" && t[1]}<Kategorie slug={t[1]} tab={t[2] ?? "ueberblick"} />
    {:else if t[0] === "akquise"}<Akquise />
    {:else if t[0] === "nachfassen"}<Nachfassen slug={t[1]} />
    {:else if t[0] === "team"}<Team />
    {:else if t[0] === "kunden" && t[1] === "r" && t[2]}<RechnungsKunde id={t[2]} />
    {:else if t[0] === "kunden" && t[1]}<Kunde slug={t[1]} />
    {:else if t[0] === "kunden"}<Kunden />
    {:else if t[0] === "rechnungen" && auth.darf("rechnungen")}<Rechnungen />
    {:else}<Uebersicht />{/if}
    </div>
    {/key}
  </main>
</div>

{#if daten.toast}<div class="toast" class:has-a={!!daten.toastAktion} role="status" in:fly={{ y: ruhig() ? 0 : 40, duration: ruhig() ? 0 : toastRein.ms, easing: toastRein.easing, opacity: 0 }} out:fade={{ duration: 180 }}><span>{daten.toast}</span>{#if daten.toastAktion}<button class="toast__a" onclick={() => { const a = daten.toastAktion; daten.toast = ""; daten.toastAktion = null; a?.fn(); }}>{daten.toastAktion.label}</button>{/if}</div>{/if}
<Ebenen />
<Rueckfrage />

<style>
  .upd { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px 14px; margin-bottom: 16px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .12); color: #C4D9F7; font-size: .9rem; }
  .upd span { flex: 1 1 260px; }
  .shell { min-height: 100vh; display: grid; grid-template-columns: var(--side) minmax(0, 1fr); }
  .top { display: none; }
  .brand { display: inline-flex; align-items: center; gap: 9px; }
  .brand__wm { height: 17px; width: auto; }
  .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 22px; padding: 22px 14px 14px;
    border-right: 1px solid var(--line); background: var(--bg-2); overflow-y: auto; }
  .side__brand { padding: 0 8px; }
  .nav { display: grid; gap: 2px; align-content: start; flex: 1; }
  .nav a { display: flex; align-items: center; gap: 11px; min-height: 42px; padding: 0 10px 0 7px; border-radius: var(--radius-s); color: var(--text-2); font-weight: 500;
    transition: background-color .2s ease, color .2s ease; }
  .nav a :global(svg) { color: var(--f, var(--steel)); flex: none; }
  .ni { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--f) 16%, transparent);
    transition: background-color .3s ease, transform .45s var(--feder-schnell), box-shadow .3s ease; }
  .nav a.on .ni { background: var(--f); box-shadow: 0 6px 16px -6px color-mix(in srgb, var(--f) 80%, transparent); }
  .nav a.on .ni :global(svg) { color: #0A1220; }
  .nav a:active .ni { transform: scale(.9); }
  .nav a.on { background: transparent; color: var(--text); }
  .nav :global(.gleiter) { background: color-mix(in srgb, var(--aktiv) 13%, transparent) !important; border-radius: 10px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aktiv) 22%, transparent); transition: transform .55s var(--feder), width .55s var(--feder), height .55s var(--feder), background-color .4s ease, box-shadow .4s ease !important; }

  @media (hover: hover) { .nav a:hover { background: var(--hover); color: var(--text); } }
  .pop { animation: pop .6s var(--feder); }
  @keyframes pop { 0% { transform: scale(.4); opacity: 0; } 60% { opacity: 1; } }
  .badge--b { background: var(--info) !important; color: #06101F !important; }
  .badge { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--coral); color: #fff; font-size: .75rem; font-weight: 600; display: grid; place-items: center; }
  .me { display: flex; align-items: center; gap: 10px; padding: 10px 6px 0 8px; border-top: 1px solid var(--line); }
  .me__av { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--panel-2); color: var(--text); font-weight: 600; flex: none; }
  .me__t { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
  .me__t b { color: var(--text); font-weight: 500; font-size: .92rem; }
  .me__t small { color: var(--steel); font-size: .78rem; }
  .main { min-width: 0; padding: 32px clamp(18px, 3vw, 40px) 64px;
    background: radial-gradient(1100px 420px at 0 0, color-mix(in srgb, var(--bereich) 8%, transparent), transparent 70%) no-repeat; transition: background .6s ease; }
  .scrim { display: none; }

  @media (max-width: 900px) {
    .shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; align-content: start; }
    .top { display: flex; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 30; height: calc(56px + env(safe-area-inset-top));
      padding: env(safe-area-inset-top) 12px 0 8px; background: rgba(10, 18, 32, .96); border-bottom: 1px solid var(--line); }
    .side { position: fixed; inset: 0 auto 0 0; z-index: 50; width: min(300px, 86vw); transform: translateX(-102%); transition: transform .5s var(--feder-weich), box-shadow .5s ease;
      padding-top: calc(22px + env(safe-area-inset-top)); padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
    .side.is-open { transform: none; box-shadow: 20px 0 60px -20px rgba(0, 0, 0, .7); }
    .scrim { display: block; position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, .45); border: 0; opacity: 0; pointer-events: none; transition: opacity .35s ease; }
    .scrim.is-open { opacity: 1; pointer-events: auto; }
    .main { padding: 22px 16px calc(48px + env(safe-area-inset-bottom)); }
  }
</style>
