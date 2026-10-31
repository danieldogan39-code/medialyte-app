<script lang="ts">
  // Rechnungsseite eines Kunden im Kundenmenü: Stammdaten, Umsatz, Rechnungen, Angebote und Abos.
  // Ohne Rechnungskunden: anlegen (mit den Angaben der Website) oder mit einem bestehenden verknüpfen.
  import Icon from "./Icon.svelte";
  import Zahl from "./Zahl.svelte";
  import Status from "./rechnungen/Status.svelte";
  import KategorieWahl from "./rechnungen/KategorieWahl.svelte";
  import { R } from "../lib/rechnungen/daten.svelte";
  import { gleiter, federKurve, ruhig } from "../lib/bewegung";
  import { fly } from "svelte/transition";
  const rf = federKurve(0.42, 0);

  import { versuche } from "../lib/rechnungen/blatt.svelte";
  import { invStatus, isWU } from "../lib/rechnungen/status";
  import { eur, fmtDate, INTERVALS, sinceText } from "../lib/rechnungen/kern";
  import { neueRechnung, neuesAngebot, oeffneAbo, oeffneAngebot, oeffneKunde, oeffneRechnung } from "../lib/rechnungen/oeffnen";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { frage } from "../lib/frage.svelte";

  let { c, slug = null, vorlage = {} }: { c: any | null; slug?: string | null; vorlage?: Record<string, string> } = $props();
  const darf = $derived(auth.darf("rechnungen", true));
  let reiter = $state<"re" | "an" | "abo">("re"), wahl = $state("");

  const re = $derived(c ? R.invoices.filter((i) => i.customer_id === c.id).sort((a, b) => String(b.issue_date || "9999").localeCompare(String(a.issue_date || "9999")) || String(b.number || "").localeCompare(String(a.number || ""), "de", { numeric: true })) : []);
  const an = $derived(c ? R.quotes.filter((q) => q.customer_id === c.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) : []);
  const abos = $derived(c ? R.recurring.filter((r) => r.customer_id === c.id) : []);
  const echt = $derived(re.filter((i) => i.kind === "invoice" && ["open", "paid"].includes(i.status)));
  const bezahlt = $derived(echt.filter((i) => i.status === "paid").reduce((a, i) => a + +i.gross, 0));
  const offenL = $derived(re.filter((i) => ["open", "overdue"].includes(invStatus(i).key)));
  const offen = $derived(offenL.reduce((a, i) => a + +i.gross, 0));
  const ueber = $derived(re.some((i) => invStatus(i).key === "overdue"));
  const frei = $derived(R.customers.filter((x) => !x.kunde_slug).sort((a, b) => String(a.name).localeCompare(String(b.name), "de")));

  const verknuepfen = (id: string) => versuche(async () => {
    const x = R.customer(id); if (!x || !slug) return;
    const { error } = await R.write("customers", "update", { kunde_slug: slug }, [["id", id]]); if (error) throw error;
    daten.melden(`${x.name} ist jetzt mit der Website verknüpft`);
  });
  const loesen = () => versuche(async () => {
    if (!(await frage("Verknüpfung lösen?", `${c.name} bleibt als Rechnungskunde erhalten, erscheint aber getrennt von der Website.`, "Lösen"))) return;
    const { error } = await R.write("customers", "update", { kunde_slug: null }, [["id", c.id]]); if (error) throw error;
    daten.melden("Verknüpfung gelöst");
  });
  const kundeLoeschen = () => versuche(async () => {
    const ab = R.recurring.filter((r) => r.customer_id === c.id);
    const text = `${c.name} wird aus deinen Kunden gelöscht.${ab.length ? ` ${ab.length === 1 ? "Sein Abo wird" : `Seine ${ab.length} Abos werden`} beendet und gelöscht.` : ""} Ausgestellte Rechnungen und Angebote bleiben erhalten.${slug ? " Die Website bleibt davon unberührt." : ""}`;
    if (!(await frage(`${c.name} löschen?`, text, "Kunde löschen", true))) return;
    const { id, name } = c;   // nach dem Löschen ist der Kunde hier nicht mehr da
    for (const r of ab) { const { error } = await R.write("recurring", "delete", undefined, [["id", r.id]]); if (error) throw error; }
    const { error } = await R.write("customers", "delete", undefined, [["id", id]]); if (error) throw error;
    daten.melden(`${name} gelöscht`);
    if (!slug) location.hash = "#/kunden";
  });
  const anlegen = () => oeffneKunde(null, (k) => { if (!slug && k?.id) location.hash = "#/kunden/r/" + k.id; }, { vorlage, kundeSlug: slug });
</script>

{#if !R.loaded}
  <section class="card akte"><p class="muted">Rechnungsdaten werden geladen …</p></section>
{:else if !c}
  <section class="card akte leer">
    <div class="kopf"><span class="ic"><Icon name="receipt" size={18} /></span><span><h3>Rechnungen</h3><p class="muted">Noch kein Rechnungskunde. Leg ihn mit den Angaben der Website an oder verknüpfe einen bestehenden.</p></span></div>
    {#if darf}
      <div class="reihe">
        <button class="btn btn--primary btn--s" onclick={anlegen}><Icon name="plus" size={15} />Rechnungskunde anlegen</button>
        {#if slug && frei.length}
          <label class="wahl"><span class="vh">Bestehenden Kunden verknüpfen</span>
            <select class="input" bind:value={wahl} onchange={() => { if (wahl) verknuepfen(wahl); }}>
              <option value="">Mit bestehendem verknüpfen …</option>
              {#each frei as x (x.id)}<option value={x.id}>{x.name}{x.number ? ` · ${x.number}` : ""}</option>{/each}
            </select></label>
        {/if}
      </div>
    {/if}
  </section>
{:else}
  <section class="card akte">
    <div class="kopf">
      <span class="ic"><Icon name="receipt" size={18} /></span>
      <span class="t"><h3>Rechnungen</h3><p class="muted">{[c.number && "Kd.-Nr. " + c.number, sinceText(R.customerSince(c.id))].filter(Boolean).join(" · ")}</p></span>
      {#if darf}<span class="aktionen">
        <button class="btn btn--s" onclick={() => oeffneKunde(c)}><Icon name="note" size={14} />Bearbeiten</button>
        <button class="btn btn--s btn--primary" onclick={() => neueRechnung(c.id)}><Icon name="plus" size={14} />Rechnung</button>
        <button class="btn btn--s" onclick={() => neuesAngebot(c.id)}><Icon name="plus" size={14} />Angebot</button>
        <button class="btn btn--s" onclick={() => oeffneAbo(null, c.id)}><Icon name="plus" size={14} />Abo</button>
      </span>{/if}
    </div>

    <KategorieWahl ausgewaehlt={c.kategorien ?? []} auto={slug && R.webKategorie ? [R.webKategorie.id] : []} {darf}
      onchange={(ids) => versuche(async () => { const { error } = await R.write("customers", "update", { kategorien: ids }, [["id", c.id]]); if (error) throw error; })} />

    <div class="zahlen">
      <div><small>Bezahlt gesamt</small><b class="num"><Zahl wert={bezahlt} format={eur} /></b></div>
      <div class:rot={ueber}><small>{ueber ? "Überfällig / offen" : "Offen"}</small><b class="num"><Zahl wert={offen} format={eur} /></b></div>
      <div><small>Rechnungen</small><b class="num"><Zahl wert={echt.length} /></b></div>
    </div>

    <dl class="stamm">
      {#if c.contact}<dt>Ansprechpartner</dt><dd>{c.contact}</dd>{/if}
      <dt>E-Mail</dt><dd>{#if c.email}<a href="mailto:{c.email}">{c.email}</a>{:else}<span class="warn">keine – Rechnungen können nicht per Mail raus</span>{/if}</dd>
      {#if c.street || c.city}<dt>Anschrift</dt><dd>{[c.street, [c.zip, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</dd>{/if}
      {#if c.website}<dt>Website</dt><dd><a href={/^https?:/.test(c.website) ? c.website : "https://" + c.website.replace(/^\/+/, "")} target="_blank" rel="noopener">{c.website.replace(/^https?:\/\//, "")}</a></dd>{/if}
      {#if c.vat_id}<dt>USt-IdNr.</dt><dd>{c.vat_id}</dd>{/if}
    </dl>

    <div class="seg" role="tablist" use:gleiter>
      <button role="tab" aria-selected={reiter === "re"} onclick={() => (reiter = "re")}>Rechnungen <span class="n">{re.length}</span></button>
      <button role="tab" aria-selected={reiter === "an"} onclick={() => (reiter = "an")}>Angebote <span class="n">{an.length}</span></button>
      <button role="tab" aria-selected={reiter === "abo"} onclick={() => (reiter = "abo")}>Abos <span class="n">{abos.length}</span></button>
    </div>

    {#key reiter}<div class="liste" in:fly={{ y: ruhig() ? 0 : 8, duration: ruhig() ? 0 : rf.ms, easing: rf.easing, opacity: 0 }}>
      {#if reiter === "re"}
        {#each re as i (i.id)}
          <button class="zeile" onclick={() => oeffneRechnung(i)}><span class="h"><b>{i.number || "Entwurf"}</b><small class="muted">{i.issue_date ? fmtDate(i.issue_date) : "noch nicht ausgestellt"}{i.recurring_id ? " · Abo" : ""}{i.service_text ? " · " + i.service_text : ""}</small></span>
            <span class="r"><b class="num">{eur(R.invTotal(i))}</b><Status doc={i} /></span></button>
        {:else}<p class="muted klein">Noch keine Rechnungen.</p>{/each}
      {:else if reiter === "an"}
        {#each an as q (q.id)}
          <button class="zeile" onclick={() => oeffneAngebot(q)}><span class="h"><b>{q.number || "Entwurf"}{isWU(q) ? " · Website-Update" : ""}</b><small class="muted">{q.issue_date ? fmtDate(q.issue_date) : "noch nicht verschickt"}{q.service_text ? " · " + q.service_text : ""}</small></span>
            <span class="r"><b class="num">{R.splitText(q.items)}</b><Status doc={q} angebot /></span></button>
        {:else}<p class="muted klein">Noch keine Angebote.</p>{/each}
      {:else}
        {#each abos as r (r.id)}
          <button class="zeile" onclick={() => oeffneAbo(r)}><span class="h"><b>{r.title || "Abo"}</b><small class="muted">{INTERVALS[r.interval]} · nächste Rechnung {fmtDate(r.next_date)}{r.auto_send ? " · automatischer Versand" : ""}</small></span>
            <span class="r"><b class="num">{eur(R.totals(r.items).gross)}</b>{#if r.active}<span class="pill pill--plain pill--gruen">aktiv</span>{:else}<span class="pill pill--plain">pausiert</span>{/if}</span></button>
        {:else}<p class="muted klein">Keine Abos.</p>{/each}
      {/if}
    </div>{/key}
    {#if darf}<div class="ende">
      {#if slug}<button class="lnk" onclick={loesen}>Verknüpfung mit der Website lösen</button>{/if}
      <button class="lnk rot" onclick={kundeLoeschen}>{slug ? "Rechnungskunden löschen" : "Kunde löschen"}</button>
    </div>{/if}
  </section>
{/if}

<style>
  .akte { padding: 18px; display: grid; gap: 14px; margin-bottom: 16px; }
  .kopf { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
  .kopf .t { flex: 1; min-width: 180px; }
  .kopf h3 { margin: 0; font-size: 1.05rem; }
  .kopf p { margin: 2px 0 0; font-size: .88rem; }
  .ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: rgba(242, 74, 74, .12); color: var(--coral-2); flex: none; }
  .aktionen { display: flex; gap: 6px; flex-wrap: wrap; }
  .reihe { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .wahl select { min-height: 34px; padding-top: 4px; padding-bottom: 4px; }
  .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .zahlen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .zahlen > div { display: grid; gap: 2px; padding: 10px 12px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); }
  .zahlen small { color: var(--steel); font-size: .78rem; }
  .zahlen b { color: var(--text); font-size: 1.15rem; font-weight: 600; }
  .zahlen .rot { border-color: rgba(242, 74, 74, .45); } .zahlen .rot b { color: #FF8080; }
  .stamm { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: .9rem; }
  .stamm dt { color: var(--steel); }
  .stamm dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .warn { color: #EBC56B; }
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); justify-self: start; max-width: 100%; overflow-x: auto; }
  .seg button { height: 32px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--steel); cursor: pointer; font: inherit; font-weight: 500; white-space: nowrap; }
  .seg button[aria-selected="true"] { background: var(--text); color: var(--bg); }
  .seg .n { opacity: .6; font-size: .82em; margin-left: 2px; }
  .liste { display: grid; gap: 2px; }
  .zeile { display: flex; justify-content: space-between; gap: 12px; align-items: center; width: 100%; text-align: left; padding: 10px 10px; border-radius: var(--radius-s); border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
  @media (hover: hover) { .zeile:hover { background: var(--hover); } }
  .h { display: grid; gap: 2px; min-width: 0; }
  .h b { color: var(--text); font-weight: 600; }
  .h small { font-size: .8rem; overflow: hidden; text-overflow: ellipsis; }
  .r { display: grid; justify-items: end; gap: 4px; flex: none; }
  .r b { color: var(--text); font-weight: 600; }
  .klein { font-size: .86rem; margin: 6px 10px; }
  .ende { display: flex; gap: 18px; flex-wrap: wrap; }
  .lnk.rot { color: #FF8080; }
  .lnk { justify-self: start; border: 0; background: none; color: var(--steel); text-decoration: underline; cursor: pointer; font: inherit; font-size: .84rem; padding: 0; }
  @media (max-width: 520px) { .zahlen b { font-size: 1rem; } .zahlen > div { padding: 8px; } }
</style>
