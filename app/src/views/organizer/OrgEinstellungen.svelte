<script lang="ts">
  import Icon from "../../components/Icon.svelte";
  import Schalter from "../../components/Schalter.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { modus } from "../../lib/modus.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { lesen as planLesen } from "../../lib/organizer/import";
  import { relativTag, uhr } from "../../lib/organizer/zeit";
  import type { Kalender } from "../../lib/organizer/typen";

  // Planung
  let e = $state({ ...org.einst, fahrt_regeln: (org.einst.fahrt_regeln ?? []).map((r) => ({ ...r })) });
  $effect(() => { e = { ...org.einst, fahrt_regeln: (org.einst.fahrt_regeln ?? []).map((r) => ({ ...r })) }; });
  const geaendert = $derived(JSON.stringify(e) !== JSON.stringify(org.einst));

  let passt = $state(false);

  // Kalender
  let kArt = $state<Kalender["art"]>("ism"), kName = $state(""), kUrl = $state(""), kLaeuft = $state(false);
  const HILFE: Record<Kalender["art"], string[]> = {
    ism: ["Im ISM-Portal den Stundenplan öffnen.", "Nach „Kalender abonnieren“, „iCal“ oder „Export“ suchen und den Link kopieren (beginnt meist mit https:// oder webcal://).", "Gibt es nur einen Download (.ics-Datei)? Dann unten „.ics-Datei einlesen“ nehmen."],
    google: ["Google Kalender am Computer öffnen → Zahnrad → Einstellungen.", "Links unter „Meine Kalender“ den Kalender wählen → „Kalender integrieren“.", "„Geheime Adresse im iCal-Format“ kopieren und hier einfügen. Die Adresse bleibt privat in deinem Konto."],
    sonstige: ["Jeder Kalender mit Abo-Link (iCal, .ics, webcal://) funktioniert: Outlook, Apple iCloud, Moodle …"],
  };
  async function kalenderAnlegen(ev: Event) {
    ev.preventDefault();
    const url = kUrl.trim();
    if (!/^(https|webcal):\/\//i.test(url)) { daten.melden("Der Link muss mit https:// oder webcal:// beginnen.", undefined, true); return; }
    kLaeuft = true;
    const ok = await org.kalenderSpeichern({ name: kName.trim() || (kArt === "ism" ? "ISM-Stundenplan" : kArt === "google" ? "Google Kalender" : "Kalender"), url, art: kArt, farbe: kArt === "ism" ? "#6FA8F0" : kArt === "google" ? "#4CC38A" : "#8B98AD" });
    kLaeuft = false;
    if (ok) { kName = ""; kUrl = ""; }
  }
  async function kalenderWeg(k: Kalender) {
    if (!(await frage(`„${k.name}“ trennen?`, "Die daraus übernommenen Termine werden aus dem Organizer entfernt.", "Trennen", true))) return;
    org.kalenderLoeschen(k);
  }
  let icsLaeuft = $state(false);
  async function icsDatei(ev: Event) {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0]; if (!f) return;
    icsLaeuft = true;
    try { const r = await org.icsImportieren(await f.text()); daten.melden(r.neu ? `${r.neu} Termine übernommen` : `Keine neuen Termine (${r.gelesen} gelesen)`); }
    catch (err: any) { daten.melden("Nicht eingelesen: " + (err?.message ?? err), undefined, true); }
    finally { icsLaeuft = false; (ev.currentTarget as HTMLInputElement).value = ""; }
  }

  // Lernplan
  let planText = $state(""), planLaeuft = $state(false);
  const plan = $derived(planText.trim() ? planLesen(planText) : null);
  async function planUebernehmen() {
    if (!plan || planLaeuft) return;
    planLaeuft = true;
    try {
      const r = await org.lernplanImportieren(plan);
      daten.melden(`Übernommen: ${r.aufgaben} Lernblöcke, ${r.termine} Termine${r.faecher ? `, ${r.faecher} Fächer` : ""}${r.training ? ", Training als Gewohnheit" : ""}`);
      planText = "";
    } catch (err: any) { daten.melden("Nicht übernommen: " + (err?.message ?? err), undefined, true); }
    finally { planLaeuft = false; }
  }
</script>

<div class="kopf"><h1>Einstellungen</h1><p class="muted">Dein Organizer – nur du siehst diese Daten, auch kein Teammitglied.</p></div>

<div class="raster">
  <section class="card blk">
    <h2><Icon name="calendar" size={18} />Kalender verbinden</h2>
    {#if org.kalender.length}
      <ul class="kal">
        {#each org.kalender as k (k.id)}
          <li style="--f: {k.farbe}">
            <i></i>
            <span><b>{k.name}</b><small class:fehler={!!k.fehler}>{k.fehler ? k.fehler : k.zuletzt ? `abgeglichen ${relativTag(k.zuletzt)} ${uhr(k.zuletzt)}` : "wird abgeglichen …"}</small></span>
            <button class="btn btn--quiet btn--icon" aria-label="Jetzt abgleichen" disabled={org.gleichtAb} onclick={() => org.abgleichen(k.id)}><Icon name="refresh" size={16} /></button>
            <button class="btn btn--quiet btn--icon" aria-label="Trennen" onclick={() => kalenderWeg(k)}><Icon name="trash" size={16} /></button>
          </li>
        {/each}
      </ul>
    {/if}
    <form class="f" onsubmit={kalenderAnlegen}>
      <div class="seg">
        <button type="button" class:on={kArt === "ism"} onclick={() => (kArt = "ism")}>ISM-Stundenplan</button>
        <button type="button" class:on={kArt === "google"} onclick={() => (kArt = "google")}>Google Kalender</button>
        <button type="button" class:on={kArt === "sonstige"} onclick={() => (kArt = "sonstige")}>Anderer</button>
      </div>
      <ol class="hilfe">{#each HILFE[kArt] as h}<li>{h}</li>{/each}</ol>
      <input class="input" bind:value={kUrl} placeholder="https://… oder webcal://…" inputmode="url" autocomplete="off" spellcheck="false">
      <div class="zeile2">
        <input class="input" bind:value={kName} placeholder="Name (optional)">
        <button class="btn btn--primary org-primary" type="submit" disabled={!kUrl.trim() || kLaeuft}>{kLaeuft ? "Verbindet …" : "Verbinden"}</button>
      </div>
    </form>
    <label class="datei btn btn--s"><Icon name="upload" size={15} />{icsLaeuft ? "Liest …" : ".ics-Datei einlesen"}<input type="file" accept=".ics,text/calendar" onchange={icsDatei} hidden></label>
    <p class="muted klein">Abos werden beim Öffnen und alle 30 Minuten abgeglichen. Vorlesungen und Klausuren bekommen automatisch die Farbe ihres Fachs, wenn der Name passt. Hinweis: Google wird gelesen, nicht beschrieben – Termine, die du hier anlegst, erscheinen nicht in Google.</p>
  </section>

  <section class="card blk">
    <h2><Icon name="sun" size={18} />Tagesroutine</h2>
    <p class="muted klein">Dein fester Tagesablauf. In die <b>Fokusblöcke</b> plant die App deine Aufgaben – schwere Fächer in den Block mit dem höchsten Niveau. Was mit Uni oder Weg kollidiert, fällt an dem Tag aus.</p>
    {#if org.routine.length}
      <ul class="rt">
        {#each org.routine as r (r.id)}
          <li class:block={r.art === "block"} class:aus={!r.aktiv}>
            <input class="input zeit" type="time" value={r.start} onchange={(ev) => org.routineSpeichern({ ...r, start: (ev.currentTarget as HTMLInputElement).value })} aria-label="Beginn">
            <input class="input min" type="number" min="5" max="600" step="5" value={r.dauer_min} onchange={(ev) => org.routineSpeichern({ ...r, dauer_min: Number((ev.currentTarget as HTMLInputElement).value) || r.dauer_min })} aria-label="Minuten">
            <input class="input name" value={r.titel} onchange={(ev) => org.routineSpeichern({ ...r, titel: (ev.currentTarget as HTMLInputElement).value || r.titel })} aria-label="Titel">
            <select class="input art" value={r.art === "block" ? "b" + (r.niveau ?? 2) : r.art} onchange={(ev) => { const v = (ev.currentTarget as HTMLSelectElement).value; org.routineSpeichern({ ...r, art: v.startsWith("b") ? "block" : (v as any), niveau: v.startsWith("b") ? Number(v.slice(1)) : null }); }} aria-label="Art">
              <option value="b1">Fokusblock · hoch</option><option value="b2">Fokusblock · mittel</option><option value="b3">Fokusblock · niedrig</option><option value="fix">Fester Punkt</option><option value="flex">Flexibel</option>
            </select>
            <span class="tg">{#each ["M", "D", "M", "D", "F", "S", "S"] as t, i}<button class:on={r.tage.includes(i + 1)} aria-label="Tag {i + 1}" onclick={() => org.routineSpeichern({ ...r, tage: r.tage.includes(i + 1) ? r.tage.filter((x) => x !== i + 1) : [...r.tage, i + 1].sort() })}>{t}</button>{/each}</span>
            <button class="btn btn--quiet btn--icon" aria-label="Löschen" onclick={() => org.routineLoeschen(r)}><Icon name="trash" size={15} /></button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="aktion">
      <button class="btn" onclick={() => org.routineSpeichern({ titel: "Neuer Punkt", start: "12:00" })}><Icon name="plus" size={15} />Punkt</button>
      <button class="btn btn--primary org-primary" disabled={!org.routine.some((r) => r.art === "block") || passt} onclick={async () => { passt = true; const n = await org.anRoutineAnpassen(); passt = false; if (n != null) daten.melden(`${n} Lernblöcke in deine Routine eingepasst`); }}><Icon name="wand" size={15} />{passt ? "Passt an …" : "Feste Lernblöcke einpassen"}</button>
    </div>
  </section>

  <section class="card blk">
    <h2><Icon name="note" size={18} />Fächer</h2>
    <p class="muted klein">{org.aktiveFaecher.length} Fächer. Details, Dozenten, Prüfungen und die Verbindung zum Kalender findest du unter <a href="#/o/faecher">Fächer</a>.</p>
    <div class="aktion"><a class="btn" href="#/o/faecher">Fächer öffnen</a><button class="btn" onclick={() => org.zuordnen(false)}><Icon name="refresh" size={15} />Termine und Aufgaben zuordnen</button></div>
  </section>

  <section class="card blk">
    <h2><Icon name="wand" size={18} />Auto-Planung</h2>
    <div class="reihe">
      <label class="field"><span>Arbeitsbeginn</span><input class="input" type="time" bind:value={e.tag_start} step="900"></label>
      <label class="field"><span>Arbeitsende</span><input class="input" type="time" bind:value={e.tag_ende} step="900"></label>
      <label class="field"><span>Puffer zwischen Blöcken (Min.)</span><input class="input" type="number" min="0" max="120" step="5" bind:value={e.puffer_min}></label>
      <label class="field"><span>Weg zur Uni, eine Richtung (Min.)</span><input class="input" type="number" min="0" max="180" step="5" bind:value={e.fahrzeit_min}></label>
      <label class="field"><span>Höchstens pro Tag (Std.)</span><input class="input" type="number" min="1" max="12" step="0.5" value={e.tag_max_min / 60} oninput={(ev) => (e.tag_max_min = Math.round(Number((ev.currentTarget as HTMLInputElement).value) * 60) || 360)}></label>
    </div>
    <div class="field"><span>Weitere Wege (Stichwort in Titel oder Ort → Minuten pro Richtung)</span>
      <div class="regeln">
        {#each e.fahrt_regeln ?? [] as r, i}
          <div class="regel"><input class="input" bind:value={r.muster} placeholder="z. B. Billstedt"><input class="input min" type="number" min="0" max="180" step="5" bind:value={r.min}><button class="btn btn--quiet btn--icon" aria-label="Entfernen" onclick={() => (e.fahrt_regeln = e.fahrt_regeln.filter((_, j) => j !== i))}><Icon name="x" size={15} /></button></div>
        {/each}
        <button class="btn btn--s" onclick={() => (e.fahrt_regeln = [...(e.fahrt_regeln ?? []), { muster: "", min: 30 }])}><Icon name="plus" size={14} />Weg hinzufügen</button>
      </div>
    </div>
    <div class="schalter"><span>Auch am Wochenende planen</span><Schalter an={e.wochenende} label="Wochenende" onchange={(v) => (e.wochenende = v)} /></div>
    <div class="aktion">
      <button class="btn btn--primary org-primary" disabled={!geaendert || e.tag_ende <= e.tag_start} onclick={async () => { if (await org.einstSpeichern(e)) { daten.melden("Gespeichert"); org.planen(undefined, true); } }}>Speichern</button>
    </div>
    <p class="muted klein">Die App verteilt Aufgaben ohne feste Zeit in die Lücken zwischen Terminen und Gewohnheiten – früheste Frist zuerst, mit Puffer und nie mehr als die Tagesgrenze. Feste Zeiten (📌) bleiben, wo sie sind.</p>
  </section>

  <section class="card blk">
    <h2><Icon name="liste" size={18} />Lernplan übernehmen</h2>
    <p class="muted klein">In der Tabelle „Lernplan bis 21.12.2026“ alles markieren (Strg/⌘ + A), kopieren und hier einfügen. Lernblöcke werden zu Aufgaben mit fester Zeit, Vorlesungen und Klausuren zu Terminen, Training zur Gewohnheit.</p>
    <textarea class="input" rows="4" bind:value={planText} placeholder="Hier einfügen …"></textarea>
    {#if plan}
      <div class="vorschau">
        <span><b class="num">{plan.aufgaben.length}</b> Lernblöcke</span><span><b class="num">{plan.termine.length}</b> Termine</span>
        {#if plan.training}<span>Training {plan.training.pro_woche}× / Woche</span>{/if}
        {#if plan.faecher.length}<span>Fächer: {plan.faecher.join(", ")}</span>{/if}
        {#if plan.fehler.length}<span class="fehler">{plan.fehler.length} Zeilen nicht erkannt</span>{/if}
      </div>
      <div class="aktion"><button class="btn btn--primary org-primary" disabled={planLaeuft || !(plan.aufgaben.length + plan.termine.length)} onclick={planUebernehmen}>{planLaeuft ? "Übernimmt …" : "Übernehmen"}</button></div>
    {/if}
  </section>

  <section class="card blk">
    <h2><Icon name="wechsel" size={18} />Bereich</h2>
    <p class="muted klein">Beim Öffnen der App wählst du zwischen Medialyte und dem Organizer. Hier geht es direkt rüber.</p>
    <div class="aktion"><button class="btn" onclick={() => modus.oeffnen("medialyte")}><img src="./mono.svg" alt="" width="16" height="12">Zu Medialyte</button><button class="btn btn--quiet" onclick={() => modus.auswahl()}>Zur Auswahl</button></div>
  </section>
</div>

<style>
  .kopf { display: grid; gap: 4px; margin-bottom: 18px; }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; align-items: start; --bereich: var(--org); }
  .blk { display: grid; gap: 12px; padding: 18px; border-radius: 18px; }
  h2 { display: flex; align-items: center; gap: 9px; font-size: 1.02rem; }
  h2 :global(svg) { color: var(--org); }
  .klein { font-size: .84rem; }
  .f { display: grid; gap: 10px; }
  .seg { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); overflow-x: auto; }
  .seg button { flex: 1 0 auto; height: 34px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); font: inherit; font-size: .86rem; cursor: pointer; white-space: nowrap; }
  .seg button.on { background: var(--org); color: #fff; font-weight: 600; }
  .hilfe { margin: 0; padding-left: 20px; display: grid; gap: 4px; color: var(--text-2); font-size: .86rem; }
  .zeile2 { display: flex; gap: 8px; }
  .zeile2 .input { flex: 1; }
  .kal, .faecher { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .kal li { display: flex; align-items: center; gap: 10px; padding: 8px 6px 8px 12px; border-radius: 12px; background: var(--bg-2); }
  .kal li > i { width: 10px; height: 10px; border-radius: 50%; background: var(--f); flex: none; }
  .kal li > span { flex: 1; display: grid; min-width: 0; line-height: 1.3; }
  .kal b { color: var(--text); font-weight: 500; }
  .kal small { color: var(--steel); font-size: .78rem; overflow: hidden; text-overflow: ellipsis; }
  .fehler { color: #FF8080 !important; }
  .datei { justify-self: start; cursor: pointer; }
  .regeln { display: grid; gap: 6px; justify-items: start; }
  .regel { display: grid; grid-template-columns: minmax(0, 1fr) 80px auto; gap: 6px; width: 100%; }
  .regel .input { min-height: 36px; }
  .rt { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-height: 520px; overflow: auto; }
  .rt li { display: grid; grid-template-columns: 92px 64px minmax(120px, 1fr) 150px auto auto; gap: 6px; align-items: center; padding: 4px; border-radius: 10px; }
  .rt li.block { background: rgba(142, 124, 255, .08); }
  .rt li.aus { opacity: .5; }
  .rt .input { min-height: 34px; padding: 4px 8px; font-size: .86rem; }
  .tg { display: flex; gap: 2px; }
  .tg button { width: 22px; height: 26px; border: 0; border-radius: 6px; background: var(--bg-2); color: var(--steel); font: inherit; font-size: .72rem; cursor: pointer; }
  .tg button.on { background: var(--org); color: #fff; }
  @media (max-width: 700px) {
    .rt { max-height: none; overflow: visible; gap: 10px; }
    .rt li { grid-template-columns: 96px 72px minmax(0, 1fr) 40px; padding: 10px; background: var(--bg-2); }
    .rt li.block { background: rgba(142, 124, 255, .1); }
    .rt .input { min-height: 40px; font-size: 16px; }
    .rt .art { grid-column: 1 / -1; }
    .tg { grid-column: 1 / -1; gap: 4px; }
    .tg button { flex: 1; width: auto; height: 40px; font-size: .8rem; }
    .rt li > .btn--icon { grid-row: 1; grid-column: 4; }
  }
  .faecher li { display: flex; align-items: center; gap: 8px; }
  .faecher .input { min-height: 36px; }
  .farbwahl { position: relative; }
  .farbwahl summary { list-style: none; width: 26px; height: 26px; border-radius: 50%; background: var(--c); cursor: pointer; box-shadow: inset 0 0 0 2px rgba(0, 0, 0, .2); }
  .farbwahl summary::-webkit-details-marker { display: none; }
  .farbwahl div { position: absolute; z-index: 5; top: 32px; left: 0; display: grid; grid-template-columns: repeat(5, 26px); gap: 6px; padding: 10px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line-2); box-shadow: 0 20px 40px -20px #000; }
  .farbwahl div button { width: 26px; height: 26px; border-radius: 50%; border: 0; background: var(--c); cursor: pointer; }
  .reihe { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .schalter { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 12px; background: var(--bg-2); }
  .aktion { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .vorschau { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px 12px; border-radius: 12px; background: var(--bg-2); font-size: .86rem; color: var(--text-2); }
  .vorschau b { color: var(--text); }
  input[type="time"] { color-scheme: dark; }
  @media (max-width: 520px) { .raster { grid-template-columns: minmax(0, 1fr); } .reihe { grid-template-columns: minmax(0, 1fr); } }
</style>
