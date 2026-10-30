<script lang="ts">
  // Positionen-Editor (Rechnungen, Angebote, Abos, Website-Update-Vorlage): Positionen mit Menge, Einheit, Preis,
  // Rabatt und USt, bei Angeboten mit Abrechnungsart (einmalig/Abo); Gesamtrabatte; Vorlagen; Summen live.
  import Icon from "../Icon.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { B, versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { BILLING, BILL_SUFFIX, INTERVALS, UNITS, billingOf, discText, eur, fmtNum, isDiscLine, lineNet, num, positionsOf, splitByBilling, type Posten } from "../../lib/rechnungen/kern";
  import VorlagenWahl from "./VorlagenWahl.svelte";

  let { anfang = [], mitAbrechnung = false, posten = $bindable([]) }: { anfang?: Posten[]; mitAbrechnung?: boolean; posten?: Posten[] } = $props();
  type Zeile = { k: number; desc: string; qty: string; unit: string; price: string; disc: string; vat: number; dlabel: string; bill: string };
  type Rabatt = { k: number; name: string; val: string; mode: string; bill: string };
  let n = 0;
  const zuZeile = (it: Posten = {}): Zeile => ({ k: ++n, desc: it.description ?? "", qty: fmtNum(it.quantity ?? 1, 3), unit: it.unit ?? "Std.", price: it.price != null && it.price !== ("" as any) ? fmtNum(it.price) : "",
    disc: +(it.discount ?? 0) ? fmtNum(it.discount, 3) : "", vat: R.small ? 0 : (it.vat ?? 19), dlabel: it.discount_label ?? "", bill: billingOf(it) });
  const zuRabatt = (d: Posten = {}): Rabatt => ({ k: ++n, name: d.description ?? "", val: +(d.value ?? 0) ? fmtNum(d.value, 3) : "", mode: d.mode === "amount" ? "amount" : "percent", bill: billingOf(d) });
  const start = positionsOf(anfang);
  let zeilen = $state<Zeile[]>((start.length ? start : [{}]).map(zuZeile));
  let rabatte = $state<Rabatt[]>(anfang.filter(isDiscLine).map(zuRabatt));

  function lesen(): Posten[] {
    const pos = zeilen.map((z) => {
      const discount = num(z.disc), label = z.dlabel.trim();
      return { description: z.desc.trim(), quantity: num(z.qty), unit: z.unit.trim(), price: num(z.price), discount, vat: R.small ? 0 : +z.vat,
        ...(discount && label ? { discount_label: label } : {}), ...(mitAbrechnung ? { billing: z.bill } : {}) } as Posten;
    }).filter((it) => it.description || it.price);
    const ds = rabatte.map((d) => ({ type: "discount", description: d.name.trim() || "Rabatt", mode: d.mode, value: num(d.val), ...(mitAbrechnung ? { billing: d.bill } : {}) }) as Posten).filter((d) => (d.value ?? 0) > 0);
    return [...pos, ...ds];
  }
  $effect(() => { posten = lesen(); });

  const gruppen = $derived(splitByBilling(posten));
  const summe = $derived(R.totals(posten));
  // Rabattart gewählt → Standardwert übernehmen, wenn noch keiner eingetragen ist
  const typVon = (name: string) => R.discTypes().find((t) => t.name.toLowerCase() === String(name || "").trim().toLowerCase());
  function typZeile(z: Zeile) { const t = typVon(z.dlabel); if (t && !num(z.disc) && t.mode !== "amount") z.disc = fmtNum(t.value, 3); }
  function typRabatt(d: Rabatt) { const t = typVon(d.name); if (t && !num(d.val)) { d.val = fmtNum(t.value, t.mode === "amount" ? 2 : 3); d.mode = t.mode === "amount" ? "amount" : "percent"; } }
  function neueZeile() { zeilen.push(zuZeile({ vat: zeilen.at(-1)?.vat ?? 19 })); setTimeout(() => (document.querySelectorAll<HTMLTextAreaElement>(".pz textarea").item(zeilen.length - 1))?.focus(), 30); }
  function weg(z: Zeile) { zeilen = zeilen.filter((x) => x !== z); if (!zeilen.length) zeilen = [zuZeile({})]; }
  function neuerRabatt() { const t0 = R.discTypes()[0]; rabatte.push(zuRabatt(t0 && !rabatte.length ? { description: t0.name, mode: t0.mode as any, value: t0.value } : {})); }
  function ausVorlage() {
    B.auf(VorlagenWahl, { waehlen: (p: any) => {
      const it: Posten = { description: p.details ? `${p.name}\n${p.details}` : p.name, quantity: 1, unit: p.unit || "", price: +p.price, discount: +p.discount || 0, vat: R.small ? 0 : +p.vat, billing: billingOf(p) };
      if (!mitAbrechnung && billingOf(it) !== "once") daten.melden("Hinweis: Abo-Positionen rechnest du am besten über ein Abo oder ein Angebot ab.");
      const letzte = zeilen.at(-1);
      if (letzte && !letzte.desc.trim() && !num(letzte.price)) zeilen[zeilen.length - 1] = zuZeile(it); else zeilen.push(zuZeile(it));
      daten.melden(`„${p.name}“ hinzugefügt`);
    } });
  }
  async function alsVorlage(z: Zeile) {
    const raw = z.desc.trim();
    if (!raw) { daten.melden("Bitte zuerst eine Bezeichnung eintragen."); return; }
    const [name, ...rest] = raw.split("\n");
    const p = { name: name.trim(), details: rest.join("\n").trim() || null, unit: z.unit.trim() || null, price: num(z.price), discount: num(z.disc), vat: R.small ? 0 : +z.vat, billing: mitAbrechnung ? z.bill : "once" };
    const dup = R.products.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
    await versuche(async () => {
      if (dup && !(await frage("Vorlage überschreiben?", `Es gibt schon eine Vorlage „${dup.name}“. Mit diesen Werten überschreiben?`, "Überschreiben"))) return;
      const r = dup ? await R.write("products", "update", p, [["id", dup.id]]) : await R.write("products", "insert", p);
      if (r.error) throw r.error;
      await R.reloadProducts(); daten.melden(dup ? "Vorlage aktualisiert" : "Als Vorlage gespeichert");
    });
  }
  function wachsen(el: HTMLTextAreaElement) {
    const f = () => { el.style.height = "auto"; el.style.height = Math.max(44, el.scrollHeight + 2) + "px"; };
    requestAnimationFrame(f); el.addEventListener("input", f);
    return { destroy: () => el.removeEventListener("input", f) };
  }
  const intervall = (b: string) => (b === "once" ? "Einmalig" : INTERVALS[b][0].toUpperCase() + INTERVALS[b].slice(1));
</script>

<datalist id="einheiten">{#each UNITS as u}<option value={u}></option>{/each}</datalist>
<datalist id="rabattarten">{#each R.discTypes() as t}<option value={t.name}>{t.mode === "amount" ? eur(t.value) : fmtNum(t.value, 3) + " %"}</option>{/each}</datalist>

<div class="pos">
  {#each zeilen as z (z.k)}
    {@const l = lineNet({ quantity: num(z.qty), price: num(z.price), discount: num(z.disc) })}
    <div class="pz">
      {#if mitAbrechnung}<select class="input bill" bind:value={z.bill} aria-label="Abrechnungsart">{#each Object.entries(BILLING) as [k, t]}<option value={k}>{t}</option>{/each}</select>{/if}
      <textarea class="input" rows="2" bind:value={z.desc} use:wachsen placeholder={"Bezeichnung (erste Zeile, fett)\nDetails in weiteren Zeilen (optional)"} aria-label="Bezeichnung"></textarea>
      <div class="nums" class:ohne-ust={R.small}>
        <label>Menge<input class="input" inputmode="decimal" bind:value={z.qty}></label>
        <label>Einheit<input class="input" list="einheiten" bind:value={z.unit}></label>
        <label>Preis {R.small ? "" : "netto "}€<input class="input" inputmode="decimal" bind:value={z.price} placeholder="0,00"></label>
        <label>Rabatt %<input class="input" inputmode="decimal" bind:value={z.disc} placeholder="0"></label>
        {#if !R.small}<label>USt<select class="input" bind:value={z.vat}>{#each [19, 7, 0] as v}<option value={v}>{v} %</option>{/each}</select></label>{/if}
        <button type="button" class="btn btn--quiet btn--icon del" onclick={() => weg(z)} aria-label="Position entfernen"><Icon name="x" size={16} /></button>
      </div>
      {#if num(z.disc)}<label class="dl">Name des Rabatts<input class="input" list="rabattarten" bind:value={z.dlabel} onchange={() => typZeile(z)} oninput={() => typZeile(z)} placeholder="z. B. Bestandskundenrabatt (optional)"></label>{/if}
      <div class="pfuss"><button type="button" class="lnk" onclick={() => alsVorlage(z)}>☆ Als Vorlage speichern</button><span>{l ? `= ${eur(l)}${R.small ? "" : " netto"}` : ""}</span></div>
    </div>
  {/each}
</div>
<div class="knoepfe">
  <button type="button" class="btn btn--s btn--primary" onclick={ausVorlage}><Icon name="plus" size={14} />Aus Vorlagen</button>
  <button type="button" class="btn btn--s" onclick={neueZeile}><Icon name="plus" size={14} />Leere Position</button>
  <button type="button" class="btn btn--s" onclick={neuerRabatt}><Icon name="plus" size={14} />Gesamtrabatt</button>
</div>
{#if rabatte.length}
  <div class="rabatte">
    <div class="rh">Gesamtrabatt</div>
    {#each rabatte as d (d.k)}
      <div class="rz" class:mit={mitAbrechnung}>
        <input class="input" list="rabattarten" bind:value={d.name} oninput={() => typRabatt(d)} onchange={() => typRabatt(d)} placeholder="Name, z. B. Bestandskundenrabatt" aria-label="Name des Rabatts">
        <input class="input" inputmode="decimal" bind:value={d.val} placeholder="0" aria-label="Rabatt">
        <select class="input" bind:value={d.mode} aria-label="Prozent oder Betrag"><option value="percent">%</option><option value="amount">€</option></select>
        {#if mitAbrechnung}<select class="input" bind:value={d.bill} aria-label="Gilt für">{#each Object.entries({ once: "auf Einmaliges", monthly: "auf Monatliches", quarterly: "auf Vierteljährliches", yearly: "auf Jährliches" }) as [k, t]}<option value={k}>{t}</option>{/each}</select>{/if}
        <button type="button" class="btn btn--quiet btn--icon" onclick={() => (rabatte = rabatte.filter((x) => x !== d))} aria-label="Rabatt entfernen"><Icon name="x" size={16} /></button>
      </div>
    {/each}
  </div>
{/if}

{#snippet rabattZeilen(gt: ReturnType<typeof R.totals>)}
  {#if gt.discounts.some((d) => d.amount)}
    <div><span>Zwischensumme{R.small ? "" : " netto"}</span><span>{eur(gt.subtotal)}</span></div>
    {#each gt.discounts.filter((d) => d.amount) as d}<div class="rab"><span>{discText(d)}</span><span>−{eur(d.amount)}</span></div>{/each}
  {/if}
{/snippet}
<div class="summen num">
  {#if mitAbrechnung && gruppen.some((g) => g.billing !== "once")}
    {#each gruppen as g}{@const gt = R.totals(g.items)}{@render rabattZeilen(gt)}<div class="g"><span>{intervall(g.billing)}</span><span>{eur(gt.gross)}{BILL_SUFFIX[g.billing]}</span></div>{/each}
    <div><span>{R.small ? "ohne USt (§ 19 UStG)" : "jeweils inkl. USt"}</span><span></span></div>
  {:else if R.small}
    {@render rabattZeilen(summe)}<div class="g"><span>Gesamt</span><span>{eur(summe.gross)}</span></div><div><span>ohne USt (§ 19 UStG)</span><span></span></div>
  {:else}
    {@render rabattZeilen(summe)}
    <div><span>Netto</span><span>{eur(summe.net)}</span></div>
    {#each summe.vatLines as v}<div><span>USt {v.rate} %</span><span>{eur(v.amount)}</span></div>{/each}
    <div class="g"><span>Gesamt</span><span>{eur(summe.gross)}</span></div>
  {/if}
</div>

<style>
  .pos { display: grid; gap: 10px; }
  .pz { display: grid; gap: 8px; padding: 12px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); }
  .pz textarea { resize: none; min-height: 44px; overflow: hidden; }
  .bill { min-height: 36px; }
  .nums { display: grid; grid-template-columns: 80px 100px minmax(100px, 1fr) 80px 90px auto; gap: 8px; align-items: end; }
  .nums.ohne-ust { grid-template-columns: 80px 100px minmax(100px, 1fr) 80px auto; }
  .nums label, .dl { display: grid; gap: 4px; font-size: .74rem; color: var(--steel); }
  .nums .input { min-height: 38px; padding: 6px 9px; }
  .del { width: 38px; min-height: 38px; }
  @media (max-width: 600px) { .nums, .nums.ohne-ust { grid-template-columns: repeat(3, minmax(0, 1fr)); } .del { justify-self: end; } }
  .pfuss { display: flex; justify-content: space-between; gap: 10px; font-size: .82rem; color: var(--text-2); }
  .lnk { border: 0; background: none; padding: 0; color: var(--steel); cursor: pointer; font: inherit; }
  @media (hover: hover) { .lnk:hover { color: var(--text); } }
  .knoepfe { display: flex; gap: 6px; flex-wrap: wrap; }
  .rabatte { display: grid; gap: 8px; }
  .rh { font-size: .82rem; font-weight: 600; color: var(--steel); }
  .rz { display: grid; grid-template-columns: 1fr 84px 64px auto; gap: 8px; align-items: center; }
  .rz.mit { grid-template-columns: 1fr 84px 64px minmax(0, 170px) auto; }
  .rz .input { min-height: 38px; padding: 6px 9px; }
  @media (max-width: 560px) { .rz, .rz.mit { grid-template-columns: 1fr 84px auto; } .rz .input:first-child { grid-column: 1 / -1; } }
  .summen { display: grid; gap: 4px; justify-self: end; min-width: min(320px, 100%); font-size: .92rem; color: var(--text-2); padding: 10px 0 0; border-top: 1px solid var(--line); }
  .summen div { display: flex; justify-content: space-between; gap: 18px; }
  .summen .g { color: var(--text); font-weight: 600; font-size: 1.02rem; padding-top: 4px; }
  .summen .rab span:last-child { color: #FF8080; }
</style>
