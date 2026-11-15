<script lang="ts">
  // Quellen: erfassen (auch per DOI/ISBN), prüfen (zitierfähig? vollständig?), Literaturverzeichnis und Kurzbelege im ISM-Format
  import Icon from "../../../components/Icon.svelte";
  import { arbeiten } from "../../../lib/arbeiten/arbeiten.svelte";
  import { daten } from "../../../lib/daten.svelte";
  import { frage } from "../../../lib/frage.svelte";
  import { kurzbeleg, lvEintrag, sortiert, warnungen } from "../../../lib/arbeiten/zitieren";
  import type { Arbeit, Quelle, QuellenTyp } from "../../../lib/arbeiten/typen";

  let { arbeit }: { arbeit: Arbeit } = $props();
  const rw = $derived(arbeiten.regelwerk);
  const liste = $derived(sortiert(arbeiten.von(arbeiten.quellen, arbeit.id), rw));
  const TYPEN: [QuellenTyp, string][] = [["buch", "Buch (Monografie)"], ["sammelwerk", "Beitrag im Sammelwerk"], ["zeitschrift", "Zeitschriftenaufsatz"], ["internet", "Internetquelle"], ["statistik", "Statistik / Daten"], ["gesetz", "Gesetz / Verordnung"], ["sonstiges", "Sonstiges"]];
  const FELDER: Record<QuellenTyp, string[]> = {
    buch: ["autoren", "jahr", "titel", "untertitel", "auflage", "ort", "verlag"],
    sammelwerk: ["autoren", "jahr", "titel", "hrsg", "sammelwerk", "auflage", "ort", "verlag", "seiten"],
    zeitschrift: ["autoren", "jahr", "titel", "zeitschrift", "jahrgang", "heft", "seiten", "doi"],
    internet: ["autoren", "jahr", "titel", "url", "abruf"],
    statistik: ["autoren", "jahr", "titel", "ort", "verlag", "url", "abruf"],
    gesetz: ["titel", "jahr", "url", "abruf"],
    sonstiges: ["autoren", "jahr", "titel", "ort", "verlag", "url", "abruf"],
  };
  const NAME: Record<string, string> = { autoren: "Autoren (Nachname, Vorname – eine Person pro Zeile)", hrsg: "Herausgeber (eine Person pro Zeile)", jahr: "Jahr", titel: "Titel", untertitel: "Untertitel", auflage: "Auflage", ort: "Verlagsort", verlag: "Verlag", sammelwerk: "Titel des Sammelwerks", zeitschrift: "Zeitschrift", jahrgang: "Jahrgang/Band", heft: "Heft/Nr.", seiten: "Seiten (von–bis)", url: "URL", abruf: "Abgerufen am", doi: "DOI" };

  let e = $state<Quelle | null>(null), suche = $state(""), sucht = $state(false);
  const leer = (): Quelle => ({ id: "", arbeit_id: arbeit.id, typ: "buch", datei_id: null, notiz: null, erstellt: "", daten: {} });
  const zeilen = (l?: string[]) => (l ?? []).join("\n");
  async function speichern() {
    if (!e) return;
    const z = { ...e, id: e.id || undefined } as any;
    if (await arbeiten.quelleSpeichern(z)) { e = null; daten.melden("Quelle gespeichert"); }
  }
  async function weg(q: Quelle) { if (await frage("Quelle löschen?", lvEintrag(q, rw), "Löschen", true)) await arbeiten.quelleLoeschen(q); }

  // DOI (Crossref) oder ISBN (Open Library) automatisch ausfüllen
  async function nachschlagen() {
    const s = suche.trim(); if (!s) return; sucht = true;
    try {
      const doi = s.match(/10\.\d{4,9}\/\S+/)?.[0];
      const isbn = s.replace(/[^0-9Xx]/g, "");
      if (doi) {
        const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`).then((x) => (x.ok ? x.json() : null));
        const m = r?.message; if (!m) throw new Error("DOI nicht gefunden");
        const typ: QuellenTyp = m.type === "journal-article" ? "zeitschrift" : m.type === "book-chapter" ? "sammelwerk" : m.type?.startsWith("book") ? "buch" : "sonstiges";
        e = { ...leer(), typ, daten: {
          autoren: (m.author ?? []).map((a: any) => [a.family, a.given].filter(Boolean).join(", ")), hrsg: (m.editor ?? []).map((a: any) => [a.family, a.given].filter(Boolean).join(", ")),
          jahr: String(m.issued?.["date-parts"]?.[0]?.[0] ?? ""), titel: m.title?.[0], untertitel: m.subtitle?.[0], zeitschrift: typ === "zeitschrift" ? m["container-title"]?.[0] : undefined,
          sammelwerk: typ === "sammelwerk" ? m["container-title"]?.[0] : undefined, jahrgang: m.volume, heft: m.issue, seiten: m.page?.replace("-", "–"), verlag: typ !== "zeitschrift" ? m.publisher : undefined, doi } };
      } else if (isbn.length === 10 || isbn.length === 13) {
        const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`).then((x) => x.json());
        const b = r?.[`ISBN:${isbn}`]; if (!b) throw new Error("ISBN nicht gefunden");
        e = { ...leer(), typ: "buch", daten: { autoren: (b.authors ?? []).map((a: any) => { const t = String(a.name).trim().split(" "); return t.length > 1 ? `${t.pop()}, ${t.join(" ")}` : a.name; }),
          jahr: String(b.publish_date ?? "").match(/\d{4}/)?.[0], titel: b.title, untertitel: b.subtitle, ort: b.publish_places?.[0]?.name, verlag: b.publishers?.[0]?.name } };
      } else throw new Error("Bitte eine DOI (10.…) oder ISBN eingeben");
      suche = ""; daten.melden("Gefunden – bitte kurz prüfen und speichern");
    } catch (err: any) { daten.melden(String(err?.message ?? err), undefined, true); }
    sucht = false;
  }
  async function kopieren(text: string, was: string) { try { await navigator.clipboard.writeText(text); daten.melden(`${was} kopiert`); } catch { daten.melden("Kopieren nicht möglich", undefined, true); } }
  let seite = $state<Record<string, string>>({}), direkt = $state<Record<string, boolean>>({});
  const min = $derived(arbeit.min_quellen ?? (rw?.quellen.min_je_1000_woerter && arbeit.woerter_ziel ? Math.round((rw.quellen.min_je_1000_woerter * arbeit.woerter_ziel) / 1000) : null));
</script>

<div class="qk">
  <div class="zaehler card"><b class="num">{liste.length}</b><span>Quellen{min != null ? ` · Richtwert ${min}` : ""}</span>{#if min != null}<i class="bar"><i style="width:{Math.min(100, (liste.length / Math.max(1, min)) * 100)}%"></i></i>{/if}</div>
  <form class="such card" onsubmit={(ev) => { ev.preventDefault(); nachschlagen(); }}>
    <input class="input" placeholder="DOI oder ISBN einfügen → automatisch ausfüllen" bind:value={suche} />
    <button class="btn" disabled={sucht || !suche.trim()}>{sucht ? "Sucht …" : "Ausfüllen"}</button>
  </form>
  <button class="btn btn--primary org-primary" onclick={() => (e = leer())}><Icon name="plus" size={15} />Quelle von Hand</button>
  {#if liste.length}<button class="btn" onclick={() => kopieren(liste.map((q) => lvEintrag(q, rw)).join("\n"), "Literaturverzeichnis")}><Icon name="copy" size={15} />Literaturverzeichnis kopieren</button>{/if}
</div>

{#if e}
  <section class="form card">
    <div class="ft"><b>{e.id ? "Quelle bearbeiten" : "Neue Quelle"}</b><button class="btn btn--quiet btn--icon" aria-label="Schließen" onclick={() => (e = null)}><Icon name="x" size={16} /></button></div>
    <div class="typen">{#each TYPEN as [t, l]}<button class:an={e.typ === t} onclick={() => (e!.typ = t)}>{l}</button>{/each}</div>
    <div class="felder">
      {#each FELDER[e.typ] as f}
        <label class:breit={f === "autoren" || f === "hrsg" || f === "titel" || f === "url"}>
          <span>{NAME[f]}</span>
          {#if f === "autoren" || f === "hrsg"}
            <textarea class="input" rows="2" value={zeilen((e.daten as any)[f])} oninput={(ev) => ((e!.daten as any)[f] = (ev.currentTarget as HTMLTextAreaElement).value.split("\n").map((x) => x.trim()).filter(Boolean))}></textarea>
          {:else if f === "abruf"}
            <input class="input" type="date" bind:value={(e.daten as any)[f]} />
          {:else}
            <input class="input" bind:value={(e.daten as any)[f]} />
          {/if}
        </label>
      {/each}
      <label class="breit"><span>Notiz (Kernaussagen, wo im Text verwendet)</span><textarea class="input" rows="2" bind:value={e.notiz}></textarea></label>
    </div>
    <div class="vorschau"><small>So steht sie im Literaturverzeichnis</small><p>{lvEintrag(e, rw)}</p>
      {#each warnungen(e, rw) as w}<span class="warn"><Icon name="x" size={13} />{w}</span>{/each}
    </div>
    <div class="fa"><button class="btn" onclick={() => (e = null)}>Abbrechen</button><button class="btn btn--primary org-primary" disabled={!e.daten.titel?.trim()} onclick={speichern}>Speichern</button></div>
  </section>
{/if}

{#if liste.length}
  <ol class="lv">
    {#each liste as q (q.id)}
      {@const w = warnungen(q, rw)}
      <li class="card" class:schlecht={w.some((x) => /:/.test(x))}>
        <div class="lv-k">
          <span class="typ">{TYPEN.find((t) => t[0] === q.typ)?.[1]}</span>
          <p>{lvEintrag(q, rw)}</p>
          {#if w.length}<div class="warns">{#each w as x}<span class="warn"><Icon name="x" size={12} />{x}</span>{/each}</div>{/if}
          {#if q.notiz}<p class="notiz">{q.notiz}</p>{/if}
        </div>
        <div class="kb">
          <span class="kb-l">Fußnote:</span>
          <code>{kurzbeleg(q, rw, seite[q.id] ?? "", !!direkt[q.id])}</code>
          <input class="input s" placeholder="Seite" bind:value={seite[q.id]} />
          <label class="dk"><input type="checkbox" bind:checked={direkt[q.id]} />wörtlich</label>
          <button class="btn btn--s btn--quiet" onclick={() => kopieren(kurzbeleg(q, rw, seite[q.id] ?? "", !!direkt[q.id]), "Fußnote")}><Icon name="copy" size={13} /></button>
          <button class="btn btn--s btn--quiet" onclick={() => (e = JSON.parse(JSON.stringify(q)))}><Icon name="stift" size={13} /></button>
          <button class="btn btn--s btn--quiet" onclick={() => weg(q)}><Icon name="trash" size={13} /></button>
        </div>
      </li>
    {/each}
  </ol>
{:else if !e}
  <div class="empty"><b>Noch keine Quellen</b><span>Füge Quellen per DOI/ISBN oder von Hand hinzu – das Literaturverzeichnis im ISM-Format entsteht automatisch.</span></div>
{/if}

<style>
  .qk { display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; margin-bottom: 12px; }
  .zaehler { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 2px 10px; padding: 8px 14px; border-radius: 14px; min-width: 170px; }
  .zaehler b { font-size: 1.5rem; grid-row: span 2; }
  .zaehler span { font-size: .8rem; color: var(--steel); }
  .bar { display: block; height: 5px; border-radius: 3px; background: rgba(203, 215, 235, .1); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--warn); }
  .such { display: flex; gap: 6px; padding: 6px; border-radius: 14px; flex: 1 1 320px; }
  .such .input { flex: 1; border: 0; background: transparent; }
  .form { display: grid; gap: 12px; padding: 16px; border-radius: 18px; margin-bottom: 12px; border-color: rgba(231, 185, 74, .4); }
  .ft { display: flex; justify-content: space-between; align-items: center; }
  .typen { display: flex; flex-wrap: wrap; gap: 6px; }
  .typen button { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); font: inherit; font-size: .84rem; cursor: pointer; }
  .typen button.an { background: rgba(231, 185, 74, .16); border-color: rgba(231, 185, 74, .5); color: var(--text); }
  .felder { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .felder label { display: grid; gap: 4px; }
  .felder label.breit { grid-column: 1 / -1; }
  .felder span { font-size: .76rem; color: var(--steel); font-weight: 600; }
  textarea.input { font: inherit; resize: vertical; }
  .vorschau { display: grid; gap: 6px; padding: 12px; border-radius: 12px; background: var(--bg-2); }
  .vorschau small { color: var(--steel); font-size: .74rem; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  .vorschau p { margin: 0; color: var(--text); }
  .fa { display: flex; justify-content: flex-end; gap: 8px; }
  .warn { display: inline-flex; align-items: center; gap: 5px; font-size: .8rem; color: #F2A06A; }
  .lv { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .lv li { display: grid; gap: 10px; padding: 12px 14px; border-radius: 16px; }
  .lv li.schlecht { border-color: rgba(242, 122, 106, .45); }
  .lv-k { display: grid; gap: 4px; }
  .typ { font-size: .72rem; color: var(--steel); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  .lv-k p { margin: 0; line-height: 1.5; }
  .warns { display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .notiz { color: var(--steel); font-size: .86rem; }
  .kb { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--line); }
  .kb-l { font-size: .78rem; color: var(--steel); }
  code { font-family: inherit; font-size: .88rem; padding: 4px 8px; border-radius: 8px; background: var(--bg-2); color: var(--text); }
  .input.s { width: 76px; min-height: 30px; padding: 4px 8px; font-size: .84rem; }
  .dk { display: inline-flex; align-items: center; gap: 5px; font-size: .82rem; color: var(--text-2); }
</style>
