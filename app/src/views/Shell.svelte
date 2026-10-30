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
  import Bald from "./Bald.svelte";
  import Rueckfrage from "../components/Rueckfrage.svelte";

  let offen = $state(false);   // Navigation auf dem Handy
  $effect(() => { daten.laden(); });
  $effect(() => { router.pfad; offen = false; window.scrollTo(0, 0); });

  const t = $derived(router.teile);
  const aktiv = (p: string) => (p === "/" ? router.pfad === "/" : router.pfad.startsWith(p));
</script>

<div class="shell">
  <header class="top">
    <button class="btn btn--quiet btn--icon top__menu" aria-label="Menü" aria-expanded={offen} onclick={() => (offen = !offen)}><Icon name="menu" /></button>
    <a class="brand" href="#/"><img src="./mono.svg" alt="" width="26" height="20"><img src="./wordmark.svg" alt="Medialyte" class="brand__wm" width="104" height="20"></a>
  </header>

  <nav class="side" class:is-open={offen} aria-label="Hauptnavigation">
    <a class="brand side__brand" href="#/"><img src="./mono.svg" alt="" width="26" height="20"><img src="./wordmark.svg" alt="Medialyte" class="brand__wm" width="104" height="20"></a>
    <div class="nav">
      <a href="#/" class:on={aktiv("/")}><Icon name="home" />Übersicht</a>
      {#if auth.darf("anfragen")}<a href="#/anfragen" class:on={aktiv("/anfragen")}><Icon name="inbox" />Anfragen{#if daten.neueAnfragen}<span class="badge num">{daten.neueAnfragen}</span>{/if}</a>{/if}
      {#if auth.darf("akquise")}
        <a href="#/akquise" class:on={aktiv("/akquise") && t.length === 1}><Icon name="layers" />Akquise</a>
        <div class="sub">
          {#each daten.kategorien as k (k.slug)}
            <a href="#/akquise/{k.slug}" class:on={t[1] === k.slug} style="--c:{k.farbe}"><i class="dot"></i>{k.name}</a>
          {/each}
        </div>
      {/if}
      {#if auth.darf("akquise")}<a href="#/nachfassen" class:on={aktiv("/nachfassen")}><Icon name="phone" />Nachfassen{#if daten.nachfassHeute}<span class="badge badge--b num">{daten.nachfassHeute}</span>{/if}</a>{/if}
      {#if auth.darf("kunden")}<a href="#/kunden" class:on={aktiv("/kunden")}><Icon name="users" />Kunden</a>{/if}
      {#if auth.darf("rechnungen")}<a href="#/rechnungen" class:on={aktiv("/rechnungen")}><Icon name="receipt" />Rechnungen</a>{/if}
      {#if auth.darf("team")}<a href="#/team" class:on={aktiv("/team")}><Icon name="shield" />Team & Rechte</a>{/if}
    </div>
    <div class="me">
      <span class="me__av" aria-hidden="true">{auth.ich?.name?.[0] ?? "?"}</span>
      <span class="me__t"><b>{auth.ich?.name}</b><small>{ROLLEN[auth.ich?.rolle ?? ""] ?? ""}</small></span>
      <button class="btn btn--quiet btn--icon" title="Abmelden" aria-label="Abmelden" onclick={() => auth.abmelden()}><Icon name="logout" size={17} /></button>
    </div>
  </nav>
  {#if offen}<button class="scrim" aria-label="Menü schließen" onclick={() => (offen = false)}></button>{/if}

  <main class="main">
    {#if t[0] === "anfragen"}<Anfragen id={t[1]} />
    {:else if t[0] === "akquise" && t[1] === "betrieb" && t[2]}<Betrieb id={t[2]} />
    {:else if t[0] === "akquise" && t[1]}<Kategorie slug={t[1]} tab={t[2] ?? "board"} />
    {:else if t[0] === "akquise"}<Akquise />
    {:else if t[0] === "nachfassen"}<Nachfassen slug={t[1]} />
    {:else if t[0] === "team"}<Team />
    {:else if t[0] === "kunden"}<Bald titel="Kunden" text="Kunden aus Anfragen, Akquise und Rechnungen an einem Ort – kommt mit dem Zusammenführen der Rechnungs-App (Etappe 4)." />
    {:else if t[0] === "rechnungen"}<Bald titel="Rechnungen & Angebote" text="Die Rechnungs-App zieht in Etappe 4 komplett hierher. Bis dahin öffnest du sie wie gewohnt." link />
    {:else}<Uebersicht />{/if}
  </main>
</div>

{#if daten.toast}<div class="toast" class:has-a={!!daten.toastAktion} role="status"><span>{daten.toast}</span>{#if daten.toastAktion}<button class="toast__a" onclick={() => { const a = daten.toastAktion; daten.toast = ""; daten.toastAktion = null; a?.fn(); }}>{daten.toastAktion.label}</button>{/if}</div>{/if}
<Rueckfrage />

<style>
  .shell { min-height: 100vh; display: grid; grid-template-columns: var(--side) minmax(0, 1fr); }
  .top { display: none; }
  .brand { display: inline-flex; align-items: center; gap: 9px; }
  .brand__wm { height: 17px; width: auto; }
  .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 22px; padding: 22px 14px 14px;
    border-right: 1px solid var(--line); background: var(--bg-2); overflow-y: auto; }
  .side__brand { padding: 0 8px; }
  .nav { display: grid; gap: 2px; align-content: start; flex: 1; }
  .nav a { display: flex; align-items: center; gap: 11px; min-height: 38px; padding: 0 10px; border-radius: var(--radius-s); color: var(--text-2); font-weight: 500;
    transition: background-color .12s ease, color .12s ease; }
  .nav a :global(svg) { color: var(--steel); flex: none; }
  .nav a.on { background: rgba(255, 255, 255, .07); color: var(--text); }
  .nav a.on :global(svg) { color: var(--text); }
  @media (hover: hover) { .nav a:hover { background: var(--hover); color: var(--text); } }
  .sub { display: grid; gap: 1px; margin: 2px 0 8px 19px; padding-left: 12px; border-left: 1px solid var(--line); }
  .sub a { min-height: 32px; font-size: .9rem; font-weight: 400; gap: 10px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; }
  .badge--b { background: var(--info) !important; color: #06101F !important; }
  .badge { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--coral); color: #fff; font-size: .75rem; font-weight: 600; display: grid; place-items: center; }
  .me { display: flex; align-items: center; gap: 10px; padding: 10px 6px 0 8px; border-top: 1px solid var(--line); }
  .me__av { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--panel-2); color: var(--text); font-weight: 600; flex: none; }
  .me__t { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
  .me__t b { color: var(--text); font-weight: 500; font-size: .92rem; }
  .me__t small { color: var(--steel); font-size: .78rem; }
  .main { min-width: 0; padding: 32px clamp(18px, 3vw, 40px) 64px; }
  .scrim { display: none; }

  @media (max-width: 900px) {
    .shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; align-content: start; }
    .top { display: flex; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 30; height: calc(56px + env(safe-area-inset-top));
      padding: env(safe-area-inset-top) 12px 0 8px; background: rgba(10, 18, 32, .96); border-bottom: 1px solid var(--line); }
    .side { position: fixed; inset: 0 auto 0 0; z-index: 50; width: min(300px, 86vw); transform: translateX(-102%); transition: transform .28s var(--ease);
      padding-top: calc(22px + env(safe-area-inset-top)); padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
    .side.is-open { transform: none; box-shadow: 20px 0 60px -20px rgba(0, 0, 0, .7); }
    .scrim { display: block; position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, .45); border: 0; }
    .main { padding: 22px 16px calc(48px + env(safe-area-inset-bottom)); }
  }
</style>
