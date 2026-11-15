<script lang="ts">
  // KI-Nachweis: jede KI-Nutzung sofort festhalten – daraus entsteht die Tabelle für die „Erklärung zum Einsatz generativer KI“ der ISM-Vorlage
  import Icon from "../../../components/Icon.svelte";
  import { arbeiten } from "../../../lib/arbeiten/arbeiten.svelte";
  import { daten } from "../../../lib/daten.svelte";
  import { frage } from "../../../lib/frage.svelte";
  import { md } from "../../../lib/lernen/md";
  import { tagKurz, tagKey } from "../../../lib/organizer/zeit";
  import type { Arbeit, KiNutzung } from "../../../lib/arbeiten/typen";

  let { arbeit }: { arbeit: Arbeit } = $props();
  const rw = $derived(arbeiten.regelwerk);
  // Zwecke wie in der Tabelle der ISM-Dokumentvorlage
  const ZWECKE = ["Ideenfindung und Konzeptualisierung", "Literaturrecherche und -analyse", "Methodisches Vorgehen", "Datenerhebung und -analyse", "Ergebnisdarstellung und -diskussion", "Textbearbeitung (Strukturierung, Generierung, Übersetzung)"];
  const TOOLS = ["ChatGPT", "Claude", "Perplexity", "DeepL", "Grammarly", "Copilot", "Gemini", "scite.ai", "consensus.app"];
  const liste = $derived(arbeiten.von(arbeiten.ki, arbeit.id));
  type Form = { id?: string; datum: string; tool: string; zweck: string; prompt: string; ergebnis: string; textstelle: string };
  const leer = (): Form => ({ datum: tagKey(Date.now()), tool: "", zweck: ZWECKE[0], prompt: "", ergebnis: "", textstelle: "" });
  let e = $state<Form | null>(null);
  async function speichern() {
    if (!e || !e.tool.trim() || !e.prompt.trim()) return;
    if (await arbeiten.kiSpeichern({ ...e, arbeit_id: arbeit.id, ergebnis: e.ergebnis || null, textstelle: e.textstelle || null } as any)) { e = null; daten.melden("KI-Nutzung festgehalten"); }
  }
  async function weg(k: KiNutzung) { if (await frage("Eintrag löschen?", `${k.tool}: ${k.zweck}`, "Löschen", true)) await arbeiten.kiLoeschen(k); }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  async function tabelleKopieren() {
    // Gruppiert nach Zweck – so wie die Tabelle der Vorlage aufgebaut ist
    const zeilen = ZWECKE.concat([...new Set(liste.map((k) => k.zweck))].filter((z) => !ZWECKE.includes(z))).map((z) => {
      const l = liste.filter((k) => k.zweck === z); if (!l.length) return null;
      return [z, l.map((k) => `${tagKurz(k.datum)}: ${k.prompt}`).join("\n"), [...new Set(l.map((k) => k.tool))].join(", "), [...new Set(l.map((k) => k.textstelle).filter(Boolean))].join("; ") || "–"];
    }).filter(Boolean) as string[][];
    const kopf = ["Zweck der Nutzung", "Konkretisierung der Nutzung", "Name des verwendeten KI-Tools", "Betroffene Abschnitte (Kapitel, Absätze…)"];
    const html = `<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:10pt"><tr>${kopf.map((k) => `<th>${esc(k)}</th>`).join("")}</tr>${zeilen.map((r) => `<tr>${r.map((c) => `<td>${esc(c).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("")}</table>`;
    const text = [kopf, ...zeilen].map((r) => r.map((c) => c.replace(/\n/g, " / ")).join("\t")).join("\n");
    try { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]); daten.melden("Tabelle kopiert – in Word einfügen"); }
    catch { try { await navigator.clipboard.writeText(text); daten.melden("Als Text kopiert"); } catch { daten.melden("Kopieren nicht möglich", undefined, true); } }
  }
  // Formular beim Öffnen ins Bild holen (auf dem Handy liegt es sonst unterhalb)
  const zeigen = (n: HTMLElement) => { setTimeout(() => n.scrollIntoView({ behavior: "smooth", block: "start" }), 60); };
</script>

{#if rw?.ki}
  <aside class="regel card"><Icon name="sparkles" size={16} /><div class="md">{@html md(rw.ki.pflicht + (rw.ki.angaben.length ? `\n\nAnzugeben: ${rw.ki.angaben.join(", ")}.` : ""))}<small>{rw.ki.quelle}</small></div></aside>
{/if}

<div class="kk">
  <button class="btn btn--primary org-primary" onclick={() => (e = leer())}><Icon name="plus" size={15} />KI-Nutzung festhalten</button>
  {#if liste.length}<button class="btn" onclick={tabelleKopieren}><Icon name="copy" size={15} />Tabelle für Word kopieren</button>{/if}
</div>

{#if e}
  <section class="form card" use:zeigen>
    <div class="zeile">
      <label><span>Datum</span><input class="input" type="date" bind:value={e.datum} /></label>
      <label class="w"><span>Tool (mit Version, wenn bekannt)</span><input class="input" list="ki-tools" bind:value={e.tool} placeholder="z. B. ChatGPT (GPT-5)" /><datalist id="ki-tools">{#each TOOLS as t}<option value={t}></option>{/each}</datalist></label>
    </div>
    <label><span>Zweck der Nutzung</span><select class="input" bind:value={e.zweck}>{#each ZWECKE as z}<option>{z}</option>{/each}</select></label>
    <label><span>Prompt / Konkretisierung – was genau hast du gefragt?</span><textarea class="input" rows="3" bind:value={e.prompt} placeholder="Den Prompt wörtlich einfügen"></textarea></label>
    <label><span>Was hast du mit dem Ergebnis gemacht? (optional)</span><textarea class="input" rows="2" bind:value={e.ergebnis} placeholder="z. B. Gliederungsidee übernommen und angepasst; Text nicht übernommen"></textarea></label>
    <label><span>Betroffene Abschnitte</span><input class="input" bind:value={e.textstelle} placeholder="z. B. Kapitel 2.1, S. 4, Absatz 2" /></label>
    <div class="fa"><button class="btn" onclick={() => (e = null)}>Abbrechen</button><button class="btn btn--primary org-primary" disabled={!e.tool.trim() || !e.prompt.trim()} onclick={speichern}>Speichern</button></div>
  </section>
{/if}

{#if liste.length}
  <ol class="kl">
    {#each liste as k (k.id)}
      <li class="card">
        <div class="k-k"><b>{k.tool}</b><span class="muted">{tagKurz(k.datum)} · {k.zweck}</span>
          <span class="ak"><button class="btn btn--s btn--quiet" onclick={() => (e = { id: k.id, datum: k.datum, tool: k.tool, zweck: k.zweck, prompt: k.prompt, ergebnis: k.ergebnis ?? "", textstelle: k.textstelle ?? "" })}><Icon name="stift" size={13} /></button><button class="btn btn--s btn--quiet" onclick={() => weg(k)}><Icon name="trash" size={13} /></button></span></div>
        <p class="prompt">„{k.prompt}“</p>
        {#if k.ergebnis}<p class="muted">{k.ergebnis}</p>{/if}
        {#if k.textstelle}<small>Betrifft: {k.textstelle}</small>{/if}
      </li>
    {/each}
  </ol>
{:else if !e}
  <div class="empty"><b>Noch keine KI-Nutzung festgehalten</b><span>Trag jede Nutzung sofort ein – dann ist die Pflichttabelle am Ende fertig und vollständig.</span></div>
{/if}

<style>
  .regel { display: flex; gap: 12px; padding: 14px; border-radius: 16px; margin-bottom: 12px; border-color: rgba(180, 140, 255, .35); background: rgba(180, 140, 255, .06); }
  .regel :global(svg) { color: #CDB8FF; flex: none; margin-top: 3px; }
  .md { color: var(--text-2); font-size: .9rem; line-height: 1.55; display: grid; gap: 4px; }
  .md :global(p) { margin: 0; }
  .md small { color: var(--steel); font-size: .76rem; }
  .kk { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .form { display: grid; gap: 10px; padding: 16px; border-radius: 18px; margin-bottom: 12px; border-color: rgba(180, 140, 255, .4); }
  .form label { display: grid; gap: 4px; }
  .form span { font-size: .76rem; color: var(--steel); font-weight: 600; }
  .zeile { display: flex; gap: 10px; flex-wrap: wrap; }
  .zeile .w { flex: 1 1 240px; }
  textarea.input { font: inherit; resize: vertical; }
  .fa { display: flex; justify-content: flex-end; gap: 8px; }
  .kl { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .kl li { display: grid; gap: 6px; padding: 12px 14px; border-radius: 14px; }
  .k-k { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .k-k .muted { font-size: .84rem; flex: 1; }
  .ak { display: flex; gap: 2px; }
  .prompt { margin: 0; color: var(--text); font-size: .92rem; line-height: 1.5; }
  .kl p.muted { margin: 0; font-size: .86rem; }
  .kl small { color: var(--steel); font-size: .8rem; }
</style>
