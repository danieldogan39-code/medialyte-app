<script lang="ts">
  // Angebot schreiben (auch Website-Update mit Anschreiben auf Seite 1): Positionen einmalig oder als Abo
  import Blatt from "./Blatt.svelte";
  import Positionen from "./Positionen.svelte";
  import Icon from "../Icon.svelte";
  import { R, QUEUED_MSG } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { isWU } from "../../lib/rechnungen/status";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { HISTORY_START, WU_PLACEHOLDERS, positionsOf, todayISO, type Posten } from "../../lib/rechnungen/kern";
  import { oeffneKunde } from "../../lib/rechnungen/oeffnen";

  let { zu, q = null, kunde = "" }: { zu: () => void; q?: any; kunde?: string } = $props();
  const neu = !q;
  const v = q ?? { items: [{ quantity: 1, unit: "pauschal", vat: 19 }], intro: R.settings.quote_intro, service_text: "", notes: "", customer_id: kunde, status: "draft" };
  const versendet = v.status === "sent", wu = isWU(v);
  let id = $state<string | undefined>(v.id);
  let f = $state({ customer_id: v.customer_id ?? "", service_text: v.service_text ?? "", valid_until: v.valid_until ?? "", intro: v.intro ?? "", notes: v.notes ?? "",
    q_issue_date: todayISO(), l_title: v.letter?.title ?? "", l_body: v.letter?.body ?? "" });
  let posten = $state<Posten[]>([]);
  let laeuft = $state("");
  const tun = (k: string, fn: () => Promise<unknown>) => { if (laeuft) return; laeuft = k; versuche(fn).finally(() => (laeuft = "")); };

  const sammeln = () => ({ customer_id: f.customer_id || null, service_text: f.service_text.trim() || null, valid_until: f.valid_until || null,
    intro: f.intro.trim(), notes: f.notes.trim(), items: posten, ...(wu ? { letter: { title: f.l_title.trim(), body: f.l_body.replace(/\s+$/, "") } } : {}) });
  const mitSummen = (d: any) => { const t = R.totals(d.items); return { ...d, net: t.net, vat: t.vat, gross: t.gross }; };
  async function sichern() {
    const d = mitSummen(sammeln());
    if (id) { const { error } = await R.write("quotes", "update", d, [["id", id]]); if (error) throw error; }
    else { const { data, error } = await R.write("quotes", "insert", { ...d, status: "draft" }); if (error) throw error; id = data.id; }
    return d;
  }
  async function abschliessen(senden: boolean) {
    const d = sammeln();
    if (!d.customer_id) throw new Error("Bitte einen Kunden wählen.");
    if (!positionsOf(d.items).length) throw new Error("Bitte mindestens eine Position eintragen.");
    const c = R.customer(d.customer_id);
    if (senden && !c?.email) throw new Error("Der Kunde hat keine E-Mail-Adresse. Trag sie beim Kunden ein oder wähle „Nur abschließen“.");
    if (!(await frage(senden ? "Angebot senden?" : "Nur abschließen?", senden ? `Angebot ${versendet ? "erneut " : ""}an ${c.email} senden?` : "Angebot abschließen, ohne es zu versenden?", senden ? "Senden" : "Abschließen"))) return;
    await sichern();
    const r = await R.act("quote_issue", { id, send: senden, issue_date: !v.number ? f.q_issue_date || todayISO() : todayISO() });
    zu(); await R.loadAll().catch(() => {});
    daten.melden(r.queued ? QUEUED_MSG : senden ? `Angebot ${r.quote.number} an ${c.email} gesendet` : `Angebot ${r.quote.number} abgeschlossen`);
  }
  const loeschen = () => tun("del", async () => {
    if (!(await frage("Angebotsentwurf löschen?", "Der Entwurf wird gelöscht.", "Löschen", true))) return;
    const { error } = await R.write("quotes", "delete", undefined, [["id", id]]); if (error) throw error;
    zu(); await R.loadAll().catch(() => {}); daten.melden("Entwurf gelöscht");
  });
</script>

<Blatt titel={neu ? "Neues Angebot" : versendet ? `Angebot ${v.number} bearbeiten` : wu ? "Website-Update-Angebot" : "Angebotsentwurf"} {zu} breit>
  {#if wu}
    <div class="box">
      <h3>Anschreiben (Seite 1)</h3>
      <label class="field"><span>Überschrift</span><input class="input" bind:value={f.l_title}></label>
      <label class="field"><span>Text</span><textarea class="input brief" rows="14" bind:value={f.l_body}></textarea></label>
      <p class="muted klein">Platzhalter werden beim Erstellen des PDFs ersetzt: {WU_PLACEHOLDERS}. Leerzeile = Absatz · <code>## </code> Überschrift · <code>- </code> Aufzählung</p>
    </div>
    <h3>Angebot (Seite 2)</h3>
  {/if}
  {#if versendet}<div class="note">Das Angebot wurde schon verschickt. Nach dem Speichern kannst du die neue Fassung direkt erneut senden – die Nummer bleibt gleich.</div>{/if}
  <div class="field"><span>Kunde</span>
    <div class="inline"><select class="input" bind:value={f.customer_id}><option value="">Kunde wählen …</option>{#each R.customers as c (c.id)}<option value={c.id}>{c.name}{c.number ? " · " + c.number : ""}{c.email ? "" : " (ohne E-Mail)"}</option>{/each}</select>
      <button type="button" class="btn btn--s" onclick={() => oeffneKunde(null, (k: any) => { if (k?.id) f.customer_id = k.id; })}><Icon name="plus" size={14} />Neu</button></div></div>
  <div class="drei">
    <label class="field"><span>Leistungszeitraum (optional)</span><input class="input" bind:value={f.service_text} placeholder="z. B. ab Dezember 2026"></label>
    <label class="field"><span>Gültig bis</span><input class="input" type="date" bind:value={f.valid_until}></label>
    {#if !v.number}<label class="field"><span>Angebotsdatum</span><input class="input" type="date" bind:value={f.q_issue_date} min={HISTORY_START} max={todayISO()}></label>{/if}
  </div>
  <p class="muted klein">Leer lassen = {R.settings.quote_valid_days} Tage ab Versand.</p>
  <label class="field"><span>Einleitungstext</span><textarea class="input" rows="2" bind:value={f.intro}></textarea></label>
  <h3>Positionen</h3>
  <p class="muted klein">Pro Position wählst du „Einmalig“ oder „Abo“. Nimmt der Kunde an, wird aus Einmaligem eine Rechnung und aus Abo-Positionen ein Abo.</p>
  <Positionen anfang={v.items ?? []} mitAbrechnung bind:posten />
  <label class="field"><span>Anmerkung (optional)</span><textarea class="input" rows="2" bind:value={f.notes} placeholder="Erscheint unter der Angebotssumme"></textarea></label>
  {#if !versendet}<p class="klein"><button type="button" class="lnk" onclick={() => tun("only", () => abschliessen(false))}>Nur abschließen, ohne Versand</button></p>{/if}
  {#snippet fuss()}
    {#if v.status === "draft" && !neu}<button class="btn del" onclick={loeschen} disabled={!!laeuft}>Löschen</button>{/if}
    <button class="btn" onclick={() => tun("preview", async () => { await sichern(); await R.openPdf({ id: id!, kind: "quote", number: v.number }); R.loadAll().catch(() => {}); })} disabled={!!laeuft}>{laeuft === "preview" ? "Lädt …" : "Vorschau"}</button>
    <button class="btn" onclick={() => tun("save", async () => { await sichern(); zu(); await R.loadAll().catch(() => {}); daten.melden("Angebot gespeichert"); })} disabled={!!laeuft}>Speichern</button>
    <button class="btn btn--primary" onclick={() => tun("send", () => abschliessen(true))} disabled={!!laeuft}>{versendet ? "Speichern & erneut senden" : "Abschließen & senden"}</button>
  {/snippet}
</Blatt>

<style>
  .box { display: grid; gap: 10px; padding: 14px 16px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); }
  .brief { font-size: .92rem; line-height: 1.55; }
  .note { padding: 10px 12px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; }
  .inline { display: flex; gap: 8px; }
  .inline .input { flex: 1; }
  .drei { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .klein { font-size: .84rem; margin: 0; line-height: 1.5; }
  code { font-size: .9em; padding: 1px 5px; border-radius: 4px; background: rgba(255, 255, 255, .07); }
  .lnk { border: 0; background: none; padding: 0; color: var(--text-2); text-decoration: underline; cursor: pointer; font: inherit; }
  .del { color: #FF8080; margin-right: auto; }
</style>
