<script lang="ts">
  // Startbildschirm: Wohin? Medialyte (Agentur) oder der persönliche Organizer – zwei eigenständige Welten in einer App.
  import Icon from "../components/Icon.svelte";
  import OrgZeichen from "../components/organizer/OrgZeichen.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { modus } from "../lib/modus.svelte";
  import { org } from "../lib/organizer/org.svelte";
  import { countdown, gruss, tageBis, tagLang, uhr } from "../lib/organizer/zeit";
  import { haptik } from "../lib/haptik";
  import { ruhig } from "../lib/bewegung";

  let geht = $state<"" | "medialyte" | "organizer">("");
  // Organizer-Stand im Hintergrund auffrischen, damit die Karte stimmt
  $effect(() => { if (auth.darf("organizer")) org.laden(); });

  const heute = $derived(org.bloecke(new Date(org.jetzt)).filter((b) => !b.ganztag && b.art !== "routine"));
  const offenHeute = $derived(heute.filter((b) => (b.art === "aufgabe" || b.art === "gewohnheit") && !b.erledigt).length);
  const naechster = $derived(heute.find((b) => b.ende.getTime() > org.jetzt));
  const pruefung = $derived(org.pruefungen[0]);
  const anfragen = $derived(daten.neueAnfragen);
  const nachfassen = $derived(auth.darf("akquise") ? daten.nachfassHeute : 0);
  const agentLaeuft = $derived(Object.keys(daten.laufend ?? {}).length > 0);

  function waehlen(z: "medialyte" | "organizer") {
    if (geht) return;
    haptik("mittel"); geht = z;
    setTimeout(() => modus.oeffnen(z), ruhig() ? 0 : 380);
  }
  $effect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.("input, textarea")) return; if (e.key === "1") waehlen("medialyte"); if (e.key === "2") waehlen("organizer"); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });
</script>

<div class="start" class:geht={!!geht}>
  <header>
    <small>{tagLang(org.jetzt)}</small>
    <h1>{gruss()}, {auth.ich?.name?.split(" ")[0] ?? ""}</h1>
    <p class="muted">Wohin möchtest du?</p>
  </header>

  <div class="karten">
    <button class="karte ml" class:gewaehlt={geht === "medialyte"} class:weg={geht === "organizer"} onclick={() => waehlen("medialyte")} aria-keyshortcuts="1">
      <span class="licht" aria-hidden="true"></span>
      <!-- Radar im Hintergrund: das Bild des Agenten, der neue Kunden findet -->
      <span class="radar" aria-hidden="true"><i class="ringe"></i><i class="sweep"></i><b style="--x: 62%; --y: 30%; --d: 1.1s"></b><b style="--x: 28%; --y: 46%; --d: 4.4s"></b><b style="--x: 70%; --y: 66%; --d: 2.5s"></b></span>
      <span class="kopf">
        <span class="zeichen"><span class="welle"></span><span class="welle w2"></span><img src="./mono.svg" alt="" width="28" height="21"></span>
        <span class="pfeil"><Icon name="right" size={20} /></span>
      </span>
      <span class="name"><img src="./wordmark.svg" alt="Medialyte" width="150" height="29"></span>
      <span class="text">Akquise, Anfragen, Kunden, Rechnungen und Social Media – deine Agentur.</span>
      <span class="info">
        {#if auth.darf("anfragen") && anfragen}<span class="pill pill--rot">{anfragen} {anfragen === 1 ? "neue Anfrage" : "neue Anfragen"}</span>{/if}
        {#if nachfassen}<span class="pill pill--gelb">{nachfassen} heute nachfassen</span>{/if}
        {#if agentLaeuft}<span class="pill pill--blau live">Agent sucht gerade</span>{/if}
        {#if !(auth.darf("anfragen") && anfragen) && !nachfassen && !agentLaeuft}<span class="pill pill--grau">Alles ruhig</span>{/if}
      </span>
    </button>

    <button class="karte og" class:gewaehlt={geht === "organizer"} class:weg={geht === "medialyte"} onclick={() => waehlen("organizer")} aria-keyshortcuts="2">
      <span class="licht" aria-hidden="true"></span>
      <span class="kopf"><OrgZeichen size={46} animiert /><span class="pfeil"><Icon name="right" size={20} /></span></span>
      <span class="name"><b>Organizer</b></span>
      <span class="text">Dein Tag, deine Woche, Aufgaben, Gewohnheiten und Prüfungen – alles an einem Ort, selbst geplant.</span>
      <span class="info">
        {#if !org.geladen}<span class="pill pill--lila">Neu – einmal einrichten</span>
        {:else}
          {#if naechster}<span class="pill pill--lila"><span class="kurz">{naechster.start.getTime() <= org.jetzt ? "Jetzt" : uhr(naechster.start)} · {naechster.titel}</span></span>
          {:else if offenHeute === 0}<span class="pill pill--gruen">Heute ist alles erledigt</span>{/if}
          {#if pruefung}<span class="pill pill--rot"><span class="kurz">{pruefung.art === "abgabe" ? "Abgabe" : "Klausur"} {countdown(tageBis(pruefung.start))} · {pruefung.titel}</span></span>{/if}
        {/if}
      </span>
    </button>
  </div>

  <footer>
    <span class="muted">Tipp: 1 oder 2 drücken · später jederzeit oben wechseln</span>
    <button class="btn btn--quiet btn--s" onclick={() => auth.abmelden()}><Icon name="logout" size={15} />Abmelden</button>
  </footer>
</div>

<style>
  .start { min-height: 100dvh; display: grid; align-content: center; justify-items: center; gap: 34px; padding: calc(40px + env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom)); }
  header { text-align: center; display: grid; gap: 6px; animation: rein .7s var(--feder) both; }
  header small { color: var(--steel); letter-spacing: .06em; text-transform: uppercase; font-size: .74rem; font-weight: 600; }
  header h1 { font-size: clamp(1.7rem, 4vw, 2.4rem); }
  .karten { display: grid; grid-template-columns: repeat(2, minmax(0, 340px)); gap: 18px; width: 100%; justify-content: center; }
  .karte { position: relative; overflow: hidden; isolation: isolate; display: grid; gap: 14px; align-content: start; text-align: left; min-height: 280px; padding: 22px;
    border-radius: 26px; border: 1px solid var(--line-2); background: var(--panel); color: var(--text-2); font: inherit; cursor: pointer;
    box-shadow: 0 30px 70px -40px rgba(0, 0, 0, .9); animation: rein .8s var(--feder) both;
    transition: transform .55s var(--feder-schnell), border-color .3s ease, box-shadow .4s ease, opacity .35s ease, filter .35s ease; }
  .karte.og { animation-delay: 90ms; }
  .karte .licht { position: absolute; inset: -40% -30% auto auto; width: 120%; height: 120%; z-index: -1; opacity: .9; transition: transform 1s var(--feder-weich), opacity .4s ease; }
  .ml .licht { background: radial-gradient(closest-side, rgba(242, 74, 74, .26), rgba(111, 168, 240, .06) 55%, transparent 72%); }
  /* feine Kante oben in den Markenfarben */
  .karte::before { content: ""; position: absolute; left: 22px; right: 22px; top: 0; height: 1px; opacity: .8; }
  .ml::before { background: linear-gradient(90deg, transparent, #FF6B6B 30%, #7BAFFF 75%, transparent); }
  .og::before { background: linear-gradient(90deg, transparent, #A897FF 30%, #4FD1B5 75%, transparent); }
  /* Radar: Ringe + langsamer Strahl, ganz zurückhaltend */
  .radar { position: absolute; right: -110px; bottom: -130px; width: 320px; height: 320px; z-index: -1; pointer-events: none; opacity: .6;
    -webkit-mask: radial-gradient(circle, #000 0 45%, transparent 70%); mask: radial-gradient(circle, #000 0 45%, transparent 70%); }
  .radar i { position: absolute; inset: 0; border-radius: 50%; }
  .ringe { background: repeating-radial-gradient(circle, transparent 0 34px, rgba(123, 175, 255, .16) 35px 36px); }
  .sweep { background: conic-gradient(from 0deg, transparent 0 290deg, rgba(255, 107, 107, .18) 345deg, rgba(255, 140, 140, .35) 360deg); animation: sweep 7s linear infinite; }
  @keyframes sweep { to { transform: rotate(360deg); } }
  /* Fundpunkte leuchten auf, wenn der Strahl vorbeikommt */
  .radar b { position: absolute; left: var(--x); top: var(--y); width: 6px; height: 6px; margin: -3px; border-radius: 50%; background: #FF8A7A; opacity: 0;
    box-shadow: 0 0 10px 2px rgba(255, 107, 107, .6); animation: blip 7s ease-out var(--d) infinite; }
  @keyframes blip { 0% { opacity: 0; transform: scale(.4); } 4% { opacity: 1; transform: scale(1); } 40% { opacity: 0; transform: scale(.8); } 100% { opacity: 0; } }
  .og .licht { background: radial-gradient(closest-side, rgba(142, 124, 255, .3), rgba(79, 209, 181, .08) 55%, transparent 72%); }
  .kopf { display: flex; justify-content: space-between; align-items: center; }
  /* Zeichen in der Markenkachel (rot, wie das Organizer-Zeichen violett) – das Monogramm schreibt sich beim Öffnen */
  .zeichen { position: relative; width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center;
    background: linear-gradient(150deg, #FF8A7A, #F24A4A 48%, #B42343); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .22), 0 10px 24px rgba(242, 74, 74, .38); }
  .zeichen img { width: 28px; height: auto; filter: brightness(0) invert(1); clip-path: inset(0 100% 0 0); animation: schreiben .9s cubic-bezier(.65, 0, .35, 1) .3s forwards; }
  @keyframes schreiben { to { clip-path: inset(0 0 0 0); } }
  .welle { position: absolute; inset: 0; border-radius: 13px; border: 1.5px solid rgba(255, 120, 120, .6); opacity: 0; animation: welle 1.6s cubic-bezier(.2, .6, .3, 1) .5s both; pointer-events: none; }
  .welle.w2 { animation-delay: .8s; }
  @keyframes welle { 0% { transform: scale(1); opacity: 0; } 15% { opacity: .9; } 100% { transform: scale(2.1); opacity: 0; border-radius: 30px; } }
  .live::before { animation: live 1.4s ease-in-out infinite; }
  @keyframes live { 50% { opacity: .25; } }
  .pfeil { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line-2); color: var(--text); transition: transform .5s var(--feder-schnell), background-color .3s ease; }
  .name { display: flex; align-items: center; min-height: 40px; margin-top: 16px; }
  .name img { height: 27px; width: auto; display: block; }
  .name b { font-size: 1.55rem; font-weight: 600; letter-spacing: -.03em; color: var(--text);
    background: linear-gradient(90deg, #C9BEFF, #8E7CFF 45%, #4FD1B5); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
  .text { font-size: .95rem; line-height: 1.45; }
  .info { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; min-width: 0; }
  .info .pill { max-width: 100%; }
  .kurz { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  @media (hover: hover) and (pointer: fine) {
    .karte:hover { transform: translateY(-4px); border-color: rgba(203, 215, 235, .3); box-shadow: 0 40px 80px -40px rgba(0, 0, 0, .95); }
    .karte:hover .licht { transform: translate(-6%, 8%) scale(1.08); }
    .karte:hover .pfeil { transform: translateX(3px); background: rgba(255, 255, 255, .06); }
    .ml:hover .welle { animation: welle 1.6s cubic-bezier(.2, .6, .3, 1) both; }
    .ml:hover .welle.w2 { animation-delay: .3s; }
    .ml:hover .radar { opacity: .85; }
  }
  .karte:active { transform: scale(.975); transition-duration: .1s; }
  .karte:focus-visible { outline: 2px solid var(--text); outline-offset: 4px; border-radius: 26px; }
  .karte.gewaehlt { transform: scale(1.04); border-color: rgba(203, 215, 235, .45); }
  .karte.weg { opacity: 0; transform: scale(.94); filter: blur(4px); }
  .start.geht header, .start.geht footer { opacity: 0; transform: translateY(-8px); transition: opacity .3s ease, transform .4s var(--feder-schnell); }
  footer { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; font-size: .82rem; animation: rein .9s .2s var(--feder) both; }
  @keyframes rein { from { opacity: 0; transform: translateY(16px) scale(.98); } }
  @media (max-width: 720px) {
    .start { align-content: start; gap: 22px; padding-top: calc(54px + env(safe-area-inset-top)); }
    .karten { grid-template-columns: minmax(0, 1fr); max-width: 460px; gap: 14px; }
    .karte { min-height: 0; padding: 18px; border-radius: 22px; gap: 10px; }
    .name { margin-top: 4px; min-height: 34px; }
    .name img { height: 24px; }
    .radar { opacity: .4; }
    footer .muted { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { header, .karte, footer, .sweep, .welle, .live::before, .radar b { animation: none; } .zeichen img { animation: none; clip-path: none; } }
</style>
