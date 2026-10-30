<script lang="ts">
  // Angenommenes Angebot umsetzen: Einmaliges → Rechnungsentwurf, Abo-Positionen → Abo(s)
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { BILL_SUFFIX, INTERVALS, eur, firstOfNextMonth, positionsOf, splitByBilling } from "../../lib/rechnungen/kern";
  let { zu, q, fertig }: { zu: () => void; q: any; fertig?: (res: { invoice: any; abos: number }) => void } = $props();
  const gruppen = splitByBilling(q.items);
  const einmal = gruppen.find((g) => g.billing === "once");
  const abos = gruppen.filter((g) => g.billing !== "once");
  let start = $state<Record<string, string>>(Object.fromEntries(abos.map((g) => [g.billing, firstOfNextMonth()])));
  let auto = $state<Record<string, boolean>>(Object.fromEntries(abos.map((g) => [g.billing, true])));
  const ohneAbrechnung = (items: any[]) => items.map(({ billing, ...it }) => it);
  const los = () => versuche(async () => {
    const res: { invoice: any; abos: number } = { invoice: null, abos: 0 };
    if (einmal) {
      const { data, error } = await R.write("invoices", "insert", { status: "draft", kind: "invoice", customer_id: q.customer_id, items: ohneAbrechnung(einmal.items),
        service_text: q.service_text || "", intro: R.settings.intro, notes: q.notes || "" });
      if (error) throw error; res.invoice = data;
    }
    for (const g of abos) {
      if (!start[g.billing]) throw new Error("Bitte ein Startdatum für das Abo wählen.");
      const p = positionsOf(g.items);
      const { error } = await R.write("recurring", "insert", { customer_id: q.customer_id, title: `${String(p[0].description || "").split("\n")[0]}${p.length > 1 ? ` + ${p.length - 1} weitere` : ""}`,
        items: ohneAbrechnung(g.items), interval: g.billing, next_date: start[g.billing], auto_send: auto[g.billing], active: true, quote_id: q.id });
      if (error) throw error; res.abos++;
    }
    const { error: e2 } = await R.write("quotes", "update", { status: "accepted", invoice_id: res.invoice?.id || null, decided_at: q.decided_at || new Date().toISOString() }, [["id", q.id]]);
    if (e2) throw e2;
    zu(); await R.loadAll().catch(() => {}); fertig?.(res);
  });
</script>

<Blatt titel={`Angebot ${q.number} umsetzen`} {zu}>
  <p class="muted">Der Kunde hat zugesagt? Dann lege ich das an:</p>
  {#if einmal}
    {@const n = positionsOf(einmal.items).length}
    <div class="box"><h3>Rechnungsentwurf</h3><p class="muted">Einmalige Positionen über <b>{eur(R.totals(einmal.items).gross)}</b> ({n} {n === 1 ? "Position" : "Positionen"}). Du prüfst den Entwurf und schickst ihn ab.</p></div>
  {/if}
  {#each abos as g (g.billing)}
    <div class="box"><h3>Abo · {INTERVALS[g.billing]}</h3>
      <p class="muted">{eur(R.totals(g.items).gross)}{BILL_SUFFIX[g.billing]} · {positionsOf(g.items).map((it) => String(it.description || "").split("\n")[0]).join(", ")}</p>
      <label class="field"><span>Erste Abo-Rechnung am</span><input class="input" type="date" bind:value={start[g.billing]}></label>
      <label class="check"><input type="checkbox" bind:checked={auto[g.billing]}>Automatisch an den Kunden senden</label>
    </div>
  {/each}
  {#snippet fuss()}<button class="btn btn--primary" onclick={los}>Angebot annehmen & anlegen</button>{/snippet}
</Blatt>

<style>
  p { margin: 0; }
  .box { display: grid; gap: 10px; padding: 14px 16px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); }
  .check { display: flex; gap: 8px; align-items: center; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--coral); }
</style>
