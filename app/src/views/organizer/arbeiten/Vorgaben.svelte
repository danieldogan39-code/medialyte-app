<script lang="ts">
  // Vorgaben: Aufgabenstellung, Formalia auf einen Blick, Aufbau, vollständige Checkliste der ISM-Regeln
  import Icon from "../../../components/Icon.svelte";
  import { arbeiten } from "../../../lib/arbeiten/arbeiten.svelte";
  import { md, mdZeile } from "../../../lib/lernen/md";
  import type { Arbeit, Regel } from "../../../lib/arbeiten/typen";
  import { sb } from "../../../lib/supabase";
  import { istDesktop } from "../../../lib/appupdate.svelte";

  let { arbeit }: { arbeit: Arbeit } = $props();
  const rw = $derived(arbeiten.regelwerk);
  let bearbeiten = $state(false), text = $state("");
  let filter = $state<"alle" | "offen" | "auto">("alle");
  const GRUPPEN: Regel["gruppe"][] = ["Umfang", "Aufbau", "Layout", "Zitieren", "Quellen", "Sprache", "KI", "Inhalt", "Abgabe"];
  // Handy: Regelgruppen sind zugeklappt (sonst ist die Seite über zwanzig Bildschirme lang), am Computer offen
  const breit = typeof innerWidth === "number" && innerWidth > 700;
  const haken = $derived((arbeit.haken ?? {}) as Record<string, boolean>);
  const regeln = $derived((rw?.regeln ?? []).filter((r) => filter === "alle" || (filter === "auto" ? r.pruefung === "auto" : r.pruefung !== "auto" && !haken[r.id])));
  const erledigt = $derived((rw?.regeln ?? []).filter((r) => r.pruefung !== "auto" && haken[r.id]).length);
  const manuell = $derived((rw?.regeln ?? []).filter((r) => r.pruefung !== "auto").length);
  function umschalten(r: Regel) { arbeiten.speichern({ ...arbeit, haken: { ...haken, [r.id]: !haken[r.id] } } as any); }
  async function vorlage(datei: string) {
    const { data } = await sb.storage.from("organizer").createSignedUrl(`${arbeiten.uid}/arbeiten/${datei}`, 3600, { download: datei.includes("docx") ? datei.split("/").pop() : undefined });
    if (!data?.signedUrl) return;
    if (istDesktop()) { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(data.signedUrl); } else window.open(data.signedUrl, "_blank", "noopener");
  }
  const cm = (n: number) => n.toLocaleString("de-DE");
</script>

{#if !rw}
  <div class="empty"><b>Regelwerk wird geladen …</b></div>
{:else}
  <div class="vg">
    <section class="card blk auf">
      <div class="kz"><h2>Aufgabenstellung</h2><button class="btn btn--s btn--quiet" onclick={() => { text = arbeit.aufgabe ?? ""; bearbeiten = !bearbeiten; }}><Icon name="stift" size={14} />{bearbeiten ? "Abbrechen" : "Bearbeiten"}</button></div>
      {#if bearbeiten}
        <textarea class="input" rows="14" bind:value={text} placeholder="Aufgabenstellung aus Moodle einfügen …"></textarea>
        <button class="btn btn--primary org-primary" onclick={async () => { await arbeiten.speichern({ ...arbeit, aufgabe: text }); bearbeiten = false; }}>Speichern</button>
      {:else if arbeit.aufgabe}<div class="md">{@html md(arbeit.aufgabe)}</div>
      {:else}<p class="muted">Noch keine Aufgabenstellung hinterlegt.</p>{/if}
    </section>

    <section class="card blk">
      <h2>Formalia auf einen Blick</h2>
      <dl class="fa">
        <div><dt>Schrift</dt><dd>{rw.layout.schriften.map((s) => `${s.name} ${s.pt} pt`).join(" oder ")}</dd></div>
        <div><dt>Fußnoten, Beschriftungen</dt><dd>{rw.layout.fussnote_pt} pt, Zeilenabstand {cm(rw.layout.zeilenabstand_fussnote)}</dd></div>
        <div><dt>Zeilenabstand</dt><dd>{cm(rw.layout.zeilenabstand)} · {rw.layout.absatz_nach_pt} pt nach Absätzen{rw.layout.blocksatz ? " · Blocksatz" : ""}{rw.layout.silbentrennung ? " · Silbentrennung" : ""}</dd></div>
        <div><dt>Ränder</dt><dd>oben {cm(rw.layout.raender_cm.oben)} · unten {cm(rw.layout.raender_cm.unten)} · links {cm(rw.layout.raender_cm.links)} · rechts {cm(rw.layout.raender_cm.rechts)} cm</dd></div>
        <div><dt>Seitenzahlen</dt><dd>{rw.layout.seitenzahl}</dd></div>
        <div><dt>Umfang</dt><dd>{arbeit.woerter_ziel ? `${arbeit.woerter_ziel.toLocaleString("de-DE")} Wörter ± ${arbeit.toleranz} % · ` : ""}{rw.umfang.zaehlt}</dd></div>
        <div><dt>Zitieren</dt><dd>{arbeit.zitierweise === "fussnoten" ? "Fußnoten mit Kurzbeleg" : "Kurzbeleg im Text"} · indirekt mit „{rw.zitieren.indirekt_praefix}“{rw.zitieren.direkt_max_anzahl != null || arbeit.max_zitate != null ? ` · höchstens ${arbeit.max_zitate ?? rw.zitieren.direkt_max_anzahl} direkte Zitate` : ""}</dd></div>
        <div><dt>Nicht zitierfähig</dt><dd>{rw.quellen.verboten.map((v) => v.name).join(", ")}</dd></div>
      </dl>
      <div class="vl">
        <button class="btn btn--s" onclick={() => vorlage("vorlage-hausarbeit.docx")}><Icon name="download" size={14} />ISM-Vorlage (Word)</button>
        <button class="btn btn--s" onclick={() => vorlage("formalvorschriften.pdf")}><Icon name="external" size={14} />Formalvorschriften</button>
        <button class="btn btn--s" onclick={() => vorlage("richtlinie.pdf")}><Icon name="external" size={14} />Richtlinie</button>
        <button class="btn btn--s" onclick={() => vorlage("wiar-skript.pdf")}><Icon name="external" size={14} />Skript Wiss. Arbeiten</button>
      </div>
    </section>

    <section class="card blk">
      <h2>Aufbau der Arbeit</h2>
      <ol class="aufbau">
        {#each rw.aufbau as t}<li class:bedingt={t.pflicht !== "immer"}><b>{t.teil}</b>{#if t.pflicht === "bedingt"}<small>{t.bedingung ?? "nur wenn nötig"}</small>{:else if t.pflicht === "nein"}<small>optional</small>{/if}</li>{/each}
      </ol>
    </section>

    <section class="card blk regeln">
      <div class="kz">
        <h2>Alle Regeln <span class="muted">({rw.regeln.length})</span></h2>
        <div class="seg">{#each [["alle", "Alle"], ["offen", `Selbst prüfen (${manuell - erledigt})`], ["auto", "Prüft der Organizer"]] as [k, l]}<button class:an={filter === k} onclick={() => (filter = k as typeof filter)}>{l}</button>{/each}</div>
      </div>
      <p class="muted klein">{erledigt} von {manuell} Regeln, die du selbst prüfen musst, sind abgehakt. Alles mit <Icon name="sparkles" size={12} /> prüft der Organizer automatisch, wenn du unter „Prüfen“ deine Word-Datei hochlädst.</p>
      {#each GRUPPEN as g}
        {@const l = regeln.filter((r) => r.gruppe === g)}
        {#if l.length}
          <details class="gr" open={breit}>
          <summary><h3>{g}</h3><span>{l.filter((r) => r.pruefung !== "auto" && haken[r.id]).length} von {l.filter((r) => r.pruefung !== "auto").length} abgehakt · {l.length} Regeln</span></summary>
          <ul>
            {#each l as r (r.id)}
              <li class:ok={haken[r.id]}>
                {#if r.pruefung === "auto"}<span class="auto" title="Prüft der Organizer automatisch"><Icon name="sparkles" size={13} /></span>
                {:else}<button class="haken" aria-label="Abhaken" onclick={() => umschalten(r)}>{#if haken[r.id]}<Icon name="check" size={13} />{/if}</button>{/if}
                <span><span class="md">{@html mdZeile(r.text)}</span><small>{r.quelle}{r.pruefung === "teil" ? " · teilweise automatisch" : ""}</small></span>
              </li>
            {/each}
          </ul>
          </details>
        {/if}
      {/each}
    </section>
  </div>
{/if}

<style>
  .vg { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
  .auf, .regeln { grid-column: 1 / -1; }
  .blk { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 16px; border-radius: 18px; }
  .kz { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  h2 { margin: 0; font-size: 1rem; }
  .gr summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; min-height: 44px; padding: 4px 2px; cursor: pointer; list-style: none; }
  .gr summary::-webkit-details-marker { display: none; }
  .gr summary h3 { margin: 0; }
  .gr summary span { color: var(--steel); font-size: .76rem; display: inline-flex; align-items: center; gap: 8px; }
  .gr summary span::after { content: ""; width: 7px; height: 7px; border-right: 2px solid var(--steel); border-bottom: 2px solid var(--steel); transform: rotate(45deg); margin-bottom: 3px; transition: transform .25s ease; }
  .gr[open] summary span::after { transform: rotate(225deg); margin-bottom: -3px; }
  .gr { border-top: 1px solid var(--line); }
  h3 { margin: 8px 0 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--steel); }
  .md { color: var(--text-2); line-height: 1.6; }
  .md :global(p) { margin: 0 0 .6em; } .md :global(ul), .md :global(ol) { padding-left: 1.3em; margin: .2em 0 .7em; } .md :global(b) { color: var(--text); }
  textarea.input { font: inherit; line-height: 1.5; resize: vertical; }
  .fa { margin: 0; display: grid; gap: 8px; }
  .fa div { display: grid; grid-template-columns: 150px 1fr; gap: 10px; font-size: .9rem; }
  .fa dt { color: var(--steel); }
  .fa dd { margin: 0; color: var(--text); }
  .vl { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .aufbau { margin: 0; padding-left: 1.4em; display: grid; gap: 4px; font-size: .92rem; }
  .aufbau li::marker { color: var(--warn); font-weight: 700; }
  .aufbau small { display: block; color: var(--steel); font-size: .78rem; }
  .aufbau li { display: list-item; background: none; padding: 5px 0 5px 4px; border-radius: 0; border-bottom: 1px solid var(--line); }
  .aufbau li:last-child { border-bottom: 0; }
  .bedingt b { color: var(--text-2); font-weight: 500; }
  .seg { display: flex; gap: 4px; flex-wrap: wrap; }
  .seg button { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); font: inherit; font-size: .82rem; cursor: pointer; }
  .seg button.an { background: rgba(231, 185, 74, .16); border-color: rgba(231, 185, 74, .5); color: var(--text); }
  .klein { font-size: .84rem; margin: 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
  li { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: 12px; background: var(--bg-2); }
  li > span:last-child { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  li small { color: var(--steel); font-size: .76rem; }
  li.ok .md { color: var(--steel); text-decoration: line-through; }
  .auto { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; flex: none; background: rgba(180, 140, 255, .18); color: #CDB8FF; margin-top: 1px; }
  .haken { width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; border: 1.5px solid var(--line-2); background: transparent; color: #0A1220; display: grid; place-items: center; cursor: pointer; flex: none; }
  li.ok .haken { background: var(--ok); border-color: var(--ok); }
  @media (max-width: 860px) { .vg { grid-template-columns: minmax(0, 1fr); } .fa div { grid-template-columns: 1fr; gap: 0; } }
</style>
