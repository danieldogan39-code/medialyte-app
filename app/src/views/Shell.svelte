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

  let offen = $state(false);   // „Mehr“-Blatt auf dem Handy
  $effect(() => { daten.laden(); });

  // Scrollposition je Seite merken: Zurück landet wieder an derselben Stelle (wie in nativen Apps), neue Seiten starten oben
  const pos = new Map<string, number>();
  let zurueckNav = false, aktPfad = router.pfad;
  $effect(() => {
    const s = () => pos.set(aktPfad, scrollY);
    const p = () => { zurueckNav = true; };
    addEventListener("scroll", s, { passive: true }); addEventListener("popstate", p);
    return () => { removeEventListener("scroll", s); removeEventListener("popstate", p); };
  });
  $effect(() => {
    const p = router.pfad; offen = false;
    const ziel = zurueckNav ? pos.get(p) ?? 0 : 0; zurueckNav = false; aktPfad = p;
    scrollTo(0, 0);
    if (ziel > 0) {  // Inhalte laden evtl. noch: kurz warten, bis die Seite lang genug ist
      const bis = performance.now() + 900;
      const versuch = () => { if (document.documentElement.scrollHeight - innerHeight >= ziel - 2 || performance.now() > bis) scrollTo(0, ziel); else requestAnimationFrame(versuch); };
      requestAnimationFrame(versuch);
    }
  });

  // Handy: Titel oben einblenden, sobald die große Überschrift der Seite weggescrollt ist (wie bei iOS/Android)
  let titel = $state(""), kompakt = $state(false);
  $effect(() => {
    router.pfad; kompakt = false;
    let io: IntersectionObserver | null = null;
    const t = setTimeout(() => {
      const h = [...document.querySelectorAll<HTMLElement>("main .seite h1, main .seite h2")].find((x) => x.getClientRects().length);
      titel = h?.textContent?.trim() || bereichVon(router.pfad).name;
      if (!h) return;
      io = new IntersectionObserver(([e]) => { kompakt = !e.isIntersecting && e.boundingClientRect.top < 80; }, { rootMargin: "-60px 0px 0px 0px" });
      io.observe(h);
    }, 60);
    return () => { clearTimeout(t); io?.disconnect(); };
  });
  // Zurück oben links: zur übergeordneten Seite; kam man von dort, per Verlauf (dann stimmt auch die Scrollposition)
  const tief = $derived(router.teile.length > 1);
  const stapel: string[] = [];
  $effect(() => { const p = router.pfad; if (stapel[stapel.length - 2] === p) stapel.pop(); else stapel.push(p); if (stapel.length > 30) stapel.shift(); });
  function zurueck() {
    const eltern = "/" + (router.teile[0] ?? "");
    const vorher = stapel[stapel.length - 2];
    if (vorher && vorher !== router.pfad && vorher.startsWith(eltern)) history.back();
    else router.geh(eltern);
  }

  // Untere Reiter auf dem Handy: die ersten vier erlaubten Bereiche, der Rest unter „Mehr“
  const darfPfad: Record<string, () => boolean> = {
    "/": () => true, "/anfragen": () => auth.darf("anfragen"), "/akquise": () => auth.darf("akquise"), "/kunden": () => auth.darf("kunden") || auth.darf("rechnungen"),
    "/rechnungen": () => auth.darf("rechnungen"), "/nachfassen": () => auth.darf("akquise"), "/kosten": () => auth.darf("akquise"), "/team": () => auth.darf("team"), "/einstellungen": () => true,
  };
  const REIHE = ["/", "/anfragen", "/akquise", "/kunden", "/rechnungen", "/nachfassen", "/kosten", "/team", "/einstellungen"];
  const reiter = $derived(REIHE.filter((p) => darfPfad[p]?.()).slice(0, 4).map((p) => BEREICHE.find((b) => b.pfad === p)!));
  const kurz: Record<string, string> = { "/": "Übersicht", "/team": "Team" };
  const badge = (p: string) => p === "/anfragen" ? daten.neueAnfragen : p === "/nachfassen" ? daten.nachfassHeute : p === "/kunden" ? daten.tischbuchWartet : 0;
  const imReiter = (p: string) => reiter.some((b) => b.pfad === p);
  const mehrAktiv = $derived(!reiter.some((b) => aktiv(b.pfad)));
  const mehrBadge = $derived(REIHE.filter((p) => !reiter.some((b) => b.pfad === p)).reduce((n, p) => n + (badge(p) || 0), 0));

  // „Mehr“-Blatt: nach unten wischen schließt es
  let blatt: HTMLElement | undefined = $state(), zieh: { y: number; t: number } | null = null;
  function ziehStart(e: PointerEvent) { if (!blatt || innerWidth > 900) return; zieh = { y: e.clientY, t: performance.now() }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); blatt.style.transition = "none"; }
  function ziehen(e: PointerEvent) { if (!zieh || !blatt) return; const d = e.clientY - zieh.y; blatt.style.transform = `translateY(${d > 0 ? d : d / 6}px)`; }
  function ziehEnde(e: PointerEvent) {
    if (!zieh || !blatt) return;
    const d = e.clientY - zieh.y, v = d / Math.max(1, performance.now() - zieh.t);
    blatt.style.transition = ""; blatt.style.transform = ""; zieh = null;
    if (d > 90 || v > 0.5) offen = false;
  }
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
  // Richtung des Seitenwechsels wie in nativen Apps: tiefer = von rechts, zurück = von links, Bereichswechsel = nur einblenden
  let richtung = $state(0), tiefeVorher = router.teile.length, bereichVorher = router.teile[0] ?? "";
  $effect.pre(() => {
    const t2 = router.teile, b2 = t2[0] ?? "";
    richtung = b2 !== bereichVorher ? 0 : t2.length > tiefeVorher ? 1 : t2.length < tiefeVorher ? -1 : 0;
    tiefeVorher = t2.length; bereichVorher = b2;
  });
  const aktiv = (p: string) => (p === "/" ? router.pfad === "/" : router.pfad.startsWith(p));
</script>

<div class="shell">
  <div class="fensterleiste" data-tauri-drag-region aria-hidden="true"></div>
  <header class="top" class:kompakt>
    {#if tief}<button class="top__back" aria-label="Zurück" onclick={zurueck}><Icon name="left" size={22} /><span>Zurück</span></button>
    {:else}<a class="brand top__brand" href="#/" aria-label="Übersicht"><img src="./mono.svg" alt="" width="26" height="20"></a>{/if}
    <span class="top__t" aria-hidden={!kompakt}>{titel}</span>
    <span class="top__r"></span>
  </header>

  <nav class="side" class:is-open={offen} aria-label="Hauptnavigation" bind:this={blatt}>
    <div class="griff" aria-hidden="true" onpointerdown={ziehStart} onpointermove={ziehen} onpointerup={ziehEnde} onpointercancel={ziehEnde}><span></span></div>
    <a class="brand side__brand" href="#/"><img src="./mono.svg" alt="" width="26" height="20"><img src="./wordmark.svg" alt="Medialyte" class="brand__wm" width="104" height="20"></a>
    <div class="nav" style="--aktiv: {bereichVon(router.pfad).farbe}" use:gleiter={{ sel: "a.on" }}>
      <a href="#/" style="--f: {farbe("/")}" class:on={aktiv("/")} class:in-reiter={imReiter("/")}><span class="ni"><Icon name="home" size={15} /></span>Übersicht</a>
      {#if auth.darf("anfragen")}<a href="#/anfragen" style="--f: {farbe("/anfragen")}" class:on={aktiv("/anfragen")} class:in-reiter={imReiter("/anfragen")}><span class="ni"><Icon name="inbox" size={15} /></span>Anfragen{#if daten.neueAnfragen}{#key daten.neueAnfragen}<span class="badge num pop">{daten.neueAnfragen}</span>{/key}{/if}</a>{/if}
      {#if auth.darf("akquise")}<a href="#/akquise" style="--f: {farbe("/akquise")}" class:on={aktiv("/akquise")} class:in-reiter={imReiter("/akquise")}><span class="ni"><Icon name="layers" size={15} /></span>Akquise</a>{/if}
      {#if auth.darf("akquise")}<a href="#/nachfassen" style="--f: {farbe("/nachfassen")}" class:on={aktiv("/nachfassen")} class:in-reiter={imReiter("/nachfassen")}><span class="ni"><Icon name="phone" size={15} /></span>Nachfassen{#if daten.nachfassHeute}{#key daten.nachfassHeute}<span class="badge badge--b num pop">{daten.nachfassHeute}</span>{/key}{/if}</a>{/if}
      {#if auth.darf("kunden") || auth.darf("rechnungen")}<a href="#/kunden" style="--f: {farbe("/kunden")}" class:on={aktiv("/kunden")} class:in-reiter={imReiter("/kunden")}><span class="ni"><Icon name="users" size={15} /></span>Kunden{#if daten.tischbuchWartet}{#key daten.tischbuchWartet}<span class="badge num pop" title="Gäste warten auf Antwort">{daten.tischbuchWartet}</span>{/key}{/if}</a>{/if}
      {#if auth.darf("rechnungen")}<a href="#/rechnungen" style="--f: {farbe("/rechnungen")}" class:on={aktiv("/rechnungen")} class:in-reiter={imReiter("/rechnungen")}><span class="ni"><Icon name="receipt" size={15} /></span>Rechnungen</a>{/if}
      {#if auth.darf("akquise")}<a href="#/kosten" style="--f: {farbe("/kosten")}" class:on={aktiv("/kosten")} class:in-reiter={imReiter("/kosten")}><span class="ni"><Icon name="scale" size={15} /></span>Kosten</a>{/if}
      {#if auth.darf("team")}<a href="#/team" style="--f: {farbe("/team")}" class:on={aktiv("/team")} class:in-reiter={imReiter("/team")}><span class="ni"><Icon name="shield" size={15} /></span>Team & Rechte</a>{/if}
      <a href="#/einstellungen" style="--f: {farbe("/einstellungen")}" class:on={aktiv("/einstellungen")} class:in-reiter={imReiter("/einstellungen")}><span class="ni"><Icon name="settings" size={15} /></span>Einstellungen</a>
    </div>
    <div class="me">
      <span class="me__av" aria-hidden="true">{auth.ich?.name?.[0] ?? "?"}</span>
      <span class="me__t"><b>{auth.ich?.name}</b><small>{ROLLEN[auth.ich?.rolle ?? ""] ?? ""}</small></span>
      <button class="btn btn--quiet btn--icon" title="Abmelden" aria-label="Abmelden" onclick={() => auth.abmelden()}><Icon name="logout" size={17} /></button>
    </div>
  </nav>
  <button class="scrim" class:is-open={offen} aria-label="Menü schließen" tabindex={offen ? 0 : -1} aria-hidden={!offen} onclick={() => (offen = false)}></button>

  <nav class="tabbar" aria-label="Bereiche">
    {#each reiter as b (b.pfad)}
      <a href={"#" + b.pfad} class:on={aktiv(b.pfad) && !offen} style="--f: {b.farbe}" aria-current={aktiv(b.pfad) ? "page" : undefined}
        onclick={(e) => { if (aktiv(b.pfad) && router.pfad === b.pfad) { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); } }}>
        <span class="ti"><Icon name={b.icon} size={21} />{#if badge(b.pfad)}<span class="tb num">{badge(b.pfad)}</span>{/if}</span><span class="tl">{kurz[b.pfad] ?? b.name}</span></a>
    {/each}
    <button class:on={(mehrAktiv && !offen) || offen} style="--f: {mehrAktiv ? bereichVon(router.pfad).farbe : '#AEB9CA'}" aria-expanded={offen} onclick={() => (offen = !offen)}>
      <span class="ti"><Icon name="menu" size={21} />{#if mehrBadge}<span class="tb num">{mehrBadge}</span>{/if}</span><span class="tl">{mehrAktiv && !offen ? bereichVon(router.pfad).name.split(" ")[0] : "Mehr"}</span></button>
  </nav>

  <main class="main" style="--bereich: {bereichVon(router.pfad).farbe}">
    {#if appUpdate.neu}<div class="upd"><span>Neue App-Version {appUpdate.neu.v} ist da. Mit einem Tipp installieren – deine Daten bleiben erhalten.</span><button class="btn btn--s btn--primary" disabled={appUpdate.fortschritt != null} onclick={async () => { const f = await appUpdate.installieren().catch((e) => String(e?.message || e)); if (f) daten.melden(f); }}>{appUpdate.fortschritt != null ? `Lädt … ${Math.round(appUpdate.fortschritt * 100)} %` : "Jetzt aktualisieren"}</button><button class="btn btn--quiet btn--s" onclick={() => (appUpdate.neu = null)}>Später</button></div>{/if}
    {#key seite}
    <div class="seite" in:fly={{ x: ruhig() ? 0 : richtung * 28, y: ruhig() || richtung ? 0 : 8, duration: ruhig() ? 0 : richtung ? rein.ms : 260, easing: rein.easing, opacity: 0 }}>
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
  .shell { min-height: 100dvh; display: grid; grid-template-columns: var(--side) minmax(0, 1fr); }
  .top { display: none; }
  .brand { display: inline-flex; align-items: center; gap: 9px; }
  .brand__wm { height: 17px; width: auto; }
  .side { position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; gap: 22px; padding: 22px 14px 14px;
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

  @media (hover: hover) and (pointer: fine) { .nav a:hover { background: var(--hover); color: var(--text); } }
  .pop { animation: pop .6s var(--feder); }
  @keyframes pop { 0% { transform: scale(.4); opacity: 0; } 60% { opacity: 1; } }
  .badge--b { background: var(--info) !important; color: #06101F !important; }
  .badge { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--coral); color: #fff; font-size: .75rem; font-weight: 600; display: grid; place-items: center; }
  .me { display: flex; align-items: center; gap: 10px; padding: 10px 6px 0 8px; border-top: 1px solid var(--line); }
  .me__av { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--panel-2); color: var(--text); font-weight: 600; flex: none; }
  .me__t { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
  .me__t b { color: var(--text); font-weight: 500; font-size: .92rem; }
  .me__t small { color: var(--steel); font-size: .78rem; }
  .main { min-width: 0; overflow-x: clip; padding: 32px clamp(18px, 3vw, 40px) 64px;
    background: radial-gradient(1100px 420px at 0 0, color-mix(in srgb, var(--bereich) 8%, transparent), transparent 70%) no-repeat; transition: background .6s ease; }
  .scrim { display: none; }

  .griff, .tabbar { display: none; }
  /* Mac-Programm: Fensterknöpfe liegen über der Seitenleiste (wie in Mail oder Notizen), oben lässt sich das Fenster ziehen */
  .fensterleiste { display: none; }
  :global(.programm.mac) .fensterleiste { display: block; position: fixed; inset: 0 0 auto 0; height: 30px; z-index: 60; }
  :global(.programm.mac) .side { padding-top: 46px; }
  @media (max-width: 900px) {
    .shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; align-content: start; }
    /* Navigationsleiste: durchscheinend wie in iOS/Android, Titel erscheint beim Scrollen */
    .top { display: grid; grid-template-columns: 96px 1fr 96px; align-items: center; position: sticky; top: 0; z-index: 30; height: calc(50px + env(safe-area-inset-top));
      padding: env(safe-area-inset-top) 8px 0; background: rgba(10, 18, 32, .72); -webkit-backdrop-filter: saturate(170%) blur(20px); backdrop-filter: saturate(170%) blur(20px);
      border-bottom: 1px solid transparent; transition: border-color .25s ease, background-color .25s ease; }
    .top.kompakt { border-bottom-color: var(--line); background: rgba(10, 18, 32, .82); }
    .top__brand { padding: 8px; justify-self: start; }
    .top__back { justify-self: start; display: inline-flex; align-items: center; gap: 0; height: 40px; padding: 0 10px 0 2px; border: 0; background: none; color: var(--bereich-top, var(--text)); font-size: 1rem; font-weight: 500; }
    .top__back:active { opacity: .5; }
    .top__t { text-align: center; color: var(--text); font-weight: 600; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      opacity: 0; transform: translateY(6px); transition: opacity .25s ease, transform .4s var(--feder-schnell); }
    .top.kompakt .top__t { opacity: 1; transform: none; }

    /* „Mehr“-Blatt: kommt von unten, nach unten wischen schließt */
    .side { position: fixed; inset: auto 0 0 0; z-index: 50; height: auto; max-height: min(82dvh, 720px); width: auto; border-right: 0; border-radius: 22px 22px 0 0;
      transform: translateY(105%); transition: transform .5s var(--feder-weich), box-shadow .5s ease; overscroll-behavior: contain;
      padding: 0 12px calc(14px + env(safe-area-inset-bottom)); gap: 14px; box-shadow: 0 -1px 0 var(--line); }
    .side.is-open { transform: none; box-shadow: 0 -30px 80px -20px rgba(0, 0, 0, .8), 0 -1px 0 var(--line-2); }
    .side__brand { display: none; }
    .griff { display: grid; place-items: center; height: 26px; margin: 0 -12px; touch-action: none; cursor: grab; }
    .griff span { width: 38px; height: 5px; border-radius: 3px; background: var(--line-2); }
    .nav a { min-height: 48px; }
    .nav a.in-reiter { display: none; }
    .scrim { display: block; position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, .5); border: 0; opacity: 0; pointer-events: none; transition: opacity .35s ease; }
    .scrim.is-open { opacity: 1; pointer-events: auto; }

    /* Reiter unten */
    .tabbar { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; position: fixed; inset: auto 0 0 0; z-index: 45; height: calc(58px + env(safe-area-inset-bottom));
      padding: 4px 4px env(safe-area-inset-bottom); background: rgba(12, 21, 36, .78); -webkit-backdrop-filter: saturate(170%) blur(22px); backdrop-filter: saturate(170%) blur(22px);
      border-top: 1px solid var(--line); }
    .tabbar a, .tabbar button { display: grid; justify-items: center; align-content: center; gap: 3px; border: 0; background: none; color: var(--steel); font: inherit; padding: 0; min-width: 0; }
    .ti { position: relative; display: grid; place-items: center; width: 52px; height: 30px; border-radius: 15px; transition: background-color .3s ease, transform .45s var(--feder-schnell); }
    .tl { font-size: .7rem; font-weight: 500; letter-spacing: .01em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tabbar .on { color: var(--text); }
    .tabbar .on .ti { background: color-mix(in srgb, var(--f) 22%, transparent); color: var(--f); }
    .tabbar a:active .ti, .tabbar button:active .ti { transform: scale(.88); }
    .tb { position: absolute; top: -3px; right: 6px; min-width: 17px; height: 17px; padding: 0 5px; border-radius: 9px; background: var(--coral); color: #fff; font-size: .66rem; font-weight: 700;
      display: grid; place-items: center; box-shadow: 0 0 0 2px var(--bg); }

    .main { padding: 14px 16px calc(84px + env(safe-area-inset-bottom)); }
  }
</style>
