<script lang="ts">
  // Eingangsanimation des Organizers – „Dein Tag fügt sich“:
  // 1 Keim: verstreute Zeitblöcke deines Tages (Lernen, Uni, Training, Kirche) treiben unscharf herein.
  // 2 Genese: sie rasten zu einer Tagesspalte ein, die Spalte rollt sich zum Ring des Organizer-Zeichens.
  // 3 Auflösung: der Ring schließt sich, der Haken zeichnet sich, der Punkt landet; „Organizer“ rastet Buchstabe für Buchstabe ein,
  //   darunter dein Tag in einem Satz.
  // 4 Halt, dann öffnet sich die App aus dem Zeichen heraus.
  // Einmal pro App-Start, Tippen überspringt, „Bewegung reduzieren“ lässt sie aus.
  import { org } from "../../lib/organizer/org.svelte";
  import { ruhig } from "../../lib/bewegung";
  import { uhr } from "../../lib/organizer/zeit";

  const KEY = "org-intro";
  let schon = false;
  try { schon = sessionStorage.getItem(KEY) === "1"; } catch { /* egal */ }
  let zeigen = $state(!schon && !ruhig()), laeuft = $state(false), geht = $state(false);

  // Dein Tag in einem Satz (aus den echten Daten, sonst neutral)
  const satz = $derived.by(() => {
    if (!org.geladen) return "Dein Tag, im Plan.";
    const b = org.bloecke(new Date(org.jetzt)).filter((x) => !x.ganztag && x.ende.getTime() > org.jetzt);
    const lernen = b.filter((x) => x.art === "aufgabe" && !x.erledigt).length;
    const training = b.find((x) => x.art === "gewohnheit");
    const termin = b.find((x) => x.art === "termin");
    const teile = [lernen ? `${lernen} ${lernen === 1 ? "Aufgabe" : "Aufgaben"}` : "", training ? `${training.titel} ${uhr(training.start)}` : "", !training && termin ? `${termin.titel} ${uhr(termin.start)}` : ""].filter(Boolean);
    return teile.length ? "Heute: " + teile.join(" · ") : "Heute ist nichts mehr offen.";
  });

  $effect(() => {
    if (!zeigen) return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* egal */ }
    // läuft gerade noch die Medialyte-Eingangsanimation, danach starten
    let t1 = 0, t2 = 0;
    const start = () => { laeuft = true; t1 = window.setTimeout(() => (geht = true), 2700); t2 = window.setTimeout(() => (zeigen = false), 3400); };
    const warte = window.setInterval(() => { if (!document.querySelector(".intro")) { clearInterval(warte); start(); } }, 80);
    return () => { clearInterval(warte); clearTimeout(t1); clearTimeout(t2); };
  });
  function ueberspringen() { if (geht) return; geht = true; setTimeout(() => (zeigen = false), 700); }

  // Zeitblöcke des Keims: Farbe, Startlage (verstreut), Länge
  const BLOECKE = [
    { f: "#B48CFF", x: -150, y: -170, r: -14, w: 112 },   // Lernen
    { f: "#6FA8F0", x: 160, y: -120, r: 11, w: 86 },     // Uni
    { f: "#4CC38A", x: -175, y: 40, r: 9, w: 96 },       // Training
    { f: "#E7B94A", x: 150, y: 120, r: -10, w: 76 },     // Hausarbeit
    { f: "#8B98AD", x: -40, y: 190, r: 6, w: 90 },       // Kirche
  ];
  const BUCHSTABEN = [..."Organizer"];
  // Verlauf der Wortmarke (#C9BEFF → #8E7CFF → #4FD1B5) je Buchstabe, damit jeder Buchstabe einzeln animiert werden kann
  const STOPS = [[201, 190, 255], [142, 124, 255], [79, 209, 181]];
  function farbe(i: number) {
    const t = i / (BUCHSTABEN.length - 1), seg = t < .45 ? 0 : 1, u = seg === 0 ? t / .45 : (t - .45) / .55;
    const [a, b] = [STOPS[seg], STOPS[seg + 1]];
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(",")})`;
  }
</script>

{#if zeigen}
  <div class="oi" class:laeuft class:geht role="presentation" onclick={ueberspringen}>
    <div class="aura" aria-hidden="true"><i></i><i></i></div>
    <div class="buehne" aria-hidden="true">
      <!-- 1+2: Zeitblöcke treiben herein, rasten zur Tagesspalte ein und rollen sich zum Ring -->
      <div class="spalte">
        {#each BLOECKE as b, i}
          <span class="block" style="--f: {b.f}; --x: {b.x}px; --y: {b.y}px; --r: {b.r}deg; --w: {b.w}px; --i: {i}; --sy: {(i - 2) * 19}px"><i></i></span>
        {/each}
      </div>
      <!-- 3: das Zeichen (deckungsgleich mit OrgZeichen) -->
      <svg class="zeichen" viewBox="0 0 48 48" width="112" height="112">
        <defs>
          <linearGradient id="oi-a" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#A897FF"/><stop offset=".55" stop-color="#7C8CFF"/><stop offset="1" stop-color="#4FD1B5"/></linearGradient>
          <linearGradient id="oi-b" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#E9E4FF" stop-opacity=".9"/></linearGradient>
        </defs>
        <g class="kachel"><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#oi-a)"/><rect x="2.5" y="2.5" width="43" height="43" rx="12.5" fill="none" stroke="#fff" stroke-opacity=".22"/></g>
        <circle class="ring" cx="24" cy="24" r="12.5" fill="none" stroke="url(#oi-b)" stroke-width="3.2" stroke-linecap="round" transform="rotate(-210 24 24)"/>
        <path class="haken" d="m18.5 24.5 4 4 8-9" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle class="punkt" cx="35.2" cy="15.2" r="2.6" fill="#fff"/>
      </svg>
      <span class="glut"></span>
    </div>
    <div class="wort" aria-label="Organizer">
      {#each BUCHSTABEN as c, i}<span style="--i: {i}; color: {farbe(i)}">{c}</span>{/each}
    </div>
    <p class="satz">{satz}</p>
  </div>
{/if}

<style>
  .oi { position: fixed; inset: 0; z-index: 990; display: grid; place-items: center; align-content: center; gap: 14px; background: #070D18; overflow: hidden; cursor: pointer;
    --oeffnen: 0%; -webkit-mask: radial-gradient(circle at 50% 44%, transparent var(--oeffnen), #000 calc(var(--oeffnen) + 1px)); mask: radial-gradient(circle at 50% 44%, transparent var(--oeffnen), #000 calc(var(--oeffnen) + 1px)); }
  @property --oeffnen { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
  /* 4: die App öffnet sich aus dem Zeichen heraus (Loch wächst), Inhalt verblasst dabei */
  .oi.geht { animation: oeffnen .7s cubic-bezier(.65, 0, .35, 1) forwards; pointer-events: none; }
  .oi.geht .buehne, .oi.geht .wort, .oi.geht .satz { transition: opacity .35s ease, transform .6s cubic-bezier(.32, .72, 0, 1); opacity: 0; transform: scale(1.08); }
  @keyframes oeffnen { to { --oeffnen: 150%; } }

  .aura i { position: absolute; width: 90vmax; height: 90vmax; border-radius: 50%; left: 50%; top: 44%; margin: -45vmax 0 0 -45vmax; opacity: 0;
    background: radial-gradient(circle, rgba(142, 124, 255, .2), rgba(142, 124, 255, 0) 55%); }
  .aura i + i { background: radial-gradient(circle, rgba(79, 209, 181, .14), rgba(79, 209, 181, 0) 55%); }
  .laeuft .aura i { animation: treiben 3s cubic-bezier(.32, .72, 0, 1) both; }
  .laeuft .aura i + i { animation-name: treiben2; animation-delay: .4s; }
  @keyframes treiben { from { transform: translate(-10%, 10%) scale(.55); opacity: 0; } to { transform: translate(4%, -3%) scale(1); opacity: 1; } }
  @keyframes treiben2 { from { transform: translate(12%, -8%) scale(.55); opacity: 0; } to { transform: translate(-6%, 5%) scale(1); opacity: 1; } }

  .buehne { position: relative; width: 170px; height: 170px; display: grid; place-items: center; }
  .spalte { position: absolute; inset: 0; display: grid; place-items: center; }
  /* Zeitblock: Kärtchen mit Farbkante, wie in deiner Tagesansicht */
  .block { position: absolute; width: var(--w); height: 14px; border-radius: 5px; background: rgba(203, 215, 235, .2); opacity: 0;
    transform: translate(var(--x), var(--y)) rotate(var(--r)); filter: blur(10px); }
  .block i { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 4px 0 0 4px; background: var(--f); box-shadow: 0 0 12px var(--f); }
  .laeuft .block { animation:
      herein .5s cubic-bezier(.16, 1, .3, 1) calc(var(--i) * 60ms) forwards,
      einrasten .55s cubic-bezier(.65, 0, .35, 1) calc(.55s + var(--i) * 40ms) forwards,
      rollen .5s cubic-bezier(.7, 0, .84, 0) 1.25s forwards; }
  @keyframes herein { to { opacity: .9; filter: blur(0); transform: translate(calc(var(--x) * .55), calc(var(--y) * .55)) rotate(calc(var(--r) * .5)); } }
  @keyframes einrasten { from { opacity: .9; filter: blur(0); transform: translate(calc(var(--x) * .55), calc(var(--y) * .55)) rotate(calc(var(--r) * .5)); }
    to { opacity: 1; filter: blur(0); transform: translate(0, var(--sy)) rotate(0); width: 96px; } }
  /* Die Spalte rollt sich zum Ring: alle Blöcke ziehen sich auf den Kreis zusammen und verglühen */
  @keyframes rollen { from { opacity: 1; transform: translate(0, var(--sy)) rotate(0); width: 96px; }
    to { opacity: 0; transform: translate(0, 0) rotate(calc(var(--i) * 72deg)) scale(.3); width: 96px; filter: blur(4px); } }

  .zeichen { position: relative; overflow: visible; filter: drop-shadow(0 14px 30px rgba(124, 140, 255, .45)); }
  .kachel { opacity: 0; transform-origin: 24px 24px; }
  .ring { stroke-dasharray: 0 100; opacity: 0; }
  .haken { stroke-dasharray: 20; stroke-dashoffset: 20; }
  .punkt { opacity: 0; transform-origin: 35.2px 15.2px; }
  .laeuft .ring { animation: ringZeichnen .7s cubic-bezier(.3, .8, .2, 1) 1.45s forwards; }
  .laeuft .kachel { animation: kachel .6s cubic-bezier(.16, 1, .3, 1) 1.55s forwards; }
  .laeuft .haken { animation: haken .4s cubic-bezier(.3, .8, .2, 1) 1.95s forwards; }
  .laeuft .punkt { animation: punkt .45s cubic-bezier(.34, 1.3, .64, 1) 2.15s forwards; }
  @keyframes ringZeichnen { 0% { opacity: 1; stroke-dasharray: 0 100; } 100% { opacity: 1; stroke-dasharray: 62 100; } }
  @keyframes kachel { from { opacity: 0; transform: scale(.7); filter: blur(8px); } to { opacity: 1; transform: none; filter: blur(0); } }
  @keyframes haken { to { stroke-dashoffset: 0; } }
  @keyframes punkt { from { opacity: 0; transform: translate(-6px, 6px) scale(.2); } to { opacity: 1; transform: none; } }
  .glut { position: absolute; width: 260px; height: 260px; border-radius: 50%; z-index: -1; opacity: 0;
    background: radial-gradient(circle closest-side, rgba(142, 124, 255, .5), rgba(79, 209, 181, .12) 60%, transparent); }
  .laeuft .glut { animation: glut 1.4s cubic-bezier(.32, .72, 0, 1) 1.5s forwards; }
  @keyframes glut { from { opacity: 0; transform: scale(.4); } to { opacity: .7; transform: scale(1); } }

  /* Wortmarke: Buchstaben rasten gestaffelt ein, Laufweite zieht sich zusammen */
  .wort { display: flex; font-size: 2.3rem; font-weight: 600; letter-spacing: .3em; margin-right: -.3em; }
  .wort span { display: inline-block; opacity: 0; transform: translateY(14px); filter: blur(10px); }
  .laeuft .wort { animation: laufweite .9s cubic-bezier(.16, 1, .3, 1) 2s forwards; }
  .laeuft .wort span { animation: buchstabe .5s cubic-bezier(.16, 1, .3, 1) calc(2s + var(--i) * 55ms) forwards; }
  @keyframes laufweite { to { letter-spacing: -.03em; margin-right: 0; } }
  @keyframes buchstabe { to { opacity: 1; transform: none; filter: blur(0); } }
  .satz { margin: -6px 0 0; color: var(--steel); font-size: .95rem; opacity: 0; text-align: center; padding: 0 24px; }
  .laeuft .satz { animation: satz .6s ease 2.5s forwards; }
  @keyframes satz { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (max-width: 520px) { .wort { font-size: 2rem; } .buehne { transform: scale(.9); } }
</style>
