<script lang="ts">
  // Fächer: alles zu einem Fach an einem Ort – Dozent, Prüfung, nächste Vorlesungen aus dem Kalender, offene Aufgaben, Lernstand.
  import Icon from "../../components/Icon.svelte";
  import Ring from "../../components/organizer/Ring.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { router } from "../../lib/router.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { countdown, dauer, relativTag, tageBis, tagKurz, uhr } from "../../lib/organizer/zeit";
  import { FARBEN, NIVEAU, type Fach } from "../../lib/organizer/typen";

  let { id = "" }: { id?: string } = $props();
  const fach = $derived(id ? org.fach(id) : null);

  const info = (f: Fach) => {
    const j = org.jetzt;
    const termine = org.termine.filter((t) => t.fach_id === f.id);
    const vorlesungen = termine.filter((t) => t.art === "vorlesung" && Date.parse(t.ende) > j).sort((a, b) => a.start.localeCompare(b.start));
    const pruefungen = termine.filter((t) => (t.art === "klausur" || t.art === "abgabe") && Date.parse(t.ende) > j).sort((a, b) => a.start.localeCompare(b.start));
    const auf = org.aufgaben.filter((a) => a.fach_id === f.id), offen = auf.filter((a) => !a.erledigt);
    return { vorlesungen, pruefungen, offen, fertig: auf.length - offen.length, alle: auf.length, minOffen: offen.reduce((n, a) => n + a.dauer_min, 0) };
  };

  // Bearbeiten
  let e = $state<Fach | null>(null);
  $effect(() => { e = fach ? { ...fach } : null; });
  const geaendert = $derived(!!e && !!fach && JSON.stringify(e) !== JSON.stringify(fach));
  async function speichern() { if (!e) return; if (await org.fachSpeichern(e)) { daten.melden("Gespeichert"); await org.zuordnen(true); } }
  let neu = $state("");
  async function anlegen(ev: Event) { ev.preventDefault(); if (!neu.trim()) return; const f = await org.fachSpeichern({ name: neu }); if (f) { neu = ""; await org.zuordnen(true); router.geh("/o/faecher/" + f.id); } }
  async function loeschen(f: Fach) {
    if (!(await frage(`„${f.name}“ löschen?`, "Aufgaben und Termine bleiben, verlieren aber ihre Farbe und Zuordnung.", "Löschen", true))) return;
    if (await org.fachLoeschen(f)) router.geh("/o/faecher");
  }
</script>

{#if fach && e}
  {@const x = info(fach)}
  <div class="kopf" style="--f: {fach.farbe}">
    <div class="titel">
      <a class="zurueck muted" href="#/o/faecher">← Alle Fächer</a>
      <h1><i></i>{fach.name}</h1>
      {#if fach.name_lang && fach.name_lang !== fach.name}<p class="muted">{fach.name_lang}</p>{/if}
    </div>
    <div class="aktionen">
      <button class="btn" onclick={() => blatt.auf({ art: "aufgabe", a: { fach_id: fach.id } })}><Icon name="plus" size={15} />Aufgabe</button>
      <button class="btn btn--primary org-primary" onclick={() => blatt.auf({ art: "termin", t: { art: "klausur", fach_id: fach.id } })}><Icon name="target" size={15} />Prüfung eintragen</button>
    </div>
  </div>

  <div class="detail">
    <section class="card blk" style="--f: {fach.farbe}">
      <div class="stand">
        <Ring wert={x.alle ? x.fertig / x.alle : 0} size={64} dicke={6} farbe={fach.farbe}><span class="num">{x.alle ? Math.round((x.fertig / x.alle) * 100) : 0}%</span></Ring>
        <div><b class="num">{x.fertig} von {x.alle}</b> Aufgaben erledigt<br><span class="muted">{x.offen.length ? `noch ${dauer(x.minOffen)} offen` : "nichts offen"}</span></div>
      </div>
      {#each x.pruefungen as p (p.id)}
        <button class="pr" onclick={() => blatt.auf({ art: "termin", t: p })}><span class="num">{tageBis(p.start)}</span><span><b>{p.art === "abgabe" ? "Abgabe" : "Klausur"} {countdown(tageBis(p.start))}</b><small>{tagKurz(p.start)}{p.ganztag ? "" : `, ${uhr(p.start)} Uhr`}{p.ort ? ` · ${p.ort}` : ""}</small></span></button>
      {:else}<p class="muted klein">Noch keine Prüfung eingetragen.</p>{/each}
    </section>

    <section class="card blk">
      <h2><Icon name="calendar" size={16} />Nächste Vorlesungen</h2>
      {#if x.vorlesungen.length}
        <ul class="vl">{#each x.vorlesungen.slice(0, 6) as v (v.id)}<li><b>{tagKurz(v.start)}</b><span class="num">{uhr(v.start)}–{uhr(v.ende)}</span><span class="muted">{v.ort ?? ""}{org.brauchtFahrt(v) ? " · mit Weg" : ""}</span></li>{/each}</ul>
        {#if x.vorlesungen.length > 6}<p class="muted klein">+ {x.vorlesungen.length - 6} weitere</p>{/if}
      {:else}<p class="muted klein">Keine kommenden Vorlesungen im Kalender. Passt der volle Name unten zum Titel im ISM-Kalender?</p>{/if}
    </section>

    <section class="card blk breit">
      <h2><Icon name="check" size={16} />Offene Aufgaben <span class="muted num">{x.offen.length}</span></h2>
      {#if x.offen.length}
        <ul class="auf">
          {#each x.offen.sort((a, b) => (a.geplant ?? "9").localeCompare(b.geplant ?? "9")).slice(0, 12) as a (a.id)}
            <li style="--f: {fach.farbe}">
              <button class="haken" aria-label="Erledigt" onclick={() => org.erledigen(a)}><Icon name="check" size={14} /></button>
              <button class="t" onclick={() => blatt.auf({ art: "aufgabe", a })}><b>{a.titel}</b><small>{dauer(a.dauer_min)}{a.geplant ? ` · ${relativTag(a.geplant)} ${uhr(a.geplant)}` : " · ohne Zeit"}</small></button>
            </li>
          {/each}
        </ul>
        {#if x.offen.length > 12}<a class="klein" href="#/o/aufgaben">Alle {x.offen.length} in Aufgaben ansehen</a>{/if}
      {:else}<p class="muted klein">Nichts offen.</p>{/if}
    </section>

    <section class="card blk breit">
      <h2><Icon name="stift" size={16} />Details</h2>
      <div class="formular">
        <label class="field"><span>Kurzname</span><input class="input" bind:value={e.name} maxlength="60"></label>
        <label class="field"><span>Name im Kalender (für die Zuordnung)</span><input class="input" bind:value={e.name_lang} placeholder="z. B. Wirtschaftsmathematik"></label>
        <label class="field"><span>Dozent/in</span><input class="input" bind:value={e.dozent}></label>
        <label class="field"><span>Prüfungsform</span><input class="input" bind:value={e.pruefung} placeholder="z. B. Klausur 120 Min."></label>
        <label class="field ganz"><span>Link (Skript, Moodle)</span><input class="input" bind:value={e.link} placeholder="https://…" inputmode="url"></label>
        <label class="field ganz"><span>Notizen</span><textarea class="input" rows="3" bind:value={e.notiz}></textarea></label>
        <div class="field ganz"><span>Wie anspruchsvoll? (bestimmt den Fokusblock)</span>
          <div class="seg">{#each [1, 2, 3] as n}<button class:on={e.niveau === n} onclick={() => (e!.niveau = n)}>{n === 1 ? "Schwer → Block 1" : n === 2 ? "Normal" : "Leicht → Abendblock"}</button>{/each}</div>
        </div>
        <div class="field ganz"><span>Farbe</span><div class="farben">{#each FARBEN as c}<button class="fb" class:on={e.farbe === c} style="--c: {c}" aria-label="Farbe {c}" onclick={() => (e!.farbe = c)}></button>{/each}</div></div>
      </div>
      <div class="fuss">
        {#if fach.link}<a class="btn btn--quiet" href={fach.link} target="_blank" rel="noopener"><Icon name="external" size={15} />Link öffnen</a>{/if}
        <button class="btn btn--quiet gefahr" onclick={() => loeschen(fach)}><Icon name="trash" size={15} />Löschen</button>
        <button class="btn btn--primary org-primary" disabled={!geaendert} onclick={speichern}>Speichern</button>
      </div>
    </section>
  </div>
{:else}
  <div class="kopf">
    <div><h1>Fächer</h1><p class="muted">Jedes Fach verbindet Vorlesungen aus dem Kalender, Prüfungen und Aufgaben.</p></div>
    <div class="aktionen"><a class="btn" href="#/o/pruefungen"><Icon name="target" size={15} />Prüfungen</a><button class="btn" onclick={() => org.zuordnen(false)}><Icon name="refresh" size={15} />Neu zuordnen</button></div>
  </div>
  <div class="liste">
    {#each org.aktiveFaecher as f (f.id)}
      {@const x = info(f)}
      {@const p = x.pruefungen[0]}
      <a class="fk card" href={"#/o/faecher/" + f.id} style="--f: {f.farbe}">
        <span class="streif"></span>
        <span class="fk__k"><Ring wert={x.alle ? x.fertig / x.alle : 0} size={46} dicke={5} farbe={f.farbe}><span class="num">{x.offen.length}</span></Ring>
          <span><b>{f.name}</b><small>{f.dozent ?? f.name_lang ?? ""}</small></span></span>
        <span class="zeilen">
          {#if p}<span class="z rot"><Icon name="target" size={13} />{p.art === "abgabe" ? "Abgabe" : "Klausur"} {countdown(tageBis(p.start))} · {tagKurz(p.start)}</span>{/if}
          {#if x.vorlesungen[0]}<span class="z"><Icon name="calendar" size={13} />Nächste Vorlesung {relativTag(x.vorlesungen[0].start)} {uhr(x.vorlesungen[0].start)}{x.vorlesungen[0].ort ? ` · ${x.vorlesungen[0].ort}` : ""}</span>{/if}
          <span class="z"><Icon name="check" size={13} />{x.offen.length} offen · {dauer(x.minOffen)}{f.niveau === 1 ? " · schwer" : ""}</span>
        </span>
      </a>
    {/each}
    <form class="fk card neu" onsubmit={anlegen}>
      <Icon name="plus" size={18} /><input bind:value={neu} placeholder="Neues Fach oder Bereich" maxlength="60"><button class="btn btn--s" disabled={!neu.trim()}>Anlegen</button>
    </form>
  </div>
{/if}

<style>
  .kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .titel { display: grid; gap: 4px; }
  .zurueck { font-size: .84rem; }
  h1 { display: flex; align-items: center; gap: 10px; }
  h1 i { width: 14px; height: 14px; border-radius: 50%; background: var(--f); box-shadow: 0 0 0 4px color-mix(in srgb, var(--f) 25%, transparent); }
  .aktionen { display: flex; gap: 8px; flex-wrap: wrap; }
  .liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .fk { position: relative; overflow: hidden; display: grid; gap: 12px; padding: 16px 16px 16px 20px; border-radius: 18px; color: inherit; }
  .streif { position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--f); }
  .fk__k { display: flex; align-items: center; gap: 12px; }
  .fk__k > span:last-child { display: grid; line-height: 1.3; }
  .fk__k b { color: var(--text); font-size: 1.05rem; }
  .fk__k small { color: var(--steel); font-size: .8rem; }
  .zeilen { display: grid; gap: 4px; }
  .z { display: flex; align-items: center; gap: 7px; font-size: .84rem; color: var(--text-2); }
  .z :global(svg) { color: var(--f); flex: none; }
  .z.rot { color: #FF9A8F; }
  .neu { display: flex; align-items: center; gap: 10px; border-style: dashed; }
  .neu :global(svg) { color: var(--org); }
  .neu input { flex: 1; min-width: 0; min-height: 38px; border: 0; background: transparent; color: var(--text); outline: none; font-size: .95rem; }
  .detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
  .blk { display: grid; gap: 12px; padding: 16px; border-radius: 18px; }
  .breit { grid-column: 1 / -1; }
  h2 { display: flex; align-items: center; gap: 8px; font-size: 1rem; }
  h2 :global(svg) { color: var(--org); }
  .stand { display: flex; align-items: center; gap: 14px; font-size: .92rem; }
  .stand b { color: var(--text); }
  .pr { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--f) 35%, transparent); background: color-mix(in srgb, var(--f) 10%, transparent); color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .pr > span:first-child { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; font-weight: 700; font-size: 1.2rem; color: var(--f); background: color-mix(in srgb, var(--f) 18%, transparent); }
  .pr > span:last-child { display: grid; }
  .pr b { color: var(--text); font-weight: 500; }
  .pr small { color: var(--steel); }
  .vl, .auf { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .vl li { display: grid; grid-template-columns: 110px 100px 1fr; gap: 8px; font-size: .88rem; padding: 6px 0; border-bottom: 1px solid var(--line); }
  .vl li:last-child { border-bottom: 0; }
  .vl b { color: var(--text); font-weight: 500; }
  .auf li { display: flex; align-items: center; gap: 10px; }
  .auf .t { flex: 1; display: grid; text-align: left; border: 0; background: none; color: inherit; font: inherit; padding: 6px 0; cursor: pointer; }
  .auf .t b { color: var(--text); font-weight: 500; }
  .auf .t small { color: var(--steel); font-size: .8rem; }
  .haken { width: 26px; height: 26px; flex: none; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--f) 70%, var(--line-2)); background: transparent; color: transparent; display: grid; place-items: center; cursor: pointer; }
  @media (hover: hover) and (pointer: fine) { .haken:hover { color: var(--f); } }
  .formular { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .ganz { grid-column: 1 / -1; }
  .seg { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); flex-wrap: wrap; }
  .seg button { flex: 1 0 auto; height: 34px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; color: var(--text-2); font: inherit; font-size: .86rem; cursor: pointer; }
  .seg button.on { background: var(--org); color: #fff; font-weight: 600; }
  .farben { display: flex; gap: 8px; flex-wrap: wrap; }
  .fb { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; background: var(--c); cursor: pointer; box-shadow: inset 0 0 0 3px var(--panel); }
  .fb.on { border-color: var(--c); }
  .fuss { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .gefahr { color: #FF8080; margin-right: auto; }
  .klein { font-size: .86rem; }
  @media (max-width: 760px) { .detail, .formular { grid-template-columns: minmax(0, 1fr); } .vl li { grid-template-columns: 1fr auto; } .vl li .muted { grid-column: 1 / -1; } }
</style>
