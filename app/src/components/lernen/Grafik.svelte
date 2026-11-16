<script lang="ts">
  // Visualisierungen für Lerninhalte: Funktionsgraph, Bilanz, T-Konten, Ablauf, Matrix, Balken, Zeitstrahl, Baum, Lebenszyklus.
  import type { Grafik } from "../../lib/lernen/typen";
  import { mdZeile } from "../../lib/lernen/md";
  import { de } from "../../lib/lernen/pruefen";
  import { funktion, wert, type Werte } from "../../lib/lernen/ausdruck";
  // werte: Reglerwerte, die in den Kurvenausdrücken vorkommen dürfen (interaktive Grafiken)
  let { g, farbe = "var(--org)", werte }: { g: Grafik; farbe?: string; werte?: Werte } = $props();
  const fn = (s: string) => (werte ? (x: number) => { try { return wert(s, { ...werte, x }); } catch { return NaN; } } : funktion(s));

  const FARBEN = ["#8E7CFF", "#4FC7D4", "#F2995A", "#4CC38A", "#E7B94A", "#F27A6A"];
  const zahl = (v: number | string) => (typeof v === "number" ? de(v) : v);

  // ---------- Funktionsgraph
  const W = 640, H = 380, P = { l: 52, r: 18, t: 18, b: 40 };
  // linker Rand passend zur längsten y-Beschriftung (z. B. „20.000“), damit nichts abgeschnitten wird
  const links = (g: Extract<Grafik, { art: "graph" }>) => Math.max(P.l, 18 + 8.4 * Math.max(...schritte(g.y[0], g.y[1]).map((v) => de(v).length)));
  function skala(g: Extract<Grafik, { art: "graph" }>) {
    const l = links(g);
    const sx = (x: number) => l + ((x - g.x[0]) / (g.x[1] - g.x[0])) * (W - l - P.r);
    const sy = (y: number) => H - P.b - ((y - g.y[0]) / (g.y[1] - g.y[0])) * (H - P.t - P.b);
    return { sx, sy };
  }
  function schritte(a: number, b: number) {
    const roh = (b - a) / 8, p = 10 ** Math.floor(Math.log10(roh)), n = roh / p;
    const st = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p, out: number[] = [];
    for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(Math.round(v / st) * st);
    return out;
  }
  function pfad(g: Extract<Grafik, { art: "graph" }>, ausdruck: string, von = g.x[0], bis = g.x[1]) {
    const f = fn(ausdruck), { sx, sy } = skala(g), n = 320, teile: string[] = [];
    let offen = false;
    const ymin = g.y[0] - (g.y[1] - g.y[0]) * 0.5, ymax = g.y[1] + (g.y[1] - g.y[0]) * 0.5;
    for (let i = 0; i <= n; i++) {
      const x = von + ((bis - von) * i) / n, y = f(x);
      if (!Number.isFinite(y) || y < ymin || y > ymax) { offen = false; continue; }
      teile.push(`${offen ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`); offen = true;
    }
    return teile.join("");
  }
  function flaeche(g: Extract<Grafik, { art: "graph" }>) {
    const fl = g.flaeche!; const { sx, sy } = skala(g), n = 160, o: string[] = [], u: string[] = [];
    const f = fn(fl.f), gg = fl.g ? fn(fl.g) : () => 0;
    const k = (y: number) => Math.max(g.y[0], Math.min(g.y[1], y));
    for (let i = 0; i <= n; i++) { const x = fl.von + ((fl.bis - fl.von) * i) / n; o.push(`${sx(x).toFixed(1)},${sy(k(f(x))).toFixed(1)}`); u.unshift(`${sx(x).toFixed(1)},${sy(k(gg(x))).toFixed(1)}`); }
    return `M${o.join("L")}L${u.join("L")}Z`;
  }

  // ---------- Lebenszyklus
  function zyklusPfad(werte: number[]) {
    const w = 600, h = 200, n = werte.length - 1, max = Math.max(...werte.map(Math.abs), 1);
    const pts = werte.map((v, i) => [20 + (i / n) * (w - 40), h / 2 + 70 - (v / max) * 150] as const);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
    return d;
  }
</script>

<figure class="gr" style="--f: {farbe}">
  {#if "titel" in g && g.titel}<figcaption>{@html mdZeile(g.titel)}</figcaption>{/if}

  {#if g.art === "graph"}
    {@const { sx, sy } = skala(g)}
    {@const L = links(g)}
    <svg viewBox="0 0 {W} {H}" role="img" aria-label={g.titel ?? "Funktionsgraph"}>
      {#each schritte(g.x[0], g.x[1]) as x}<line x1={sx(x)} x2={sx(x)} y1={P.t} y2={H - P.b} class="gitter" /><text x={sx(x)} y={H - P.b + 18} class="tick" text-anchor="middle">{de(x)}</text>{/each}
      {#each schritte(g.y[0], g.y[1]) as y}<line x1={L} x2={W - P.r} y1={sy(y)} y2={sy(y)} class="gitter" /><text x={L - 8} y={sy(y) + 4} class="tick" text-anchor="end">{de(y)}</text>{/each}
      {#if g.y[0] <= 0 && g.y[1] >= 0}<line x1={L} x2={W - P.r} y1={sy(0)} y2={sy(0)} class="achse" />{/if}
      {#if g.x[0] <= 0 && g.x[1] >= 0}<line x1={sx(0)} x2={sx(0)} y1={P.t} y2={H - P.b} class="achse" />{/if}
      {#if g.flaeche}<path d={flaeche(g)} class="fl" />{/if}
      {#each g.kurven as k, i}<path d={pfad(g, k.f, k.von, k.bis)} fill="none" stroke={k.farbe ?? FARBEN[i % FARBEN.length]} stroke-width="2.6" stroke-dasharray={k.gestrichelt ? "7 6" : undefined} stroke-linecap="round" />{/each}
      {#each g.punkte ?? [] as p}
        <circle cx={sx(p.x)} cy={sy(p.y)} r="5" class="pkt" />
        {#if p.name}{@const rechts = sx(p.x) > W - 150}<text x={sx(p.x) + (rechts ? -9 : 9)} y={sy(p.y) - 9} class="pn" text-anchor={rechts ? "end" : "start"}>{p.name}</text>{/if}
      {/each}
      {#if g.xName}<text x={W - P.r} y={H - 6} class="an" text-anchor="end">{g.xName}</text>{/if}
      {#if g.yName}<text x={L} y={P.t - 4} class="an">{g.yName}</text>{/if}
    </svg>
    <div class="leg">{#each g.kurven as k, i}<span><i style="background:{k.farbe ?? FARBEN[i % FARBEN.length]}"></i>{@html mdZeile(k.name)}</span>{/each}</div>

  {:else if g.art === "bilanz"}
    {@const sa = g.aktiva.reduce((n, [, v]) => n + (typeof v === "number" ? v : 0), 0)}
    {@const sp = g.passiva.reduce((n, [, v]) => n + (typeof v === "number" ? v : 0), 0)}
    <div class="bil">
      <div class="bil__k"><b>Aktiva</b><small>Was ist da? (Mittelverwendung)</small></div>
      <div class="bil__k"><b>Passiva</b><small>Woher kommt es? (Mittelherkunft)</small></div>
      <div class="bil__s">{#each g.aktiva as [n, v]}<div class:mark={g.markiert?.includes(n)}><span>{n}</span><span class="num">{zahl(v)}</span></div>{/each}</div>
      <div class="bil__s">{#each g.passiva as [n, v]}<div class:mark={g.markiert?.includes(n)}><span>{n}</span><span class="num">{zahl(v)}</span></div>{/each}</div>
      <div class="bil__sum"><span>Summe</span><span class="num">{de(sa)}{g.einheit ? " " + g.einheit : ""}</span></div>
      <div class="bil__sum"><span>Summe</span><span class="num">{de(sp)}{g.einheit ? " " + g.einheit : ""}</span></div>
    </div>

  {:else if g.art === "tkonto"}
    <div class="tks">
      {#each g.konten as k}
        {@const s = k.soll.reduce((n, [, v]) => n + v, 0)}
        {@const h = k.haben.reduce((n, [, v]) => n + v, 0)}
        {@const sum = Math.max(s, h)}
        <div class="tk">
          <div class="tk__n">{k.name}</div>
          <div class="tk__k"><span>Soll</span><span>Haben</span></div>
          <div class="tk__b">
            <div>{#each k.soll as [t, v]}<p><span>{t}</span><span class="num">{de(v)}</span></p>{/each}{#if k.saldo === "soll" && h > s}<p class="sa"><span>Saldo (SB)</span><span class="num">{de(h - s)}</span></p>{/if}</div>
            <div>{#each k.haben as [t, v]}<p><span>{t}</span><span class="num">{de(v)}</span></p>{/each}{#if k.saldo === "haben" && s > h}<p class="sa"><span>Saldo (SB)</span><span class="num">{de(s - h)}</span></p>{/if}</div>
          </div>
          {#if k.saldo}<div class="tk__s"><span class="num">{de(sum)}</span><span class="num">{de(sum)}</span></div>{/if}
        </div>
      {/each}
    </div>

  {:else if g.art === "fluss"}
    <ol class="fl-l" class:hoch={g.richtung === "hoch"}>
      {#each g.schritte as s, i}<li style="--i:{i}"><b>{@html mdZeile(s.t)}</b>{#if s.d}<span>{@html mdZeile(s.d)}</span>{/if}</li>{/each}
    </ol>

  {:else if g.art === "matrix"}
    <div class="mx">
      <span class="mx__y">{g.yName ?? ""}</span>
      <span class="mx__yl">{g.y[0]}</span>
      <div class="mx__f">{@html mdZeile(g.felder[0])}</div><div class="mx__f">{@html mdZeile(g.felder[1])}</div>
      <span class="mx__yl">{g.y[1]}</span>
      <div class="mx__f">{@html mdZeile(g.felder[2])}</div><div class="mx__f">{@html mdZeile(g.felder[3])}</div>
      <span></span><span class="mx__xl">{g.x[0]}</span><span class="mx__xl">{g.x[1]}</span>
      {#if g.xName}<span></span><span class="mx__x">{g.xName}</span>{/if}
    </div>

  {:else if g.art === "balken"}
    {@const max = Math.max(...g.werte.map((w) => Math.abs(w.wert)), 1)}
    <div class="bk">
      {#each g.werte as w, i}<div class="bk__z"><span class="bk__n">{@html mdZeile(w.name)}</span><span class="bk__b"><i style="width:{(Math.abs(w.wert) / max) * 100}%;background:{w.farbe ?? FARBEN[i % FARBEN.length]}"></i></span><span class="num bk__w">{de(w.wert)}{g.einheit ? " " + g.einheit : ""}</span></div>{/each}
    </div>

  {:else if g.art === "zeitstrahl"}
    <ol class="zs">{#each g.punkte as p}<li><span class="zs__w num">{p.wann}</span><span><b>{@html mdZeile(p.t)}</b>{#if p.d}<small>{@html mdZeile(p.d)}</small>{/if}</span></li>{/each}</ol>

  {:else if g.art === "baum"}
    <div class="bm">
      <div class="bm__w">{@html mdZeile(g.wurzel)}</div>
      <div class="bm__a">{#each g.aeste as a}<div class="bm__ast"><b>{@html mdZeile(a.t)}</b>{#if a.blaetter}<ul>{#each a.blaetter as b}<li>{@html mdZeile(b)}</li>{/each}</ul>{/if}</div>{/each}</div>
    </div>

  {:else if g.art === "zyklus"}
    {@const n = g.phasen.length}
    <svg viewBox="0 0 600 260" role="img" aria-label={g.titel ?? "Lebenszyklus"}>
      {#each g.phasen as _, i}{#if i > 0}<line x1={20 + (i / n) * 560} x2={20 + (i / n) * 560} y1="10" y2="210" class="gitter" />{/if}{/each}
      <line x1="20" x2="580" y1="170" y2="170" class="achse" />
      <path d={zyklusPfad(g.kurve ?? [0, 0.15, 0.6, 1, 0.85, 0.35, 0.05])} fill="none" stroke="var(--f)" stroke-width="3" />
      {#each g.phasen as p, i}<text x={20 + ((i + 0.5) / n) * 560} y="234" text-anchor="middle" class="pz">{p.t}</text>{/each}
    </svg>
    {#if g.phasen.some((p) => p.d)}<div class="zy">{#each g.phasen as p}<div><b>{p.t}</b>{#if p.d}<span>{@html mdZeile(p.d)}</span>{/if}</div>{/each}</div>{/if}
  {/if}
</figure>

<style>
  .gr { margin: 0; display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: var(--bg-2); border: 1px solid var(--line); overflow-x: auto; }
  figcaption { font-weight: 600; font-size: .92rem; color: var(--text); }
  svg { width: 100%; height: auto; display: block; min-width: 300px; }
  .gitter { stroke: rgba(203, 215, 235, .08); }
  .achse { stroke: rgba(203, 215, 235, .45); stroke-width: 1.2; }
  .tick, .an, .pz { fill: var(--steel); font-size: 12px; font-family: var(--font); }
  .an { fill: var(--text-2); font-weight: 600; }
  .pz { fill: var(--text-2); font-size: 13px; font-weight: 600; }
  .pkt { fill: var(--text); stroke: var(--bg-2); stroke-width: 2; }
  .pn { fill: var(--text); font-size: 13px; font-weight: 600; font-family: var(--font); paint-order: stroke; stroke: var(--bg-2); stroke-width: 4px; }
  .fl { fill: color-mix(in srgb, var(--f) 22%, transparent); }
  .leg { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: .84rem; color: var(--text-2); }
  .leg span { display: inline-flex; align-items: center; gap: 7px; }
  .leg i { width: 16px; height: 3px; border-radius: 2px; }

  .bil { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--line-2); border-radius: 12px; overflow: hidden; min-width: 300px; }
  .bil > div { padding: 9px 12px; }
  .bil__k { display: grid; background: var(--panel-2); border-bottom: 1px solid var(--line-2); }
  .bil__k small { color: var(--steel); font-size: .74rem; }
  .bil__k:first-child, .bil__s:nth-child(3), .bil__sum:nth-child(5) { border-right: 1px solid var(--line-2); }
  .bil__s { display: grid; align-content: start; gap: 4px; font-size: .9rem; }
  .bil__s div, .bil__sum { display: flex; justify-content: space-between; gap: 10px; }
  .bil__s .mark { color: var(--f); font-weight: 600; }
  .bil__sum { border-top: 2px double var(--line-2); font-weight: 700; }

  .tks { display: flex; flex-wrap: wrap; gap: 14px; }
  .tk { flex: 1 1 230px; min-width: 210px; font-size: .88rem; }
  .tk__n { text-align: center; font-weight: 700; padding-bottom: 4px; }
  .tk__k { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2px solid var(--text-2); color: var(--steel); font-size: .74rem; text-transform: uppercase; letter-spacing: .05em; }
  .tk__k span:last-child { text-align: right; }
  .tk__b { display: grid; grid-template-columns: 1fr 1fr; min-height: 60px; }
  .tk__b > div { padding: 6px 8px 6px 0; display: grid; align-content: start; gap: 3px; }
  .tk__b > div:last-child { border-left: 2px solid var(--text-2); padding: 6px 0 6px 8px; }
  .tk__b p { margin: 0; display: flex; justify-content: space-between; gap: 6px; }
  .tk__b .sa { color: var(--f); font-weight: 600; }
  .tk__s { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line-2); font-weight: 700; }
  .tk__s span { text-align: right; padding: 4px 8px; }

  .fl-l { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; counter-reset: s; }
  .fl-l li { position: relative; flex: 1 1 150px; display: grid; gap: 4px; align-content: start; padding: 12px 12px 12px 40px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); font-size: .86rem; color: var(--text-2); counter-increment: s; }
  .fl-l li::before { content: counter(s); position: absolute; left: 10px; top: 11px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--f) 25%, transparent); color: var(--f); font-weight: 700; font-size: .78rem; }
  .fl-l li b { color: var(--text); font-size: .92rem; }
  .fl-l.hoch { flex-direction: column; }

  .mx { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); gap: 6px; align-items: stretch; font-size: .86rem; min-width: 300px; }
  .mx__y { grid-column: 1 / -1; color: var(--steel); font-size: .78rem; }
  .mx__yl { writing-mode: vertical-rl; transform: rotate(180deg); text-align: center; color: var(--text-2); font-size: .78rem; font-weight: 600; }
  .mx__f { padding: 14px; border-radius: 12px; background: color-mix(in srgb, var(--f) 9%, var(--panel)); border: 1px solid var(--line); color: var(--text-2); min-height: 70px; }
  .mx__xl { text-align: center; color: var(--text-2); font-size: .78rem; font-weight: 600; }
  .mx__x { grid-column: 2 / -1; text-align: center; color: var(--steel); font-size: .78rem; }

  .bk { display: grid; gap: 8px; }
  .bk__z { display: grid; grid-template-columns: minmax(90px, 30%) 1fr auto; align-items: center; gap: 10px; font-size: .86rem; }
  .bk__b { height: 12px; border-radius: 6px; background: var(--panel); overflow: hidden; }
  .bk__b i { display: block; height: 100%; border-radius: 6px; }
  .bk__w { color: var(--text-2); }

  .zs { list-style: none; margin: 0; padding: 0 0 0 6px; display: grid; gap: 12px; border-left: 2px solid color-mix(in srgb, var(--f) 45%, transparent); }
  .zs li { display: grid; grid-template-columns: 90px 1fr; gap: 10px; position: relative; padding-left: 14px; font-size: .88rem; }
  .zs li::before { content: ""; position: absolute; left: -7px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--f); }
  .zs__w { color: var(--f); font-weight: 700; }
  .zs small { display: block; color: var(--steel); }

  .bm { display: grid; gap: 12px; justify-items: center; }
  .bm__w { padding: 10px 18px; border-radius: 12px; background: color-mix(in srgb, var(--f) 22%, var(--panel)); font-weight: 700; }
  .bm__a { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; width: 100%; }
  .bm__ast { flex: 1 1 160px; padding: 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); border-top: 3px solid var(--f); font-size: .86rem; }
  .bm__ast ul { margin: 6px 0 0; padding-left: 18px; color: var(--text-2); display: grid; gap: 2px; }

  .zy { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; font-size: .82rem; color: var(--text-2); }
  .zy div { display: grid; gap: 2px; padding: 10px; border-radius: 10px; background: var(--panel); }
  .zy b { color: var(--text); }
  @media (max-width: 560px) {
    .gr { padding: 10px; }
    .tick, .an { font-size: 19px; }
    .pz { font-size: 19px; }
    .pn { font-size: 20px; }
    svg { min-width: 0; }
  }
</style>
