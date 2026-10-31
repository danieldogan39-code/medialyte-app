<script lang="ts">
  // Ausgestellte Rechnung: Stand, Bezüge (Angebot, Storno, Ersatz), Aktionen, Positionen und E-Mail-Verlauf
  import Blatt from "./Blatt.svelte";
  import Status from "./Status.svelte";
  import Bezahlt from "./Bezahlt.svelte";
  import { R, QUEUED_MSG } from "../../lib/rechnungen/daten.svelte";
  import { B, versuche } from "../../lib/rechnungen/blatt.svelte";
  import { invStatus } from "../../lib/rechnungen/status";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { TYPE_LABEL, discText, eur, fmtDate, fmtDateTime, fmtNum, lineNet, positionsOf } from "../../lib/rechnungen/kern";
  import { oeffneAngebot, oeffneRechnung } from "../../lib/rechnungen/oeffnen";
  import RechnungEditor from "./RechnungEditor.svelte";
  import { auth } from "../../lib/auth.svelte";
  import { sb } from "../../lib/supabase";
  import { onMount } from "svelte";

  let { zu, inv }: { zu: () => void; inv: any } = $props();
  const i = $derived(R.invoice(inv.id) ?? inv);
  const st = $derived(invStatus(i));
  const ref = $derived(i.ref_invoice_id ? R.invoice(i.ref_invoice_id) : null);
  const storno = $derived(R.invoices.find((x) => x.kind === "storno" && x.ref_invoice_id === i.id));
  const ersatz = $derived(R.invoices.find((x) => x.kind === "invoice" && x.ref_invoice_id === i.id));
  const ausAngebot = $derived(R.quotes.find((q) => q.invoice_id === i.id));
  const logs = $derived(R.mail.filter((m) => m.invoice_id === i.id));
  const istRe = $derived(i.kind === "invoice");
  const darf = $derived(auth.darf("rechnungen", true));
  let laeuft = $state("");
  const tun = (k: string, fn: () => Promise<unknown>) => { if (laeuft) return; laeuft = k; versuche(fn).finally(() => (laeuft = "")); };
  const danach = async (t: string) => { zu(); await R.loadAll().catch(() => {}); if (t) daten.melden(t); };
  const springe = (x: any) => { zu(); setTimeout(() => oeffneRechnung(x), 180); };
  // GoBD: Ausgestellte Rechnungen werden 8 Jahre aufbewahrt und nie gelöscht. „Ausblenden“ nimmt sie aus Listen und Umsatz,
  // sie bleiben aber unverändert gespeichert, im Prüfer-Export und jederzeit wieder einblendbar.
  const name = $derived(`${i.kind === "storno" ? "Stornorechnung" : "Rechnung"} ${i.number || ""}`.trim());
  let blendAus = $state(false), grund = $state("");
  const ausblenden = () => tun("hide", async () => {
    const mitStorno = storno && !storno.ausgeblendet_am && (await frage(`Stornorechnung ${storno.number} auch ausblenden?`, `Sie gehört zu ${name}.`, "Auch ausblenden"));
    const jetzt = new Date().toISOString(), g = grund.trim() || null;
    for (const x of mitStorno ? [storno, i] : [i]) { const { error } = await R.write("invoices", "update", { ausgeblendet_am: jetzt, ausgeblendet_grund: g }, [["id", x.id]]); if (error) throw error; }
    blendAus = false; grund = "";
    await danach(mitStorno ? `${name} und Stornorechnung ausgeblendet` : `${name} ausgeblendet`);
  });
  const einblenden = () => tun("show", async () => {
    const { error } = await R.write("invoices", "update", { ausgeblendet_am: null, ausgeblendet_grund: null }, [["id", i.id]]); if (error) throw error;
    daten.melden(`${name} wieder eingeblendet`);
  });

  // Änderungsverlauf aus dem unveränderlichen Protokoll
  const FELD: Record<string, string> = { status: "Status", paid_at: "Bezahlt am", sent_at: "Versendet", reminders_sent: "Erinnerungen", number: "Nummer",
    ausgeblendet_am: "Ausgeblendet", ausgeblendet_grund: "Grund", beleg_pfad: "Original-PDF", issue_date: "Rechnungsdatum", due_date: "Fällig am",
    items: "Positionen", customer: "Kunde", customer_id: "Kunde", gross: "Brutto", service_text: "Leistung", intro: "Einleitung", notes: "Hinweise" };
  const STAT: Record<string, string> = { draft: "Entwurf", open: "offen", paid: "bezahlt", cancelled: "storniert" };
  const wert = (k: string, v: any) => v === null || v === undefined || v === "" ? "–" : k === "status" ? STAT[v] ?? v
    : /_at$|_date$/.test(k) ? fmtDate(String(v).slice(0, 10)) : k === "gross" ? eur(v) : k === "beleg_pfad" ? "abgelegt" : typeof v === "object" ? "geändert" : String(v);
  type Eintrag = { id: number; zeit: string; aktion: string; wer: string | null; aenderungen: Record<string, any> };
  let verlauf = $state<Eintrag[] | null>(null);
  const zeilen = (e: Eintrag) => e.aktion !== "geaendert" ? [] : Object.entries(e.aenderungen)
    .filter(([k]) => FELD[k] && k !== "customer_id")
    .map(([k, v]) => (k === "items" || k === "customer" || k === "beleg_pfad" || k === "ausgeblendet_grund") ? `${FELD[k]} ${wert(k, v?.neu)}` : `${FELD[k]}: ${wert(k, v?.alt)} → ${wert(k, v?.neu)}`);
  onMount(async () => {
    const { data } = await sb.from("beleg_protokoll").select("id,zeit,aktion,wer,aenderungen").eq("datensatz", inv.id).order("id", { ascending: false }).limit(100);
    verlauf = (data as Eintrag[]) ?? [];
  });
</script>

<Blatt titel={`${i.kind === "storno" ? "Stornorechnung" : "Rechnung"} ${i.number}`} {zu}>
  <div class="kopf"><span class="gross num">{eur(i.gross)}</span><Status doc={i} /></div>
  <div class="muted">{R.custName(i)}{i.customer?.email ? " · " + i.customer.email : ""}</div>
  {#if ausAngebot || ref || storno || ersatz}
    <div class="note">
      {#if ausAngebot}<div>Aus Angebot <button class="lnk" onclick={() => { zu(); setTimeout(() => oeffneAngebot(ausAngebot), 180); }}>{ausAngebot.number || "Entwurf"}</button></div>{/if}
      {#if ref}<div>{i.kind === "storno" ? "Storniert" : "Ersetzt"} <button class="lnk" onclick={() => springe(ref)}>{ref.number}</button></div>{/if}
      {#if storno}<div>Storniert durch <button class="lnk" onclick={() => springe(storno)}>{storno.number}</button></div>{/if}
      {#if ersatz}<div>Ersetzt durch <button class="lnk" onclick={() => springe(ersatz)}>{ersatz.number || "Entwurf"}</button></div>{/if}
    </div>
  {/if}
  <dl class="kv">
    <dt>Rechnungsdatum</dt><dd>{fmtDate(i.issue_date)}</dd>
    {#if i.service_text}<dt>Leistung</dt><dd>{i.service_text}</dd>{/if}
    {#if istRe}<dt>Fällig am</dt><dd>{fmtDate(i.due_date)}</dd>{/if}
    <dt>Netto / USt</dt><dd>{eur(i.net)} / {eur(i.vat)}</dd>
    <dt>Versendet</dt><dd>{i.sent_at ? fmtDateTime(i.sent_at) : "noch nicht"}</dd>
    {#if istRe && i.reminders_sent}<dt>Erinnerungen</dt><dd>{i.reminders_sent}, zuletzt {fmtDate(i.last_reminder_at)}</dd>{/if}
    {#if i.paid_at}<dt>Bezahlt am</dt><dd>{fmtDate(String(i.paid_at).slice(0, 10))}</dd>{/if}
    {#if i.recurring_id}<dt>Herkunft</dt><dd>Abo</dd>{/if}
    {#if i.imported}<dt>Herkunft</dt><dd>Übernommen aus dem alten System</dd>{/if}
    <dt>Original-PDF</dt><dd>{#if i.beleg_am}abgelegt am {fmtDateTime(i.beleg_am)}{i.beleg_nachtraeglich ? " (nachträglich)" : ""}<span class="hash" title="SHA-256-Prüfsumme">{i.beleg_sha256}</span>{:else}wird beim nächsten Öffnen abgelegt{/if}</dd>
    {#if i.ausgeblendet_am}<dt>Ausgeblendet</dt><dd>{fmtDateTime(i.ausgeblendet_am)}{i.ausgeblendet_grund ? " · " + i.ausgeblendet_grund : ""}</dd>{/if}
  </dl>
  {#if i.ausgeblendet_am}<div class="note">Ausgeblendet: Sie erscheint nicht in Listen und Umsatz, bleibt aber unverändert aufbewahrt und im GoBD-Export.</div>{/if}
  <div class="aktionen">
    <button class="btn" onclick={() => tun("pdf", () => R.openPdf(i))} disabled={!!laeuft}>{laeuft === "pdf" ? "PDF wird erstellt …" : "PDF ansehen / teilen"}</button>
    {#if darf}
      {#if istRe && i.status === "open"}<button class="btn btn--primary" onclick={() => { zu(); setTimeout(() => B.auf(Bezahlt, { inv: i }), 180); }}>Als bezahlt markieren</button>{/if}
      {#if istRe && i.status === "paid"}<button class="btn" onclick={() => tun("unpaid", async () => { const { error } = await R.write("invoices", "update", { status: "open", paid_at: null }, [["id", i.id]]); if (error) throw error; await danach("Wieder als offen markiert"); })}>Doch nicht bezahlt</button>{/if}
      {#if istRe && i.status === "open" && st.key === "overdue"}<button class="btn" onclick={() => tun("remind", async () => { if (!(await frage("Zahlungserinnerung senden?", "Zahlungserinnerung jetzt an den Kunden senden?", "Senden"))) return; const r = await R.act("remind", { id: i.id }); await danach(r.queued ? QUEUED_MSG : `Erinnerung an ${r.to} gesendet`); })}>Zahlungserinnerung jetzt senden</button>{/if}
      <button class="btn" onclick={() => tun("resend", async () => { if (!(await frage("Erneut senden?", "Die Rechnung noch einmal an den Kunden senden?", "Senden"))) return; const r = await R.act("send", { id: i.id }); await danach(r.queued ? QUEUED_MSG : `An ${r.to} gesendet`); })}>Erneut an Kunden senden</button>
      {#if istRe && ["open", "paid"].includes(i.status)}
        <button class="btn" onclick={() => tun("correct", async () => {
          if (!(await frage(`Rechnung ${i.number} korrigieren?`, "Sie wird storniert und als neuer Entwurf kopiert. Den Entwurf passt du an und schickst ihn ab. Der Kunde bekommt dann Storno und neue Rechnung zusammen.", "Korrigieren"))) return;
          R.needsNet("Korrigieren");
          const r = await R.fn("correct", { id: i.id, mode: "replace" });
          zu(); await R.loadAll().catch(() => {}); setTimeout(() => B.auf(RechnungEditor, { inv: R.invoice(r.draft.id) }), 180);
        })}>Korrigieren (Storno + neue Rechnung)</button>
        <button class="btn del" onclick={() => tun("cancel", async () => {
          if (!(await frage(`Rechnung ${i.number} stornieren?`, "Es wird eine Stornorechnung erstellt und an den Kunden geschickt.", "Stornieren", true))) return;
          const r = await R.act("correct", { id: i.id, mode: "cancel" });
          await danach(r.queued ? QUEUED_MSG : r.mailError ? `Storniert, aber Versand fehlgeschlagen: ${r.mailError}` : "Storniert und Stornorechnung versendet");
        })}>Stornieren</button>
      {/if}
      {#if i.ausgeblendet_am}
        <button class="btn" onclick={einblenden} disabled={!!laeuft}>{laeuft === "show" ? "Wird eingeblendet …" : "Wieder einblenden"}</button>
      {:else if blendAus}
        <div class="aus">
          <p class="klein">Rechnungen werden 8 Jahre aufbewahrt und lassen sich nicht löschen. Ausgeblendet erscheint sie nicht mehr in Listen und Umsatz, bleibt aber gespeichert. Für eine falsche Rechnung ist Stornieren der richtige Weg.</p>
          <label class="field"><span>Grund (optional)</span><input class="input" bind:value={grund} maxlength="200" placeholder="z. B. Testrechnung"></label>
          <div class="reihe"><button class="btn" onclick={() => { blendAus = false; grund = ""; }}>Abbrechen</button><button class="btn del" onclick={ausblenden} disabled={!!laeuft}>{laeuft === "hide" ? "Wird ausgeblendet …" : "Ausblenden"}</button></div>
        </div>
      {:else}
        <button class="btn del" onclick={() => (blendAus = true)} disabled={!!laeuft}>Rechnung ausblenden</button>
      {/if}
    {/if}
  </div>
  <h3>Positionen</h3>
  <ul class="liste">
    {#each positionsOf(i.items || []) as it}<li>{fmtNum(it.quantity, 3)} {it.unit || ""} · {it.description} · {eur(lineNet(it))}{#if +(it.discount ?? 0)} (−{fmtNum(it.discount, 3)} %{it.discount_label ? " " + it.discount_label : ""}){/if}</li>{/each}
    {#each R.totals(i.items || []).discounts as d}<li class="rab">{discText(d)} · −{eur(d.amount)}</li>{/each}
  </ul>
  <h3>E-Mail-Verlauf</h3>
  {#if logs.length}
    <ul class="liste">{#each logs as m (m.id)}<li>{fmtDateTime(m.sent_at)} · {TYPE_LABEL[m.type] || m.type} an {m.recipient} {#if m.status === "sent"}✓{:else}<span class="fehl">fehlgeschlagen: {m.error}</span>{/if}</li>{/each}</ul>
  {:else}<p class="muted klein">Noch keine E-Mails.</p>{/if}
  <h3>Änderungsverlauf</h3>
  {#if verlauf === null}<p class="muted klein">Wird geladen …</p>
  {:else if verlauf.length}
    <ul class="liste">{#each verlauf as e (e.id)}<li>{fmtDateTime(e.zeit)} · {e.aktion === "angelegt" ? "angelegt" : e.aktion === "geloescht" ? "gelöscht" : "geändert"}{#if e.wer} · {daten.name(e.wer) || "Team"}{:else} · automatisch{/if}{#each zeilen(e) as z}<br><span class="muted">{z}</span>{/each}</li>{/each}</ul>
  {:else}<p class="muted klein">Noch keine Einträge (das Protokoll läuft seit dem Update zur GoBD-Ablage).</p>{/if}
</Blatt>

<style>
  .kopf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .gross { font-size: 2.1rem; font-weight: 600; color: var(--text); letter-spacing: -.02em; }
  .note { padding: 10px 12px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; display: grid; gap: 4px; }
  .lnk { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; font-weight: 600; }
  .kv { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; font-size: .92rem; }
  .kv dt { color: var(--steel); }
  .kv dd { margin: 0; color: var(--text); white-space: pre-line; }
  .aktionen { display: grid; gap: 8px; }
  .aktionen .btn { justify-content: center; }
  .del { color: #FF8080; }
  .liste { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: .88rem; color: var(--text-2); }
  .liste li { white-space: pre-line; }
  .rab { color: #FF8080; }
  .fehl { color: #FF8080; }
  .klein { font-size: .86rem; margin: 0; }
  .hash { display: block; font-size: .72rem; color: var(--steel); word-break: break-all; }
  .aus { display: grid; gap: 10px; padding: 12px; border-radius: var(--radius-s); border: 1px solid var(--line-2); }
  .reihe { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
