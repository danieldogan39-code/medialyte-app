<script lang="ts">
  // Rechnung schreiben (Entwurf): Kunde, Leistungszeitraum, Positionen, Datum, bereits bezahlt; abschließen & senden
  import Blatt from "./Blatt.svelte";
  import Positionen from "./Positionen.svelte";
  import Icon from "../Icon.svelte";
  import { R, QUEUED_MSG } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { HISTORY_START, fmtDate, positionsOf, todayISO, type Posten } from "../../lib/rechnungen/kern";
  import { oeffneKunde } from "../../lib/rechnungen/oeffnen";

  let { zu, inv = null, kunde = "" }: { zu: () => void; inv?: any; kunde?: string } = $props();
  const neu = !inv;
  const v = inv ?? { items: [{ quantity: 1, unit: "Std.", vat: 19 }], intro: R.settings.intro, service_text: "", notes: "", customer_id: kunde };
  const ref = v.ref_invoice_id ? R.invoice(v.ref_invoice_id) : null;
  let id = $state<string | undefined>(v.id);
  let f = $state({ customer_id: v.customer_id ?? "", service_text: v.service_text ?? "", intro: v.intro ?? "", notes: v.notes ?? "", issue_date: todayISO(), paid: false, paid_at: todayISO() });
  let posten = $state<Posten[]>([]);
  let laeuft = $state("");
  const zurueck = $derived(!!f.issue_date && f.issue_date < todayISO());
  // Nachträge (rückdatiert oder schon bezahlt) gehen standardmäßig NICHT per Mail raus
  const spaet = $derived(f.paid || zurueck);

  const daten_ = () => ({ customer_id: f.customer_id || null, service_text: f.service_text.trim(), intro: f.intro.trim(), notes: f.notes.trim(), items: posten });
  async function sichern() {
    const d = daten_();
    if (id) { const { error } = await R.write("invoices", "update", d, [["id", id]]); if (error) throw error; }
    else { const { data, error } = await R.write("invoices", "insert", { ...d, status: "draft", kind: "invoice", ref_invoice_id: v.ref_invoice_id || null }); if (error) throw error; id = data.id; }
    return d;
  }
  const tun = (k: string, fn: () => Promise<unknown>) => { if (laeuft) return; laeuft = k; versuche(fn).finally(() => (laeuft = "")); };
  async function abschliessen(senden: boolean) {
    const d = daten_();
    if (!d.customer_id) throw new Error("Bitte einen Kunden wählen.");
    if (!positionsOf(d.items).length) throw new Error("Bitte mindestens eine Position eintragen.");
    if (!d.service_text) throw new Error("Bitte Leistungsdatum oder -zeitraum angeben (Pflichtangabe).");
    const c = R.customer(d.customer_id);
    if (senden && !c?.email) throw new Error("Der Kunde hat keine E-Mail-Adresse. Trag sie beim Kunden ein oder wähle „Nur abschließen“.");
    const issue_date = f.issue_date || todayISO();
    if (issue_date < HISTORY_START || issue_date > todayISO()) throw new Error("Das Rechnungsdatum muss zwischen 01.01.2024 und heute liegen.");
    const paid_at = f.paid_at || issue_date;
    if (f.paid && paid_at < issue_date) throw new Error("Das Zahlungsdatum liegt vor dem Rechnungsdatum.");
    const was = `${issue_date < todayISO() ? ` mit Datum ${fmtDate(issue_date)}` : ""}${f.paid ? `, bezahlt am ${fmtDate(paid_at)}` : ""}`;
    if (!(await frage(senden ? "Abschließen und senden?" : "Nur abschließen?", senden ? `Rechnung${was} abschließen und an ${c.email} senden?` : `Rechnung${was} abschließen, ohne sie zu versenden?`, senden ? "Abschließen & senden" : "Abschließen"))) return;
    await sichern();
    const r = await R.act("issue", { id, send: senden, issue_date, paid: f.paid, paid_at });
    zu(); await R.loadAll().catch(() => {});
    daten.melden(r.queued ? QUEUED_MSG : senden ? `Rechnung ${r.invoice.number} an ${c.email} gesendet` : `Rechnung ${r.invoice.number} abgeschlossen`);
  }
  const speichern = () => tun("save", async () => { await sichern(); zu(); await R.loadAll().catch(() => {}); daten.melden("Entwurf gespeichert"); });
  const vorschau = () => tun("preview", async () => { await sichern(); await R.openPdf({ id: id!, kind: "invoice" }); R.loadAll().catch(() => {}); });
  const loeschen = () => tun("del", async () => {
    if (!(await frage("Entwurf löschen?", "Der Rechnungsentwurf wird gelöscht.", "Löschen", true))) return;
    const { error } = await R.write("invoices", "delete", undefined, [["id", id]]); if (error) throw error;
    zu(); await R.loadAll().catch(() => {}); daten.melden("Entwurf gelöscht");
  });
  const neuerKunde = () => oeffneKunde(null, (k: any) => { if (k?.id) f.customer_id = k.id; });
</script>

<Blatt titel={neu ? "Neue Rechnung" : "Rechnungsentwurf"} {zu} breit>
  {#if ref}<div class="note">Korrektur zu <b>{ref.number}</b>. Beim Versand bekommt der Kunde die Stornorechnung und diese neue Rechnung zusammen.</div>{/if}
  <div class="field"><span>Kunde</span>
    <div class="inline"><select class="input" bind:value={f.customer_id}><option value="">Kunde wählen …</option>{#each R.customers as c (c.id)}<option value={c.id}>{c.name}{c.number ? " · " + c.number : ""}{c.email ? "" : " (ohne E-Mail)"}</option>{/each}</select>
      <button type="button" class="btn btn--s" onclick={neuerKunde}><Icon name="plus" size={14} />Neu</button></div></div>
  <label class="field"><span>Leistungsdatum / -zeitraum</span><input class="input" bind:value={f.service_text} placeholder="z. B. Oktober 2026 oder 28.10.2026"></label>
  <label class="field"><span>Einleitungstext</span><textarea class="input" rows="2" bind:value={f.intro}></textarea></label>
  <h3>Positionen</h3>
  <Positionen anfang={v.items ?? []} bind:posten />
  <label class="field"><span>Anmerkung (optional)</span><textarea class="input" rows="2" bind:value={f.notes} placeholder="Erscheint unter den Summen"></textarea></label>
  <div class="box">
    <div class="zwei">
      <label class="field"><span>Rechnungsdatum</span><input class="input" type="date" bind:value={f.issue_date} min={HISTORY_START} max={todayISO()}></label>
      <label class="check"><input type="checkbox" bind:checked={f.paid}> Bereits bezahlt</label>
    </div>
    {#if f.paid}<label class="field"><span>Bezahlt am</span><input class="input" type="date" bind:value={f.paid_at} min={f.issue_date || HISTORY_START} max={todayISO()}></label>{/if}
    {#if zurueck}<p class="warn">Rückdatieren nur für Rechnungen, die du an diesem Tag wirklich ausgestellt hast (z. B. Nachtrag aus dem alten System). Neue Rechnungen bekommen das heutige Datum – den Leistungszeitraum kannst du jederzeit in die Vergangenheit legen.</p>{/if}
  </div>
  <p class="muted klein">Die Rechnungsnummer wird beim Abschließen vergeben. Danach ist die Rechnung nicht mehr änderbar, nur noch per Korrektur.<br>
    <button type="button" class="lnk" onclick={() => tun("only", () => abschliessen(spaet))}>{spaet ? "Nachtragen und zusätzlich an den Kunden senden" : "Nur abschließen, ohne Versand"}</button></p>
  {#snippet fuss()}
    {#if !neu}<button class="btn del" onclick={loeschen} disabled={!!laeuft}>Löschen</button>{/if}
    <button class="btn" onclick={vorschau} disabled={!!laeuft}>{laeuft === "preview" ? "Lädt …" : "Vorschau"}</button>
    <button class="btn" onclick={speichern} disabled={!!laeuft}>Speichern</button>
    <button class="btn btn--primary" onclick={() => tun("issue", () => abschliessen(!spaet))} disabled={!!laeuft}>{spaet ? "Nachtragen" : "Abschließen & senden"}</button>
  {/snippet}
</Blatt>

<style>
  .note { padding: 10px 12px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; }
  .inline { display: flex; gap: 8px; }
  .inline .input { flex: 1; }
  .box { display: grid; gap: 10px; padding: 14px 16px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); }
  .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: end; }
  .check { display: flex; gap: 8px; align-items: center; min-height: 40px; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--coral); }
  .warn { margin: 0; font-size: .84rem; color: var(--warn); line-height: 1.45; }
  .klein { font-size: .84rem; margin: 0; line-height: 1.5; }
  .lnk { border: 0; background: none; padding: 0; color: var(--text-2); text-decoration: underline; cursor: pointer; font: inherit; }
  .del { color: #FF8080; margin-right: auto; }
</style>
