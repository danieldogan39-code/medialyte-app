<script lang="ts">
  // Eingangsanimation beim Öffnen der App: Radarwellen, das Medialyte-Zeichen schreibt sich, der Schriftzug steigt auf,
  // dann öffnet sich die App. Einmal am Tag (danach startet die App sofort wie eine native App), Tippen überspringt,
  // „Bewegung reduzieren“ lässt sie aus.
  import { ruhig } from "../lib/bewegung";
  let { bereit = true }: { bereit?: boolean } = $props();
  const KEY = "medialyte-intro";
  const heute = new Date().toISOString().slice(0, 10);
  let schon = false;
  try { schon = sessionStorage.getItem(KEY) === "1" || localStorage.getItem(KEY) === heute; } catch { /* egal */ }
  let zeigen = $state(!schon && !ruhig()), fertig = $state(false), geht = $state(false);
  $effect(() => {
    if (!zeigen) return;
    try { sessionStorage.setItem(KEY, "1"); localStorage.setItem(KEY, heute); } catch { /* egal */ }
    const t = setTimeout(() => (fertig = true), 2400);
    return () => clearTimeout(t);
  });
  $effect(() => { if (fertig && bereit && !geht) { geht = true; setTimeout(() => (zeigen = false), 650); } });
  const ueberspringen = () => { fertig = true; };
</script>

{#if zeigen}
  <div class="intro" class:geht role="presentation" onclick={ueberspringen}>
    <div class="aura" aria-hidden="true"><i></i><i></i></div>
    <div class="buehne" aria-hidden="true">
      <span class="welle"></span><span class="welle w2"></span><span class="welle w3"></span>
      <span class="strahl"></span>
      <span class="glut"></span>
      <img class="zeichen" src="./mono.svg" alt="" width="132" height="99">
    </div>
    <img class="wort" src="./wordmark.svg" alt="Medialyte" width="190" height="37">
    <span class="zeile" aria-hidden="true"><i></i></span>
  </div>
{/if}

<style>
  .intro { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; align-content: center; gap: 26px; background: #070D18; overflow: hidden; cursor: pointer;
    transition: opacity .6s cubic-bezier(.4, 0, .2, 1), transform .6s cubic-bezier(.4, 0, .2, 1); }
  .intro.geht { opacity: 0; transform: scale(1.06); pointer-events: none; }
  .aura i { position: absolute; width: 90vmax; height: 90vmax; border-radius: 50%; left: 50%; top: 50%; margin: -45vmax 0 0 -45vmax; opacity: .9;
    background: radial-gradient(circle, rgba(242, 74, 74, .16), rgba(242, 74, 74, 0) 55%); animation: treiben 4s ease-in-out both; }
  .aura i + i { background: radial-gradient(circle, rgba(111, 168, 240, .16), rgba(111, 168, 240, 0) 55%); animation-name: treiben2; }
  @keyframes treiben { from { transform: translate(-12%, 8%) scale(.6); opacity: 0; } to { transform: translate(6%, -4%) scale(1); } }
  @keyframes treiben2 { from { transform: translate(14%, -10%) scale(.6); opacity: 0; } to { transform: translate(-8%, 6%) scale(1); } }

  .buehne { position: relative; width: 220px; height: 220px; display: grid; place-items: center; }
  .welle { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid rgba(123, 175, 255, .55); opacity: 0;
    animation: welle 1.9s cubic-bezier(.2, .6, .3, 1) .1s both; }
  .welle.w2 { animation-delay: .35s; } .welle.w3 { animation-delay: .6s; }
  @keyframes welle { 0% { transform: scale(.25); opacity: 0; } 15% { opacity: .9; } 100% { transform: scale(1.9); opacity: 0; } }
  .strahl { position: absolute; inset: -30px; border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0 250deg, rgba(123, 175, 255, .25) 330deg, rgba(200, 224, 255, .95) 360deg);
    -webkit-mask: radial-gradient(circle, transparent 0 60%, #000 61% 66%, transparent 67%); mask: radial-gradient(circle, transparent 0 60%, #000 61% 66%, transparent 67%);
    animation: strahl 1.6s cubic-bezier(.45, .05, .25, 1) .2s both; }
  @keyframes strahl { 0% { transform: rotate(-90deg); opacity: 0; } 20% { opacity: 1; } 85% { opacity: .9; } 100% { transform: rotate(270deg); opacity: 0; } }
  .glut { position: absolute; width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 87, 87, .45), rgba(255, 87, 87, 0) 62%);
    animation: glut 2.2s cubic-bezier(.32, .72, 0, 1) .45s both; }
  @keyframes glut { 0% { transform: scale(.3); opacity: 0; } 40% { opacity: 1; } 100% { transform: scale(1); opacity: .55; } }
  /* Das Zeichen schreibt sich von links nach rechts, wie mit der Feder */
  .zeichen { position: relative; width: 132px; height: auto;
    clip-path: inset(0 100% 0 0); animation: schreiben 1.05s cubic-bezier(.65, 0, .35, 1) .35s forwards, schweben 1.2s cubic-bezier(.34, 1.4, .64, 1) .35s both; }
  @keyframes schreiben { to { clip-path: inset(0 0 0 0); } }
  @keyframes schweben { from { transform: translateY(10px) scale(.92); } }
  .wort { width: 190px; height: auto; opacity: 0; animation: steigen .9s cubic-bezier(.32, .72, 0, 1) 1.05s forwards; }
  @keyframes steigen { from { opacity: 0; transform: translateY(14px); letter-spacing: .2em; } to { opacity: 1; transform: none; } }
  .zeile { width: 120px; height: 2px; border-radius: 2px; background: rgba(255, 255, 255, .08); overflow: hidden; opacity: 0; animation: an .4s ease 1.3s forwards; }
  .zeile i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #F24A4A, #7BAFFF); transform-origin: left; transform: scaleX(0); animation: laden 1.3s cubic-bezier(.65, 0, .35, 1) 1.3s forwards; }
  @keyframes laden { to { transform: scaleX(1); } }
  @keyframes an { to { opacity: 1; } }
</style>
