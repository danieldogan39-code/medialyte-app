<script lang="ts">
  // Fokus: ganzer Bildschirm für den laufenden Block – großer Ring mit Restzeit, Pause, Erledigt
  import Icon from "../Icon.svelte";
  import Ring from "./Ring.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { MIN } from "../../lib/organizer/zeit";
  import { fade, scale } from "svelte/transition";
  import type { Aufgabe } from "../../lib/organizer/typen";

  let { a, onclose }: { a: Aufgabe; onclose: () => void } = $props();
  const gesamt = (() => { const g = a.geplant ? Date.parse(a.geplant) + a.dauer_min * MIN - Date.now() : a.dauer_min * MIN; return Math.max(5 * MIN, Math.min(a.dauer_min * MIN, g)); })();
  let uebrig = $state(gesamt), pause = $state(false), letzte = Date.now();
  $effect(() => {
    const t = setInterval(() => { const n = Date.now(); if (!pause) uebrig = Math.max(0, uebrig - (n - letzte)); letzte = n; }, 250);
    return () => clearInterval(t);
  });
  $effect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onclose(); if (e.key === " ") { e.preventDefault(); pause = !pause; } }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  const mm = $derived(Math.floor(uebrig / 60000)), ss = $derived(Math.floor((uebrig % 60000) / 1000));
  const farbe = org.farbe(a.fach_id, "#8E7CFF");
</script>

<div class="fokus" style="--f: {farbe}" transition:fade={{ duration: 220 }} role="dialog" aria-label="Fokus">
  <div class="glut" aria-hidden="true"></div>
  <button class="zu btn btn--quiet btn--icon" aria-label="Fokus beenden" onclick={onclose}><Icon name="x" size={20} /></button>
  <div class="mitte" in:scale={{ start: .92, duration: 420 }}>
    <small>{org.fach(a.fach_id)?.name ?? "Fokus"}</small>
    <h2>{a.titel}</h2>
    <Ring wert={uebrig / gesamt} size={260} dicke={10} farbe={farbe}>
      <span class="zeit num">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>
      <span class="muted">{uebrig === 0 ? "Zeit um" : pause ? "Pause" : "noch"}</span>
    </Ring>
    <div class="knoepfe">
      <button class="btn" onclick={() => (pause = !pause)}><Icon name={pause ? "play" : "pause"} size={16} />{pause ? "Weiter" : "Pause"}</button>
      <button class="btn btn--primary org-primary" onclick={async () => { await org.erledigen(a, true); onclose(); }}><Icon name="check" size={16} />Erledigt</button>
    </div>
  </div>
</div>

<style>
  .fokus { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(6, 11, 20, .96); padding: 24px; }
  .glut { position: absolute; inset: 0; background: radial-gradient(600px circle at 50% 45%, color-mix(in srgb, var(--f) 22%, transparent), transparent 65%); animation: atmen 6s ease-in-out infinite; }
  @keyframes atmen { 50% { opacity: .55; transform: scale(1.06); } }
  .zu { position: absolute; top: calc(14px + env(safe-area-inset-top)); right: 14px; }
  .mitte { position: relative; display: grid; justify-items: center; gap: 18px; text-align: center; max-width: 560px; }
  .mitte small { color: var(--f); font-weight: 600; letter-spacing: .08em; text-transform: uppercase; font-size: .78rem; }
  h2 { font-size: 1.5rem; }
  .zeit { font-size: 3.2rem; font-weight: 600; letter-spacing: -.03em; color: var(--text); line-height: 1; }
  .knoepfe { display: flex; gap: 10px; }
  @media (prefers-reduced-motion: reduce) { .glut { animation: none; } }
</style>
