<script lang="ts">
  // Abgeschlossenes Angebot: Stand, Umsetzung (Rechnung/Abos), Aktionen, Positionen, E-Mail-Verlauf
  import Blatt from "./Blatt.svelte";
  import Status from "./Status.svelte";
  import AngebotAnnehmen from "./AngebotAnnehmen.svelte";
  import AngebotEditor from "./AngebotEditor.svelte";
  import { R, QUEUED_MSG } from "../../lib/rechnungen/daten.svelte";
  import { B, versuche } from "../../lib/rechnungen/blatt.svelte";
  import { rechnungenAnsicht } from "../../lib/rechnungen/ansicht.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { auth } from "../../lib/auth.svelte";
  import { BILL_SUFFIX, INTERVALS, billingOf, discText, eur, fmtDate, fmtDateTime, fmtNum, lineNet, positionsOf, splitByBilling } from "../../lib/rechnungen/kern";
  import { oeffneAbo, oeffneRechnung } from "../../lib/rechnungen/oeffnen";

  let { zu, q: q0 }: { zu: () => void; q: any } = $props();
  const q = $derived(R.quote(q0.id) ?? q0);
  const logs = $derived(R.mail.filter((m) => m.quote_id === q.id));
  const inv = $derived(q.invoice_id ? R.invoice(q.invoice_id) : null);
  const abos = $derived(R.recurring.filter((r) => r.quote_id === q.id));
  const umgesetzt = $derived(!!inv || abos.length > 0);
  const mehrere = $derived(splitByBilling(q.items).length > 1);
  const mitAbo = $derived(splitByBilling(q.items).some((g) => g.billing !== "once"));
  const darf = $derived(auth.darf("rechnungen", true));
  let laeuft = $state("");
  const tun = (k: string, fn: () => Promise<unknown>) => { if (laeuft) return; laeuft = k; versuche(fn).finally(() => (laeuft = "")); };
  const setzen = (status: string, t: string) => tun(status, async () => {
    const { error } = await R.write("quotes", "update", { status, decided_at: status === "sent" ? null : new Date().toISOString() }, [["id", q.id]]);
    if (error) throw error; zu(); await R.loadAll().catch(() => {}); daten.melden(t);
  });
  function annehmen() {
    zu();
    setTimeout(() => B.auf(AngebotAnnehmen, { q, fertig: (res: { invoice: any; abos: number }) => {
      if (res.invoice) { rechnungenAnsicht.tab = "invoices"; oeffneRechnung(R.invoice(res.invoice.id) ?? res.invoice); } else rechnungenAnsicht.tab = "recurring";
      daten.melden(res.invoice && res.abos ? `Rechnungsentwurf und ${res.abos === 1 ? "Abo" : res.abos + " Abos"} angelegt` : res.invoice ? "Rechnungsentwurf angelegt – prüfen und abschicken" : `${res.abos === 1 ? "Abo" : res.abos + " Abos"} angelegt`);
    } }), 180);
  }
</script>

<Blatt titel={`Angebot ${q.number}`} {zu}>
  <div class="kopf"><span class="gross num" class:klein={mehrere}>{R.splitText(q.items)}</span><Status doc={q} angebot /></div>
  <div class="muted">{q.customer?.name || R.customer(q.customer_id)?.name || ""}{q.customer?.email ? " · " + q.customer.email : ""}</div>
  {#if umgesetzt}
    <div class="note">
      {#if inv}<div>Einmaliges berechnet mit <button class="lnk" onclick={() => { zu(); setTimeout(() => oeffneRechnung(inv), 180); }}>{inv.number || "Rechnungsentwurf"}</button></div>{/if}
      {#each abos as r (r.id)}<div>Abo {INTERVALS[r.interval]} · nächste Rechnung {fmtDate(r.next_date)} <button class="lnk" onclick={() => { zu(); rechnungenAnsicht.tab = "recurring"; setTimeout(() => oeffneAbo(r), 180); }}>öffnen</button></div>{/each}
    </div>
  {/if}
  <dl class="kv">
    <dt>Angebotsdatum</dt><dd>{fmtDate(q.issue_date)}</dd>
    <dt>Gültig bis</dt><dd>{fmtDate(q.valid_until)}</dd>
    {#if q.service_text}<dt>Leistung</dt><dd>{q.service_text}</dd>{/if}
    <dt>Versendet</dt><dd>{q.sent_at ? fmtDateTime(q.sent_at) : "noch nicht"}</dd>
    {#if q.decided_at}<dt>{q.status === "declined" ? "Abgelehnt am" : "Angenommen am"}</dt><dd>{fmtDate(String(q.decided_at).slice(0, 10))}</dd>{/if}
  </dl>
  <div class="aktionen">
    <button class="btn" onclick={() => tun("pdf", () => R.openPdf({ ...q, kind: "quote" }))} disabled={!!laeuft}>{laeuft === "pdf" ? "PDF wird erstellt …" : "PDF ansehen / teilen"}</button>
    {#if darf}
      {#if !umgesetzt && q.status !== "declined"}<button class="btn btn--primary" onclick={annehmen}>{mitAbo ? "Angenommen – Rechnung & Abo anlegen" : "Angenommen – in Rechnung umwandeln"}</button>{/if}
      {#if q.status === "sent"}<button class="btn" onclick={() => setzen("accepted", "Als angenommen markiert")}>Nur als angenommen markieren</button>{/if}
      {#if q.status === "sent"}<button class="btn" onclick={() => { zu(); setTimeout(() => B.auf(AngebotEditor, { q }), 180); }}>Bearbeiten</button>{/if}
      {#if ["sent", "accepted"].includes(q.status)}<button class="btn" onclick={() => tun("resend", async () => { if (!(await frage("Erneut senden?", "Das Angebot noch einmal an den Kunden senden?", "Senden"))) return; const r = await R.act("quote_send", { id: q.id }); zu(); await R.loadAll().catch(() => {}); daten.melden(r.queued ? QUEUED_MSG : `An ${r.to} gesendet`); })}>Erneut an Kunden senden</button>{/if}
      {#if q.status === "sent"}<button class="btn del" onclick={() => setzen("declined", "Als abgelehnt markiert")}>Als abgelehnt markieren</button>{/if}
      {#if ["accepted", "declined"].includes(q.status) && !umgesetzt}<button class="btn" onclick={() => setzen("sent", "Wieder offen")}>Wieder auf offen setzen</button>{/if}
    {/if}
  </div>
  <h3>Positionen</h3>
  <ul class="liste">
    {#each positionsOf(q.items || []) as it}<li>{fmtNum(it.quantity, 3)} {it.unit || ""} · {String(it.description || "").split("\n")[0]} · {eur(lineNet(it))}{BILL_SUFFIX[billingOf(it)]}</li>{/each}
    {#each splitByBilling(q.items || []) as g}{#each R.totals(g.items).discounts as d}<li class="rab">{discText(d)} · −{eur(d.amount)}{BILL_SUFFIX[g.billing]}</li>{/each}{/each}
  </ul>
  <h3>E-Mail-Verlauf</h3>
  {#if logs.length}
    <ul class="liste">{#each logs as m (m.id)}<li>{fmtDateTime(m.sent_at)} · an {m.recipient} {#if m.status === "sent"}✓{:else}<span class="fehl">fehlgeschlagen: {m.error}</span>{/if}</li>{/each}</ul>
  {:else}<p class="muted">Noch keine E-Mails.</p>{/if}
</Blatt>

<style>
  .kopf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .gross { font-size: 2.1rem; font-weight: 600; color: var(--text); letter-spacing: -.02em; }
  .gross.klein { font-size: 1.5rem; }
  .note { padding: 10px 12px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; display: grid; gap: 4px; }
  .lnk { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; font-weight: 600; }
  .kv { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; font-size: .92rem; }
  .kv dt { color: var(--steel); }
  .kv dd { margin: 0; color: var(--text); }
  .aktionen { display: grid; gap: 8px; }
  .del { color: #FF8080; }
  .liste { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: .88rem; color: var(--text-2); }
  .rab, .fehl { color: #FF8080; }
  p { margin: 0; }
</style>
