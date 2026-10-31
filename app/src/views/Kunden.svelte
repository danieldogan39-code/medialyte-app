<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Zahl from "../components/Zahl.svelte";
  import { auth } from "../lib/auth.svelte";
  import TischbuchAnsicht from "../components/TischbuchAnsicht.svelte";
  import { sb } from "../lib/supabase";
  import { vor } from "../lib/format";
  import { kundeAufheben } from "../lib/kunden";
  import { frage } from "../lib/frage.svelte";
  import { daten } from "../lib/daten.svelte";
  import { STAND, hinweise, personen, tischbuecher, wartet, dauer, type Kunde, type Lage } from "../lib/kunden";
  import { R } from "../lib/rechnungen/daten.svelte";
  import { invStatus } from "../lib/rechnungen/status";
  import { eur, fmtDate } from "../lib/rechnungen/kern";
  import { oeffneKunde } from "../lib/rechnungen/oeffnen";
  import { B } from "../lib/rechnungen/blatt.svelte";
  import KategorienEditor from "../components/rechnungen/KategorienEditor.svelte";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { federKurve, gleiter, ruhig } from "../lib/bewegung";
  const fk = federKurve(0.5, 0.06);

  type Neu = { slug: string; name: string; ort?: string; branche?: string };
  let kunden = $state<Kunde[]>([]), neue = $state<Neu[]>([]), laedt = $state(true);
  let ansicht = $state<"" | "beispiel" | "demo">("");
  let lokale = $state<Record<string, Lage> | null>(null), tbFehler = $state("");

  const webDarf = $derived(auth.darf("kunden")), reDarf = $derived(auth.darf("rechnungen"));
  let suche = $state(""), filter = $state("alle");   // "alle" | "web" | "offen" | "k:<Kategorie>"
  async function laden() {
    if (!auth.darf("kunden")) { laedt = false; return; }
    const [k, nf, bt] = await Promise.all([
      sb.from("kunden").select("*").order("name"),
      auth.darf("akquise") ? sb.from("nachfass").select("slug").eq("status", "kunde") : Promise.resolve({ data: [] as any[] }),
      auth.darf("akquise") ? sb.from("betriebe").select("name,ort,branche,demos(slug,geloescht)").eq("status", "kunde") : Promise.resolve({ data: [] as any[] }),
    ]);
    kunden = (k.data as Kunde[]) ?? [];
    const da = new Set(kunden.map((x) => x.slug)), map: Record<string, Neu> = {};
    for (const b of (bt.data ?? []) as any[]) for (const d of b.demos ?? []) if (!d.geloescht) map[d.slug] = { slug: d.slug, name: b.name, ort: b.ort, branche: b.branche };
    const ohne = ((nf.data ?? []) as any[]).map((x) => x.slug).filter((s) => !map[s]);
    if (ohne.length) {
      const { data } = await sb.from("demos").select("slug,geloescht,betriebe(name,ort,branche)").in("slug", ohne);
      for (const d of (data ?? []) as any[]) if (!d.geloescht) map[d.slug] = { slug: d.slug, name: d.betriebe?.name ?? d.slug, ort: d.betriebe?.ort, branche: d.betriebe?.branche };
    }
    neue = Object.values(map).filter((x) => !da.has(x.slug)).sort((a, b) => a.name.localeCompare(b.name, "de"));
    laedt = false;
    const t = await tischbuecher();
    lokale = t.lokale; tbFehler = t.fehler ?? "";
  }
  $effect(() => {
    laden();
    const k = sb.channel("kunden-live").on("postgres_changes", { event: "*", schema: "public", table: "kunden" }, () => laden()).subscribe();
    return () => { sb.removeChannel(k); };
  });

  const summe = $derived.by(() => {
    const l = Object.entries(lokale ?? {}).filter(([, x]) => !x.demo).map(([, x]) => x);
    return { offen: l.reduce((n, x) => n + (x.offen ?? 0), 0), heute: l.reduce((n, x) => n + (x.heute_tische ?? 0), 0), warten: l.filter(wartet).length };
  });
  // Ein Kundenmenü: Website-Kunden (mit ihrem Rechnungskunden) und Rechnungskunden ohne Website
  type Eintrag = { key: string; name: string; href: string; web?: Kunde; rk?: any };
  const katVon = (e: { web?: Kunde; rk?: any }) => { const k = new Set<string>(e.rk?.kategorien ?? []); if (e.web && R.webKategorie) k.add(R.webKategorie.id); return [...k]; };
  const katListe = $derived([...R.kategorien].sort((a, b) => a.sortierung - b.sortierung || a.name.localeCompare(b.name, "de")));
  const offenVon = (id?: string) => (id ? R.invoices.filter((i) => i.customer_id === id && ["open", "overdue"].includes(invStatus(i).key)) : []);
  const eintraege = $derived.by(() => {
    const out: Eintrag[] = [], slugs = new Set(kunden.map((x) => x.slug));
    for (const w of kunden) out.push({ key: "w:" + w.slug, name: w.name, href: "#/kunden/" + w.slug, web: w, rk: R.customers.find((x) => x.kunde_slug === w.slug) });
    for (const c of R.customers) if (!c.kunde_slug || !slugs.has(c.kunde_slug)) out.push({ key: "r:" + c.id, name: c.name, href: webDarf && c.kunde_slug ? "#/kunden/" + c.kunde_slug : "#/kunden/r/" + c.id, rk: c });
    return out;
  });
  const liste = $derived.by(() => {
    const q = suche.trim().toLowerCase();
    const passt = (e: Eintrag) => filter === "alle" || (filter === "web" ? !!e.web : filter === "offen" ? offenVon(e.rk?.id).length > 0 : katVon(e).includes(filter.slice(2)));
    return eintraege.filter((e) => passt(e) &&
      (!q || `${e.name} ${e.rk?.number ?? ""} ${e.rk?.city ?? ""} ${e.rk?.contact ?? ""} ${e.rk?.website ?? ""} ${e.web?.stand?.domain ?? e.web?.eingaben?.domain ?? ""} ${katVon(e).map((id) => R.kategorie(id)?.name ?? "").join(" ")}`.toLowerCase().includes(q)))
      .sort((a, b) => Number(wartet(lokale?.[b.web?.slug ?? ""])) - Number(wartet(lokale?.[a.web?.slug ?? ""]))
        || Number(offenVon(b.rk?.id).some((i) => invStatus(i).key === "overdue")) - Number(offenVon(a.rk?.id).some((i) => invStatus(i).key === "overdue"))
        || a.name.localeCompare(b.name, "de"));
  });
  const offenSumme = $derived(R.invoices.filter((i) => ["open", "overdue"].includes(invStatus(i).key)).reduce((a, i) => a + +i.gross, 0));
  async function neuEntfernen(x: Neu) {
    if (!(await frage(`${x.name} entfernen?`, `${x.name} ist dann nicht mehr als gewonnener Kunde markiert (im Nachfassen: „Kein Interesse“). Die Demo bleibt, bis sie regulär abläuft.`, "Entfernen", true))) return;
    await kundeAufheben(x.slug, "Doch kein Kunde").catch(() => {});
    neue = neue.filter((y) => y.slug !== x.slug); daten.melden(`${x.name} entfernt`);
  }
  const neuerKunde = () => oeffneKunde(null, (k) => { if (k?.id) location.hash = "#/kunden/r/" + k.id; });
</script>

<Head titel="Kunden" text="Alle Kunden an einem Ort: Rechnungen, Angebote, Abos, Websites und Tischbücher.">
  {#if auth.darf("rechnungen", true)}<button class="btn btn--primary" onclick={neuerKunde}><Icon name="plus" size={16} />Neuer Kunde</button>{/if}
  {#if webDarf}<button class="btn" onclick={() => (ansicht = "beispiel")}><Icon name="eye" size={16} />Beispiel-Tischbuch</button>{/if}
  {#if auth.darf("kunden", true)}<button class="btn" onclick={() => (ansicht = "demo")}><Icon name="sparkles" size={16} />Agent ausprobieren</button>{/if}
</Head>
{#if ansicht}<TischbuchAnsicht art={ansicht} onclose={() => (ansicht = "")} />{/if}

{#if laedt && !eintraege.length}<div class="skelett" aria-label="Lade …"><i></i><i></i><i></i></div>{/if}
{#if eintraege.length}
  <div class="kz">
    <div class="card ton ton-gruen"><small>Kunden</small><b class="num"><Zahl wert={eintraege.length} /></b></div>
    {#if reDarf && R.loaded}<div class="card ton ton-lila" class:heiss={offenSumme > 0}><small>Offene Rechnungen</small><b class="num klein-b"><Zahl wert={offenSumme} format={eur} /></b></div>{/if}
    {#if lokale && kunden.length}
      <div class="card ton ton-rot" class:heiss={summe.warten}><small>Tischanfragen offen</small><b class="num"><Zahl wert={summe.offen} /></b>{#if summe.warten}<span class="pill pill--rot pill--plain">{summe.warten} {summe.warten === 1 ? "Restaurant antwortet" : "Restaurants antworten"} nicht</span>{/if}</div>
      <div class="card ton ton-blau"><small>Websites live</small><b class="num">{kunden.filter((k) => k.stand?.stand === "live").length}<span class="von"> von {kunden.length}</span></b></div>
    {/if}
  </div>
{/if}

{#if neue.length}
  <section class="sek">
    <h2>Neu gewonnen</h2>
    <p class="muted">Aus der Demo wird ihre echte Website: Domain, Impressum und Fotos eintragen, Vorschau bauen, live schalten.</p>
    <div class="grid">
      {#each neue as x (x.slug)}
        <div class="card neu">
          <a class="neu__a" href="#/kunden/{x.slug}"><b>{x.name}</b><small class="muted">{[x.branche, x.ort].filter(Boolean).join(" · ")}</small></a>
          <span class="neu__k">
            <a class="btn btn--s btn--primary" href="#/kunden/{x.slug}">Website übernehmen</a>
            {#if auth.darf("akquise", true)}<button class="btn btn--s btn--quiet btn--icon" title="Doch kein Kunde – entfernen" aria-label="{x.name} entfernen" onclick={() => neuEntfernen(x)}><Icon name="x" size={15} /></button>{/if}
          </span>
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if eintraege.length}
  <section class="sek">
    <div class="bar">
      {#if neue.length}<h2>Kunden</h2>{/if}
      <div class="chips" role="tablist" aria-label="Kunden filtern" use:gleiter>
        <button class="chip" role="tab" aria-selected={filter === "alle"} class:on={filter === "alle"} onclick={() => (filter = "alle")}>Alle <span class="z">{eintraege.length}</span></button>
        {#each katListe as k (k.id)}
          {@const n = eintraege.filter((e) => katVon(e).includes(k.id)).length}
          <button class="chip kat" role="tab" style="--k: {k.farbe}" aria-selected={filter === "k:" + k.id} class:on={filter === "k:" + k.id} onclick={() => (filter = "k:" + k.id)}><i></i>{k.name} <span class="z">{n}</span></button>
        {/each}
        {#if webDarf && !R.webKategorie}<button class="chip" role="tab" aria-selected={filter === "web"} class:on={filter === "web"} onclick={() => (filter = "web")}>Mit Website</button>{/if}
        {#if reDarf}<button class="chip" role="tab" aria-selected={filter === "offen"} class:on={filter === "offen"} onclick={() => (filter = "offen")}>Offene Rechnungen</button>{/if}
        {#if auth.darf("rechnungen", true)}<button class="chip chip--rand" onclick={() => B.auf(KategorienEditor)} title="Kategorien bearbeiten"><Icon name="settings" size={13} />Kategorien</button>{/if}
      </div>
      <label class="search"><Icon name="search" size={16} /><input class="input" type="search" placeholder="Kunden suchen …" bind:value={suche} aria-label="Kunden suchen"></label>
    </div>
    <div class="grid">
      {#each liste as e (e.key)}
        {@const k = e.web}{@const s = k?.stand ?? {}}{@const l = k ? lokale?.[k.slug] : undefined}{@const of = offenVon(e.rk?.id)}{@const ue = of.some((i) => invStatus(i).key === "overdue")}
        <a class="card kk" class:heiss={wartet(l) || ue} href={e.href} animate:flip={{ duration: ruhig() ? 0 : fk.ms, easing: fk.easing }} in:fly={{ y: ruhig() ? 0 : 12, duration: ruhig() ? 0 : fk.ms, easing: fk.easing, opacity: 0 }}>
          <span class="kk__h"><b>{e.name}</b>
            {#if k && STAND[s.stand ?? ""]}<span class="pill pill--{STAND[s.stand ?? ''].ton}">{STAND[s.stand ?? ""].name}</span>
            {:else if !k && !katVon(e).length}<span class="pill pill--plain">Rechnungskunde</span>{/if}</span>
          {#if katVon(e).length}<span class="kats">{#each katVon(e) as id (id)}{@const kk = R.kategorie(id)}{#if kk}<span class="kp" style="--k: {kk.farbe}"><i></i>{kk.name}</span>{/if}{/each}</span>{/if}
          {#if k}<small class="muted">{s.domain ? "www." + s.domain : k.eingaben?.domain ? "www." + k.eingaben.domain : k.slug}{s.aktualisiert ? " · " + vor(s.aktualisiert) : ""}</small>
          {:else}<small class="muted">{[e.rk?.number && "Kd.-Nr. " + e.rk.number, e.rk?.website?.replace(/^https?:\/\//, ""), e.rk?.contact, e.rk?.city].filter(Boolean).join(" · ") || "–"}</small>{/if}
          {#if l}
            <span class="werte">
              <span class:rot={!!l.offen}><b class="num">{l.offen ?? 0}</b>offen</span>
              <span><b class="num">{l.heute_tische ?? 0}</b>heute{#if l.heute_tische}<small> · {personen(l.heute_personen)}</small>{/if}</span>
              <span><b class="num">{l.kommend ?? 0}</b>kommend</span>
            </span>
            {@const h = hinweise(l)[0]}
            <span class="hw hw--{h[0]}">{h[1]}</span>
            {#if l.letzte}<small class="muted">{l.woche ?? 0} {l.woche === 1 ? "Anfrage" : "Anfragen"} in 7 Tagen · letzte vor {dauer(Date.now() - Date.parse(l.letzte))}</small>{/if}
          {:else if s.stand === "fehler"}<span class="hw hw--rot">{String(s.fehler ?? "Hat nicht geklappt").slice(0, 140)}</span>{/if}
          {#if e.rk && reDarf}
            {@const anz = R.invoices.filter((i) => i.customer_id === e.rk.id && i.kind === "invoice" && i.status !== "draft")}{@const letzte = anz.map((i) => i.issue_date).filter(Boolean).sort().pop()}
            <span class="re">
              <span><Icon name="receipt" size={14} />{anz.length} {anz.length === 1 ? "Rechnung" : "Rechnungen"}{letzte ? " · zuletzt " + fmtDate(letzte) : ""}{k && e.rk.number ? " · Kd.-Nr. " + e.rk.number : ""}</span>
              {#if of.length}<span class="pill pill--plain pill--{ue ? 'rot' : 'gelb'}">{eur(of.reduce((a, i) => a + +i.gross, 0))} {ue ? "überfällig" : "offen"}</span>{/if}
            </span>
          {/if}
        </a>
      {:else}<p class="muted">Nichts gefunden.</p>{/each}
    </div>
    {#if tbFehler && kunden.length}<p class="muted klein">Tischbücher: {tbFehler}</p>{/if}
  </section>
{:else if !laedt && !neue.length && (!reDarf || R.loaded)}
  <div class="card empty"><b>Noch keine Kunden</b><p>Leg einen Kunden für Rechnungen an, oder wähle beim Nachfassen „Kunde“ – dann steht der Betrieb hier bereit, damit aus seiner Demo die echte Website wird.</p>
    {#if auth.darf("akquise")}<a class="btn" href="#/nachfassen"><Icon name="phone" size={16} />Zum Nachfassen</a>{/if}</div>
{/if}

<style>
  .kz { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 22px; max-width: 980px; }
  .kz .card { padding: 14px 16px; display: grid; gap: 4px; align-content: start; }
  .kz small { color: var(--steel); font-size: .8rem; }
  .kz b { color: var(--text); font-size: 1.6rem; font-weight: 600; }
  .kz .von { font-size: .9rem; color: var(--steel); font-weight: 400; }
  .card.heiss { border-color: rgba(242, 74, 74, .45); }
  .sek { display: grid; gap: 10px; margin-bottom: 28px; }
  .sek h2 { font-size: 1.05rem; }
  .sek > p { margin-top: -6px; font-size: .9rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 12px; }
  .neu { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; color: inherit; }
  .neu__a { display: grid; gap: 2px; min-width: 0; color: inherit; flex: 1; }
  .neu__k { display: flex; gap: 4px; align-items: center; }
  .neu b, .kk b { color: var(--text); font-weight: 600; }
  .kk { display: grid; gap: 8px; padding: 16px; color: inherit; align-content: start; }
  .kk__h { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .werte { display: flex; gap: 18px; padding-top: 2px; }
  .werte > span { display: grid; font-size: .78rem; color: var(--steel); }
  .werte b { font-size: 1.15rem; color: var(--text); font-weight: 600; }
  .werte .rot b { color: #FF8080; }
  .werte small { font-size: .74rem; }
  .hw { font-size: .84rem; line-height: 1.4; padding: 8px 10px; border-radius: var(--radius-s); }
  .hw--rot { background: rgba(242, 74, 74, .12); color: #FF9C9C; }
  .hw--gelb { background: rgba(231, 185, 74, .10); color: #EBC56B; }
  .hw--gruen { background: rgba(76, 195, 138, .10); color: #7FD9AE; }
  .klein { font-size: .84rem; }
  .klein-b { font-size: 1.25rem !important; }
  .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .bar h2 { margin-right: 6px; }
  .chips { display: flex; gap: 6px; overflow-x: auto; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font: inherit; font-size: .86rem; white-space: nowrap; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .search { position: relative; display: block; width: min(260px, 100%); margin-left: auto; }
  .search :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--steel); pointer-events: none; }
  .search .input { padding-left: 34px; min-height: 36px; }
  .chips { padding: 2px 0; }
  .chips .chip.on { background: transparent; border-color: transparent; }
  .chips :global(.gleiter) { border-radius: 999px; }
  .chip .z { opacity: .55; font-size: .8em; margin-left: 2px; }
  .chip.kat { display: inline-flex; align-items: center; gap: 7px; }
  .chip.kat i, .kp i { width: 8px; height: 8px; border-radius: 50%; background: var(--k); flex: none; }
  .chip--rand { display: inline-flex; align-items: center; gap: 6px; border-style: dashed; color: var(--steel); }
  .kats { display: flex; flex-wrap: wrap; gap: 5px; margin-top: -2px; }
  .kp { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 999px; font-size: .74rem; color: var(--text-2);
    background: color-mix(in srgb, var(--k) 14%, transparent); border: 1px solid color-mix(in srgb, var(--k) 35%, transparent); }
  .re { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--line); font-size: .82rem; color: var(--text-2); }
  .re > span:first-child { display: inline-flex; gap: 6px; align-items: center; }
  .re :global(svg) { color: var(--steel); }
  @media (hover: hover) { a.card:hover { border-color: var(--line-2); background: var(--panel-2); } }
  @media (max-width: 560px) { .kz { grid-template-columns: repeat(2, minmax(0, 1fr)); } .neu { flex-wrap: wrap; } .search { width: 100%; } }
</style>
