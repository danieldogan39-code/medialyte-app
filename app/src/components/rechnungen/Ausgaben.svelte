<script lang="ts">
  // Ausgaben der Firma: Liste nach Monaten, Suche, Jahresauswahl. Grundlage für Vorsteuer, Reverse Charge und Gewinn im Reiter „Steuern“.
  import Icon from "../Icon.svelte";
  import Zahl from "../Zahl.svelte";
  import AusgabeEditor from "./AusgabeEditor.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { B } from "../../lib/rechnungen/blatt.svelte";
  import { MONTHS_LONG, eur, fmtDate, todayISO } from "../../lib/rechnungen/kern";
  import { ARTEN, kategorie, type Ausgabe } from "../../lib/rechnungen/steuer";
  import { auth } from "../../lib/auth.svelte";

  const darf = $derived(auth.darf("rechnungen", true));
  const heute = todayISO(), cy = +heute.slice(0, 4);
  const jahre = $derived([...new Set([cy, ...R.ausgaben.map((a) => +String(a.datum).slice(0, 4))])].filter((y) => y > 2000).sort((a, b) => b - a));
  let jahr = $state(cy), suche = $state("");
  const klein = $derived(R.small);
  const imJahr = $derived(R.ausgaben.filter((a) => String(a.datum).startsWith(jahr + "-")));
  const liste = $derived.by(() => {
    const q = suche.trim().toLowerCase();
    return imJahr.filter((a) => !q || `${a.lieferant} ${a.beschreibung || ""} ${kategorie(a.kategorie).name} ${a.notiz || ""}`.toLowerCase().includes(q))
      .sort((a, b) => String(b.datum).localeCompare(String(a.datum)) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  });
  const monate = $derived.by(() => {
    const g: { key: string; name: string; summe: number; zeilen: Ausgabe[] }[] = [];
    for (const a of liste) { const k = String(a.datum).slice(0, 7); let m = g[g.length - 1]; if (!m || m.key !== k) g.push((m = { key: k, name: `${MONTHS_LONG[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`, summe: 0, zeilen: [] })); m.zeilen.push(a); m.summe += +a.brutto || 0; }
    return g;
  });
  const summe = (l: Ausgabe[], f: (a: Ausgabe) => number) => l.reduce((s, a) => s + f(a), 0);
  const kosten = $derived(summe(imJahr, (a) => (klein && a.art === "inland" ? +a.brutto : +a.netto) || 0));
  const vorsteuer = $derived(summe(imJahr, (a) => (a.art === "inland" ? +a.ust || 0 : 0)));
  const monat = $derived(summe(R.ausgaben.filter((a) => String(a.datum).startsWith(heute.slice(0, 7))), (a) => +a.brutto || 0));
  const artKurz = (a: Ausgabe) => { const k = ARTEN.find((x) => x.key === a.art)?.kurz; return !k || a.art === "inland" ? "" : " · " + k; };
</script>

<div class="seite-h"><h1>Ausgaben</h1><p class="muted">Alles, was Medialyte bezahlt hat. Daraus rechnet die App deine Vorsteuer und deinen Gewinn.</p></div>
{#if !R.ausgabenBereit}<div class="note">Die Datenbank wird gerade für die Ausgaben vorbereitet. In ein paar Minuten ist es so weit – einmal oben auf Aktualisieren tippen.</div>{/if}

<div class="stats">
  <div class="card ton ton-tuerkis"><small>Ausgaben {jahr}{klein ? "" : ", netto"}</small><b class="num"><Zahl wert={kosten} format={eur} /></b></div>
  {#if !klein}<div class="card ton ton-gruen"><small>Vorsteuer {jahr}</small><b class="num"><Zahl wert={vorsteuer} format={eur} /></b></div>{/if}
  <div class="card ton ton-grau"><small>Diesen Monat bezahlt</small><b class="num"><Zahl wert={monat} format={eur} /></b></div>
</div>

<div class="bar">
  <div class="chips">{#each jahre as y (y)}<button class="chip" class:on={jahr === y} onclick={() => (jahr = y)}>{y}</button>{/each}</div>
  <label class="search"><Icon name="search" size={16} /><input class="input" type="search" placeholder="Suchen …" bind:value={suche} aria-label="Ausgaben durchsuchen"></label>
</div>

{#each monate as m (m.key)}
  <div class="monat"><h3>{m.name}</h3><span class="muted num">{m.zeilen.length} {m.zeilen.length === 1 ? "Ausgabe" : "Ausgaben"} · {eur(m.summe)}</span></div>
  <div class="liste">
    {#each m.zeilen as a (a.id)}
      <button class="zeile" onclick={() => B.auf(AusgabeEditor, { a })}>
        <span class="h"><b>{a.lieferant}</b><small class="muted">{fmtDate(a.datum)} · {kategorie(a.kategorie).name}{artKurz(a)}{a.beschreibung ? " · " + a.beschreibung : ""}</small></span>
        <span class="r"><b class="num">{eur(a.brutto)}</b>
          {#if a.art === "inland" && +a.ust && !klein}<small class="muted num">{eur(a.ust)} Vorsteuer</small>
          {:else if a.art === "eu" || a.art === "drittland"}<small class="muted num">§ 13b</small>{/if}</span>
      </button>
    {/each}
  </div>
{:else}
  <div class="card empty"><b>{imJahr.length ? "Nichts gefunden" : `Noch keine Ausgaben ${jahr}`}</b>
    <p>{imJahr.length ? "Ändere die Suche." : "Trag ein, was Medialyte bezahlt: Software-Abos, Hosting, Porto, Werbung, Geräte. Jede Ausgabe senkt deine Steuer."}</p>
    {#if darf && !imJahr.length}<button class="btn btn--s" onclick={() => B.auf(AusgabeEditor, { a: null })}><Icon name="plus" size={14} />Erste Ausgabe eintragen</button>{/if}</div>
{/each}
{#if R.ausgaben.length}<p class="muted klein fuss">Die Belege selbst (PDF oder Foto der Rechnung) musst du 8 Jahre aufbewahren. Die App speichert hier nur die Zahlen.</p>{/if}

<style>
  .seite-h { margin: 4px 0 16px; display: grid; gap: 4px; }
  .seite-h h1 { font-size: 1.7rem; }
  .note { padding: 10px 14px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; margin-bottom: 12px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; max-width: 760px; }
  .stats .card { padding: 14px 16px; display: grid; gap: 4px; }
  .stats small { color: var(--steel); font-size: .8rem; }
  .stats b { color: var(--text); font-size: 1.35rem; font-weight: 600; }
  @media (max-width: 520px) { .stats { gap: 6px; } .stats .card { padding: 10px; } .stats b { font-size: 1rem; } }
  .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
  .chips { display: flex; gap: 6px; overflow-x: auto; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; white-space: nowrap; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .search { position: relative; display: block; width: min(260px, 100%); margin-left: auto; }
  .search :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--steel); pointer-events: none; }
  .search .input { padding-left: 34px; min-height: 36px; }
  @media (max-width: 640px) { .search { width: 100%; } }
  .monat { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 18px 2px 8px; }
  .monat h3 { font-size: 1rem; }
  .monat span { font-size: .84rem; }
  .liste { display: grid; gap: 6px; }
  .zeile { display: flex; justify-content: space-between; gap: 12px; align-items: center; width: 100%; text-align: left; padding: 11px 12px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--panel); color: inherit; cursor: pointer; font: inherit; }
  @media (hover: hover) and (pointer: fine) { .zeile:hover { border-color: var(--line-2); } }
  .h { display: grid; gap: 2px; min-width: 0; }
  .h b { color: var(--text); font-weight: 600; }
  .h small { font-size: .8rem; overflow: hidden; text-overflow: ellipsis; }
  .r { display: grid; justify-items: end; gap: 2px; flex: none; }
  .r b { color: var(--text); font-weight: 600; }
  .r small { font-size: .78rem; }
  .klein { font-size: .84rem; }
  .fuss { margin: 18px 2px 0; }
</style>
