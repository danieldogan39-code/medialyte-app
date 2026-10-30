<script lang="ts">
  // Rechnung als bezahlt markieren, mit dem Tag des Geldeingangs (zählt für die Umsatzstatistik)
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { HISTORY_START, eur, fmtDate, todayISO } from "../../lib/rechnungen/kern";
  let { zu, inv }: { zu: () => void; inv: any } = $props();
  const min = [inv.issue_date, HISTORY_START].filter(Boolean).sort().pop();
  let tag = $state(todayISO());
  const ok = () => versuche(async () => {
    if (!tag || tag < min || tag > todayISO()) throw new Error("Bitte ein Datum zwischen Rechnungsdatum und heute wählen.");
    const { error } = await R.write("invoices", "update", { status: "paid", paid_at: new Date(tag + "T12:00:00Z").toISOString() }, [["id", inv.id]]);
    if (error) throw error; zu(); await R.loadAll().catch(() => {}); daten.melden(`Bezahlt am ${fmtDate(tag)}`);
  });
</script>

<Blatt titel={`${inv.number} als bezahlt markieren`} {zu}>
  <p class="muted">{R.custName(inv)} · {eur(inv.gross)}</p>
  <label class="field"><span>Geld eingegangen am</span><input class="input" type="date" bind:value={tag} {min} max={todayISO()}></label>
  <p class="muted klein">Das Datum zählt für deine Umsatzstatistik (Geldeingang).</p>
  {#snippet fuss()}<button class="btn btn--primary" onclick={ok}>Als bezahlt markieren</button>{/snippet}
</Blatt>

<style>p { margin: 0; } .klein { font-size: .86rem; }</style>
