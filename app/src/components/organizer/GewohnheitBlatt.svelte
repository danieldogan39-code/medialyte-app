<script lang="ts">
  import Fenster from "./Fenster.svelte";
  import Icon from "../Icon.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { frage } from "../../lib/frage.svelte";
  import type { Gewohnheit } from "../../lib/organizer/typen";

  let { g = {}, onclose }: { g?: Partial<Gewohnheit>; onclose: () => void } = $props();
  let fenster: Fenster | undefined = $state();
  const neu = !g.id || !org.gewohnheiten.some((x) => x.id === g.id);
  let name = $state(g.name ?? ""), proWoche = $state(g.pro_woche ?? 3), tage = $state<number[]>([...(g.tage ?? [])]), uhrzeit = $state(g.uhrzeit?.slice(0, 5) ?? ""),
    dauerMin = $state(g.dauer_min ?? 60), icon = $state(g.icon ?? "dumbbell"), farbe = $state(g.farbe ?? "#4CC38A"), laeuft = $state(false),
    zeiten = $state<Record<string, string>>({ ...(g.zeiten ?? {}) }), jeTag = $state(Object.keys(g.zeiten ?? {}).length > 0);
  const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const ICONS = ["dumbbell", "flame", "sun", "note", "star", "users", "phone", "home"];
  const FARBEN = ["#4CC38A", "#8E7CFF", "#6FA8F0", "#E7B94A", "#FB923C", "#F08FC0", "#4FC7D4"];
  const umschalten = (t: number) => { tage = tage.includes(t) ? tage.filter((x) => x !== t) : [...tage, t].sort(); if (tage.length > proWoche) proWoche = tage.length; };

  async function speichern(e?: Event) {
    e?.preventDefault();
    if (!name.trim() || laeuft) return;
    laeuft = true;
    const ok = await org.gewohnheitSpeichern({ ...(neu ? {} : { id: g.id }), name, pro_woche: proWoche, tage, uhrzeit: uhrzeit || null, zeiten: jeTag ? Object.fromEntries(Object.entries(zeiten).filter(([t, z]) => z && tage.includes(+t) && z !== uhrzeit)) : {}, dauer_min: dauerMin, icon, farbe });
    laeuft = false;
    if (ok) fenster?.zu();
  }
  async function loeschen() {
    if (!(await frage("Gewohnheit löschen?", `„${g.name}“ und alle Häkchen werden gelöscht.`, "Löschen", true))) return;
    if (await org.gewohnheitLoeschen(g as Gewohnheit)) fenster?.zu();
  }
</script>

<Fenster bind:this={fenster} titel={neu ? "Neue Gewohnheit" : "Gewohnheit"} {onclose} farbe={farbe}>
  <form class="f" onsubmit={speichern}>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input titel" bind:value={name} placeholder="z. B. Training, Lesen, Laufen" autofocus={neu} maxlength="60" required>
    <div class="field"><span>Wie oft pro Woche?</span>
      <div class="zaehler">
        <button type="button" class="btn btn--icon" aria-label="Weniger" disabled={proWoche <= Math.max(1, tage.length)} onclick={() => proWoche--}>−</button>
        <b class="num">{proWoche}×</b>
        <button type="button" class="btn btn--icon" aria-label="Mehr" disabled={proWoche >= 7} onclick={() => proWoche++}>+</button>
      </div>
    </div>
    <div class="field"><span>Feste Tage (optional)</span>
      <div class="chips">{#each TAGE as t, i}<button type="button" class="chip tag" class:on={tage.includes(i + 1)} onclick={() => umschalten(i + 1)}>{t}</button>{/each}</div>
    </div>
    <div class="reihe">
      <label class="field"><span>Uhrzeit (optional)</span><input class="input" type="time" bind:value={uhrzeit} step="300"></label>
      <label class="field"><span>Dauer (Min.)</span><input class="input" type="number" min="5" max="480" step="5" bind:value={dauerMin}></label>
    </div>
    {#if uhrzeit && tage.length > 1}
      <label class="je"><input type="checkbox" bind:checked={jeTag}>An einzelnen Tagen andere Uhrzeit</label>
      {#if jeTag}
        <div class="zeiten">{#each tage as t (t)}<label><span>{TAGE[t - 1]}</span><input class="input" type="time" step="300" value={zeiten[t] ?? uhrzeit} oninput={(e) => (zeiten[t] = (e.currentTarget as HTMLInputElement).value)}></label>{/each}</div>
      {/if}
    {/if}
    {#if uhrzeit && tage.length}<div class="hinweis"><Icon name="wand" size={16} /><span>Die Auto-Planung hält {tage.map((t) => `${TAGE[t - 1]} ${jeTag && zeiten[t] ? zeiten[t] : uhrzeit}`).join(", ")} Uhr frei. Liegt dann ein Termin oder Weg, rückt die Gewohnheit automatisch dahinter.</span></div>{/if}
    <div class="field"><span>Symbol und Farbe</span>
      <div class="chips">
        {#each ICONS as x}<button type="button" class="chip sym" class:on={icon === x} aria-label={x} onclick={() => (icon = x)}><Icon name={x} size={16} /></button>{/each}
      </div>
      <div class="chips">
        {#each FARBEN as c}<button type="button" class="farbe" class:on={farbe === c} style="--c: {c}" aria-label="Farbe {c}" onclick={() => (farbe = c)}></button>{/each}
      </div>
    </div>
    <button type="submit" hidden aria-hidden="true"></button>
  </form>
  {#snippet fuss()}
    {#if !neu}<button class="btn btn--quiet btn--gefahr links" type="button" onclick={loeschen}><Icon name="trash" size={16} />Löschen</button>{/if}
    <button class="btn btn--primary org-primary" type="button" disabled={!name.trim() || laeuft} onclick={() => speichern()}>{neu ? "Anlegen" : "Speichern"}</button>
  {/snippet}
</Fenster>

<style>
  .f { display: grid; gap: 16px; }
  .titel { font-size: 1.05rem; min-height: 48px; }
  .zaehler { display: inline-flex; align-items: center; gap: 16px; }
  .zaehler b { font-size: 1.4rem; color: var(--text); min-width: 3ch; text-align: center; }
  .zaehler .btn { font-size: 1.2rem; }
  .tag { min-width: 46px; justify-content: center; }
  .sym { width: 40px; padding: 0; justify-content: center; }
  .farbe { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent; background: var(--c); cursor: pointer; box-shadow: inset 0 0 0 3px var(--panel); transition: transform .3s var(--feder-schnell); }
  .farbe.on { border-color: var(--c); }
  .farbe:active { transform: scale(.88); }
  input[type="time"] { color-scheme: dark; }
  .je { display: flex; align-items: center; gap: 8px; font-size: .9rem; color: var(--text-2); }
  .zeiten { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .zeiten label { display: grid; gap: 4px; }
  .zeiten span { font-size: .78rem; color: var(--steel); font-weight: 600; }
</style>
