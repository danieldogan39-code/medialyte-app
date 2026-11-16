<script lang="ts">
  // Eingangsanimation von Medialyte – „Der Agent findet“:
  // 1 Keim: ein dunkles Feld voller Betriebe (Punkte), ein Radarstrahl fährt einmal herum.
  // 2 Genese: wo der Strahl vorbeikommt, leuchten Treffer rot auf; alle Treffer ziehen zur Mitte zusammen.
  // 3 Auflösung: aus ihnen entsteht die Markenkachel, das Monogramm schreibt sich, „medialyte“ steigt auf,
  //   darunter der Stand in einem Satz (neue Anfragen, heute nachfassen, Agent läuft).
  // 4 Halt, dann öffnet sich die App aus der Kachel heraus.
  // Einmal pro App-Start, Tippen überspringt, „Bewegung reduzieren“ lässt sie aus.
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { ruhig } from "../lib/bewegung";

  const KEY = "ml-intro";
  let schon = false;
  try { schon = sessionStorage.getItem(KEY) === "1"; } catch { /* egal */ }
  let zeigen = $state(!schon && !ruhig()), laeuft = $state(false), geht = $state(false);

  const satz = $derived.by(() => {
    const a = auth.darf("anfragen") ? daten.neueAnfragen : 0, n = auth.darf("akquise") ? daten.nachfassHeute : 0;
    const t = [a ? `${a} ${a === 1 ? "neue Anfrage" : "neue Anfragen"}` : "", n ? `${n} heute nachfassen` : "", Object.keys(daten.laufend ?? {}).length ? "Agent sucht gerade" : ""].filter(Boolean);
    return t.length ? "Heute: " + t.join(" · ") : "Alles ruhig – Zeit für Neues.";
  });

  $effect(() => {
    if (!zeigen) return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* egal */ }
    let t1 = 0, t2 = 0;
    const start = () => { laeuft = true; t1 = window.setTimeout(() => (geht = true), 2900); t2 = window.setTimeout(() => (zeigen = false), 3600); };
    // läuft gerade noch die allgemeine Eingangsanimation, danach starten
    const warte = window.setInterval(() => { if (!document.querySelector(".intro")) { clearInterval(warte); start(); } }, 80);
    return () => { clearInterval(warte); clearTimeout(t1); clearTimeout(t2); };
  });
  function ueberspringen() { if (geht) return; geht = true; setTimeout(() => (zeigen = false), 700); }

  // Betriebe im Feld: Lage (px um die Mitte), Treffer ja/nein; Aufleuchten, wenn der Strahl (Start oben, im Uhrzeigersinn) vorbeikommt
  const ROH: [number, number, boolean][] = [[-120, -96, true], [70, -130, false], [138, -40, true], [112, 92, true], [-30, 140, false], [-142, 58, true], [30, -64, false], [-76, -18, false], [62, 40, true], [-150, -150, false], [160, 150, false], [10, -168, true]];
  const PUNKTE = ROH.map(([x, y, treffer]) => {
    const winkel = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
    return { x, y, treffer, d: 0.25 + (winkel / 360) * 0.95 };
  });
</script>

{#if zeigen}
  <div class="mi" class:laeuft class:geht role="presentation" onclick={ueberspringen}>
    <div class="aura" aria-hidden="true"><i></i><i></i></div>
    <div class="buehne" aria-hidden="true">
      <span class="feld"></span>
      <span class="strahl"></span>
      {#each PUNKTE as p}
        <span class="punkt" class:treffer={p.treffer} style="--x: {p.x}px; --y: {p.y}px; --d: {p.d}s"></span>
      {/each}
      <span class="glut"></span>
      <span class="kachel"><span class="welle"></span><img src="./mono.svg" alt="" width="70" height="53"></span>
    </div>
    <img class="wort" src="./wordmark.svg" alt="Medialyte" width="196" height="38">
    <p class="satz">{satz}</p>
  </div>
{/if}

<style>
  .mi { position: fixed; inset: 0; z-index: 990; display: grid; place-items: center; align-content: center; gap: 18px; background: #070D18; overflow: hidden; cursor: pointer;
    -webkit-mask: radial-gradient(circle at 50% 43%, transparent var(--auf), #000 calc(var(--auf) + 1px)); mask: radial-gradient(circle at 50% 43%, transparent var(--auf), #000 calc(var(--auf) + 1px)); }
  @property --auf { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
  .mi.geht { animation: auf .7s cubic-bezier(.65, 0, .35, 1) forwards; pointer-events: none; }
  .mi.geht .buehne, .mi.geht .wort, .mi.geht .satz { transition: opacity .35s ease, transform .6s cubic-bezier(.32, .72, 0, 1); opacity: 0; transform: scale(1.08); }
  @keyframes auf { to { --auf: 150%; } }

  .aura i { position: absolute; width: 90vmax; height: 90vmax; border-radius: 50%; left: 50%; top: 43%; margin: -45vmax 0 0 -45vmax; opacity: 0;
    background: radial-gradient(circle, rgba(242, 74, 74, .17), rgba(242, 74, 74, 0) 55%); }
  .aura i + i { background: radial-gradient(circle, rgba(111, 168, 240, .14), rgba(111, 168, 240, 0) 55%); }
  .laeuft .aura i { animation: treiben 3s cubic-bezier(.32, .72, 0, 1) both; }
  .laeuft .aura i + i { animation-name: treiben2; animation-delay: .3s; }
  @keyframes treiben { from { transform: translate(-10%, 10%) scale(.55); opacity: 0; } to { transform: translate(4%, -3%) scale(1); opacity: 1; } }
  @keyframes treiben2 { from { transform: translate(12%, -8%) scale(.55); opacity: 0; } to { transform: translate(-6%, 5%) scale(1); opacity: 1; } }

  .buehne { position: relative; width: 170px; height: 170px; display: grid; place-items: center; }
  /* Feld: feine Radarringe */
  .feld { position: absolute; width: 380px; height: 380px; border-radius: 50%; opacity: 0;
    background: repeating-radial-gradient(circle, transparent 0 46px, rgba(123, 175, 255, .14) 47px 48px);
    -webkit-mask: radial-gradient(circle, #000 0 50%, transparent 72%); mask: radial-gradient(circle, #000 0 50%, transparent 72%); }
  .laeuft .feld { animation: feld 2s cubic-bezier(.32, .72, 0, 1) forwards; }
  @keyframes feld { 0% { opacity: 0; transform: scale(.85); } 30% { opacity: 1; } 70% { opacity: .8; } 100% { opacity: .25; transform: scale(1); } }
  /* Strahl: eine Umdrehung */
  .strahl { position: absolute; width: 380px; height: 380px; border-radius: 50%; opacity: 0;
    background: conic-gradient(from 0deg, transparent 0 280deg, rgba(255, 107, 107, .12) 330deg, rgba(255, 150, 140, .55) 359deg, transparent 360deg);
    -webkit-mask: radial-gradient(circle, #000 0 52%, transparent 70%); mask: radial-gradient(circle, #000 0 52%, transparent 70%); }
  .laeuft .strahl { animation: strahl 1.05s cubic-bezier(.45, .05, .55, .95) .2s forwards; }
  @keyframes strahl { 0% { opacity: 0; transform: rotate(-20deg); } 12% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: rotate(345deg); } }
  /* Betriebe: erst graue Punkte; Treffer leuchten rot auf und ziehen zur Mitte, die anderen verblassen */
  .punkt { position: absolute; width: 6px; height: 6px; margin: -3px; left: 50%; top: 50%; border-radius: 50%; background: rgba(203, 215, 235, .4); opacity: 0;
    transform: translate(var(--x), var(--y)); }
  .laeuft .punkt { animation: da .5s ease .05s forwards, aus .5s ease 1.25s forwards; }
  .laeuft .punkt.treffer { animation: da .5s ease .05s forwards, treffer .35s cubic-bezier(.16, 1, .3, 1) var(--d) forwards, sammeln .45s cubic-bezier(.7, 0, .84, 0) 1.3s forwards; }
  @keyframes da { to { opacity: 1; } }
  @keyframes aus { to { opacity: 0; transform: translate(var(--x), var(--y)) scale(.5); } }
  @keyframes treffer { from { opacity: 1; } to { opacity: 1; background: #FF6B6B; width: 9px; height: 9px; margin: -4.5px; box-shadow: 0 0 14px 3px rgba(255, 107, 107, .65); } }
  @keyframes sammeln { from { opacity: 1; background: #FF6B6B; width: 9px; height: 9px; margin: -4.5px; box-shadow: 0 0 14px 3px rgba(255, 107, 107, .65); transform: translate(var(--x), var(--y)); }
    to { opacity: 0; background: #FF6B6B; width: 9px; height: 9px; margin: -4.5px; box-shadow: 0 0 22px 6px rgba(255, 107, 107, .8); transform: translate(0, 0) scale(.6); } }

  .glut { position: absolute; width: 260px; height: 260px; border-radius: 50%; opacity: 0;
    background: radial-gradient(circle closest-side, rgba(255, 87, 87, .5), rgba(111, 168, 240, .1) 60%, transparent); }
  .laeuft .glut { animation: glut 1.4s cubic-bezier(.32, .72, 0, 1) 1.6s forwards; }
  @keyframes glut { from { opacity: 0; transform: scale(.4); } to { opacity: .65; transform: scale(1); } }
  /* Markenkachel wie in der Auswahl; das Monogramm schreibt sich darin */
  .kachel { position: relative; width: 112px; height: 112px; border-radius: 31px; display: grid; place-items: center; opacity: 0;
    background: linear-gradient(150deg, #FF8A7A, #F24A4A 48%, #B42343); box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, .22), 0 18px 40px rgba(242, 74, 74, .45); }
  .kachel img { width: 70px; height: auto; filter: brightness(0) invert(1); clip-path: inset(0 100% 0 0); }
  .laeuft .kachel { animation: kachel .6s cubic-bezier(.16, 1, .3, 1) 1.65s forwards; }
  .laeuft .kachel img { animation: schreiben .9s cubic-bezier(.65, 0, .35, 1) 1.95s forwards; }
  @keyframes kachel { from { opacity: 0; transform: scale(.55); filter: blur(10px); } to { opacity: 1; transform: none; filter: blur(0); } }
  @keyframes schreiben { to { clip-path: inset(0 0 0 0); } }
  .welle { position: absolute; inset: 0; border-radius: 31px; border: 2px solid rgba(255, 120, 120, .7); opacity: 0; }
  .laeuft .welle { animation: welle 1.2s cubic-bezier(.2, .6, .3, 1) 2.6s both; }
  @keyframes welle { 0% { opacity: 0; transform: scale(1); } 15% { opacity: .9; } 100% { opacity: 0; transform: scale(1.8); border-radius: 60px; } }

  .wort { width: 196px; height: auto; opacity: 0; margin-top: 4px; }
  .laeuft .wort { animation: steigen .9s cubic-bezier(.16, 1, .3, 1) 2.35s forwards; }
  @keyframes steigen { from { opacity: 0; transform: translateY(14px); filter: blur(8px); } to { opacity: 1; transform: none; filter: blur(0); } }
  .satz { margin: -4px 0 0; color: var(--steel); font-size: .95rem; opacity: 0; text-align: center; padding: 0 24px; }
  .laeuft .satz { animation: satz .6s ease 2.6s forwards; }
  @keyframes satz { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (max-width: 520px) { .buehne { transform: scale(.9); } .wort { width: 176px; } }
</style>
