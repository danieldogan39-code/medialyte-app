<script lang="ts">
  // Ausgabe anlegen oder bearbeiten: was die Firma bezahlt hat (für Vorsteuer, Reverse Charge und Gewinn)
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { auth } from "../../lib/auth.svelte";
  import { addMonthsISO, eur, fmtNum, num, todayISO } from "../../lib/rechnungen/kern";
  import { ARTEN, KATEGORIEN, ausgabeBetraege, type Ausgabe, type AusgabeArt } from "../../lib/rechnungen/steuer";

  let { zu, a = null, vorlage = null }: { zu: () => void; a?: Ausgabe | null; vorlage?: Partial<Ausgabe> | null } = $props();
  const neu = !a, q = a ?? vorlage;
  const darf = auth.darf("rechnungen", true);
  let f = $state({
    lieferant: q?.lieferant ?? "", beschreibung: q?.beschreibung ?? "", kategorie: q?.kategorie ?? "software", art: (q?.art ?? "inland") as AusgabeArt,
    datum: String(q?.datum ?? todayISO()).slice(0, 10), bezahlt_am: String(q?.bezahlt_am ?? q?.datum ?? todayISO()).slice(0, 10),
    betrag: q && +(q.brutto ?? 0) ? fmtNum(q.brutto) : "", satz: q && q.art === "inland" ? +(q.ust_satz ?? 19) : 19, notiz: q?.notiz ?? "",
  });
  let zahltagEigen = $state(!!q && !!q.bezahlt_am && String(q.bezahlt_am).slice(0, 10) !== String(q.datum).slice(0, 10));
  let feld: HTMLInputElement | undefined = $state();
  $effect(() => { if (neu && !vorlage) setTimeout(() => feld?.focus(), 200); });

  // Bekannte Lieferanten: Name antippen übernimmt Kategorie, Steuerart und Betrag vom letzten Mal
  const bekannt = $derived.by(() => { const m = new Map<string, Ausgabe>(); for (const x of R.ausgaben) { const k = x.lieferant.trim().toLowerCase(); if (!m.has(k)) m.set(k, x); } return m; });
  let uebernommen = "";
  const lieferantGewaehlt = () => {
    const x = bekannt.get(f.lieferant.trim().toLowerCase());
    if (!neu || !x || uebernommen === x.id) return; uebernommen = x.id;
    f.kategorie = x.kategorie; f.art = x.art; f.satz = x.art === "inland" ? +x.ust_satz : 19;
    if (!f.beschreibung) f.beschreibung = x.beschreibung ?? "";
    if (!f.betrag) f.betrag = fmtNum(x.brutto);
  };

  const klein = $derived(R.small);
  const rc = $derived(f.art === "eu" || f.art === "drittland");
  const b = $derived(ausgabeBetraege(num(f.betrag), rc ? 19 : f.satz, f.art));
  const art = $derived(ARTEN.find((x) => x.key === f.art)!);

  const lesen = () => {
    const lieferant = f.lieferant.trim();
    if (!lieferant) throw new Error("Bitte eintragen, an wen du gezahlt hast.");
    if (!num(f.betrag)) throw new Error("Bitte den Betrag eintragen.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.datum)) throw new Error("Bitte das Rechnungsdatum wählen.");
    const zahltag = zahltagEigen ? f.bezahlt_am : f.datum;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(zahltag)) throw new Error("Bitte den Zahltag wählen.");
    return { lieferant, beschreibung: f.beschreibung.trim() || null, kategorie: f.kategorie, art: f.art, datum: f.datum, bezahlt_am: zahltag, ...b, notiz: f.notiz.trim() || null };
  };
  const speichern = () => versuche(async () => {
    const d = lesen();
    const r = neu ? await R.write("ausgaben", "insert", d) : await R.write("ausgaben", "update", d, [["id", a!.id]]);
    if (r.error) throw r.error;
    zu(); daten.melden(neu ? "Ausgabe gespeichert" : "Ausgabe geändert");
  });
  // Monatliche Kosten: dieselbe Ausgabe einen Monat später noch einmal anlegen
  const kopieren = () => versuche(async () => {
    const d = lesen();
    const r = await R.write("ausgaben", "insert", { ...d, datum: addMonthsISO(d.datum, 1), bezahlt_am: addMonthsISO(d.bezahlt_am, 1) });
    if (r.error) throw r.error;
    zu(); daten.melden(`Kopie für ${addMonthsISO(d.datum, 1).split("-").reverse().join(".")} angelegt`);
  });
  const loeschen = () => versuche(async () => {
    if (!(await frage("Ausgabe löschen?", `${a!.lieferant} · ${eur(a!.brutto)} löschen? Sie zählt dann nicht mehr für Vorsteuer und Gewinn.`, "Löschen", true))) return;
    const { error } = await R.write("ausgaben", "delete", undefined, [["id", a!.id]]); if (error) throw error;
    zu(); daten.melden("Ausgabe gelöscht");
  });
</script>

<Blatt titel={neu ? "Neue Ausgabe" : "Ausgabe bearbeiten"} {zu}>
  <label class="field"><span>Bezahlt an</span>
    <input class="input" bind:this={feld} bind:value={f.lieferant} list="lieferanten" placeholder="z. B. IONOS, Anthropic, Deutsche Post" oninput={lieferantGewaehlt} onchange={lieferantGewaehlt} disabled={!darf}>
    <datalist id="lieferanten">{#each [...bekannt.values()] as x (x.id)}<option value={x.lieferant}></option>{/each}</datalist></label>
  <label class="field"><span>Wofür (optional)</span><input class="input" bind:value={f.beschreibung} placeholder="z. B. Hosting November" disabled={!darf}></label>
  <div class="zwei">
    <label class="field"><span>Kategorie</span><select class="input" bind:value={f.kategorie} disabled={!darf}>{#each KATEGORIEN as k}<option value={k.key}>{k.name}</option>{/each}</select></label>
    <label class="field"><span>Rechnungsdatum</span><input class="input" type="date" bind:value={f.datum} max={addMonthsISO(todayISO(), 1)} disabled={!darf}></label>
  </div>
  <label class="field"><span>Woher kommt die Rechnung?</span>
    <select class="input" bind:value={f.art} disabled={!darf}>{#each ARTEN as x}<option value={x.key}>{x.name}</option>{/each}</select></label>
  <p class="hinweis">{art.hinweis}</p>
  <div class="zwei">
    <label class="field"><span>{f.art === "inland" ? "Betrag brutto €" : rc ? "Rechnungsbetrag € (ohne Umsatzsteuer)" : "Betrag €"}</span>
      <input class="input" inputmode="decimal" bind:value={f.betrag} placeholder="0,00" disabled={!darf}></label>
    {#if f.art === "inland"}<label class="field"><span>Umsatzsteuer</span><select class="input" bind:value={f.satz} disabled={!darf}>{#each [19, 7, 0] as v}<option value={v}>{v} %</option>{/each}</select></label>{/if}
  </div>
  {#if num(f.betrag)}
    <div class="rechnung num">
      {#if f.art === "inland"}<span>Netto <b>{eur(b.netto)}</b></span><span>{klein ? "Umsatzsteuer (als Kleinunternehmer nicht abziehbar)" : "Vorsteuer"} <b>{eur(b.ust)}</b></span>
      {:else if rc}<span>Kosten <b>{eur(b.netto)}</b></span><span>19 % nach § 13b <b>{eur(b.ust)}</b>{klein ? " · zahlst du ans Finanzamt" : " · anmelden und gleich wieder abziehen"}</span>
      {:else}<span>Kosten <b>{eur(b.netto)}</b></span><span>keine Vorsteuer</span>{/if}
    </div>
  {/if}
  {#if rc}<p class="hinweis">In fremder Währung abgebucht? Trag den Euro-Betrag von deinem Kontoauszug ein.</p>{/if}
  <label class="check"><input type="checkbox" bind:checked={zahltagEigen} disabled={!darf}><span>An einem anderen Tag bezahlt als das Rechnungsdatum</span></label>
  {#if zahltagEigen}<label class="field"><span>Bezahlt am (zählt für den Gewinn)</span><input class="input" type="date" bind:value={f.bezahlt_am} disabled={!darf}></label>{/if}
  <label class="field"><span>Notiz (optional)</span><textarea class="input" rows="2" bind:value={f.notiz} placeholder="z. B. Rechnungsnummer oder wo der Beleg liegt" disabled={!darf}></textarea></label>
  {#snippet fuss()}
    {#if darf}
      {#if !neu}<button class="btn del" onclick={loeschen}>Löschen</button><button class="btn" onclick={kopieren}>Kopie für nächsten Monat</button>{/if}
      <button class="btn btn--primary" onclick={speichern}>Speichern</button>
    {/if}
  {/snippet}
</Blatt>

<style>
  .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 480px) { .zwei { grid-template-columns: 1fr; } }
  .hinweis { margin: -6px 0 0; color: var(--steel); font-size: .84rem; line-height: 1.5; }
  .rechnung { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 10px 14px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); font-size: .9rem; }
  .rechnung b { color: var(--text); font-weight: 600; }
  .check { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; line-height: 1.45; color: var(--text-2); }
  .check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--coral); flex: none; }
  .del { color: #FF8080; margin-right: auto; }
</style>
