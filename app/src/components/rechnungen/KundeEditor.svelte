<script lang="ts">
  // Rechnungskunde anlegen/bearbeiten, mit Rechnungsverzeichnis (alle Rechnungen dieses Kunden)
  import Blatt from "./Blatt.svelte";
  import Status from "./Status.svelte";
  import KategorieWahl from "./KategorieWahl.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { eur, fmtDate, isOn } from "../../lib/rechnungen/kern";
  import { oeffneRechnung } from "../../lib/rechnungen/oeffnen";

  // vorlage: Angaben für einen neuen Kunden (z. B. aus dem Impressum der Website), kundeSlug: gleich mit der Website verknüpfen
  let { zu, c = null, gespeichert, vorlage = {}, kundeSlug = null }: { zu: () => void; c?: any; gespeichert?: (k: any) => void; vorlage?: Record<string, string>; kundeSlug?: string | null } = $props();
  const neu = !c;
  const K = ["number", "name", "contact", "email", "street", "zip", "city", "country", "vat_id", "website"] as const;
  let f = $state<Record<string, string>>(Object.fromEntries(K.map((k) => [k, k === "number" ? (c?.number ?? (neu ? R.nextCustomerNumber() : "")) : k === "country" ? (c?.country ?? "Deutschland") : (c?.[k] ?? vorlage[k] ?? "")])));
  let start = $state(String(c?.invoice_start ?? 1));
  let kategorien = $state<string[]>([...(c?.kategorien ?? (kundeSlug && R.webKategorie ? [R.webKategorie.id] : []))]);
  let feld: HTMLInputElement | undefined = $state();
  $effect(() => { if (neu) setTimeout(() => feld?.focus(), 200); });
  const proKunde = $derived(isOn(R.settings.number_per_customer));
  const liste = $derived(neu ? [] : R.invoices.filter((i) => i.customer_id === c.id).sort((a, b) => String(b.issue_date || "9999").localeCompare(String(a.issue_date || "9999")) || String(b.number || "").localeCompare(String(a.number || ""))));
  const echt = $derived(liste.filter((i) => i.kind === "invoice" && ["open", "paid"].includes(i.status)));
  const bezahlt = $derived(echt.filter((i) => i.status === "paid").reduce((a, i) => a + +i.gross, 0));
  const offen = $derived(echt.filter((i) => i.status === "open").reduce((a, i) => a + +i.gross, 0));

  const speichern = () => versuche(async () => {
    const d: Record<string, any> = Object.fromEntries(K.map((k) => [k, f[k].trim() || null]));
    if (proKunde) d.invoice_start = Math.max(1, parseInt(start, 10) || 1);
    if (!d.name) throw new Error("Bitte einen Namen eintragen.");
    if (neu && kundeSlug) d.kunde_slug = kundeSlug;
    if (R.kategorien.length) d.kategorien = kategorien;
    const r = neu ? await R.write("customers", "insert", d) : await R.write("customers", "update", d, [["id", c.id]]);
    if (r.error) throw r.error;
    zu(); await R.loadAll().catch(() => {}); gespeichert?.(r.data); daten.melden("Kunde gespeichert");
  });
  const loeschen = () => versuche(async () => {
    if (!(await frage(`${c.name} löschen?`, "Bereits ausgestellte Rechnungen bleiben erhalten.", "Löschen", true))) return;
    const { error } = await R.write("customers", "delete", undefined, [["id", c.id]]);
    if (error) throw new Error(/foreign key|violates/i.test(error.message) ? "Zu diesem Kunden gibt es noch ein Abo. Lösche zuerst das Abo." : error.message);
    zu(); await R.loadAll().catch(() => {}); daten.melden("Kunde gelöscht");
  });
</script>

<Blatt titel={neu ? "Neuer Kunde" : (c.number ? c.number + " · " : "") + c.name} {zu}>
  <div class="drei"><label class="field"><span>Kundennr.</span><input class="input" bind:value={f.number}></label><label class="field"><span>Firma oder Name</span><input class="input" bind:this={feld} bind:value={f.name} required></label></div>
  <label class="field"><span>Ansprechpartner (für die Anrede)</span><input class="input" bind:value={f.contact} placeholder="z. B. Frau Schulz"></label>
  <label class="field"><span>E-Mail für Rechnungen</span><input class="input" type="email" inputmode="email" bind:value={f.email}></label>
  <label class="field"><span>Straße und Hausnummer</span><input class="input" bind:value={f.street}></label>
  <div class="drei"><label class="field"><span>PLZ</span><input class="input" inputmode="numeric" bind:value={f.zip}></label><label class="field"><span>Ort</span><input class="input" bind:value={f.city}></label></div>
  <div class="zwei"><label class="field"><span>Land</span><input class="input" bind:value={f.country}></label><label class="field"><span>USt-IdNr. (optional)</span><input class="input" bind:value={f.vat_id}></label></div>
  <div class="field"><span>Kategorien</span><KategorieWahl ausgewaehlt={kategorien} onchange={(ids) => (kategorien = ids)} /></div>
  <label class="field"><span>Website (optional)</span><input class="input" inputmode="url" bind:value={f.website} placeholder="z. B. rubin-gold.de"></label>
  {#if proKunde}
    <label class="field"><span>Rechnungen fortsetzen ab Nr.</span><input class="input" inputmode="numeric" bind:value={start}></label>
    <p class="muted klein">{#if !neu && +c.invoice_counter}Zuletzt vergeben: {R.customerInvoiceNumber(c, c.invoice_counter)} · {/if}Nächste Rechnung: <b>{R.customerInvoiceNumber({ ...(c ?? {}), number: f.number }, Math.max((+(c?.invoice_counter ?? 0) || 0) + 1, +start || 1))}</b></p>
  {/if}
  {#if !neu}
    <h3>Rechnungsverzeichnis</h3>
    <div class="kz">
      <div class="card"><small>Rechnungen</small><b class="num">{echt.length}</b></div>
      <div class="card"><small>Bezahlt</small><b class="num">{eur(bezahlt)}</b></div>
      <div class="card" class:rot={offen}><small>Offen</small><b class="num">{eur(offen)}</b></div>
    </div>
    {#if liste.length}
      <div class="liste">
        {#each liste as i (i.id)}
          <button class="zeile" onclick={() => { zu(); setTimeout(() => oeffneRechnung(i), 180); }}>
            <span class="h"><b>{i.number || "Entwurf"}</b><small class="muted">{i.issue_date ? fmtDate(i.issue_date) : "noch nicht ausgestellt"}{i.service_text ? " · " + i.service_text : ""}{i.imported ? " · übernommen" : ""}</small></span>
            <span class="r"><b class="num">{eur(R.invTotal(i))}</b><Status doc={i} /></span>
          </button>
        {/each}
      </div>
    {:else}<p class="muted klein">Noch keine Rechnungen für diesen Kunden.</p>{/if}
  {/if}
  {#snippet fuss()}
    {#if !neu}<button class="btn del" onclick={loeschen}>Löschen</button>{/if}
    <button class="btn btn--primary" onclick={speichern}>Speichern</button>
  {/snippet}
</Blatt>

<style>
  .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .drei { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
  @media (max-width: 520px) { .zwei { grid-template-columns: 1fr; } }
  .klein { font-size: .84rem; margin: -6px 0 0; }
  h3 { margin-top: 6px; }
  .kz { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .kz .card { padding: 10px 12px; display: grid; gap: 2px; background: var(--bg-2); }
  .kz small { color: var(--steel); font-size: .78rem; }
  .kz b { color: var(--text); font-size: 1.05rem; }
  .kz .rot b { color: #FF8080; }
  .liste { display: grid; gap: 6px; }
  .zeile { display: flex; justify-content: space-between; gap: 12px; align-items: center; text-align: left; padding: 10px 12px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--bg-2); color: inherit; cursor: pointer; font: inherit; }
  .h { display: grid; gap: 2px; min-width: 0; }
  .h b, .r b { color: var(--text); font-weight: 600; }
  .h small { font-size: .78rem; }
  .r { display: grid; justify-items: end; gap: 4px; }
  .del { color: #FF8080; margin-right: auto; }
</style>
