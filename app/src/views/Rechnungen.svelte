<script lang="ts">
  // Rechnungen & Angebote (bisher eigene Rechnungs-App): Rechnungen, Angebote mit Website-Update, Kunden, Abos, Einstellungen.
  // Arbeitet auch ohne Internet: alles wird auf dem Gerät gespeichert und später übertragen.
  import Icon from "../components/Icon.svelte";
  import Zahl from "../components/Zahl.svelte";
  import Gruppen from "../components/rechnungen/Gruppen.svelte";
  import Status from "../components/rechnungen/Status.svelte";
  import Sync from "../components/rechnungen/Sync.svelte";
  import Statistik from "../components/rechnungen/Statistik.svelte";
  import WuVorlage from "../components/rechnungen/WuVorlage.svelte";
  import Einstellungen from "../components/rechnungen/Einstellungen.svelte";
  import { R } from "../lib/rechnungen/daten.svelte";
  import { gleiter, federKurve, ruhig } from "../lib/bewegung";
  import { fly } from "svelte/transition";
  const tabRein = federKurve(0.45, 0);

  import { B, versuche } from "../lib/rechnungen/blatt.svelte";
  import { rechnungenAnsicht as A } from "../lib/rechnungen/ansicht.svelte";
  import { invStatus, quoteStatus, isWU } from "../lib/rechnungen/status";
  import { addDaysISO, eur, fmtDate, greeting, sinceText, sparkPunkte, todayISO, MONTHS, pct, fmtPct, INTERVALS } from "../lib/rechnungen/kern";
  import { neueRechnung, neuesAngebot, oeffneAbo, oeffneAngebot, oeffneKunde, oeffneRechnung } from "../lib/rechnungen/oeffnen";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { frage } from "../lib/frage.svelte";

  $effect(() => { R.starten(); if (A.tab === "customers") A.tab = "invoices"; });
  const darf = $derived(auth.darf("rechnungen", true));
  const TABS = [["invoices", "Rechnungen", "receipt"], ["quotes", "Angebote", "note"], ["recurring", "Abos", "refresh"], ["settings", "Einstellungen", "settings"]] as const;
  let laedt = $state(false);
  const neuLaden = () => { if (laedt) return; laedt = true; versuche(() => R.loadAll()).finally(() => (laedt = false)); };

  // ---------- Rechnungen
  const heute = todayISO(), jahr = heute.slice(0, 4);
  const mitStatus = $derived(R.invoices.map((i) => [i, invStatus(i)] as const));
  const summe = (keys: string[]) => mitStatus.filter(([, s]) => keys.includes(s.key)).reduce((a, [i]) => a + +i.gross, 0);
  const offenAnzahl = $derived(mitStatus.filter(([, s]) => ["open", "overdue"].includes(s.key)).length);
  const reListe = $derived.by(() => {
    const q = A.query.trim().toLowerCase();
    return mitStatus.filter(([i, s]) => (A.filter === "all" || s.key === A.filter || (A.filter === "open" && s.key === "overdue")) &&
      (!q || `${i.number || ""} ${R.custName(i)} ${R.customer(i.customer_id)?.number || ""} ${i.service_text || ""}`.toLowerCase().includes(q))).map(([i]) => i);
  });
  const reZusammen = (list: any[]) => {
    const st = list.map(invStatus);
    const offen = list.filter((_, n) => ["open", "overdue"].includes(st[n].key)).reduce((a, i) => a + +i.gross, 0);
    const ueber = st.some((x) => x.key === "overdue"), entw = st.filter((x) => x.key === "draft").length;
    const anz = list.filter((i) => i.kind === "invoice" && i.status !== "draft").length, letzte = list.find((i) => i.issue_date);
    return { attention: offen > 0 || entw > 0,
      line: `${anz} ${anz === 1 ? "Rechnung" : "Rechnungen"}${letzte ? " · zuletzt " + fmtDate(letzte.issue_date) : ""}${entw ? ` · ${entw} ${entw === 1 ? "Entwurf" : "Entwürfe"}` : ""}`,
      right: offen > 0 ? { betrag: eur(offen), text: ueber ? "überfällig" : "offen", ton: ueber ? "rot" : "gelb" } : entw ? { text: "Entwurf", ton: "blau" } : { text: "alles bezahlt", ton: "gruen" } };
  };
  // Jahreskacheln mit Mini-Verlauf
  const ev = $derived(R.revenueEvents());
  const monatlich = (y: number) => { const m = Array(12).fill(0); for (const e of ev) if (e.date.startsWith(y + "-")) m[+e.date.slice(5, 7) - 1] += e.amount; return m; };
  const cy = +heute.slice(0, 4), cm = +heute.slice(5, 7);
  const kacheln = $derived(Array.from({ length: cy - 2024 + 1 }, (_, i) => cy - i).map((y) => {
    const m = monatlich(y), vor = monatlich(y - 1), bis = y === cy ? cm : 12;
    const s = m.reduce((a, b) => a + b, 0), v = vor.slice(0, bis).reduce((a, b) => a + b, 0), p = y > 2024 ? pct(s, v) : null;
    return { y, s, p, spark: sparkPunkte(m.slice(0, bis)), up: m[bis - 1] >= m[0] };
  }));
  const kumuliert = $derived.by(() => { const out: number[] = []; let acc = 0; for (let y = 2024; y <= cy; y++) { const m = monatlich(y); for (let i = 0; i < 12; i++) { if (y === cy && i >= cm) break; acc += m[i]; out.push(acc); } } return out; });

  // ---------- Angebote
  const angebote = $derived(R.quotes.filter((q) => !isWU(q)).map((q) => [q, quoteStatus(q)] as const));
  const aSumme = (keys: string[]) => angebote.filter(([, s]) => keys.includes(s.key)).reduce((a, [q]) => a + R.quoteTotal(q), 0);
  const aAnz = (keys: string[]) => angebote.filter(([, s]) => keys.includes(s.key)).length;
  const quote_ = $derived(aAnz(["accepted"]) + aAnz(["declined"]) ? Math.round((aAnz(["accepted"]) / (aAnz(["accepted"]) + aAnz(["declined"]))) * 100) : null);
  const anListe = $derived.by(() => {
    const q = A.query.trim().toLowerCase();
    return angebote.filter(([x, st]) => (A.qfilter === "all" || st.key === A.qfilter) &&
      (!q || `${x.number || ""} ${x.customer?.name || R.customer(x.customer_id)?.name || ""} ${R.customer(x.customer_id)?.number || ""} ${x.service_text || ""}`.toLowerCase().includes(q))).map(([x]) => x);
  });
  const anZusammen = (list: any[]) => {
    const st = list.map(quoteStatus);
    const offen = st.filter((x) => x.key === "open").length, entw = st.filter((x) => x.key === "draft").length, ang = st.filter((x) => x.key === "accepted").length;
    return { attention: offen > 0 || entw > 0, line: `${list.length} ${list.length === 1 ? "Angebot" : "Angebote"}${ang ? ` · ${ang} angenommen` : ""}${entw ? ` · ${entw} ${entw === 1 ? "Entwurf" : "Entwürfe"}` : ""}`,
      right: offen ? { text: `${offen} offen`, ton: "gelb" } : entw ? { text: "Entwurf", ton: "blau" } : ang ? { text: "angenommen", ton: "gruen" } : { text: "abgeschlossen", ton: "grau" } };
  };
  // Website-Update
  const wuPreis = $derived(R.totals(R.wuItems()).gross);
  const wuq = $derived(R.quotes.filter(isWU));
  const wuZeilen = $derived(R.customers.map((c) => ({ c, seit: R.customerSince(c.id), q: wuq.filter((q) => q.customer_id === c.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] }))
    .sort((a, b) => (a.seit || "9999").localeCompare(b.seit || "9999")));
  const wuStart = (c: any) => versuche(async () => {
    const q = wuq.filter((x) => x.customer_id === c.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (q && !(q.status === "declined" && (await frage("Neues Angebot?", `Für ${c.name} gibt es ein abgelehntes Angebot. Ein neues erstellen?`, "Neues erstellen")))) return oeffneAngebot(q);
    if (!darf) return;
    if (!wuPreis && !(await frage("Ohne Festpreis anlegen?", "In deiner Vorlage steht noch kein Festpreis. Trotzdem ein Angebot anlegen? (Den Preis kannst du im Entwurf eintragen.)", "Anlegen"))) return;
    const d = { customer_id: c.id, status: "draft", category: "website_update", letter: { title: R.settings.wu_title || "", body: R.settings.wu_letter || "" },
      intro: R.settings.wu_intro || "", items: R.wuItems(), service_text: "Neue Website", notes: "", valid_until: addDaysISO(todayISO(), +R.settings.wu_valid_days || 30) };
    const t = R.totals(d.items);
    const { data, error } = await R.write("quotes", "insert", { ...d, net: t.net, vat: t.vat, gross: t.gross });
    if (error) throw error; oeffneAngebot(data);
  });


  const fab = () => ({ invoices: () => neueRechnung(), quotes: () => neuesAngebot(), recurring: () => oeffneAbo(null) } as Record<string, () => void>)[A.tab]?.();
  const FAB: Record<string, string> = { invoices: "Rechnung", quotes: "Angebot", recurring: "Abo" };
</script>

{#snippet reZeile(i: any)}
  <button class="zeile" onclick={() => oeffneRechnung(i)}>
    <span class="h"><b>{i.number || "Entwurf"}</b><small class="muted">{i.issue_date ? fmtDate(i.issue_date) : "noch nicht ausgestellt"}{i.recurring_id ? " · Abo" : ""}{i.imported ? " · übernommen" : ""}{i.service_text ? " · " + i.service_text : ""}</small></span>
    <span class="r"><b class="num">{eur(R.invTotal(i))}</b><Status doc={i} /></span>
  </button>
{/snippet}
{#snippet anZeile(x: any)}
  <button class="zeile" onclick={() => oeffneAngebot(x)}>
    <span class="h"><b>{x.number || "Entwurf"}</b><small class="muted">{x.issue_date ? fmtDate(x.issue_date) : "noch nicht verschickt"}{x.valid_until && x.status === "sent" ? " · gültig bis " + fmtDate(x.valid_until) : ""}{x.service_text ? " · " + x.service_text : ""}</small></span>
    <span class="r"><b class="num">{R.splitText(x.items)}</b><Status doc={x} angebot /></span>
  </button>
{/snippet}

<div class="kopf">
  <div class="tabs" role="tablist" use:gleiter>
    {#each TABS as [k, t, ic]}<button role="tab" aria-label={t} aria-selected={A.tab === k} onclick={() => { A.tab = k; scrollTo(0, 0); }}><Icon name={ic} size={16} /><span>{t}</span></button>{/each}
  </div>
  <span class="sp"></span>
  <button class="sync sync--{R.syncInfo.cls}" onclick={() => B.auf(Sync)} title="Synchronisierung"><i></i>{R.syncInfo.text}</button>
  <button class="btn btn--quiet btn--icon" onclick={neuLaden} aria-label="Aktualisieren" disabled={laedt}><Icon name="refresh" size={17} /></button>
</div>
{#if R.offline || R.outbox.length}<div class="banner">Ohne Internet arbeitest du ganz normal weiter: Alles wird auf dem Gerät gespeichert und automatisch übertragen, sobald du wieder online bist.</div>{/if}

{#key A.tab}<div in:fly={{ y: ruhig() ? 0 : 10, duration: ruhig() ? 0 : tabRein.ms, easing: tabRein.easing, opacity: 0 }}>
{#if !R.loaded}<div class="skelett" aria-label="Lade …"><i></i><i></i><i></i><i></i></div>
{:else if A.tab === "invoices"}
  <div class="seite-h"><h1>{greeting(R.settings.account_holder || auth.ich?.name || "")}</h1>
    <p class="muted">{offenAnzahl ? `${offenAnzahl} offene ${offenAnzahl === 1 ? "Rechnung" : "Rechnungen"} · ${eur(summe(["open", "overdue"]))} ausstehend` : "Alles bezahlt – keine offenen Rechnungen."}</p></div>
  <div class="stats">
    <div class="card"><small>Offen</small><b class="num"><Zahl wert={summe(["open", "overdue"])} format={eur} /></b></div>
    <div class="card" class:rot={summe(["overdue"]) > 0}><small>Überfällig</small><b class="num"><Zahl wert={summe(["overdue"])} format={eur} /></b></div>
    <div class="card"><small>Bezahlt gesamt</small><b class="num"><Zahl wert={ev.reduce((a, e) => a + e.amount, 0)} format={eur} /></b></div>
  </div>
  <div class="jahre">
    <button class="jk alle" onclick={() => B.auf(Statistik, { welches: "all" })}><small>Gesamt seit 2024</small><b class="num"><Zahl wert={ev.reduce((a, e) => a + e.amount, 0)} format={eur} /></b><span class="d">Verlauf ansehen ›</span>
      {#if sparkPunkte(kumuliert)}<svg viewBox="0 0 100 28" preserveAspectRatio="none"><polyline class="zeichnen" pathLength="1" points={sparkPunkte(kumuliert)} fill="none" stroke="var(--ok)" stroke-width="1.6" vector-effect="non-scaling-stroke" /></svg>{/if}</button>
    {#each kacheln as k (k.y)}
      <button class="jk" onclick={() => B.auf(Statistik, { welches: String(k.y) })}><small>{k.y}{k.y === cy ? " · lfd." : ""}</small><b class="num"><Zahl wert={k.s} format={eur} /></b>
        <span class="d" class:up={k.p !== null && k.p >= 0} class:down={k.p !== null && k.p < 0}>{k.p === null ? (k.y === 2024 ? "Start" : "–") : fmtPct(k.p)}</span>
        {#if k.spark}<svg viewBox="0 0 100 28" preserveAspectRatio="none"><polyline class="zeichnen" pathLength="1" points={k.spark} fill="none" stroke={k.up ? "var(--ok)" : "var(--coral)"} stroke-width="1.6" vector-effect="non-scaling-stroke" /></svg>{/if}</button>
    {/each}
  </div>
  <div class="bar">
    <div class="chips" use:gleiter={{ sel: ".chip.on" }}>{#each [["all", "Alle"], ["draft", "Entwürfe"], ["open", "Offen"], ["overdue", "Überfällig"], ["paid", "Bezahlt"], ["cancelled", "Storniert"]] as [k, t]}<button class="chip" class:on={A.filter === k} onclick={() => (A.filter = k)}>{t}</button>{/each}</div>
    <label class="search"><Icon name="search" size={16} /><input class="input" type="search" placeholder="Suchen …" bind:value={A.query} aria-label="Rechnungen durchsuchen"></label>
  </div>
  {#if reListe.length}<Gruppen art="inv" docs={reListe} gefiltert={!!A.query.trim() || A.filter !== "all"} zeile={reZeile} zusammenfassung={reZusammen} neu={(k) => neueRechnung(k)} />
  {:else}<div class="card empty"><b>{R.invoices.length ? "Nichts gefunden" : "Noch keine Rechnungen"}</b><p>{R.invoices.length ? "Ändere den Filter oder die Suche." : "Leg mit dem Plus-Knopf deine erste Rechnung an."}</p></div>{/if}

{:else if A.tab === "quotes"}
  <div class="seg" role="tablist" use:gleiter><button role="tab" aria-selected={A.qview !== "update"} onclick={() => (A.qview = "standard")}>Angebote</button><button role="tab" aria-selected={A.qview === "update"} onclick={() => (A.qview = "update")}>Website-Update</button></div>
  {#if A.qview === "update"}
    <div class="seite-h"><h1>Website-Update</h1><p class="muted">Eine komplett neue Website zum Festpreis – für Kunden, die schon länger bei dir sind. Zweiseitig: Anschreiben mit Begründung, dann das Angebot.</p></div>
    <div class="card wu">
      <div class="wu-t"><span><small class="muted">Deine Vorlage</small><b>{R.settings.wu_title || "Website-Update"}</b></span><span class="preis">{#if wuPreis}<b class="num">{eur(wuPreis)}</b><small class="muted">Festpreis</small>{:else}<span class="pill pill--plain pill--gelb">Preis fehlt</span>{/if}</span></div>
      <p class="muted klein">{String(R.settings.wu_letter || "").replace(/\{anrede\},?\s*/, "").split("\n").find((l: string) => l.trim())?.slice(0, 170) ?? ""}…</p>
      <div class="bar0">{#if darf}<button class="btn btn--s" onclick={() => B.auf(WuVorlage)}>Vorlage bearbeiten</button>{/if}{#if wuq.length}<span class="muted klein">{wuq.length} erstellt · {wuq.filter((q) => q.status === "sent").length} offen · {wuq.filter((q) => q.status === "accepted").length} angenommen</span>{/if}</div>
    </div>
    <h3 class="unter">Kunden</h3>
    <p class="muted klein">Längste Kundenbeziehung zuerst. Tippe auf einen Kunden, um das Angebot vorzubereiten – du kannst Text und Preis vor dem Versand noch anpassen.</p>
    <div class="liste">
      {#each wuZeilen as { c, seit, q } (c.id)}
        <button class="zeile" onclick={() => wuStart(c)}><span class="h"><b>{c.name}</b><small class="muted">{sinceText(seit)}{q?.number ? " · " + q.number : ""}</small></span>
          <span class="r">{#if q}<b class="num">{R.splitText(q.items)}</b><Status doc={q} angebot />{:else}<span class="pill pill--plain">+ Angebot</span>{/if}</span></button>
      {:else}<div class="card empty"><b>Noch keine Kunden</b></div>{/each}
    </div>
  {:else}
    <div class="seite-h"><h1>Angebote</h1><p class="muted">{aAnz(["open"]) ? `${aAnz(["open"])} ${aAnz(["open"]) === 1 ? "Angebot wartet" : "Angebote warten"} auf Antwort · ${eur(aSumme(["open"]))}` : "Schreib ein Angebot – mit einem Tipp wird daraus später die Rechnung."}</p></div>
    <div class="stats">
      <div class="card"><small>Offen</small><b class="num"><Zahl wert={aSumme(["open"])} format={eur} /></b></div>
      <div class="card"><small>Angenommen</small><b class="num"><Zahl wert={aSumme(["accepted"])} format={eur} /></b></div>
      <div class="card"><small>Zusagequote</small><b class="num">{quote_ === null ? "–" : quote_ + " %"}</b></div>
    </div>
    <div class="bar">
      <div class="chips" use:gleiter={{ sel: ".chip.on" }}>{#each [["all", "Alle"], ["draft", "Entwürfe"], ["open", "Offen"], ["accepted", "Angenommen"], ["declined", "Abgelehnt"], ["expired", "Abgelaufen"]] as [k, t]}<button class="chip" class:on={A.qfilter === k} onclick={() => (A.qfilter = k)}>{t}</button>{/each}</div>
      <label class="search"><Icon name="search" size={16} /><input class="input" type="search" placeholder="Suchen …" bind:value={A.query} aria-label="Angebote durchsuchen"></label>
    </div>
    {#if anListe.length}<Gruppen art="quo" docs={anListe} gefiltert={!!A.query.trim() || A.qfilter !== "all"} zeile={anZeile} zusammenfassung={anZusammen} neu={(k) => neuesAngebot(k)} />
    {:else}<div class="card empty"><b>{angebote.length ? "Nichts gefunden" : "Noch keine Angebote"}</b><p>{angebote.length ? "Ändere den Filter oder die Suche." : "Leg mit dem Plus-Knopf dein erstes Angebot an."}</p></div>{/if}
  {/if}

{:else if A.tab === "recurring"}
  <div class="seite-h"><h1>Abos</h1><p class="muted">Wiederkehrende Rechnungen, die sich selbst schreiben</p></div>
  <div class="note">Abos erzeugen am Stichtag automatisch eine Rechnung und schicken sie, wenn gewünscht, direkt an den Kunden. Der Server prüft das jeden Morgen.</div>
  {#if R.recurring.length}
    <div class="liste">
      {#each R.recurring as r (r.id)}
        <button class="zeile" onclick={() => oeffneAbo(r)}><span class="h"><b>{R.customer(r.customer_id)?.name || "Kunde fehlt"}{r.title ? " · " + r.title : ""}</b>
          <small class="muted">{INTERVALS[r.interval]} · nächste Rechnung {fmtDate(r.next_date)}{r.auto_send ? " · automatischer Versand" : " · nur erstellen"}{r.quote_id && R.quote(r.quote_id) ? " · aus Angebot " + (R.quote(r.quote_id).number || "") : ""}</small></span>
          <span class="r"><b class="num">{eur(R.totals(r.items).gross)}</b>{#if r.active}<span class="pill pill--plain pill--gruen">aktiv</span>{:else}<span class="pill pill--plain">pausiert</span>{/if}</span></button>
      {/each}
    </div>
  {:else}<div class="card empty"><b>Noch keine Abos</b><p>Zum Beispiel für monatliches Hosting oder Betreuung.</p></div>{/if}

{:else}
  <Einstellungen />
{/if}
</div>{/key}

{#if darf && FAB[A.tab] && !(A.tab === "quotes" && A.qview === "update")}<button class="btn btn--primary fab" onclick={fab}><Icon name="plus" size={18} />{FAB[A.tab]}</button>{/if}



<style>
  .kopf { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
  .tabs { display: flex; gap: 2px; padding: 4px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); overflow-x: auto; max-width: 100%; }
  .tabs button { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--steel); cursor: pointer; font: inherit; font-weight: 500; white-space: nowrap; }
  .tabs button[aria-selected="true"] { background: var(--text); color: var(--bg); }
  @media (max-width: 640px) { .tabs button span { display: none; } .tabs button[aria-selected="true"] span { display: inline; } }
  .sp { flex: 1; }
  .sync { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font: inherit; font-size: .84rem; }
  .sync i { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 3px rgba(76, 195, 138, .18); }
  .sync--off i, .sync--bad i { animation: puls 1.6s ease-in-out infinite; }
  @keyframes puls { 50% { transform: scale(.6); opacity: .55; } }
  .sync--off i { background: var(--warn); box-shadow: 0 0 0 3px rgba(231, 185, 74, .18); }
  .sync--bad { border-color: rgba(242, 74, 74, .5); color: #FF9C9C; } .sync--bad i { background: var(--coral); }
  .banner { padding: 10px 14px; border-radius: var(--radius-s); background: rgba(231, 185, 74, .1); color: #EBC56B; font-size: .88rem; margin-bottom: 14px; }
  .seite-h { margin: 4px 0 16px; display: grid; gap: 4px; }
  .seite-h h1 { font-size: 1.7rem; }
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; max-width: 760px; }
  .stats .card { padding: 14px 16px; display: grid; gap: 4px; }
  .stats small { color: var(--steel); font-size: .8rem; }
  .stats b { color: var(--text); font-size: 1.35rem; font-weight: 600; }
  .stats .rot { border-color: rgba(242, 74, 74, .5); } .stats .rot b { color: #FF8080; }
  @media (max-width: 520px) { .stats { gap: 6px; } .stats .card { padding: 10px; } .stats b { font-size: 1rem; } }
  .jahre { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px; }
  .jk { flex: none; width: 170px; display: grid; gap: 2px; text-align: left; padding: 12px 14px 8px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--panel); color: inherit; cursor: pointer; font: inherit; }
  .jk.alle { width: 200px; background: linear-gradient(160deg, var(--panel-2), var(--panel)); }
  .jk small { color: var(--steel); font-size: .78rem; }
  .jk b { color: var(--text); font-size: 1.1rem; font-weight: 600; }
  .jk .d { font-size: .78rem; color: var(--steel); }
  .jk .up { color: #6FD3A2; } .jk .down { color: #FF8080; }
  .jk svg { width: 100%; height: 28px; margin-top: 4px; }
  .zeichnen { stroke-dasharray: 1; stroke-dashoffset: 1; animation: zeichnen 1.2s cubic-bezier(.32, .72, 0, 1) .15s forwards; }
  @keyframes zeichnen { to { stroke-dashoffset: 0; } }
  @media (hover: hover) { .jk:hover { border-color: var(--line-2); } }
  .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
  .chips { display: flex; gap: 6px; overflow-x: auto; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; white-space: nowrap; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .chips:global(.mit-gleiter) .chip.on { background: transparent; border-color: transparent; }
  .search { position: relative; display: block; width: min(260px, 100%); margin-left: auto; }
  .search :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--steel); pointer-events: none; }
  .search .input { padding-left: 34px; min-height: 36px; }
  @media (max-width: 640px) { .search { width: 100%; } .kopf .tabs { flex: 1 1 100%; } }
  .liste { display: grid; gap: 6px; }
  .zeile { display: flex; justify-content: space-between; gap: 12px; align-items: center; width: 100%; text-align: left; padding: 11px 12px; border-radius: var(--radius-s); border: 1px solid transparent; background: transparent; color: inherit; cursor: pointer; font: inherit; }
  .liste .zeile { border-color: var(--line); background: var(--panel); }
  @media (hover: hover) { .zeile:hover { background: var(--hover); } .liste .zeile:hover { border-color: var(--line-2); } }
  .h { display: grid; gap: 2px; min-width: 0; }
  .h b { color: var(--text); font-weight: 600; }
  .h small { font-size: .8rem; overflow: hidden; text-overflow: ellipsis; }
  .r { display: grid; justify-items: end; gap: 4px; flex: none; }
  .r b { color: var(--text); font-weight: 600; }
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); margin-bottom: 12px; }
  .seg button { height: 32px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; color: var(--steel); cursor: pointer; font: inherit; font-weight: 500; }
  .seg button[aria-selected="true"] { background: var(--text); color: var(--bg); }
  .wu { padding: 18px; display: grid; gap: 10px; background: linear-gradient(160deg, var(--panel-2), var(--panel)); }
  .wu-t { display: flex; justify-content: space-between; gap: 12px; }
  .wu-t > span:first-child { display: grid; }
  .wu-t b { color: var(--text); font-size: 1.1rem; }
  .preis { display: grid; justify-items: end; }
  .preis b { font-size: 1.25rem; }
  .bar0 { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .klein { font-size: .86rem; margin: 0; }
  .unter { margin: 22px 0 4px; }
  .note { padding: 10px 14px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; margin-bottom: 12px; }
  .fab { position: fixed; right: max(24px, calc((100vw - var(--side, 0px)) / 2 - 560px)); bottom: calc(24px + env(safe-area-inset-bottom)); z-index: 5; min-height: 52px; padding: 0 22px; font-size: 1rem;
    box-shadow: 0 16px 36px -14px rgba(242, 74, 74, .7); }
</style>
