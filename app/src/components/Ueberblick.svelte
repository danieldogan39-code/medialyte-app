<script lang="ts">
  // Überblick einer Branche (wie oben im alten Cockpit): Kennzahlen mit Verlauf, Pipeline, neue Demos pro Lauf, Suchradar
  import { agent, type Gebiet } from "../lib/agent.svelte";
  import { sb } from "../lib/supabase";
  import { datum, zahl } from "../lib/format";
  import type { Kategorie } from "../lib/daten.svelte";

  let { kat }: { kat: Kategorie } = $props();
  let laeufe = $state<any[]>([]), online = $state(0);
  async function laden() {
    const [l, z] = await Promise.all([
      sb.from("laeufe").select("id,start,ende,status,zahlen,daten").eq("kategorie", kat.slug).order("start", { ascending: true }).limit(60),
      sb.rpc("akquise_zahlen"),
    ]);
    laeufe = l.data ?? [];
    online = ((z.data ?? []) as any[]).filter((x) => x.kategorie === kat.slug).reduce((a, x) => a + Number(x.demos_online ?? 0), 0);
  }
  $effect(() => { kat.slug; laden(); });
  $effect(() => { const f = () => laden(); addEventListener("ml:laeufe", f); return () => removeEventListener("ml:laeufe", f); });

  const c = $derived(agent.c);
  const echt = $derived(laeufe.filter((r) => !r.daten?.probe && r.status !== "laeuft"));
  const used = $derived(echt.length ? echt : laeufe);
  const geb = (r: any) => (r.daten?.gebiete ?? []) as any[];
  const summe = (f: (r: any) => number) => used.reduce((a, r) => a + (f(r) || 0), 0);
  const geprueft = (r: any) => geb(r).reduce((a, g) => a + (g.restaurants ?? 0), 0);
  const treffer = (r: any) => geb(r).reduce((a, g) => a + (g.ohne_website ?? 0), 0);
  const google = (r: any) => (r.daten?.google_suche ?? 0) + (r.daten?.google_details ?? 0);
  const demosVon = (r: any) => (r.daten?.demos ?? []).length || (r.zahlen?.Demos ?? 0);

  const k = $derived.by(() => {
    const gp = summe(geprueft), tr = summe(treffer), durch = (c.gebiete ?? []).filter((g) => g.zuletzt).length, alleG = c.einstellungen?.gebiete || (c.gebiete ?? []).length;
    const monat = Date.now() - 30 * 864e5;
    const reihe = (f: (r: any) => number) => used.slice(-12).map(f);
    const ersatz = summe((r) => r.daten?.ki_ersatztexte ?? 0);
    return [
      { k: "Demos online", v: online, hint: `${zahl(c.demos_jemals ?? 0)} insgesamt gebaut`, s: reihe(demosVon) },
      { k: "Betriebe geprüft", v: gp, hint: `über ${used.length} ${used.length === 1 ? "Lauf" : "Läufe"}`, s: reihe(geprueft) },
      { k: "Ohne Website", v: tr, hint: gp ? `${Math.round((tr / gp) * 100)} % der geprüften` : "noch keine Daten", s: reihe(treffer) },
      { k: "Gebiete durchsucht", v: durch, unit: alleG ? ` / ${alleG}` : "", hint: alleG ? `${Math.round((durch / alleG) * 100)} % der Region` : "", s: reihe((r) => geb(r).length) },
      { k: "Google-Anfragen", v: used.filter((r) => Date.parse(r.start) > monat).reduce((a, r) => a + google(r), 0), hint: `letzte 30 Tage${c.einstellungen ? `, max. ${c.einstellungen.google_budget} Suchen pro Lauf` : ""}`, s: reihe(google) },
      { k: "KI-Texte", v: summe((r) => r.daten?.ki_texte ?? 0), hint: ersatz ? `${ersatz} mit Standardtext` : "alle von Claude geschrieben", s: reihe((r) => r.daten?.ki_texte ?? 0) },
    ];
  });
  function spark(s: number[], w = 200, h = 34) {
    if (s.length < 2) return { line: "", area: "" };
    const max = Math.max(1, ...s), dx = w / (s.length - 1);
    const pts = s.map((v, i) => [i * dx, h - 3 - (v / max) * (h - 8)]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    return { line, area: `${line} L${w} ${h} L0 ${h} Z` };
  }

  // Pipeline: vom ersten Treffer bis zum Interessenten
  const stufen = $derived.by(() => {
    const gp = summe(geprueft), sc = c.status_zahlen ?? {}, ketten = summe((r) => (r.daten?.ketten ?? 0) + (r.daten?.ketten_ki ?? 0)), briefe = c.einstellungen?.briefe_aktiv ?? true;
    return { max: Math.max(1, gp), liste: [
      { n: "Geprüft", s: "Betriebe in den Suchgebieten", v: gp },
      { n: "Ohne Website", s: "gute Bewertung, keine Kette" + (ketten ? ` (${zahl(ketten)} Ketten aussortiert)` : ""), v: summe(treffer) },
      { n: "Demo gebaut", s: "Website-Entwurf online gestellt", v: c.demos_jemals ?? 0 },
      { n: "Brief verschickt", s: briefe ? "an den Betrieb" : "Briefversand ist aus", v: sc.verschickt ?? 0, aus: !briefe },
      { n: "Behalten", s: "Interessenten", v: sc.behalten ?? 0 },
    ] };
  });

  // Säulen: neue Demos pro Lauf (letzte 10)
  const saeulen = $derived(used.slice(-10));
  const smax = $derived(Math.max(1, ...saeulen.map(demosVon)));
  let tipp = $state<any>(null);

  // Suchradar
  let wahl = $state<Gebiet | null>(null);
  const gebiete = $derived(c.gebiete ?? []);
  const n = $derived(gebiete.length || 1);
  const jetzt = $derived(gebiete[(c.gebiet_index ?? 0) % n]);
  const maxHits = $derived(Math.max(1, ...gebiete.map((g) => g.ohne_website ?? 0)));
  function punkt(i: number) {
    const a = (i / n) * 2 * Math.PI, r = 170 * (0.55 + 0.4 * ((i % 3) / 2));
    return { x: 200 + Math.sin(a) * r, y: 200 - Math.cos(a) * r };
  }
  const zeige = $derived(wahl ?? jetzt);
</script>

<div class="kpis">
  {#each k as x, i (x.k)}
    {@const p = spark(x.s)}
    <article class="card kpi">
      <small>{x.k}</small>
      <b class="num">{zahl(x.v)}{#if x.unit}<span class="u">{x.unit}</span>{/if}</b>
      <span class="hint">{x.hint}</span>
      {#if p.line}<svg class="spark" viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden="true"><path class="a" d={p.area} /><path class="l" d={p.line} /></svg>{/if}
    </article>
  {/each}
</div>

<div class="zwei">
  <section class="card box">
    <h3>Pipeline</h3>
    <p class="muted klein">Vom ersten Treffer bis zum Interessenten, über alle bisherigen Läufe.</p>
    <div class="flow">
      {#each stufen.liste as st}
        <div class="stufe" class:aus={st.aus}>
          <span class="nm">{st.n}<small class="muted">{st.s}</small></span>
          <span class="bar"><i style="width:{st.v ? Math.max(2, Math.sqrt(st.v / stufen.max) * 100) : 0}%"></i></span>
          <b class="num">{zahl(st.v)}</b>
        </div>
      {/each}
    </div>
  </section>

  <section class="card box">
    <h3>Neue Demos pro Lauf</h3>
    <p class="muted klein">{tipp ? `${datum(tipp.start)}: ${demosVon(tipp)} neue Demos, ${geb(tipp).length} Gebiete, ${google(tipp)} Google-Anfragen` : "Die letzten zehn Läufe. Antippen zeigt Einzelheiten."}</p>
    {#if saeulen.length}
      <div class="chart" role="img" aria-label="Neue Demos pro Lauf">
        {#each saeulen as r (r.id)}
          {@const v = demosVon(r)}
          <button class="sl" class:on={tipp?.id === r.id} onclick={() => (tipp = tipp?.id === r.id ? null : r)} onmouseenter={() => (tipp = r)} aria-label="{datum(r.start)}: {v} Demos">
            <span class="w">{v || ""}</span><span class="s" style="height:{(v / smax) * 100}%"></span>
            <small>{new Date(r.start).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })}</small>
          </button>
        {/each}
      </div>
    {:else}<p class="muted">Noch keine Läufe.</p>{/if}
  </section>
</div>

{#if gebiete.length}
  <section class="card box radar-box">
    <div>
      <h3>Suchradar</h3>
      <p class="muted klein">Alle Suchgebiete im Uhrzeigersinn. Der blinkende Punkt ist das Gebiet, in dem der Agent als Nächstes sucht. Antippen zeigt ein Gebiet.</p>
      <svg class="radar" viewBox="0 0 400 400" role="img" aria-label="Suchradar mit {gebiete.length} Gebieten">
        <defs><radialGradient id="rg"><stop offset="0" stop-color="#7BAFFF" stop-opacity=".12" /><stop offset="1" stop-color="#7BAFFF" stop-opacity="0" /></radialGradient></defs>
        <circle cx="200" cy="200" r="185" fill="url(#rg)" />
        {#each [0.25, 0.5, 0.75, 1] as f}<circle class="ring" cx="200" cy="200" r={170 * f} />{/each}
        {#each Array(12) as _, s}{@const a = (s / 12) * 2 * Math.PI}<line class="spoke" x1="200" y1="200" x2={200 + Math.sin(a) * 170} y2={200 - Math.cos(a) * 170} />{/each}
        {#each gebiete as g, i (g.name + i)}
          {@const p = punkt(i)}{@const h = g.ohne_website ?? 0}{@const da = !!g.zuletzt}
          <circle class="dot" class:cur={i === (c.gebiet_index ?? 0) % n} class:sel={wahl === g} cx={p.x} cy={p.y}
            r={da ? (h ? 3.5 + 6 * Math.sqrt(h / maxHits) : 3) : 2.7} fill={!da ? "#2A3F63" : h ? "#7BAFFF" : "#3D5F8F"}
            role="button" tabindex="0" aria-label={g.name} onclick={() => (wahl = wahl === g ? null : g)} onkeydown={(e) => { if (e.key === "Enter") wahl = g; }} />
        {/each}
        <circle cx="200" cy="200" r="5" fill="#7BAFFF" />
      </svg>
      <div class="legende"><span><i style="background:#2A3F63"></i>noch nicht durchsucht</span><span><i style="background:#3D5F8F"></i>durchsucht, keine Treffer</span><span><i style="background:#7BAFFF"></i>ohne Website (größer = mehr)</span></div>
    </div>
    {#if zeige}
      <dl class="seite">
        <div class="muted klein">{wahl ? "Ausgewählt" : "Als Nächstes dran"}</div>
        <div class="gname">{zeige.name}</div>
        <dt>Zuletzt durchsucht</dt><dd>{zeige.zuletzt ? datum(zeige.zuletzt) : "noch nie"}</dd>
        <dt>Betriebe gefunden</dt><dd class="num">{zahl(zeige.restaurants ?? 0)}</dd>
        <dt>Davon ohne Website</dt><dd class="num">{zahl(zeige.ohne_website ?? 0)}</dd>
        <dt>Durchläufe</dt><dd class="num">{zahl(zeige.durchlaeufe ?? 0)}</dd>
      </dl>
    {/if}
  </section>
{/if}

<style>
  .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .kpi { position: relative; padding: 14px 16px 40px; display: grid; gap: 4px; overflow: hidden; }
  .kpi small { color: var(--steel); font-size: .8rem; }
  .kpi b { color: var(--text); font-size: 1.6rem; font-weight: 600; line-height: 1.15; }
  .kpi .u { font-size: .9rem; color: var(--steel); font-weight: 400; }
  .hint { font-size: .78rem; color: var(--text-2); }
  .spark { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 34px; }
  .spark .a { fill: rgba(123, 175, 255, .14); }
  .spark .l { fill: none; stroke: #7BAFFF; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .zwei { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; margin-bottom: 14px; }
  .box { padding: 16px 20px 20px; display: grid; gap: 8px; align-content: start; }
  .klein { font-size: .84rem; line-height: 1.45; }
  .flow { display: grid; gap: 12px; margin-top: 6px; }
  .stufe { display: grid; grid-template-columns: minmax(130px, 1.2fr) 2fr auto; gap: 12px; align-items: center; }
  .stufe .nm { display: grid; font-size: .9rem; color: var(--text); }
  .stufe .nm small { font-size: .74rem; }
  .stufe .bar { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .06); overflow: hidden; }
  .stufe .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #7BAFFF, #4CC38A); transition: width .8s var(--ease); }
  .stufe b { color: var(--text); font-weight: 600; min-width: 3ch; text-align: right; }
  .stufe.aus { opacity: .5; }
  .chart { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; height: 200px; align-items: end; margin-top: 6px; }
  .sl { display: grid; grid-template-rows: auto 1fr auto; height: 100%; align-items: end; justify-items: center; gap: 4px; padding: 0; border: 0; background: none; cursor: pointer; color: var(--steel); }
  .sl .s { width: min(36px, 70%); min-height: 2px; border-radius: 5px 5px 2px 2px; background: linear-gradient(180deg, #7BAFFF, #F24A4A); align-self: end; transition: height .6s var(--ease); }
  .sl .w { font-size: .78rem; color: var(--text); font-weight: 600; align-self: end; }
  .sl small { font-size: .68rem; }
  .sl.on .s { outline: 2px solid rgba(255, 255, 255, .4); outline-offset: 2px; }
  .radar-box { grid-template-columns: minmax(0, 1fr) minmax(200px, 260px); gap: 20px; align-items: center; }
  @media (max-width: 760px) { .radar-box { grid-template-columns: minmax(0, 1fr); } }
  .radar { width: min(100%, 420px); display: block; margin: 8px auto 0; }
  .ring { fill: none; stroke: rgba(123, 175, 255, .14); }
  .spoke { stroke: rgba(123, 175, 255, .07); }
  .dot { cursor: pointer; transition: r .15s; }
  .dot.cur { animation: blink 1.2s ease-in-out infinite; stroke: #fff; stroke-width: 1.5; }
  .dot.sel { stroke: #fff; stroke-width: 2; }
  @keyframes blink { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .dot.cur { animation: none; } }
  .legende { display: flex; gap: 14px; flex-wrap: wrap; font-size: .76rem; color: var(--steel); justify-content: center; }
  .legende i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; }
  .seite { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; align-content: start; }
  .seite > div { grid-column: 1 / -1; }
  .gname { font-size: 1.05rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
  .seite dt { color: var(--steel); font-size: .84rem; }
  .seite dd { margin: 0; color: var(--text); text-align: right; }
</style>
