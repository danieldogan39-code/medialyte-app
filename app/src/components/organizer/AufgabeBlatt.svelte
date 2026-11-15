<script lang="ts">
  import Fenster from "./Fenster.svelte";
  import Icon from "../Icon.svelte";
  import Schalter from "../Schalter.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { plusTage, tagBeginn, tagKey, tagKurz, uhr, wochentag } from "../../lib/organizer/zeit";
  import type { Aufgabe } from "../../lib/organizer/typen";

  let { a = {}, onclose }: { a?: Partial<Aufgabe>; onclose: () => void } = $props();
  let fenster: Fenster | undefined = $state();
  const neu = !a.id || !org.aufgaben.some((x) => x.id === a.id);
  const lokal = (iso: string | null | undefined) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  let titel = $state(a.titel ?? ""), fach = $state<string | null>(a.fach_id ?? null), dauerMin = $state(a.dauer_min ?? 60), frist = $state(a.frist ?? ""),
    prio = $state<1 | 2 | 3>(a.prio ?? 2), fest = $state(a.fixiert ?? false), zeit = $state(lokal(a.geplant)), notiz = $state(a.notiz ?? ""), laeuft = $state(false);
  const DAUERN = [15, 30, 45, 60, 90, 120, 180];
  const heute = tagBeginn(Date.now());
  const FRISTEN = [
    { n: "Heute", d: tagKey(heute) }, { n: "Morgen", d: tagKey(plusTage(heute, 1)) },
    { n: "Freitag", d: tagKey(plusTage(heute, (5 - wochentag(heute) + 7) % 7 || 7)) }, { n: "In einer Woche", d: tagKey(plusTage(heute, 7)) },
  ];

  async function speichern(e?: Event) {
    e?.preventDefault();
    if (!titel.trim() || laeuft) return;
    laeuft = true;
    const geplant = fest && zeit ? new Date(zeit).toISOString() : fest ? a.geplant ?? null : (a.fixiert ? null : a.geplant ?? null);
    const z: any = { ...(neu ? {} : { id: a.id }), titel, fach_id: fach, dauer_min: Math.max(5, Math.min(720, Math.round(dauerMin) || 60)), frist: frist || null, prio, fixiert: fest && !!geplant, geplant, notiz: notiz.trim() || null };
    if (neu && a.id) z.id = a.id;
    const aenderungPlan = !neu && (a.dauer_min !== z.dauer_min || a.frist !== z.frist || a.prio !== z.prio || (a.fixiert && !z.fixiert));
    const r = await org.aufgabeSpeichern(z, true);
    if (r && aenderungPlan && !z.fixiert) await org.planen(new Set([r.id]), true);
    laeuft = false;
    if (r) fenster?.zu();
  }
  async function loeschen() {
    if (!(await frage("Aufgabe löschen?", `„${a.titel}“ wird gelöscht.`, "Löschen", true))) return;
    await org.aufgabeLoeschen(a as Aufgabe); fenster?.zu();
  }
  const aktuell = $derived(a.id ? org.aufgaben.find((x) => x.id === a.id) : null);
</script>

<Fenster bind:this={fenster} titel={neu ? "Neue Aufgabe" : "Aufgabe"} {onclose} farbe={org.farbe(fach, "var(--org)")}>
  <form class="f" onsubmit={speichern}>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input titel" bind:value={titel} placeholder="Was ist zu tun?" autofocus={neu} maxlength="300" required>
    {#if a.lektion}<a class="lek" href={"#/o/lernen/" + (a.lektion.endsWith("/pruefung") ? "pruefung/" + a.lektion.split("/")[0] : a.lektion)} onclick={() => onclose()}><Icon name="buch" size={15} />{a.lektion.endsWith("/pruefung") ? "Prüfungssimulation öffnen" : "Lektion im Lernbereich öffnen"}<Icon name="right" size={14} /></a>{/if}

    <div class="field"><span>Fach / Bereich</span>
      <div class="chips">
        {#each org.aktiveFaecher as f (f.id)}<button type="button" class="chip" class:on={fach === f.id} style="--c: {f.farbe}" onclick={() => (fach = fach === f.id ? null : f.id)}><i></i>{f.name}</button>{/each}
        {#if !org.aktiveFaecher.length}<small class="muted">Fächer legst du unter Einstellungen an.</small>{/if}
      </div>
    </div>

    <div class="field"><span>Dauer</span>
      <div class="chips">
        {#each DAUERN as d}<button type="button" class="chip" class:on={dauerMin === d} onclick={() => (dauerMin = d)}>{d < 60 ? `${d} Min.` : `${d / 60} Std.`.replace(".5", ",5")}</button>{/each}
        <label class="eigen"><input class="input" type="number" min="5" max="720" step="5" bind:value={dauerMin} aria-label="Minuten"><small>Min.</small></label>
      </div>
    </div>

    <div class="field"><span>Bis wann?</span>
      <div class="chips">
        {#each FRISTEN as x}<button type="button" class="chip" class:on={frist === x.d} onclick={() => (frist = frist === x.d ? "" : x.d)}>{x.n}</button>{/each}
        <input class="input datum" type="date" bind:value={frist} aria-label="Frist">
      </div>
    </div>

    <div class="field"><span>Wichtigkeit</span>
      <div class="seg" role="radiogroup" aria-label="Wichtigkeit">
        <button type="button" role="radio" aria-checked={prio === 1} class:on={prio === 1} onclick={() => (prio = 1)}>Hoch</button>
        <button type="button" role="radio" aria-checked={prio === 2} class:on={prio === 2} onclick={() => (prio = 2)}>Normal</button>
        <button type="button" role="radio" aria-checked={prio === 3} class:on={prio === 3} onclick={() => (prio = 3)}>Niedrig</button>
      </div>
    </div>

    <div class="schalter">
      <span>Feste Zeit<small>{fest ? "Bleibt genau hier – die Auto-Planung plant drumherum." : "Die App sucht selbst eine freie Lücke vor der Frist."}</small></span>
      <Schalter an={fest} label="Feste Zeit" onchange={(v) => { fest = v; if (v && !zeit) zeit = lokal(a.geplant ?? new Date(Math.ceil(Date.now() / 9e5) * 9e5).toISOString()); }} />
    </div>
    {#if fest}
      <label class="field"><span>Wann</span><input class="input" type="datetime-local" bind:value={zeit} step="300"></label>
    {:else if aktuell?.geplant && !aktuell.erledigt}
      <div class="hinweis"><Icon name="wand" size={16} /><span>Eingeplant: <b>{tagKurz(aktuell.geplant)}, {uhr(aktuell.geplant)} Uhr</b>. Ändert sich etwas, plant die App neu.</span></div>
    {/if}

    <label class="field"><span>Notiz</span><textarea class="input" bind:value={notiz} rows="3" placeholder="Seiten, Links, Hinweise …"></textarea></label>
    <button type="submit" hidden aria-hidden="true"></button>
  </form>
  {#snippet fuss()}
    {#if !neu}
      <button class="btn btn--quiet btn--gefahr links" type="button" onclick={loeschen}><Icon name="trash" size={16} />Löschen</button>
      {#if aktuell && !aktuell.erledigt && aktuell.dauer_min > 90}<button class="btn btn--quiet" type="button" title="In Teile von 90 Minuten zerlegen und einzeln einplanen" onclick={async () => { if (aktuell) await org.aufteilen(aktuell); fenster?.zu(); }}>Aufteilen</button>{/if}
      <button class="btn" type="button" onclick={async () => { if (aktuell) await org.erledigen(aktuell); fenster?.zu(); }}><Icon name="check" size={16} />{aktuell?.erledigt ? "Wieder öffnen" : "Erledigt"}</button>
    {/if}
    <button class="btn btn--primary org-primary" type="button" disabled={!titel.trim() || laeuft} onclick={() => speichern()}>{neu ? "Anlegen" : "Speichern"}</button>
  {/snippet}
</Fenster>

<style>
  .f { display: grid; gap: 16px; }
  .titel { font-size: 1.05rem; min-height: 48px; }
  .eigen { display: inline-flex; align-items: center; gap: 6px; }
  .eigen .input { width: 82px; min-height: 34px; padding: 4px 10px; }
  .datum { width: auto; min-height: 34px; padding: 4px 10px; color-scheme: dark; }
  .lek { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(180, 140, 255, .1); border: 1px solid rgba(180, 140, 255, .35); color: var(--text); text-decoration: none; font-weight: 600; font-size: .9rem; }
  .lek :global(svg:last-child) { margin-left: auto; color: var(--steel); }
</style>
