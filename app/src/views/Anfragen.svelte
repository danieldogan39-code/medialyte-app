<script lang="ts">
  import { gleiter } from "../lib/bewegung";
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Verlauf from "../components/Verlauf.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { datumZeit, vor } from "../lib/format";
  import { ANFRAGE_STATUS, FORMATE } from "../lib/status";
  import { R } from "../lib/rechnungen/daten.svelte";
  import { oeffneKunde } from "../lib/rechnungen/oeffnen";

  let { id }: { id?: string } = $props();
  let liste = $state<any[]>([]), sicht = $state<"offen" | "alle" | "gewonnen" | "zu">("offen"), laedt = $state(true);
  let a = $state<any>(null);

  const OFFEN = ["neu", "in_arbeit", "termin", "angebot"];
  async function laden() {
    let q = sb.from("anfragen").select("id,eingang,firma,name,anliegen,termin,format,art,status,pruefen,zugewiesen,kategorie").order("eingang", { ascending: false }).limit(300);
    if (sicht === "offen") q = q.in("status", OFFEN);
    if (sicht === "gewonnen") q = q.eq("status", "gewonnen");
    if (sicht === "zu") q = q.in("status", ["verloren", "spam"]);
    const { data } = await q; liste = data ?? []; laedt = false;
  }
  async function eine() { a = id ? (await sb.from("anfragen").select("*").eq("id", id).maybeSingle()).data : null; }
  $effect(() => { sicht; laden(); });
  $effect(() => { id; eine(); });
  $effect(() => { const f = () => { laden(); eine(); }; addEventListener("ml:anfragen", f); return () => removeEventListener("ml:anfragen", f); });

  async function setzen(feld: string, wert: any, notiz?: string) {
    const { error } = await sb.from("anfragen").update({ [feld]: wert }).eq("id", a.id);
    if (error) { daten.melden(fehler(error)); return; }
    if (notiz) await sb.from("verlauf").insert({ bezug: "anfrage", bezug_id: a.id, art: feld, text: notiz });
    await eine(); laden(); daten.zaehlen(); vl?.neu();
  }
  let vl: any = $state();
  const darf = $derived(auth.darf("anfragen", true));
  // Anfrage → Kunde: Kundenformular mit den Angaben aus der Anfrage; nach dem Speichern ist die Anfrage gewonnen
  const darfKunde = $derived(darf && auth.darf("rechnungen", true));
  const kunde = $derived(a?.customer_id ? R.customer(a.customer_id) : null);
  function alsKunde() {
    R.starten();
    const web = String(a.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const vorlage: Record<string, string> = { name: a.firma || a.name || "", contact: a.firma && a.name ? a.name : "", email: a.email || "", website: web, city: a.ort || "" };
    const doppelt = a.email && R.customers.find((c) => String(c.email || "").toLowerCase() === String(a.email).toLowerCase());
    if (doppelt) { verknuepfen(doppelt, true); return; }
    oeffneKunde(null, (k: any) => { if (k?.id) verknuepfen(k, false); }, { vorlage });
  }
  async function verknuepfen(k: any, schonDa: boolean) {
    const { error } = await sb.from("anfragen").update({ customer_id: k.id, ...(["gewonnen"].includes(a.status) ? {} : { status: "gewonnen" }) }).eq("id", a.id);
    if (error) { daten.melden(fehler(error)); return; }
    await sb.from("verlauf").insert({ bezug: "anfrage", bezug_id: a.id, art: "kunde", text: `Als Kunde aufgenommen: ${k.name}` });
    daten.melden(schonDa ? `${k.name} ist schon Kunde – Anfrage verknüpft` : `${k.name} ist jetzt Kunde`);
    await eine(); laden(); daten.zaehlen(); vl?.neu();
  }
  const tel = (t: string) => t.replace(/[^+\d]/g, "").replace(/^00/, "+").replace(/^0/, "+49");
</script>

<div class="wrap" class:has-detail={!!id}>
  <div class="listen">
    <Head titel="Anfragen" text="Terminbuchungen und Rückrufwünsche von medialyte.de – neue erscheinen sofort." />
    <div class="seg" role="tablist" use:gleiter={{ farbe: "var(--panel-2)" }}>
      {#each [["offen", "Offen"], ["alle", "Alle"], ["gewonnen", "Gewonnen"], ["zu", "Verloren & Spam"]] as [k, n]}
        <button role="tab" aria-selected={sicht === k} onclick={() => (sicht = k as any)}>{n}</button>
      {/each}
    </div>
    {#if liste.length}
      <ul class="card items">
        {#each liste as x (x.id)}
          <li><a href="#/anfragen/{x.id}" class:on={x.id === id}>
            <span class="items__t"><b>{x.firma || x.name || "Ohne Namen"}</b>
              <small class="muted">{x.termin ? datumZeit(x.termin) + " · " + (FORMATE[x.format] ?? "") : x.art === "rueckruf" ? "Rückruf gewünscht" : (x.anliegen ?? []).join(", ")}</small></span>
            <span class="items__r"><span class="pill pill--{ANFRAGE_STATUS[x.status]?.ton}">{ANFRAGE_STATUS[x.status]?.name}</span>{#if x.pruefen}<span class="pill pill--gelb pill--plain">Prüfen</span>{/if}<small class="muted">{vor(x.eingang)}</small></span>
          </a></li>
        {/each}
      </ul>
    {:else if !laedt}
      <div class="card empty"><b>{sicht === "offen" ? "Alles erledigt" : "Keine Anfragen"}</b><p>Neue Buchungen von medialyte.de erscheinen hier automatisch.</p></div>
    {/if}
  </div>

  {#if id && a}
    <section class="detail">
      <a class="back muted" href="#/anfragen">← Alle Anfragen</a>
      <div class="card d">
        <div class="d__h">
          <div><h2>{a.firma || a.name}</h2><p class="muted">{a.name}{a.branche ? ` · ${a.branche}` : ""}{a.ort ? ` · ${a.ort}` : ""}</p></div>
          {#if darf}
            <select class="input st" value={a.status} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; setzen("status", v, `Status: ${ANFRAGE_STATUS[a.status]?.name} → ${ANFRAGE_STATUS[v]?.name}`); }}>
              {#each Object.entries(ANFRAGE_STATUS) as [k, v]}<option value={k}>{v.name}</option>{/each}
            </select>
          {:else}<span class="pill pill--{ANFRAGE_STATUS[a.status]?.ton}">{ANFRAGE_STATUS[a.status]?.name}</span>{/if}
        </div>
        {#if a.pruefen}<p class="warn">Das versteckte Feld im Formular war ausgefüllt – möglicherweise ein Bot. Der Absender hat keine Bestätigung bekommen.</p>{/if}

        <div class="acts">
          {#if a.telefon}<a class="btn btn--s" href="tel:{tel(a.telefon)}"><Icon name="phone" size={15} />Anrufen</a>
            <a class="btn btn--s" href="https://wa.me/{tel(a.telefon).replace('+', '')}" target="_blank" rel="noopener"><Icon name="whatsapp" size={15} />WhatsApp</a>{/if}
          {#if a.email}<a class="btn btn--s" href="mailto:{a.email}?subject={encodeURIComponent('Ihre Anfrage bei Medialyte')}"><Icon name="mail" size={15} />E-Mail</a>{/if}
          {#if a.website}<a class="btn btn--s" href={/^https?:/.test(a.website) ? a.website : "https://" + a.website} target="_blank" rel="noopener"><Icon name="globe" size={15} />Website</a>{/if}
          {#if a.customer_id}<a class="btn btn--s kd" href="#/kunden/r/{a.customer_id}"><Icon name="users" size={15} />{kunde?.name ? `Kunde: ${kunde.name}` : "Zum Kunden"}</a>
          {:else if darfKunde}<button class="btn btn--s btn--primary" onclick={alsKunde}><Icon name="plus" size={15} />Als Kunde aufnehmen</button>{/if}
        </div>

        <dl class="dl">
          <div class="wide"><dt>{a.art === "rueckruf" ? "Rückruf" : "Termin"}</dt><dd><b>{a.termin ? datumZeit(a.termin) : a.rueckruf ? `Rückruf ${a.rueckruf}` : "–"}</b>{a.format ? ` · ${FORMATE[a.format] ?? a.format}` : ""}{a.dauer_min ? ` · ${a.dauer_min} Min.` : ""}</dd></div>
          <div class="wide"><dt>Anliegen</dt><dd>{(a.anliegen ?? []).join(", ") || "–"}</dd></div>
          <div><dt>E-Mail</dt><dd class="brk">{a.email ?? "–"}</dd></div>
          <div><dt>Telefon</dt><dd>{a.telefon ?? "–"}{a.whatsapp_ok ? " · WhatsApp ok" : ""}</dd></div>
          <div><dt>Unternehmensgröße</dt><dd>{a.groesse || "–"}</dd></div>
          <div><dt>Kategorie</dt><dd>{daten.kat(a.kategorie)?.name ?? "–"}</dd></div>
          <div><dt>Eingang</dt><dd>{datumZeit(a.eingang)}</dd></div>
          <div><dt>Zuständig</dt><dd>
            {#if darf}<select class="input sm" value={a.zugewiesen ?? ""} onchange={(e) => { const v = (e.target as HTMLSelectElement).value || null; setzen("zugewiesen", v, v ? `Zugewiesen an ${daten.name(v)}` : "Zuweisung entfernt"); }}>
              <option value="">Niemand</option>{#each daten.team.filter((m) => m.aktiv) as m}<option value={m.user_id}>{m.name}</option>{/each}</select>
            {:else}{daten.name(a.zugewiesen) || "–"}{/if}</dd></div>
          {#if a.nachricht}<div class="wide"><dt>Nachricht</dt><dd class="msg">{a.nachricht}</dd></div>{/if}
          <div class="wide"><dt>Herkunft</dt><dd class="muted">{a.daten?.quelle?.seite || "–"}{a.daten?.quelle?.referrer ? ` · über ${a.daten.quelle.referrer}` : ""}</dd></div>
        </dl>
      </div>
      <Verlauf bind:this={vl} bezug="anfrage" id={a.id} schreiben={darf} />
    </section>
  {/if}
</div>

<style>
  .wrap.has-detail { display: grid; grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); gap: 20px; align-items: start; }
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); margin-bottom: 14px; max-width: 100%; overflow-x: auto; }
  .seg button { height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--steel); cursor: pointer; font-size: .88rem; white-space: nowrap; }
  .seg button[aria-selected="true"] { background: var(--panel-2); color: var(--text); }
  .items { list-style: none; margin: 0; padding: 0; overflow: hidden; }
  .items li + li { border-top: 1px solid var(--line); }
  .items a { display: flex; justify-content: space-between; gap: 12px; padding: 14px 18px; transition: background-color .12s ease; }
  .items a.on { background: rgba(255, 255, 255, .06); }
  @media (hover: hover) { .items a:hover { background: var(--hover); } }
  .items__t { display: grid; min-width: 0; }
  .items__t b { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .items__t small { font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .items__r { display: grid; justify-items: end; gap: 4px; flex: none; }
  .items__r small { font-size: .78rem; }
  .detail { display: grid; gap: 14px; position: sticky; top: 24px; }
  .back { display: none; font-size: .86rem; }
  .d { padding: 22px; display: grid; gap: 18px; }
  .d__h { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
  .d__h h2 { font-size: 1.35rem; }
  .st { width: auto; min-height: 36px; }
  .sm { min-height: 32px; padding: 4px 30px 4px 10px; width: auto; }
  .warn { padding: 10px 14px; border-radius: var(--radius-s); background: rgba(231, 185, 74, .1); color: #EBC56B; font-size: .9rem; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 22px; margin: 0; }
  .dl div { display: grid; gap: 3px; min-width: 0; }
  .dl .wide { grid-column: 1 / -1; }
  .dl dt { font-size: .78rem; color: var(--steel); }
  .dl dd { margin: 0; color: var(--text); }
  .dl dd b { font-weight: 600; }
  .brk { overflow-wrap: anywhere; }
  .msg { white-space: pre-wrap; color: var(--text-2) !important; padding: 12px 14px; border-radius: var(--radius-s); background: var(--bg-2); }
  @media (max-width: 1000px) {
    .wrap.has-detail { display: block; }
    .wrap.has-detail .listen { display: none; }
    .detail { position: static; }
    .back { display: inline; }
  }
  @media (max-width: 520px) { .dl { grid-template-columns: minmax(0, 1fr); } }
</style>
