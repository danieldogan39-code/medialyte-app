<script lang="ts">
  // Umsatz wie ein Kursverlauf: Jahr oder gesamt, Vorjahresvergleich, Kennzahlen, Quartale, Jahre, Monate, Kunden
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { MONTHS, MONTHS_LONG, STEP_M, eur, fmtPct, pct, todayISO } from "../../lib/rechnungen/kern";
  let { zu, welches = "all" }: { zu: () => void; welches?: string } = $props();
  let w = $state(welches);
  const today = todayISO(), cy = +today.slice(0, 4), cm = +today.slice(5, 7);
  const jahre = Array.from({ length: cy - 2024 + 1 }, (_, i) => 2024 + i);
  const ev = $derived(R.revenueEvents());
  const monatlich = (y: number) => { const m = Array(12).fill(0); for (const e of ev) if (e.date.startsWith(y + "-")) m[+e.date.slice(5, 7) - 1] += e.amount; return m.map((v) => Math.round(v * 100) / 100); };
  type P = { label: string; long: string; v: number; m: number };
  const d = $derived.by(() => {
    const alle = w === "all", y = alle ? 0 : +w, upto = alle ? 0 : y === cy ? cm : 12;
    let series: P[] = [], compare: P[] | null = null, total = 0, cmpTotal: number | null = null, months: { label: string; v: number; prev?: number | null }[] = [];
    if (alle) {
      let acc = 0;
      for (const yy of jahre) { const m = monatlich(yy); for (let i = 0; i < 12; i++) { if (yy === cy && i >= cm) break; acc += m[i]; series.push({ label: `${MONTHS[i]} ${String(yy).slice(2)}`, long: `${MONTHS_LONG[i]} ${yy}`, v: acc, m: m[i] }); } }
      total = ev.reduce((a, e) => a + e.amount, 0); months = series.map((p) => ({ label: p.long, v: p.m })).reverse();
    } else {
      const m = monatlich(y), pm = monatlich(y - 1); let acc = 0;
      series = m.slice(0, upto).map((v, i) => ({ label: MONTHS[i], long: `${MONTHS_LONG[i]} ${y}`, v: (acc += v), m: v }));
      if (y > 2024) { let a2 = 0; compare = pm.map((v, i) => ({ label: MONTHS[i], long: `${MONTHS_LONG[i]} ${y - 1}`, v: (a2 += v), m: v })); }
      total = acc; cmpTotal = y > 2024 ? pm.slice(0, upto).reduce((a, b) => a + b, 0) : null;
      months = m.slice(0, upto).map((v, i) => ({ label: MONTHS_LONG[i], v, prev: y > 2024 ? pm[i] : null })).reverse();
    }
    const evs = ev.filter((e) => alle || e.date.startsWith(y + "-"));
    const aktiv = alle ? Math.max(series.length, 1) : upto;
    const best = months.reduce<{ label: string; v: number } | null>((b, x) => (x.v > (b?.v ?? -1) ? x : b), null);
    const quartale = alle ? null : [0, 1, 2, 3].map((q) => monatlich(y).slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0));
    const proKunde: Record<string, number> = {}; for (const e of evs) { const k = e.inv.customer_id || "none"; proKunde[k] = (proKunde[k] || 0) + e.amount; }
    const top = Object.entries(proKunde).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const offeneRe = R.invoices.filter((i) => i.kind === "invoice" && i.status === "open" && (alle || String(i.issue_date).startsWith(y + "-")));
    const erste: Record<string, string> = {};
    for (const i of R.invoices.filter((i) => i.kind === "invoice" && ["open", "paid"].includes(i.status) && i.issue_date)) { const k = i.customer_id; if (!erste[k] || i.issue_date < erste[k]) erste[k] = i.issue_date; }
    const neuK = alle ? Object.keys(erste).length : Object.values(erste).filter((x) => x.startsWith(y + "-")).length;
    const mrr = R.recurring.filter((r) => r.active).reduce((a, r) => a + R.totals(r.items).gross / (STEP_M[r.interval] || 1), 0);
    const jahresBalken = alle ? jahre.map((yy) => ({ label: String(yy), v: monatlich(yy).reduce((a, b) => a + b, 0) })).reverse() : null;
    return { alle, y, series, compare, total, p: cmpTotal !== null ? pct(total, cmpTotal) : null, evs, aktiv, best, months, quartale, top, offen: offeneRe.reduce((a, i) => a + +i.gross, 0), neuK, mrr, jahresBalken };
  });
  const maxM = $derived(Math.max(...d.months.map((x) => x.v), 1));
  const maxJ = $derived(d.jahresBalken ? Math.max(...d.jahresBalken.map((x) => x.v), 1) : 1);

  // Kurs-Chart mit Fadenkreuz
  const W = 640, H = 230, P = { l: 8, r: 8, t: 16, b: 26 };
  const ch = $derived.by(() => {
    const s = d.series, c = d.compare;
    const all = s.map((p) => p.v).concat(c ? c.map((p) => p.v) : []);
    const max = Math.max(...all, 1) * 1.08, n = Math.max(s.length, c?.length || 0, 2);
    const X = (i: number) => P.l + (i / (n - 1)) * (W - P.l - P.r), Y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
    const path = (ps: P[]) => ps.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const up = s.length < 2 || s[s.length - 1].v >= (c?.[s.length - 1]?.v ?? 0);
    const area = s.length ? `${path(s)} L${X(s.length - 1).toFixed(1)},${H - P.b} L${X(0).toFixed(1)},${H - P.b} Z` : "";
    const step = Math.ceil(n / 12), lang = n > 13;
    const basis = s.length >= (c?.length || 0) ? s : c!;
    const ticks = basis.map((p, i) => ((lang ? p.label.startsWith("Jan") : i % step === 0 || i === n - 1) ? { x: (X(i) / W) * 100, t: lang ? "20" + p.label.slice(-2) : p.label, i } : null)).filter(Boolean) as { x: number; t: string; i: number }[];
    const grid = [0.25, 0.5, 0.75].map((f) => Y((max / 1.08) * f));
    return { max, n, X, Y, path, up, area, ticks, grid, col: up ? "var(--ok)" : "var(--coral)" };
  });
  let tip = $state<number | null>(null), svgEl: SVGSVGElement | undefined = $state();
  function zeigen(e: PointerEvent | TouchEvent) {
    if (!svgEl || !d.series.length) return;
    const r = svgEl.getBoundingClientRect(), cx = ("touches" in e ? e.touches[0].clientX : e.clientX) - r.left;
    const x = (cx / r.width) * W;
    tip = Math.max(0, Math.min(d.series.length - 1, Math.round(((x - P.l) / (W - P.l - P.r)) * (ch.n - 1))));
  }
</script>

<Blatt titel={d.alle ? "Umsatz seit 2024" : `Umsatz ${d.y}`} {zu} breit>
  <div class="chips">{#each [...jahre.map(String), "all"] as k}<button class="chip" class:on={w === k} onclick={() => { w = k; tip = null; }}>{k === "all" ? "Alle" : k}</button>{/each}</div>
  <div class="kopf">
    <b class="gross num">{eur(d.total)}</b>
    {#if d.p !== null}<span class="delta" class:up={d.p >= 0} class:down={d.p < 0}>{fmtPct(d.p)} <small>ggü. {d.y - 1}{d.y === cy ? " (gleicher Zeitraum)" : ""}</small></span>
    {:else}<span class="delta"><small>{d.alle ? `${d.evs.length} bezahlte Rechnungen` : d.y === 2024 ? "Erstes Jahr" : ""}</small></span>{/if}
  </div>
  <div class="chart">
    {#if tip !== null && d.series[tip]}
      {@const pnt = d.series[tip]}{@const c = d.compare?.[tip]}
      <div class="tip" style="left:{Math.min(Math.max((ch.X(tip) / W) * 100, 12), 88)}%"><b>{pnt.long}</b><span>{eur(pnt.m)} im Monat</span><span>{eur(pnt.v)} kumuliert</span>{#if c}<span class="muted">{d.y - 1}: {eur(c.v)}</span>{/if}</div>
    {/if}
    <svg bind:this={svgEl} viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Umsatzverlauf"
      onpointermove={zeigen} onpointerdown={zeigen} onpointerleave={() => (tip = null)} ontouchmove={(e) => { zeigen(e); e.preventDefault(); }}>
      <defs><linearGradient id="umsatzflaeche" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color={ch.up ? "#4CC38A" : "#F24A4A"} stop-opacity=".32" /><stop offset="1" stop-color={ch.up ? "#4CC38A" : "#F24A4A"} stop-opacity="0" /></linearGradient></defs>
      {#each ch.grid as y}<line class="grid" x1={P.l} x2={W - P.r} y1={y} y2={y} />{/each}
      {#if d.compare?.length}<path d={ch.path(d.compare)} fill="none" stroke="var(--steel)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" opacity=".7" />{/if}
      {#if ch.area}<path d={ch.area} fill="url(#umsatzflaeche)" /><path d={ch.path(d.series)} fill="none" stroke={ch.col} stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />{/if}
      {#if tip !== null && d.series[tip]}
        <line class="kreuz" x1={ch.X(tip)} x2={ch.X(tip)} y1={P.t} y2={H - P.b} />
        <circle cx={ch.X(tip)} cy={ch.Y(d.series[tip].v)} r="4.5" fill={ch.col} stroke="var(--panel)" stroke-width="2" />
      {/if}
    </svg>
    <div class="ticks">{#each ch.ticks as t (t.i)}<span style="left:{t.x}%" class:erst={t.i === 0} class:letzt={t.i === ch.n - 1}>{t.t}</span>{/each}</div>
  </div>
  {#if d.compare}<div class="legende"><span><i style="background:var(--ok)"></i>{d.y}</span><span><i class="strich"></i>{d.y - 1}</span></div>{/if}

  <div class="kz">
    <div class="card"><small>Ø pro Monat</small><b class="num">{eur(d.total / d.aktiv)}</b></div>
    <div class="card"><small>Bester Monat</small><b class="num">{d.best && d.best.v ? eur(d.best.v) : "–"}</b>{#if d.best?.v}<small>{d.best.label}</small>{/if}</div>
    <div class="card"><small>Bezahlte Rechnungen</small><b class="num">{d.evs.length}</b></div>
    <div class="card" class:rot={d.offen}><small>Noch offen</small><b class="num">{eur(d.offen)}</b></div>
    <div class="card"><small>{d.alle ? "Kunden" : "Neue Kunden"}</small><b class="num">{d.neuK}</b></div>
    <div class="card"><small>Wiederkehrend / Monat</small><b class="num">{eur(d.mrr)}</b></div>
  </div>
  {#if d.quartale}<h3>Quartale</h3><div class="kz q">{#each d.quartale as v, i}<div class="card"><small>Q{i + 1}</small><b class="num">{eur(v)}</b></div>{/each}</div>{/if}
  {#if d.jahresBalken}
    <h3>Jahre</h3>
    <div class="balken">{#each d.jahresBalken as x, i}
      {@const vor = d.jahresBalken[i + 1]}{@const pp = vor ? pct(x.v, +x.label === cy ? monatlich(cy - 1).slice(0, cm).reduce((a, b) => a + b, 0) : vor.v) : null}
      <button class="bz knopf" onclick={() => (w = x.label)}><span>{x.label}{+x.label === cy ? " (lfd.)" : ""}</span><span class="spur"><i style="width:{(x.v / maxJ) * 100}%"></i></span><b class="num">{eur(x.v)}</b><small class:up={pp !== null && pp >= 0} class:down={pp !== null && pp < 0}>{pp === null ? "" : fmtPct(pp)}</small></button>
    {/each}</div>
  {/if}
  <h3>Monate</h3>
  <div class="balken">{#each d.months as x}
    <div class="bz"><span>{x.label}</span><span class="spur"><i style="width:{(x.v / maxM) * 100}%"></i></span><b class="num">{eur(x.v)}</b>{#if x.prev !== null && x.prev !== undefined}<small class:up={x.v >= x.prev} class:down={x.v < x.prev}>{x.prev ? fmtPct(pct(x.v, x.prev)) : ""}</small>{:else}<small></small>{/if}</div>
  {:else}<p class="muted">Noch keine Umsätze.</p>{/each}</div>
  <h3>Umsatz nach Kunden</h3>
  <div class="balken">{#each d.top as [k, v]}
    <div class="bz"><span>{R.customer(k)?.name || "Ohne Kunde"}</span><span class="spur"><i class="blau" style="width:{(v / (d.top[0][1] || 1)) * 100}%"></i></span><b class="num">{eur(v)}</b><small>{d.total ? Math.round((v / d.total) * 100) + " %" : ""}</small></div>
  {:else}<p class="muted">Noch keine Umsätze.</p>{/each}</div>
  <p class="muted klein">Gezählt werden Geldeingänge: bezahlte Rechnungen am Zahlungstag (ohne Zahlungsdatum: am Rechnungsdatum). Ausgaben erfasst das Portal nicht – für eine vollständige Einnahmen-Überschuss-Rechnung brauchst du zusätzlich deine Belege.</p>
</Blatt>

<style>
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .kopf { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .gross { font-size: 2.3rem; font-weight: 600; color: var(--text); letter-spacing: -.02em; }
  .delta { font-weight: 600; color: var(--steel); }
  .delta small { font-weight: 400; color: var(--steel); }
  .up { color: #6FD3A2 !important; } .down { color: #FF8080 !important; }
  .chart { position: relative; }
  .chart svg { display: block; width: 100%; height: 230px; touch-action: none; }
  .grid { stroke: rgba(255, 255, 255, .06); }
  .kreuz { stroke: rgba(255, 255, 255, .35); stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
  .tip { position: absolute; top: -6px; transform: translate(-50%, -100%); background: var(--panel-2); border: 1px solid var(--line-2); border-radius: 8px; padding: 6px 10px; display: grid; font-size: .8rem; white-space: nowrap; pointer-events: none; z-index: 2; }
  .tip b { color: var(--text); }
  .ticks { position: relative; height: 18px; font-size: .72rem; color: var(--steel); }
  .ticks span { position: absolute; transform: translateX(-50%); }
  .ticks .erst { transform: none; } .ticks .letzt { transform: translateX(-100%); }
  .legende { display: flex; gap: 14px; font-size: .8rem; color: var(--text-2); }
  .legende i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .legende .strich { background: repeating-linear-gradient(90deg, var(--steel) 0 4px, transparent 4px 7px); }
  .kz { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .kz.q { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  @media (max-width: 560px) { .kz { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .kz .card { padding: 10px 12px; display: grid; gap: 2px; background: var(--bg-2); }
  .kz small { color: var(--steel); font-size: .76rem; }
  .kz b { color: var(--text); font-size: 1.1rem; }
  .kz .rot b { color: #FF8080; }
  .balken { display: grid; gap: 6px; }
  .bz { display: grid; grid-template-columns: minmax(110px, 1fr) 2fr auto 64px; gap: 10px; align-items: center; font-size: .86rem; color: var(--text-2); }
  .knopf { border: 0; background: none; padding: 0; text-align: left; font: inherit; cursor: pointer; }
  .spur { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .06); overflow: hidden; }
  .spur i { display: block; height: 100%; border-radius: inherit; background: var(--ok); }
  .spur i.blau { background: var(--info); }
  .bz b { color: var(--text); font-weight: 600; text-align: right; }
  .bz small { font-size: .74rem; color: var(--steel); text-align: right; }
  .klein { font-size: .82rem; margin: 0; }
</style>
