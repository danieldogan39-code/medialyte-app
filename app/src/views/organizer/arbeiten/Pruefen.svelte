<script lang="ts">
  // Prüfen: Word-Datei gegen das ISM-Regelwerk prüfen, Formatierung automatisch korrigieren, Verlauf
  import Icon from "../../../components/Icon.svelte";
  import { arbeiten } from "../../../lib/arbeiten/arbeiten.svelte";
  import { daten } from "../../../lib/daten.svelte";
  import { tagKurz, uhr } from "../../../lib/organizer/zeit";
  import type { Arbeit, Befund, Datei } from "../../../lib/arbeiten/typen";
  import type { Ergebnis } from "../../../lib/arbeiten/pruefer";

  let { arbeit }: { arbeit: Arbeit } = $props();
  const rw = $derived(arbeiten.regelwerk);
  const entwuerfe = $derived(arbeiten.von(arbeiten.dateien, arbeit.id).filter((d) => /\.docx$/i.test(d.name)));
  const verlauf = $derived(arbeiten.pruefungen.filter((p) => p.arbeit_id === arbeit.id));
  let ergebnis = $state<(Ergebnis & { datei: string }) | null>(null), laeuft = $state(false), offen = $state<Record<string, boolean>>({});
  let quelle = $state<{ name: string; bytes: Uint8Array } | null>(null);

  async function pruefeBytes(name: string, bytes: Uint8Array) {
    if (!rw) { daten.melden("Regelwerk noch nicht geladen", undefined, true); return; }
    laeuft = true;
    try {
      const [{ lesen }, { pruefen }] = await Promise.all([import("../../../lib/arbeiten/docx"), import("../../../lib/arbeiten/pruefer")]);
      const dok = lesen(bytes);
      const e = pruefen(dok, rw, arbeit, arbeiten.von(arbeiten.ki, arbeit.id).length);
      ergebnis = { ...e, datei: name }; quelle = { name, bytes };
      await arbeiten.pruefungSpeichern(arbeit, name, e.stat.woerter, e.befunde);
    } catch (err: any) { daten.melden("Datei nicht lesbar: " + (err?.message ?? err), undefined, true); }
    laeuft = false;
  }
  async function hoch(f: File | undefined) {
    if (!f) return;
    if (!/\.docx$/i.test(f.name)) { daten.melden("Bitte eine Word-Datei (.docx) wählen", undefined, true); return; }
    const bytes = new Uint8Array(await f.arrayBuffer());
    await arbeiten.hochladen(arbeit, [f], "entwurf");
    await pruefeBytes(f.name, bytes);
  }
  async function vorhanden(d: Datei) { laeuft = true; try { await pruefeBytes(d.name, await arbeiten.bytes(d)); } catch (e: any) { daten.melden(String(e?.message ?? e), undefined, true); laeuft = false; } }
  $effect(() => { const id = sessionStorage.getItem("arb:pruefe"); if (id) { sessionStorage.removeItem("arb:pruefe"); const d = arbeiten.dateien.find((x) => x.id === id); if (d) vorhanden(d); } });

  // Formatierung korrigieren → neue Fassung als Entwurf speichern und herunterladen
  let schritte = $state<string[]>([]);
  async function korrigieren() {
    if (!quelle || !rw) return;
    const { formatieren } = await import("../../../lib/arbeiten/docx");
    const s = rw.layout.schriften[0];
    const r = formatieren(quelle.bytes, { schrift: s.name, pt: s.pt, zeile: rw.layout.zeilenabstand, nachPt: rw.layout.absatz_nach_pt, fussnotePt: rw.layout.fussnote_pt, fussnoteZeile: rw.layout.zeilenabstand_fussnote, raender: rw.layout.raender_cm, blocksatz: rw.layout.blocksatz });
    schritte = r.schritte;
    const name = quelle.name.replace(/(\s*\(formatiert\))?\.docx$/i, "") + " (formatiert).docx";
    const file = new File([r.bytes as BlobPart], name, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    await arbeiten.hochladen(arbeit, [file], "entwurf");
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click(); a.remove();
    await pruefeBytes(name, r.bytes);
  }
  const zaehl = (s: Befund["status"]) => ergebnis?.befunde.filter((b) => b.status === s).length ?? 0;
  const layoutFehler = $derived(ergebnis?.befunde.some((b) => b.gruppe === "Layout" && b.status === "fehler") ?? false);
</script>

<div class="pk">
  <label class="drop card" class:laeuft>
    <input type="file" accept=".docx" onchange={(e) => { hoch((e.currentTarget as HTMLInputElement).files?.[0]); (e.currentTarget as HTMLInputElement).value = ""; }} />
    <span class="d-ic"><Icon name="check" size={22} /></span>
    <span><b>{laeuft ? "Prüft …" : "Word-Datei prüfen"}</b><small>.docx hierher ziehen oder klicken – wird als Entwurf gespeichert und gegen alle automatisch prüfbaren ISM-Regeln geprüft.</small></span>
  </label>
  {#if entwuerfe.length}
    <div class="ent">
      <small>Oder einen gespeicherten Entwurf prüfen:</small>
      {#each entwuerfe.slice(0, 5) as d (d.id)}<button class="btn btn--s" disabled={laeuft} onclick={() => vorhanden(d)}><Icon name="stift" size={13} />{d.name}</button>{/each}
    </div>
  {/if}
</div>

{#if ergebnis}
  <section class="erg card">
    <div class="sum">
      <div class="ampel" class:rot={zaehl("fehler") > 0} class:gelb={!zaehl("fehler") && zaehl("hinweis") > 0}>
        <b class="num">{zaehl("fehler")}</b><small>Fehler</small>
      </div>
      <div class="sum-t">
        <b>{zaehl("fehler") ? "Noch nicht abgabereif" : zaehl("hinweis") ? "Formal in Ordnung – Hinweise ansehen" : "Alle automatischen Prüfungen bestanden"}</b>
        <small>{ergebnis.datei} · {zaehl("hinweis")} Hinweise · {zaehl("ok")} bestanden</small>
      </div>
      {#if layoutFehler}<button class="btn btn--primary org-primary" onclick={korrigieren}><Icon name="wand" size={15} />Formatierung automatisch korrigieren</button>{/if}
    </div>
    <div class="stats">
      <span><b class="num">{ergebnis.stat.woerter.toLocaleString("de-DE")}</b>Wörter</span>
      <span><b class="num">{ergebnis.stat.kapitel}</b>Überschriften</span>
      <span><b class="num">{ergebnis.stat.fussnoten}</b>Fußnoten</span>
      <span><b class="num">{ergebnis.stat.quellen}</b>Quellen im LV</span>
      <span><b class="num">{ergebnis.stat.zitate}</b>direkte Zitate</span>
      <span><b class="num">{ergebnis.stat.abbildungen}</b>Abbildungen</span>
    </div>
    {#if schritte.length}<div class="korr"><b><Icon name="wand" size={14} />Korrigiert und als neuer Entwurf gespeichert:</b><ul>{#each schritte as s}<li>{s}</li>{/each}</ul><small>Überschriften, Tabellen und Beschriftungen bleiben unverändert. Inhalte, Zitate und Gliederung musst du selbst anpassen.</small></div>{/if}
  </section>

  <ul class="bf">
    {#each ergebnis.befunde as b (b.id)}
      <li class={"card " + b.status}>
        <button class="bf-k" onclick={() => (offen[b.id] = !offen[b.id])} aria-expanded={!!offen[b.id]}>
          <span class="st">{#if b.status === "ok"}<Icon name="check" size={14} />{:else if b.status === "fehler"}<Icon name="x" size={14} />{:else}!{/if}</span>
          <span class="t"><small>{b.gruppe}</small><b>{b.titel}</b></span>
          {#if b.detail || b.stellen?.length || b.tipp}<Icon name="down" size={15} />{/if}
        </button>
        {#if offen[b.id] || (b.status === "fehler" && (b.stellen?.length ?? 0) > 0 && !(b.id in offen))}
          <div class="bf-d">
            {#if b.detail}<p>{b.detail}</p>{/if}
            {#if b.stellen?.length}<ul class="stellen">{#each b.stellen as s}<li>{s}</li>{/each}</ul>{/if}
            {#if b.tipp}<p class="tipp"><Icon name="sparkles" size={13} />{b.tipp}</p>{/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="muted hinw">Der Prüfer deckt alle formal prüfbaren Regeln ab. Inhalt, Argumentation und Stil prüfst du mit der Checkliste unter „Vorgaben“ – oder lass mich drüberschauen.</p>
{/if}

{#if verlauf.length}
  <section class="vl">
    <h2>Verlauf</h2>
    <ol>
      {#each verlauf.slice(0, 10) as p (p.id)}
        <li><span class="num">{tagKurz(p.erstellt)}, {uhr(p.erstellt)}</span><span class="vn">{p.datei}</span><span class="num">{p.woerter?.toLocaleString("de-DE") ?? "–"} Wörter</span><span class:rot={p.fehler > 0} class:gruen={p.fehler === 0}>{p.fehler} Fehler · {p.hinweise} Hinweise</span></li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .pk { display: grid; gap: 10px; margin-bottom: 14px; }
  .drop { display: flex; align-items: center; gap: 14px; padding: 20px; border-radius: 18px; border: 1.5px dashed rgba(180, 140, 255, .5); cursor: pointer; background: rgba(180, 140, 255, .05); }
  .drop input { display: none; }
  .drop.laeuft { opacity: .6; pointer-events: none; }
  .drop > span:last-child { display: grid; }
  .drop small { color: var(--steel); font-size: .84rem; }
  .d-ic { width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center; background: rgba(180, 140, 255, .2); color: #CDB8FF; flex: none; }
  .ent { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .ent small { color: var(--steel); }
  .erg { display: grid; gap: 14px; padding: 16px; border-radius: 20px; margin-bottom: 10px; }
  .sum { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .ampel { width: 66px; height: 66px; border-radius: 20px; display: grid; place-items: center; align-content: center; background: rgba(76, 195, 138, .16); color: var(--ok); flex: none; }
  .ampel.gelb { background: rgba(231, 185, 74, .16); color: var(--warn); }
  .ampel.rot { background: rgba(242, 122, 106, .16); color: #F27A6A; }
  .ampel b { font-size: 1.7rem; line-height: 1; }
  .ampel small { font-size: .7rem; font-weight: 600; }
  .sum-t { display: grid; flex: 1; min-width: 200px; }
  .sum-t b { font-size: 1.08rem; }
  .sum-t small { color: var(--steel); }
  .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
  .stats span { display: grid; padding: 10px 12px; border-radius: 12px; background: var(--bg-2); font-size: .78rem; color: var(--steel); }
  .stats b { font-size: 1.2rem; color: var(--text); }
  .korr { display: grid; gap: 6px; padding: 12px; border-radius: 12px; background: rgba(76, 195, 138, .08); border: 1px solid rgba(76, 195, 138, .3); font-size: .88rem; }
  .korr b { display: flex; align-items: center; gap: 6px; color: var(--ok); }
  .korr ul { margin: 0; padding-left: 1.2em; color: var(--text-2); }
  .korr small { color: var(--steel); }
  .bf { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .bf > li { border-radius: 14px; overflow: hidden; }
  .bf > li.fehler { border-color: rgba(242, 122, 106, .45); }
  .bf > li.hinweis { border-color: rgba(231, 185, 74, .4); }
  .bf-k { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .st { width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; flex: none; font-weight: 800; font-size: .85rem; }
  .ok .st { background: rgba(76, 195, 138, .16); color: var(--ok); }
  .hinweis .st { background: rgba(231, 185, 74, .18); color: var(--warn); }
  .fehler .st { background: rgba(242, 122, 106, .18); color: #F27A6A; }
  .t { display: grid; flex: 1; min-width: 0; }
  .t small { font-size: .7rem; color: var(--steel); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  .t b { font-weight: 600; font-size: .94rem; }
  .ok .t b { font-weight: 500; color: var(--text-2); }
  .bf-k > :global(svg:last-child) { color: var(--steel); flex: none; }
  .bf-d { display: grid; gap: 8px; padding: 0 14px 12px 50px; font-size: .88rem; color: var(--text-2); }
  .bf-d p { margin: 0; line-height: 1.5; }
  .stellen { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; }
  .stellen li { padding: 6px 10px; border-radius: 8px; background: var(--bg-2); font-size: .84rem; }
  .tipp { display: flex; gap: 6px; align-items: flex-start; color: #CDB8FF !important; }
  .tipp :global(svg) { flex: none; margin-top: 3px; }
  .hinw { font-size: .84rem; margin: 12px 0 0; }
  .vl { margin-top: 22px; }
  .vl h2 { font-size: .95rem; color: var(--text-2); margin: 0 0 8px; }
  .vl ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .vl li { display: grid; grid-template-columns: 120px 1fr auto auto; gap: 12px; padding: 8px 12px; border-radius: 10px; background: var(--panel); font-size: .84rem; color: var(--text-2); }
  .vn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rot { color: #F27A6A; } .gruen { color: var(--ok); }
  @media (max-width: 560px) { .vl li { grid-template-columns: 1fr auto; } .vl li .vn, .vl li span:nth-child(3) { display: none; } .bf-d { padding-left: 14px; } }
</style>
