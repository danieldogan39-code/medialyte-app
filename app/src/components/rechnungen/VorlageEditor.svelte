<script lang="ts">
  // Standard-Position anlegen oder bearbeiten
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { BILLING, UNITS, billingOf, fmtNum, num } from "../../lib/rechnungen/kern";
  let { zu, p = null }: { zu: () => void; p?: any } = $props();
  const neu = !p;
  let f = $state({ name: p?.name ?? "", details: p?.details ?? "", unit: p?.unit ?? "pauschal", price: p && p.price !== "" ? fmtNum(p.price) : "", discount: +(p?.discount ?? 0) ? fmtNum(p.discount, 3) : "", vat: p ? +p.vat : 19, billing: billingOf(p) });
  let feld: HTMLInputElement | undefined = $state();
  $effect(() => { if (neu) setTimeout(() => feld?.focus(), 200); });
  const speichern = () => versuche(async () => {
    const d = { name: f.name.trim(), details: f.details.trim() || null, unit: f.unit.trim() || null, price: num(f.price), discount: num(f.discount), vat: R.small ? 0 : +f.vat, billing: f.billing };
    if (!d.name) throw new Error("Bitte eine Bezeichnung eintragen.");
    const r = neu ? await R.write("products", "insert", d) : await R.write("products", "update", d, [["id", p.id]]);
    if (r.error) throw r.error;
    zu(); await R.reloadProducts(); daten.melden("Vorlage gespeichert");
  });
  const loeschen = () => versuche(async () => {
    if (!(await frage("Vorlage löschen?", `Vorlage „${p.name}“ löschen? Bestehende Rechnungen bleiben unverändert.`, "Löschen", true))) return;
    const { error } = await R.write("products", "delete", undefined, [["id", p.id]]); if (error) throw error;
    zu(); await R.reloadProducts(); daten.melden("Vorlage gelöscht");
  });
</script>

<Blatt titel={neu ? "Neue Standard-Position" : "Standard-Position bearbeiten"} {zu}>
  <label class="field"><span>Bezeichnung (fett auf der Rechnung)</span><input class="input" bind:this={feld} bind:value={f.name} placeholder="z. B. Website Management (monatlich)"></label>
  <label class="field"><span>Abrechnungsart</span><select class="input" bind:value={f.billing}>{#each Object.entries(BILLING) as [k, t]}<option value={k}>{t}</option>{/each}</select></label>
  <label class="field"><span>Details (optional, kleiner darunter)</span><textarea class="input" rows="2" bind:value={f.details} placeholder="z. B. Instandhaltung, Administration, Änderungen"></textarea></label>
  <div class="zwei">
    <label class="field"><span>Einheit</span><input class="input" list="einheiten2" bind:value={f.unit}><datalist id="einheiten2">{#each UNITS as u}<option value={u}></option>{/each}</datalist></label>
    <label class="field"><span>Preis {R.small ? "" : "netto "}€</span><input class="input" inputmode="decimal" bind:value={f.price} placeholder="0,00"></label>
  </div>
  <div class="zwei">
    <label class="field"><span>Rabatt %</span><input class="input" inputmode="decimal" bind:value={f.discount} placeholder="0"></label>
    {#if !R.small}<label class="field"><span>USt</span><select class="input" bind:value={f.vat}>{#each [19, 7, 0] as v}<option value={v}>{v} %</option>{/each}</select></label>{/if}
  </div>
  {#snippet fuss()}
    {#if !neu}<button class="btn del" onclick={loeschen}>Löschen</button>{/if}
    <button class="btn btn--primary" onclick={speichern}>Speichern</button>
  {/snippet}
</Blatt>

<style>
  .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .del { color: #FF8080; margin-right: auto; }
</style>
