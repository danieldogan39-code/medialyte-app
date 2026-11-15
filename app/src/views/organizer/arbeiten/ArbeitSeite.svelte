<script lang="ts">
  // Eine Hausarbeit: Überblick (Steckbrief, Schreibplan), Vorgaben, Material, Quellen, Prüfen, KI-Nachweis
  import Icon from "../../../components/Icon.svelte";
  import { arbeiten } from "../../../lib/arbeiten/arbeiten.svelte";
  import { org } from "../../../lib/organizer/org.svelte";
  import { router } from "../../../lib/router.svelte";
  import { frage } from "../../../lib/frage.svelte";
  import { daten } from "../../../lib/daten.svelte";
  import { countdown, tageBis, tagLang, tagKurz, uhr } from "../../../lib/organizer/zeit";
  import type { Arbeit } from "../../../lib/arbeiten/typen";
  import Vorgaben from "./Vorgaben.svelte";
  import Material from "./Material.svelte";
  import Quellen from "./Quellen.svelte";
  import Pruefen from "./Pruefen.svelte";
  import KiNachweis from "./KiNachweis.svelte";

  let { id }: { id: string } = $props();
  const a = $derived(arbeiten.arbeit(id));
  const REITER = [["ueberblick", "Überblick", "sun"], ["vorgaben", "Vorgaben", "liste"], ["material", "Material", "layers"], ["quellen", "Quellen", "note"], ["pruefen", "Prüfen", "check"], ["ki", "KI-Nachweis", "sparkles"]] as const;
  const reiter = $derived(router.teile[3] ?? "ueberblick");
  const STATUS: [Arbeit["status"], string][] = [["idee", "Idee"], ["recherche", "Recherche"], ["schreiben", "Schreiben"], ["korrektur", "Korrektur"], ["abgegeben", "Abgegeben"]];

  // Steckbrief bearbeiten
  let e = $state<Arbeit | null>(null);
  $effect(() => { if (a && (!e || e.id !== a.id)) e = { ...a }; });
  const geaendert = $derived(!!a && !!e && JSON.stringify({ ...e }) !== JSON.stringify({ ...a }));
  const abgabeLokal = $derived(e?.abgabe ? new Date(e.abgabe).toLocaleString("sv-SE").slice(0, 16).replace(" ", "T") : "");
  async function speichern() { if (!e) return; if (await arbeiten.speichern(e)) daten.melden("Gespeichert"); }
  async function loeschen() { if (!a) return; if (!(await frage(`„${a.titel}“ löschen?`, "Material, Quellen, KI-Nachweis und Prüfungen dieser Arbeit werden mit gelöscht.", "Löschen", true))) return; for (const d of arbeiten.von(arbeiten.dateien, a.id)) await arbeiten.dateiLoeschen(d); if (await arbeiten.loeschen(a)) router.geh("/o/arbeiten"); }
  const etappen = $derived(a ? org.aufgaben.filter((x) => x.arbeit_id === a.id).sort((x, y) => (x.frist ?? "").localeCompare(y.frist ?? "")) : []);
  const letzte = $derived(a ? arbeiten.pruefungen.find((p) => p.arbeit_id === a.id) : null);
  let plant = $state(false);
</script>

{#if !a || !e}
  <div class="empty"><b>{arbeiten.geladen ? "Arbeit nicht gefunden" : "Lädt …"}</b><a class="btn" href="#/o/arbeiten">Zur Übersicht</a></div>
{:else}
  {@const n = a.abgabe ? tageBis(a.abgabe) : null}
  <a class="zurueck" href="#/o/arbeiten"><Icon name="left" size={15} />Hausarbeiten</a>
  <header class="ah card" style="--f: {org.farbe(a.fach_id, '#E7B94A')}">
    <div class="ah__t">
      <small>{org.fach(a.fach_id)?.name ?? "Ohne Fach"}{a.abgabe ? ` · Abgabe ${tagLang(a.abgabe)}, ${uhr(a.abgabe)} Uhr` : ""}</small>
      <h1>{a.titel}</h1>
      <div class="status">{#each STATUS as [s, l]}<button class:an={a.status === s} onclick={() => arbeiten.speichern({ ...a, status: s })}>{l}</button>{/each}</div>
    </div>
    {#if n != null}<span class="tage num" class:bald={n <= 7}>{Math.max(0, n)}<small>{countdown(n)}</small></span>{/if}
  </header>

  <nav class="reiter" aria-label="Bereiche der Arbeit">
    {#each REITER as [k, l, ic]}<a href={`#/o/arbeiten/${a.id}${k === "ueberblick" ? "" : "/" + k}`} class:an={reiter === k}><Icon name={ic} size={15} />{l}</a>{/each}
  </nav>

  {#if reiter === "vorgaben"}<Vorgaben arbeit={a} />
  {:else if reiter === "material"}<Material arbeit={a} />
  {:else if reiter === "quellen"}<Quellen arbeit={a} />
  {:else if reiter === "pruefen"}<Pruefen arbeit={a} />
  {:else if reiter === "ki"}<KiNachweis arbeit={a} />
  {:else}
    <div class="ueb">
      <section class="card blk">
        <h2>Steckbrief</h2>
        <label class="f"><span>Titel</span><input class="input" bind:value={e.titel} maxlength="300" /></label>
        <label class="f"><span>Thema</span><textarea class="input" rows="2" bind:value={e.thema} placeholder="Worum geht es?"></textarea></label>
        <label class="f"><span>Forschungsfrage</span><textarea class="input" rows="2" bind:value={e.frage} placeholder="Als Frage formuliert, eng genug für den Umfang"></textarea></label>
        <div class="zeile">
          <label class="f"><span>Abgabe</span><input class="input" type="datetime-local" value={abgabeLokal} onchange={(ev) => { const v = (ev.currentTarget as HTMLInputElement).value; e!.abgabe = v ? new Date(v).toISOString() : null; }} /></label>
          <label class="f"><span>Fach</span><select class="input" bind:value={e.fach_id}><option value={null}>–</option>{#each org.aktiveFaecher as f}<option value={f.id}>{f.name}</option>{/each}</select></label>
        </div>
        <div class="zeile">
          <label class="f"><span>Wörter (Ziel)</span><input class="input num" type="number" min="50" step="50" bind:value={e.woerter_ziel} /></label>
          <label class="f"><span>Toleranz ±%</span><input class="input num" type="number" min="0" max="50" bind:value={e.toleranz} /></label>
          <label class="f"><span>Mind. Quellen</span><input class="input num" type="number" min="0" bind:value={e.min_quellen} /></label>
          <label class="f"><span>Max. direkte Zitate</span><input class="input num" type="number" min="0" bind:value={e.max_zitate} /></label>
        </div>
        <div class="zeile">
          <label class="f"><span>Zitierweise</span><select class="input" bind:value={e.zitierweise}><option value="fussnoten">Fußnoten (ISM)</option><option value="harvard">Im Text (Harvard)</option></select></label>
          <label class="f"><span>Sprache</span><select class="input" bind:value={e.sprache}><option value="de">Deutsch</option><option value="en">Englisch</option></select></label>
        </div>
        <label class="f"><span>Notizen</span><textarea class="input" rows="3" bind:value={e.notiz} placeholder="Absprachen mit dem Dozenten, Ideen …"></textarea></label>
        <div class="akt">
          <button class="btn btn--quiet rot" onclick={loeschen}><Icon name="trash" size={15} />Löschen</button>
          <button class="btn btn--primary org-primary" disabled={!geaendert || !e.titel.trim()} onclick={speichern}>Speichern</button>
        </div>
      </section>

      <div class="rechts">
        <section class="card blk">
          <h2>Stand</h2>
          <div class="kennz">
            <a href={`#/o/arbeiten/${a.id}/pruefen`}><b class="num">{letzte?.woerter?.toLocaleString("de-DE") ?? "–"}</b><small>Wörter{a.woerter_ziel ? ` von ${a.woerter_ziel.toLocaleString("de-DE")}` : ""}</small></a>
            <a href={`#/o/arbeiten/${a.id}/quellen`}><b class="num">{arbeiten.von(arbeiten.quellen, a.id).length}</b><small>Quellen{a.min_quellen ? ` (mind. ${a.min_quellen})` : ""}</small></a>
            <a href={`#/o/arbeiten/${a.id}/pruefen`}><b class="num" class:rot={!!letzte?.fehler} class:gruen={letzte && !letzte.fehler}>{letzte ? letzte.fehler : "–"}</b><small>Fehler bei der letzten Prüfung</small></a>
            <a href={`#/o/arbeiten/${a.id}/ki`}><b class="num">{arbeiten.von(arbeiten.ki, a.id).length}</b><small>KI-Nutzungen dokumentiert</small></a>
          </div>
          {#if letzte}<p class="muted klein">Zuletzt geprüft: {tagKurz(letzte.erstellt)}, {uhr(letzte.erstellt)} · {letzte.datei}</p>{/if}
        </section>

        <section class="card blk">
          <h2>Schreibplan</h2>
          {#if etappen.length}
            <ol class="etappen">
              {#each etappen as t (t.id)}
                <li class:fertig={!!t.erledigt}>
                  <button class="haken" aria-label="Erledigt" onclick={() => org.erledigen(t)}>{#if t.erledigt}<Icon name="check" size={13} />{/if}</button>
                  <span><b>{t.titel.replace(a.titel + ": ", "")}</b><small>{t.frist ? `bis ${tagKurz(t.frist)}` : ""}{t.geplant ? ` · geplant ${tagKurz(t.geplant)}, ${uhr(t.geplant)}` : ""}</small></span>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="muted">Acht Etappen von der Forschungsfrage bis zum Upload – rückwärts vom Abgabetermin geplant und direkt in deinem Kalender.</p>
            <button class="btn btn--primary org-primary" disabled={plant || !a.abgabe} onclick={async () => { plant = true; await arbeiten.schreibplan(a); plant = false; }}><Icon name="calendar" size={15} />{a.abgabe ? "Schreibplan anlegen" : "Erst Abgabe eintragen"}</button>
          {/if}
        </section>
      </div>
    </div>
  {/if}
{/if}

<style>
  .zurueck { display: inline-flex; align-items: center; gap: 6px; color: var(--steel); text-decoration: none; font-size: .88rem; margin-bottom: 10px; }
  .ah { display: flex; justify-content: space-between; gap: 16px; padding: 18px; border-radius: 22px; position: relative; overflow: hidden; background: linear-gradient(150deg, color-mix(in srgb, var(--f) 13%, var(--panel)), var(--panel) 62%); }
  .ah::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--f); }
  .ah__t { display: grid; gap: 6px; min-width: 0; }
  .ah__t small { color: color-mix(in srgb, var(--f) 75%, var(--text-2)); font-weight: 600; font-size: .76rem; text-transform: uppercase; letter-spacing: .04em; }
  h1 { margin: 0; font-size: clamp(1.3rem, 2.6vw, 1.7rem); line-height: 1.2; }
  .status { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .status button { padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); font: inherit; font-size: .8rem; cursor: pointer; }
  .status button.an { background: color-mix(in srgb, var(--f) 22%, transparent); border-color: color-mix(in srgb, var(--f) 60%, transparent); color: var(--text); font-weight: 600; }
  .tage { display: grid; justify-items: center; align-content: center; font-size: 2.2rem; font-weight: 700; color: var(--f); line-height: 1; flex: none; }
  .tage small { font-size: .72rem; font-weight: 600; color: var(--text-2); margin-top: 4px; }
  .tage.bald { color: #F27A6A; }
  .reiter { display: flex; gap: 4px; margin: 14px 0 16px; padding: 4px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
  .reiter a { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 10px; color: var(--text-2); text-decoration: none; font-size: .9rem; font-weight: 500; white-space: nowrap; }
  .reiter a:hover { color: var(--text); background: var(--hover); }
  .reiter a.an { background: rgba(231, 185, 74, .16); color: var(--text); font-weight: 600; }
  .ueb { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 14px; align-items: start; }
  .rechts { display: grid; gap: 14px; }
  .blk { display: grid; gap: 12px; padding: 16px; border-radius: 18px; }
  h2 { margin: 0; font-size: 1rem; }
  .f { display: grid; gap: 4px; flex: 1; min-width: 0; }
  .f span { font-size: .76rem; color: var(--steel); font-weight: 600; }
  .zeile { display: flex; gap: 10px; flex-wrap: wrap; }
  .zeile .f { flex: 1 1 120px; }
  textarea.input { resize: vertical; font: inherit; line-height: 1.45; }
  .akt { display: flex; justify-content: space-between; gap: 8px; }
  .rot { color: #F27A6A; } .gruen { color: var(--ok); }
  .kennz { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .kennz a { display: grid; gap: 2px; padding: 12px; border-radius: 14px; background: var(--bg-2); text-decoration: none; color: inherit; }
  .kennz b { font-size: 1.5rem; font-weight: 700; }
  .kennz small { color: var(--steel); font-size: .76rem; }
  .klein { font-size: .8rem; margin: 0; }
  .etappen { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .etappen li { display: flex; gap: 10px; align-items: flex-start; }
  .etappen span { display: grid; min-width: 0; }
  .etappen b { font-weight: 500; font-size: .9rem; }
  .etappen small { color: var(--steel); font-size: .76rem; }
  .fertig b { text-decoration: line-through; color: var(--steel); }
  .haken { width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; border: 1.5px solid var(--line-2); background: transparent; color: #0A1220; display: grid; place-items: center; cursor: pointer; flex: none; }
  .fertig .haken { background: var(--ok); border-color: var(--ok); }
  @media (max-width: 860px) { .ueb { grid-template-columns: minmax(0, 1fr); } }
</style>
