<script lang="ts">
  // Abo (wiederkehrende Rechnung): Kunde, Rhythmus, nächster Termin, Positionen, automatischer Versand;
  // Startdatum in der Vergangenheit: vergangene Zeiträume als bezahlt/offen nachtragen oder überspringen
  import Blatt from "./Blatt.svelte";
  import Positionen from "./Positionen.svelte";
  import Nachtragen from "./Nachtragen.svelte";
  import Icon from "../Icon.svelte";
  import { R, QUEUED_MSG } from "../../lib/rechnungen/daten.svelte";
  import { B, versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { auth } from "../../lib/auth.svelte";
  import { HISTORY_START, INTERVALS, STEP_M, addMonthsISO, firstOfNextMonth, fmtDate, positionsOf, todayISO, type Posten } from "../../lib/rechnungen/kern";
  import { oeffneKunde } from "../../lib/rechnungen/oeffnen";

  let { zu, r = null, kunde = "" }: { zu: () => void; r?: any; kunde?: string } = $props();
  const neu = !r;
  const v = r ?? { items: [{ quantity: 1, unit: "Monat", vat: 19 }], interval: "monthly", next_date: firstOfNextMonth(), auto_send: true, active: true };
  let id = $state<string | undefined>(v.id);
  let f = $state({ customer_id: v.customer_id ?? kunde, title: v.title ?? "", interval: v.interval, next_date: v.next_date, auto_send: !!v.auto_send, active: !!v.active });
  let posten = $state<Posten[]>([]);
  let laeuft = $state("");
  const darf = $derived(auth.darf("rechnungen", true));
  const tun = (k: string, fn: () => Promise<unknown>) => { if (laeuft) return; laeuft = k; versuche(fn).finally(() => (laeuft = "")); };
  const sammeln = () => ({ customer_id: f.customer_id || null, title: f.title.trim() || null, interval: f.interval, next_date: f.next_date, items: posten, auto_send: f.auto_send, active: f.active });
  async function sichern() {
    const d = sammeln();
    if (!d.customer_id) throw new Error("Bitte einen Kunden wählen.");
    if (!positionsOf(d.items).length) throw new Error("Bitte mindestens eine Position eintragen.");
    if (!d.next_date) throw new Error("Bitte ein Datum für die nächste Rechnung wählen.");
    if (d.auto_send && !R.customer(d.customer_id)?.email) throw new Error("Für automatischen Versand braucht der Kunde eine E-Mail-Adresse.");
    if (!id) { const { data, error } = await R.write("recurring", "insert", d); if (error) throw error; id = data.id; }
    else { const { error } = await R.write("recurring", "update", d, [["id", id]]); if (error) throw error; }
  }
  const speichern = () => tun("save", async () => {
    const d = sammeln();
    if (d.next_date && d.next_date < HISTORY_START) throw new Error("Abos können höchstens bis 01.01.2024 zurückreichen.");
    if (d.next_date && d.next_date <= todayISO() && d.active) {
      // Startdatum liegt in der Vergangenheit: erst entscheiden, wie die vergangenen Zeiträume behandelt werden
      let n = 0, x = d.next_date; while (x <= todayISO() && n < 120) { n++; x = addMonthsISO(x, STEP_M[d.interval] || 1); }
      B.auf(Nachtragen, { n, naechste: x, wahl: async (modus: string) => versuche(async () => {
        if (modus === "skip") { f.next_date = x; await sichern(); }
        else { await sichern(); const res = await R.act("recurring_backfill", { id, mode: modus }); if (res.queued) daten.melden(QUEUED_MSG); else daten.melden(`${res.created.length} Rechnungen nachgetragen (${res.created[0]} … ${res.created[res.created.length - 1]})`); }
        zu(); await R.loadAll().catch(() => {});
        if (modus === "skip") daten.melden(`Abo gespeichert – erste Rechnung am ${fmtDate(x)}`);
      }) });
      return;
    }
    await sichern(); zu(); await R.loadAll().catch(() => {}); daten.melden("Abo gespeichert");
  });
  const jetzt = () => tun("now", async () => {
    if (!(await frage("Rechnung erzeugen?", "Jetzt die Rechnung für den nächsten Zeitraum erzeugen" + (f.auto_send ? " und versenden" : "") + "?", "Erzeugen"))) return;
    await sichern(); const res = await R.act("run_recurring", { id });
    zu(); await R.loadAll().catch(() => {}); daten.melden(res.queued ? QUEUED_MSG : `Rechnung ${res.invoice.number} erstellt${res.mail ? " und versendet" : ""}`);
  });
  const loeschen = () => tun("del", async () => {
    if (!(await frage("Abo löschen?", "Bereits erstellte Rechnungen bleiben erhalten.", "Löschen", true))) return;
    const { error } = await R.write("recurring", "delete", undefined, [["id", id]]); if (error) throw error;
    zu(); await R.loadAll().catch(() => {}); daten.melden("Abo gelöscht");
  });
</script>

<Blatt titel={neu ? "Neues Abo" : "Abo bearbeiten"} {zu} breit>
  <div class="field"><span>Kunde</span>
    <div class="inline"><select class="input" bind:value={f.customer_id}><option value="">Kunde wählen …</option>{#each R.customers as c (c.id)}<option value={c.id}>{c.name}{c.number ? " · " + c.number : ""}{c.email ? "" : " (ohne E-Mail)"}</option>{/each}</select>
      <button type="button" class="btn btn--s" onclick={() => oeffneKunde(null, (k: any) => { if (k?.id) f.customer_id = k.id; })}><Icon name="plus" size={14} />Neu</button></div></div>
  <label class="field"><span>Bezeichnung (optional, erscheint auf der Rechnung)</span><input class="input" bind:value={f.title} placeholder="z. B. Hosting & Betreuung"></label>
  <div class="zwei">
    <label class="field"><span>Rhythmus</span><select class="input" bind:value={f.interval}>{#each Object.entries(INTERVALS) as [k, t]}<option value={k}>{t}</option>{/each}</select></label>
    <label class="field"><span>Nächste Rechnung am</span><input class="input" type="date" bind:value={f.next_date} min={HISTORY_START}></label>
  </div>
  <h3>Positionen je Rechnung</h3>
  <Positionen anfang={v.items ?? []} bind:posten />
  <label class="check"><input type="checkbox" bind:checked={f.auto_send}>Rechnung automatisch an den Kunden senden</label>
  <label class="check"><input type="checkbox" bind:checked={f.active}>Abo aktiv</label>
  <p class="muted klein">Als Leistungszeitraum steht auf der Rechnung automatisch der jeweilige Abrechnungszeitraum, z. B. 01.11.2026 – 30.11.2026.</p>
  {#snippet fuss()}
    {#if darf}
      {#if !neu}<button class="btn del" onclick={loeschen} disabled={!!laeuft}>Löschen</button><button class="btn" onclick={jetzt} disabled={!!laeuft}>Jetzt Rechnung erzeugen</button>{/if}
      <button class="btn btn--primary" onclick={speichern} disabled={!!laeuft}>Speichern</button>
    {/if}
  {/snippet}
</Blatt>

<style>
  .inline { display: flex; gap: 8px; }
  .inline .input { flex: 1; }
  .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .check { display: flex; gap: 8px; align-items: center; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--coral); }
  .klein { font-size: .84rem; margin: 0; }
  .del { color: #FF8080; margin-right: auto; }
</style>
