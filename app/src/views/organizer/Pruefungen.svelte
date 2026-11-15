<script lang="ts">
  import Icon from "../../components/Icon.svelte";
  import Ring from "../../components/organizer/Ring.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { countdown, dauer, plusTage, tageBis, tagKey, tagLang, uhr } from "../../lib/organizer/zeit";
  import type { Termin } from "../../lib/organizer/typen";

  let offenFuer = $state<string | null>(null), anzahl = $state(6), laenge = $state(90), legtAn = $state(false);
  const vorher = (p: Termin) => {
    // Lernstand für das Fach: offene/erledigte Aufgaben bis zur Prüfung, geplante Lernzeit davor
    if (!p.fach_id) return null;
    const bis = Date.parse(p.start);
    const auf = org.aufgaben.filter((a) => a.fach_id === p.fach_id && (!a.frist || Date.parse(a.frist) <= bis));
    const fertig = auf.filter((a) => a.erledigt), offen = auf.filter((a) => !a.erledigt);
    const geplant = offen.filter((a) => a.geplant && Date.parse(a.geplant) < bis);
    return { alle: auf.length, fertig: fertig.length, minFertig: fertig.reduce((n, a) => n + a.dauer_min, 0), minGeplant: geplant.reduce((n, a) => n + a.dauer_min, 0), ohne: offen.length - geplant.length };
  };
  function vorschlag(p: Termin) { const n = Math.max(1, tageBis(p.start)); anzahl = Math.max(2, Math.min(14, Math.round(n / 2.5))); laenge = 90; offenFuer = offenFuer === p.id ? null : p.id; }
  async function einheitenAnlegen(p: Termin) {
    if (legtAn) return; legtAn = true;
    const fach = org.fach(p.fach_id), name = fach?.name ?? p.titel;
    const frist = tagKey(plusTage(new Date(p.start), -1));
    const ids = new Set<string>();
    for (let i = 1; i <= anzahl; i++) {
      const r = await org.aufgabeSpeichern({ titel: `${name}: Lerneinheit ${i}/${anzahl}${i === anzahl ? " (Probeklausur)" : ""}`, fach_id: p.fach_id, dauer_min: laenge, frist, prio: i === anzahl ? 1 : 2, position: Date.now() / 1e6 + i }, false);
      if (r) ids.add(r.id);
    }
    if (ids.size) { await org.planen(ids, true); daten.melden(`${ids.size} Lerneinheiten für ${name} eingeplant`); }
    legtAn = false; offenFuer = null;
  }
</script>

<div class="kopf">
  <div><h1>Prüfungen</h1><p class="muted">Countdown, Lernstand und Lerneinheiten bis zur Klausur.</p></div>
  <button class="btn btn--primary org-primary" onclick={() => blatt.auf({ art: "termin", t: { art: "klausur" } })}><Icon name="plus" size={16} />Prüfung oder Abgabe</button>
</div>

{#if !org.pruefungen.length}
  <div class="empty"><Icon name="target" size={28} /><b>Keine Prüfungen eingetragen</b><span>Trag deine Klausuren und Abgaben ein – oder verbinde den ISM-Kalender unter Einstellungen.</span></div>
{/if}

<div class="liste">
  {#each org.pruefungen as p (p.id)}
    {@const n = tageBis(p.start)}
    {@const s = vorher(p)}
    {@const f = org.farbe(p.fach_id, p.art === "abgabe" ? "#E7B94A" : "#F24A4A")}
    <article class="pk card" style="--f: {f}" class:bald={n <= 7}>
      <button class="pk__k" onclick={() => blatt.auf({ art: "termin", t: p })}>
        <span class="tage"><b class="num">{n <= 0 ? "0" : n}</b><small>{n === 1 ? "Tag" : "Tage"}</small></span>
        <span class="t">
          <small>{p.art === "abgabe" ? "Abgabe" : "Klausur"} · {countdown(n)}</small>
          <b>{p.titel}</b>
          <span class="muted">{tagLang(p.start)}{p.ganztag ? "" : ` · ${uhr(p.start)} Uhr`}{p.ort ? ` · ${p.ort}` : ""}</span>
        </span>
      </button>
      {#if s}
        <div class="stand">
          <Ring wert={s.alle ? s.fertig / s.alle : 0} size={48} dicke={5} farbe={f}><span class="num">{s.alle ? Math.round((s.fertig / s.alle) * 100) : 0}%</span></Ring>
          <div class="zahlen">
            <span><b class="num">{s.fertig}/{s.alle}</b> Aufgaben erledigt</span>
            <span><b>{dauer(s.minFertig)}</b> gelernt · <b>{dauer(s.minGeplant)}</b> noch geplant</span>
            {#if s.ohne}<span class="warn">{s.ohne} ohne Zeit – <button class="link" onclick={() => org.planen()}>einplanen</button></span>{/if}
          </div>
        </div>
        {#if n > 1}
          <button class="btn btn--s ein" onclick={() => vorschlag(p)}><Icon name="wand" size={14} />Lerneinheiten bis dahin anlegen</button>
          {#if offenFuer === p.id}
            <div class="einheiten">
              <label>Einheiten<input class="input" type="number" min="1" max="30" bind:value={anzahl}></label>
              <label>je Minuten<input class="input" type="number" min="15" max="240" step="15" bind:value={laenge}></label>
              <span class="muted">= {dauer(anzahl * laenge)}, verteilt bis {tagLang(plusTage(new Date(p.start), -1))}. Die letzte ist eine Probeklausur.</span>
              <button class="btn btn--primary org-primary btn--s" disabled={legtAn} onclick={() => einheitenAnlegen(p)}>{legtAn ? "Plant …" : "Anlegen und einplanen"}</button>
            </div>
          {/if}
        {/if}
      {:else}
        <p class="muted klein">Ordne der Prüfung ein Fach zu, dann siehst du hier deinen Lernstand. <button class="link" onclick={() => blatt.auf({ art: "termin", t: p })}>Fach wählen</button></p>
      {/if}
    </article>
  {/each}
</div>

<style>
  .kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
  .pk { display: grid; gap: 14px; padding: 16px; border-radius: 20px; background: linear-gradient(150deg, color-mix(in srgb, var(--f) 10%, var(--panel)), var(--panel) 60%); }
  .pk.bald { border-color: color-mix(in srgb, var(--f) 50%, transparent); }
  .pk__k { display: flex; gap: 14px; align-items: center; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .tage { width: 70px; height: 70px; flex: none; border-radius: 18px; display: grid; place-items: center; align-content: center; background: color-mix(in srgb, var(--f) 18%, transparent); color: var(--f); }
  .tage b { font-size: 1.9rem; line-height: 1; font-weight: 700; }
  .tage small { font-size: .72rem; font-weight: 600; }
  .t { display: grid; gap: 2px; min-width: 0; }
  .t small { color: color-mix(in srgb, var(--f) 70%, var(--text-2)); font-weight: 600; font-size: .76rem; text-transform: uppercase; letter-spacing: .04em; }
  .t b { color: var(--text); font-size: 1.08rem; font-weight: 600; }
  .t .muted { font-size: .84rem; }
  .stand { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 14px; background: var(--bg-2); }
  .zahlen { display: grid; gap: 2px; font-size: .84rem; color: var(--text-2); }
  .zahlen b { color: var(--text); }
  .warn { color: var(--warn); }
  .link { border: 0; background: none; padding: 0; color: var(--org); font: inherit; text-decoration: underline; cursor: pointer; }
  .ein { justify-self: start; }
  .einheiten { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; padding: 12px; border-radius: 14px; border: 1px dashed rgba(142, 124, 255, .4); }
  .einheiten label { display: grid; gap: 4px; font-size: .78rem; color: var(--steel); }
  .einheiten .input { width: 90px; min-height: 36px; }
  .einheiten .muted { flex: 1 1 200px; font-size: .82rem; }
  .klein { font-size: .86rem; }
  .empty :global(svg) { color: #F27A6A; }
  @media (max-width: 520px) { .liste { grid-template-columns: minmax(0, 1fr); } }
</style>
