<script lang="ts">
  // Rahmen des Organizers: eigene Navigation, eigene Farbe, eigene Fenster – ein eigenständiger Teil der App.
  import Icon from "../../components/Icon.svelte";
  import OrgZeichen from "../../components/organizer/OrgZeichen.svelte";
  import Rueckfrage from "../../components/Rueckfrage.svelte";
  import AufgabeBlatt from "../../components/organizer/AufgabeBlatt.svelte";
  import TerminBlatt from "../../components/organizer/TerminBlatt.svelte";
  import GewohnheitBlatt from "../../components/organizer/GewohnheitBlatt.svelte";
  import Schnell from "../../components/organizer/Schnell.svelte";
  import Fokus from "../../components/organizer/Fokus.svelte";
  import Heute from "./Heute.svelte";
  import Woche from "./Woche.svelte";
  import Aufgaben from "./Aufgaben.svelte";
  import Ziele from "./Ziele.svelte";
  import Pruefungen from "./Pruefungen.svelte";
  import Faecher from "./Faecher.svelte";
  import OrgEinstellungen from "./OrgEinstellungen.svelte";
  import { auth } from "../../lib/auth.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { router } from "../../lib/router.svelte";
  import { modus } from "../../lib/modus.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { ORG_BEREICHE, ORG_FARBE, orgBereich } from "../../lib/organizer/bereiche";
  import { appUpdate } from "../../lib/appupdate.svelte";
  import { fly, fade } from "svelte/transition";
  import { federKurve, gleiter, ruhig } from "../../lib/bewegung";

  const rein = federKurve(0.5, 0), toastRein = federKurve(0.45, 0.18);
  $effect(() => { org.laden(); return org.live(); });
  $effect(() => { setTimeout(() => { appUpdate.pruefen(); appUpdate.beobachten(); }, 4000); });
  $effect(() => { if (router.pfad === "/o" || router.pfad === "/o/") router.geh("/o/heute"); });

  const seite = $derived(router.teile[1] ?? "heute");
  const seiteKey = $derived(seite + "/" + (router.teile[2] ?? ""));
  const b = $derived(orgBereich(router.pfad));
  const aktiv = (p: string) => router.pfad.startsWith(p);
  const offenAufgaben = $derived(org.offen.filter((a) => !a.geplant || org.liegengeblieben.includes(a)).length);
  const REITER = ORG_BEREICHE.slice(0, 5);

  // Titel oben (Handy), sobald die große Überschrift weggescrollt ist
  let kompakt = $state(false);
  $effect(() => { seite; const f = () => (kompakt = scrollY > 56); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); });
  $effect(() => { seite; scrollTo(0, 0); });

  // Tastatur: n = neu, 1–6 = Seiten
  $effect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable], dialog")) return;
      if (e.key === "n") { e.preventDefault(); blatt.auf({ art: "schnell" }); }
      const n = Number(e.key); if (n >= 1 && n <= ORG_BEREICHE.length) router.geh(ORG_BEREICHE[n - 1].pfad);
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });
  function obenauf(el: HTMLElement, _t: string) {
    const z = () => { if (typeof el.showPopover === "function") { try { if (el.matches(":popover-open")) el.hidePopover(); el.showPopover(); } catch { /* egal */ } } else el.removeAttribute("popover"); };
    z(); return { update: z };
  }
</script>

<div class="os" style="--org: {ORG_FARBE}; --bereich: {b.farbe}">
  <div class="fensterleiste" data-tauri-drag-region aria-hidden="true"></div>
  <header class="top" class:kompakt>
    <button class="wechsel" aria-label="Bereich wechseln" onclick={() => modus.auswahl()}><OrgZeichen size={28} /><Icon name="down" size={14} /></button>
    <span class="top__t">{b.name}</span>
    <a class="btn btn--quiet btn--icon" href="#/o/einstellungen" aria-label="Einstellungen"><Icon name="settings" size={19} /></a>
  </header>

  <nav class="side" aria-label="Organizer">
    <button class="marke" onclick={() => router.geh("/o/heute")}><OrgZeichen size={34} /><span><b>Organizer</b><small>persönlich · nur für dich</small></span></button>
    <div class="nav" use:gleiter={{ sel: "a.on" }} style="--aktiv: {b.farbe}">
      {#each ORG_BEREICHE as x (x.pfad)}
        <a href={"#" + x.pfad} class:on={aktiv(x.pfad)} style="--f: {x.farbe}"><span class="ni"><Icon name={x.icon} size={15} /></span>{x.name}
          {#if x.pfad === "/o/aufgaben" && offenAufgaben}<span class="badge num">{offenAufgaben}</span>{/if}</a>
      {/each}
    </div>
    <button class="neu" onclick={() => blatt.auf({ art: "schnell" })}><Icon name="plus" size={16} />Neu<kbd>N</kbd></button>
    <button class="zu-ml" onclick={() => modus.oeffnen("medialyte")}>
      <span class="zz"><img src="./mono.svg" alt="" width="18" height="14"></span><span><b>Zu Medialyte</b><small>Agentur-Backend</small></span><Icon name="wechsel" size={16} />
    </button>
    <div class="me">
      <span class="me__av" aria-hidden="true">{auth.ich?.name?.[0] ?? "?"}</span>
      <span class="me__t"><b>{auth.ich?.name}</b><small>Organizer</small></span>
      <button class="btn btn--quiet btn--icon" title="Abmelden" aria-label="Abmelden" onclick={() => auth.abmelden()}><Icon name="logout" size={17} /></button>
    </div>
  </nav>

  <main class="main">
    {#if appUpdate.bereit && !appUpdate.neu}<div class="upd"><span>Version {appUpdate.bereit.v} ist bereit und startet beim nächsten Öffnen.</span><button class="btn btn--s btn--primary org-primary" onclick={() => appUpdate.neuStarten().catch((e) => daten.melden(String(e?.message || e)))}>Jetzt neu starten</button></div>{/if}
    {#if appUpdate.neu}<div class="upd"><span>Neue App-Version {appUpdate.neu.v} ist da.</span><button class="btn btn--s btn--primary org-primary" disabled={appUpdate.fortschritt != null} onclick={async () => { const f = await appUpdate.installieren().catch((e) => String(e?.message || e)); if (f) daten.melden(f); }}>{appUpdate.fortschritt != null ? `Lädt … ${Math.round(appUpdate.fortschritt * 100)} %` : "Jetzt aktualisieren"}</button></div>{/if}
    <div class="buehne">
      {#key seiteKey}
        <div class="seite" in:fly={{ y: ruhig() ? 0 : 10, duration: ruhig() ? 0 : rein.ms, easing: rein.easing, opacity: 0 }} out:fade={{ duration: ruhig() ? 0 : 120 }}>
          {#if seite === "woche"}<Woche />
          {:else if seite === "aufgaben"}<Aufgaben />
          {:else if seite === "ziele"}<Ziele />
          {:else if seite === "pruefungen"}<Pruefungen />
          {:else if seite === "faecher"}{#key router.teile[2]}<Faecher id={router.teile[2] ?? ""} />{/key}
          {:else if seite === "einstellungen"}<OrgEinstellungen />
          {:else}<Heute />{/if}
        </div>
      {/key}
    </div>
  </main>

  <button class="fab" aria-label="Neu" onclick={() => blatt.auf({ art: "schnell" })}><Icon name="plus" size={24} /></button>
  <nav class="tabbar" aria-label="Seiten">
    {#each REITER as x (x.pfad)}
      <a href={"#" + x.pfad} class:on={aktiv(x.pfad)} style="--f: {x.farbe}" aria-current={aktiv(x.pfad) ? "page" : undefined}>
        <span class="ti"><Icon name={x.icon} size={21} />{#if x.pfad === "/o/aufgaben" && offenAufgaben}<span class="tb num">{offenAufgaben}</span>{/if}</span><span class="tl">{x.kurz}</span></a>
    {/each}
  </nav>
</div>

{#key blatt.nr}
  {#if blatt.offen?.art === "aufgabe"}<AufgabeBlatt a={blatt.offen.a} onclose={() => blatt.zu()} />
  {:else if blatt.offen?.art === "termin"}<TerminBlatt t={blatt.offen.t} onclose={() => blatt.zu()} />
  {:else if blatt.offen?.art === "gewohnheit"}<GewohnheitBlatt g={blatt.offen.g} onclose={() => blatt.zu()} />
  {:else if blatt.offen?.art === "schnell"}<Schnell text={blatt.offen.text} onclose={() => blatt.zu()} />
  {:else if blatt.offen?.art === "fokus"}<Fokus a={blatt.offen.a} onclose={() => blatt.zu()} />{/if}
{/key}
{#if daten.toast}<div class="toast" class:has-a={!!daten.toastAktion} class:toast--schlecht={daten.toastSchlecht} role="status" popover="manual" use:obenauf={daten.toast} in:fly={{ y: ruhig() ? 0 : 40, duration: ruhig() ? 0 : toastRein.ms, easing: toastRein.easing, opacity: 0 }} out:fade={{ duration: 180 }}><span>{daten.toast}</span>{#if daten.toastAktion}<button class="toast__a" onclick={() => { const a = daten.toastAktion; daten.toast = ""; daten.toastAktion = null; a?.fn(); }}>{daten.toastAktion.label}</button>{/if}</div>{/if}
<Rueckfrage />

<style>
  :global(:root) { --org: #8E7CFF; }
  :global(.org-primary) { background: linear-gradient(135deg, #9A8AFF, #7C6CF5) !important; border-color: #A598FF !important; color: #fff !important; }
  :global(.org-primary:hover:not(:disabled)) { background: linear-gradient(135deg, #A597FF, #8676FA) !important; }
  .os { min-height: 100dvh; display: grid; grid-template-columns: 248px minmax(0, 1fr); }
  .top, .tabbar, .fab { display: none; }
  .side { position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; gap: 18px; padding: 20px 14px 14px; border-right: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(142, 124, 255, .06), transparent 40%), var(--bg-2); overflow-y: auto; }
  .marke { display: flex; align-items: center; gap: 11px; padding: 4px 6px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .marke b { display: block; color: var(--text); font-size: 1.08rem; letter-spacing: -.02em; }
  .marke small { color: var(--steel); font-size: .76rem; }
  .nav { display: grid; gap: 2px; }
  .nav a { display: flex; align-items: center; gap: 11px; min-height: 42px; padding: 0 10px 0 7px; border-radius: 10px; color: var(--text-2); font-weight: 500; transition: color .2s ease; }
  .nav a :global(svg) { color: var(--f); }
  .ni { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--f) 16%, transparent); transition: background-color .3s ease, transform .45s var(--feder-schnell); }
  .nav a.on { color: var(--text); }
  .nav a.on .ni { background: var(--f); box-shadow: 0 6px 16px -6px var(--f); }
  .nav a.on .ni :global(svg) { color: #0A1220; }
  .nav a:active .ni { transform: scale(.9); }
  .nav :global(.gleiter) { background: color-mix(in srgb, var(--aktiv) 13%, transparent) !important; border-radius: 10px !important; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aktiv) 22%, transparent);
    transition: transform .55s var(--feder), width .55s var(--feder), height .55s var(--feder), background-color .4s ease !important; }
  @media (hover: hover) and (pointer: fine) { .nav a:hover { color: var(--text); background: var(--hover); } }
  .badge { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: color-mix(in srgb, var(--f) 30%, transparent); color: var(--text); font-size: .74rem; font-weight: 600; display: grid; place-items: center; }
  .neu { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-radius: 12px; border: 1px dashed rgba(142, 124, 255, .45); background: rgba(142, 124, 255, .08);
    color: var(--text); font: inherit; font-weight: 500; cursor: pointer; transition: background-color .2s ease, transform .4s var(--feder-schnell); }
  .neu kbd { margin-left: auto; font: inherit; font-size: .72rem; color: var(--steel); border: 1px solid var(--line-2); border-radius: 6px; padding: 1px 6px; }
  .neu:active { transform: scale(.97); }
  @media (hover: hover) and (pointer: fine) { .neu:hover { background: rgba(142, 124, 255, .14); } }
  .zu-ml { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 14px; border: 1px solid var(--line); background: var(--panel); color: var(--text-2);
    font: inherit; text-align: left; cursor: pointer; transition: border-color .2s ease, transform .4s var(--feder-schnell); }
  .zu-ml > span:nth-child(2) { flex: 1; display: grid; line-height: 1.25; }
  .zu-ml b { color: var(--text); font-weight: 500; font-size: .9rem; }
  .zu-ml small { color: var(--steel); font-size: .76rem; }
  .zz { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: #0E1828; border: 1px solid var(--line-2); }
  .zu-ml:active { transform: scale(.98); }
  @media (hover: hover) and (pointer: fine) { .zu-ml:hover { border-color: rgba(242, 74, 74, .4); } }
  .me { display: flex; align-items: center; gap: 10px; padding: 10px 6px 0 8px; border-top: 1px solid var(--line); }
  .me__av { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: rgba(142, 124, 255, .2); color: var(--text); font-weight: 600; flex: none; }
  .me__t { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
  .me__t b { color: var(--text); font-weight: 500; font-size: .92rem; }
  .me__t small { color: var(--steel); font-size: .78rem; }
  .main { min-width: 0; overflow-x: clip; padding: 30px clamp(18px, 3vw, 44px) 64px;
    background: radial-gradient(1000px 420px at 0 0, color-mix(in srgb, var(--bereich) 9%, transparent), transparent 70%) no-repeat; transition: background .6s ease; }
  .buehne { display: grid; min-width: 0; max-width: 1180px; }
  .buehne > :global(.seite) { grid-area: 1 / 1; min-width: 0; }
  .upd { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px 14px; margin-bottom: 16px; border-radius: 10px; background: rgba(142, 124, 255, .12); color: #D4CCFF; font-size: .9rem; }
  .upd span { flex: 1 1 240px; }
  .fensterleiste { display: none; }
  :global(.programm.mac) .fensterleiste { display: block; position: fixed; inset: 0 0 auto 0; height: 30px; z-index: 60; }
  :global(.programm.mac) .side { padding-top: 44px; }

  @media (max-width: 900px) {
    .os { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; align-content: start; }
    .side { display: none; }
    .top { display: grid; grid-template-columns: 96px 1fr 96px; align-items: center; position: sticky; top: 0; z-index: 30; height: calc(50px + env(safe-area-inset-top));
      padding: env(safe-area-inset-top) 8px 0; background: rgba(10, 18, 32, .78); -webkit-backdrop-filter: saturate(170%) blur(20px); backdrop-filter: saturate(170%) blur(20px); border-bottom: 1px solid transparent; transition: border-color .25s ease; }
    .top.kompakt { border-bottom-color: var(--line); }
    .top > a { justify-self: end; }
    .wechsel { justify-self: start; display: inline-flex; align-items: center; gap: 4px; height: 40px; padding: 0 6px; border: 0; background: none; color: var(--steel); cursor: pointer; }
    .wechsel:active { opacity: .6; }
    .top__t { text-align: center; color: var(--text); font-weight: 600; opacity: 0; transform: translateY(6px); transition: opacity .25s ease, transform .4s var(--feder-schnell); }
    .top.kompakt .top__t { opacity: 1; transform: none; }
    .main { padding: 12px 16px calc(96px + env(safe-area-inset-bottom)); }
    .tabbar { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; position: fixed; inset: auto 0 0 0; z-index: 45; height: calc(58px + env(safe-area-inset-bottom));
      padding: 4px 4px env(safe-area-inset-bottom); background: rgba(12, 21, 36, .82); -webkit-backdrop-filter: saturate(170%) blur(22px); backdrop-filter: saturate(170%) blur(22px); border-top: 1px solid var(--line); }
    .tabbar a { display: grid; justify-items: center; align-content: center; gap: 3px; color: var(--steel); }
    .ti { position: relative; display: grid; place-items: center; width: 52px; height: 30px; border-radius: 15px; transition: background-color .3s ease, transform .45s var(--feder-schnell); }
    .tl { font-size: .7rem; font-weight: 500; }
    .tabbar .on { color: var(--text); }
    .tabbar .on .ti { background: color-mix(in srgb, var(--f) 22%, transparent); color: var(--f); }
    .tabbar a:active .ti { transform: scale(.88); }
    .tb { position: absolute; top: -3px; right: 6px; min-width: 17px; height: 17px; padding: 0 5px; border-radius: 9px; background: var(--org); color: #fff; font-size: .66rem; font-weight: 700; display: grid; place-items: center; box-shadow: 0 0 0 2px var(--bg); }
    .fab { display: grid; place-items: center; position: fixed; right: 18px; bottom: calc(72px + env(safe-area-inset-bottom)); z-index: 46; width: 56px; height: 56px; border-radius: 18px; border: 0;
      background: linear-gradient(140deg, #A597FF, #7C6CF5 60%, #5FC9B4); color: #fff; box-shadow: 0 16px 34px -12px rgba(124, 108, 245, .8), inset 0 1px 0 rgba(255, 255, 255, .3);
      cursor: pointer; transition: transform .45s var(--feder-schnell); animation: fab .6s .2s var(--feder) both; }
    .fab:active { transform: scale(.9); }
    @keyframes fab { from { transform: scale(.4); opacity: 0; } }
  }
  :global(.android) .top, :global(.android) .tabbar { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; background: rgba(10, 18, 32, .97) !important; }
</style>
