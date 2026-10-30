<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import TischbuchAnsicht from "../components/TischbuchAnsicht.svelte";
  import { sb } from "../lib/supabase";
  import { vor } from "../lib/format";
  import { STAND, hinweise, personen, tischbuecher, wartet, dauer, type Kunde, type Lage } from "../lib/kunden";

  type Neu = { slug: string; name: string; ort?: string; branche?: string };
  let kunden = $state<Kunde[]>([]), neue = $state<Neu[]>([]), laedt = $state(true);
  let ansicht = $state<"" | "beispiel" | "demo">("");
  let lokale = $state<Record<string, Lage> | null>(null), tbFehler = $state("");

  async function laden() {
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
  const liste = $derived([...kunden].sort((a, b) => Number(wartet(lokale?.[b.slug])) - Number(wartet(lokale?.[a.slug])) || a.name.localeCompare(b.name, "de")));
</script>

<Head titel="Kunden" text="Websites deiner Kunden: übernehmen, live schalten, Tischbücher und der Website-Agent.">
  <button class="btn" onclick={() => (ansicht = "beispiel")}><Icon name="eye" size={16} />Beispiel-Tischbuch</button>
  {#if auth.darf("kunden", true)}<button class="btn" onclick={() => (ansicht = "demo")}><Icon name="sparkles" size={16} />Agent ausprobieren</button>{/if}
</Head>
{#if ansicht}<TischbuchAnsicht art={ansicht} onclose={() => (ansicht = "")} />{/if}

{#if lokale && kunden.length}
  <div class="kz">
    <div class="card" class:heiss={summe.warten}><small>Tischanfragen offen</small><b class="num">{summe.offen}</b>{#if summe.warten}<span class="pill pill--rot pill--plain">{summe.warten} {summe.warten === 1 ? "Restaurant antwortet" : "Restaurants antworten"} nicht</span>{/if}</div>
    <div class="card"><small>Heute reserviert</small><b class="num">{summe.heute}</b></div>
    <div class="card"><small>Live</small><b class="num">{kunden.filter((k) => k.stand?.stand === "live").length}<span class="von"> von {kunden.length}</span></b></div>
  </div>
{/if}

{#if neue.length}
  <section class="sek">
    <h2>Neu gewonnen</h2>
    <p class="muted">Aus der Demo wird ihre echte Website: Domain, Impressum und Fotos eintragen, Vorschau bauen, live schalten.</p>
    <div class="grid">
      {#each neue as x (x.slug)}
        <a class="card neu" href="#/kunden/{x.slug}">
          <span><b>{x.name}</b><small class="muted">{[x.branche, x.ort].filter(Boolean).join(" · ")}</small></span>
          <span class="btn btn--s btn--primary">Website übernehmen</span>
        </a>
      {/each}
    </div>
  </section>
{/if}

{#if liste.length}
  <section class="sek">
    {#if neue.length}<h2>Kunden</h2>{/if}
    <div class="grid">
      {#each liste as k (k.slug)}
        {@const s = k.stand ?? {}}{@const l = lokale?.[k.slug]}
        <a class="card kk" class:heiss={wartet(l)} href="#/kunden/{k.slug}">
          <span class="kk__h"><b>{k.name}</b>{#if STAND[s.stand ?? ""]}<span class="pill pill--{STAND[s.stand ?? ''].ton}">{STAND[s.stand ?? ""].name}</span>{/if}</span>
          <small class="muted">{s.domain ? "www." + s.domain : k.eingaben?.domain ? "www." + k.eingaben.domain : k.slug}{s.aktualisiert ? " · " + vor(s.aktualisiert) : ""}</small>
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
        </a>
      {/each}
    </div>
    {#if tbFehler && kunden.length}<p class="muted klein">Tischbücher: {tbFehler}</p>{/if}
  </section>
{:else if !laedt && !neue.length}
  <div class="card empty"><b>Noch keine Kunden</b><p>Sobald du beim Nachfassen „Kunde“ wählst, steht der Betrieb hier bereit, damit aus seiner Demo die echte Website wird.</p>
    {#if auth.darf("akquise")}<a class="btn" href="#/nachfassen"><Icon name="phone" size={16} />Zum Nachfassen</a>{/if}</div>
{/if}

<style>
  .kz { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 22px; max-width: 760px; }
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
  .neu > span:first-child { display: grid; gap: 2px; min-width: 0; }
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
  @media (hover: hover) { a.card:hover { border-color: var(--line-2); background: var(--panel-2); } }
  @media (max-width: 560px) { .kz { grid-template-columns: repeat(2, minmax(0, 1fr)); } .neu { flex-wrap: wrap; } }
</style>
