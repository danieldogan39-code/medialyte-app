<script lang="ts">
  import Icon from "../../components/Icon.svelte";
  import Zeitleiste from "../../components/organizer/Zeitleiste.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { MIN, dauerKurz, dm, minuten, plusTage, tagKey, uhr, wochenBeginn, wt } from "../../lib/organizer/zeit";
  import type { Block } from "../../lib/organizer/typen";

  let start = $state(wochenBeginn(Date.now()));
  let gewaehlt = $state(tagKey(Date.now()));
  const tage = $derived(Array.from({ length: 7 }, (_, i) => plusTage(start, i)));
  const heuteKey = $derived(tagKey(org.jetzt));
  const kw = $derived.by(() => { const d = new Date(start); d.setDate(d.getDate() + 3); const j = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d.getTime() - j.getTime()) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); });
  const proTag = $derived(tage.map((d) => org.bloecke(d)));
  // sichtbarer Bereich: Arbeitszeit, erweitert um frühe/späte Termine
  const vonMin = $derived(Math.max(0, Math.min(minuten(org.einst.tag_start) - 60, ...proTag.flat().filter((b) => !b.ganztag).map((b) => b.start.getHours() * 60 + b.start.getMinutes())) - 30));
  const bisMin = $derived(Math.min(24 * 60, Math.max(minuten(org.einst.tag_ende) + 120, ...proTag.flat().filter((b) => !b.ganztag).map((b) => b.ende.getHours() * 60 + b.ende.getMinutes() + (b.ende.getDate() !== b.start.getDate() ? 24 * 60 : 0))) + 30));
  const H = 46;   // Pixel je Stunde
  const stunden = $derived(Array.from({ length: Math.ceil((bisMin - Math.floor(vonMin / 60) * 60) / 60) }, (_, i) => Math.floor(vonMin / 60) + i));
  const oben = (d: Date) => ((d.getHours() * 60 + d.getMinutes() - Math.floor(vonMin / 60) * 60) / 60) * H;

  /** Überschneidungen nebeneinander legen */
  function spalten(bl: Block[]) {
    const z = bl.filter((b) => !b.ganztag && b.art !== "routine"), out: { b: Block; s: number; n: number }[] = [];
    let gruppe: { b: Block; s: number }[] = [], ende = 0;
    const schliessen = () => { const n = Math.max(1, ...gruppe.map((g) => g.s + 1)); for (const g of gruppe) out.push({ ...g, n }); gruppe = []; };
    for (const b of z) {
      if (b.start.getTime() >= ende && gruppe.length) schliessen();
      const belegt = new Set(gruppe.filter((g) => g.b.ende.getTime() > b.start.getTime()).map((g) => g.s));
      let s = 0; while (belegt.has(s)) s++;
      gruppe.push({ b, s }); ende = Math.max(ende, b.ende.getTime());
    }
    if (gruppe.length) schliessen();
    return out;
  }
  const last = (bl: Block[]) => bl.filter((b) => b.art === "aufgabe").reduce((n, b) => n + (b.ende.getTime() - b.start.getTime()) / MIN, 0);
  function oeffnen(b: Block) {
    if (b.art === "fahrt" || b.art === "routine") return;
    if (b.aufgabe) blatt.auf({ art: "aufgabe", a: b.aufgabe }); else if (b.termin) blatt.auf({ art: "termin", t: b.termin }); else if (b.gewohnheit) blatt.auf({ art: "gewohnheit", g: b.gewohnheit });
  }
  function neuBei(d: Date, e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const min = Math.floor(vonMin / 60) * 60 + Math.round(((e.clientY - r.top) / H) * 60 / 15) * 15;
    const s = new Date(d); s.setHours(0, min, 0, 0);
    blatt.auf({ art: "termin", t: { start: s.toISOString(), ende: new Date(s.getTime() + 36e5).toISOString() } });
  }
  const wechseln = (n: number) => { start = plusTage(start, n * 7); gewaehlt = tagKey(plusTage(start, 0)); };
  const jetztOben = $derived(oben(new Date(org.jetzt)));
</script>

<div class="kopf">
  <div>
    <small class="muted">KW {kw}</small>
    <h1>{dm(tage[0])} – {dm(tage[6])}</h1>
  </div>
  <div class="aktionen">
    <div class="nav">
      <button class="btn btn--icon" aria-label="Vorige Woche" onclick={() => wechseln(-1)}><Icon name="left" size={18} /></button>
      <button class="btn btn--s" onclick={() => { start = wochenBeginn(Date.now()); gewaehlt = tagKey(Date.now()); }}>Heute</button>
      <button class="btn btn--icon" aria-label="Nächste Woche" onclick={() => wechseln(1)}><Icon name="right" size={18} /></button>
    </div>
    <button class="btn btn--primary org-primary" disabled={org.plant} onclick={() => org.planen()} title="Alle offenen Aufgaben ohne feste Zeit neu verteilen"><Icon name="wand" size={16} />{org.plant ? "Plant …" : "Automatisch planen"}</button>
  </div>
</div>

<!-- Handy: Tage als Leiste, darunter der gewählte Tag -->
<div class="tagleiste" role="tablist">
  {#each tage as d, i (tagKey(d))}
    {@const k = tagKey(d)}
    <button role="tab" aria-selected={gewaehlt === k} class:heute={k === heuteKey} onclick={() => (gewaehlt = k)}>
      <small>{wt(d)}</small><b class="num">{d.getDate()}</b>
      <span class="punkte">{#each proTag[i].slice(0, 4) as b}<i style="background: {b.farbe}"></i>{/each}</span>
    </button>
  {/each}
</div>
<div class="handy">
  {#key gewaehlt}<Zeitleiste tag={new Date(gewaehlt + "T12:00:00")} leer="An diesem Tag ist nichts geplant." />{/key}
</div>

<!-- Computer: ganze Woche als Raster -->
<div class="woche card">
  <div class="ecke"></div>
  {#each tage as d, i (tagKey(d))}
    {@const k = tagKey(d)}
    <div class="th" class:heute={k === heuteKey}>
      <small>{wt(d)}</small><b class="num">{d.getDate()}</b>
      {#if last(proTag[i])}<span class="last">{dauerKurz(last(proTag[i]))}</span>{/if}
      <div class="ganz">{#each proTag[i].filter((b) => b.ganztag) as b (b.id)}<button style="--f: {b.farbe}" onclick={() => oeffnen(b)}>{b.titel}</button>{/each}</div>
    </div>
  {/each}
  <div class="achse" style="height: {stunden.length * H}px">{#each stunden as h}<span style="top: {(h - stunden[0]) * H}px">{String(h).padStart(2, "0")}:00</span>{/each}</div>
  {#each tage as d, i (tagKey(d))}
    {@const k = tagKey(d)}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="spalte" class:heute={k === heuteKey} style="height: {stunden.length * H}px; --h: {H}px" ondblclick={(e) => neuBei(d, e)}>
      {#each proTag[i].filter((b) => b.art === "routine" && b.leer) as b (b.id)}
        <div class="band" style="top: {oben(b.start)}px; height: {((b.ende.getTime() - b.start.getTime()) / 36e5) * H}px" title="{b.titel} · frei"><span>{b.titel.replace(/ \(.*\)/, "")}</span></div>
      {/each}
      {#each spalten(proTag[i]) as { b, s, n } (b.id)}
        {@const h = Math.max(20, ((b.ende.getTime() - b.start.getTime()) / 36e5) * H - 2)}
        <button class="blk" class:fertig={b.erledigt} class:termin={b.art === "termin"} class:fahrt={b.art === "fahrt"} class:klein={h < 40} style="--f: {b.farbe}; top: {oben(b.start)}px; height: {h}px; left: calc({(s / n) * 100}% + 2px); width: calc({100 / n}% - 4px)"
          title="{uhr(b.start)}–{uhr(b.ende)} {b.titel}" onclick={(e) => { e.stopPropagation(); oeffnen(b); }} ondblclick={(e) => e.stopPropagation()}>
          <b>{b.titel}</b>{#if h >= 40}<small>{uhr(b.start)}–{uhr(b.ende)}</small>{/if}
        </button>
      {/each}
      {#if k === heuteKey}<i class="jetzt" style="top: {jetztOben}px"></i>{/if}
    </div>
  {/each}
</div>
<p class="muted tipp">Doppelklick in eine freie Stelle legt dort einen Termin an. Aufgaben ohne feste Zeit verteilt „Automatisch planen“ in die Lücken.</p>

<style>
  .kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .kopf h1 { font-size: 1.6rem; }
  .aktionen { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .nav { display: flex; gap: 4px; align-items: center; }
  .tagleiste, .handy { display: none; }
  .woche { display: grid; grid-template-columns: 52px repeat(7, minmax(0, 1fr)); overflow: hidden; padding: 0; border-radius: 18px; }
  .ecke { border-bottom: 1px solid var(--line); }
  .th { display: grid; justify-items: center; gap: 1px; padding: 10px 4px 6px; border-bottom: 1px solid var(--line); border-left: 1px solid var(--line); position: relative; }
  .th small { color: var(--steel); font-size: .74rem; text-transform: uppercase; letter-spacing: .04em; }
  .th b { color: var(--text); font-size: 1.15rem; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; }
  .th.heute b { background: var(--org); color: #fff; }
  .last { font-size: .7rem; color: var(--steel); }
  .ganz { display: grid; gap: 2px; width: 100%; }
  .ganz button { border: 0; border-radius: 6px; padding: 2px 6px; font: inherit; font-size: .72rem; text-align: left; color: var(--text); background: color-mix(in srgb, var(--f) 30%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
  .achse { position: relative; }
  .achse span { position: absolute; right: 8px; transform: translateY(-50%); font-size: .7rem; color: var(--steel); }
  .achse span:first-child { transform: none; }
  .spalte { position: relative; border-left: 1px solid var(--line); background-image: repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px var(--h)); }
  .spalte.heute { background-color: rgba(142, 124, 255, .04); }
  .blk { position: absolute; display: grid; align-content: start; gap: 1px; padding: 4px 6px; overflow: hidden; border: 0; border-left: 3px solid var(--f); border-radius: 7px; text-align: left; font: inherit; cursor: pointer;
    background: color-mix(in srgb, var(--f) 22%, var(--panel)); color: var(--text); transition: transform .35s var(--feder-schnell), filter .2s ease, opacity .2s ease; }
  .blk.termin { background: color-mix(in srgb, var(--f) 12%, var(--panel-2)); border-left-style: solid; background-image: repeating-linear-gradient(135deg, transparent 0 8px, rgba(255, 255, 255, .025) 8px 16px); }
  .blk.fahrt { border-left-color: #5A6880; background: repeating-linear-gradient(135deg, rgba(139, 152, 173, .12) 0 6px, rgba(139, 152, 173, .05) 6px 12px); color: var(--steel); }
  .band { position: absolute; left: 2px; right: 2px; border-radius: 7px; border: 1px dashed rgba(142, 124, 255, .3); background: rgba(142, 124, 255, .05); pointer-events: none; }
  .band span { position: absolute; top: 3px; left: 6px; font-size: .66rem; color: rgba(185, 174, 255, .7); }
  .blk b { font-weight: 500; font-size: .78rem; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .blk.klein b { -webkit-line-clamp: 1; white-space: nowrap; text-overflow: ellipsis; display: block; }
  .blk small { font-size: .7rem; color: var(--text-2); }
  .blk.fertig { opacity: .45; }
  .blk.fertig b { text-decoration: line-through; }
  .blk:active { transform: scale(.97); }
  @media (hover: hover) and (pointer: fine) { .blk:hover { filter: brightness(1.15); z-index: 2; } }
  .jetzt { position: absolute; left: -1px; right: 0; height: 2px; background: var(--coral); z-index: 3; pointer-events: none; }
  .jetzt::before { content: ""; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--coral); }
  .tipp { font-size: .82rem; margin-top: 10px; }
  @media (max-width: 900px) {
    .kopf h1 { font-size: 1.35rem; }
    .woche, .tipp { display: none; }
    .tagleiste { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin-bottom: 14px; }
    .tagleiste button { display: grid; justify-items: center; gap: 2px; padding: 8px 0 6px; border-radius: 14px; border: 1px solid transparent; background: transparent; color: var(--text-2); font: inherit; cursor: pointer;
      transition: background-color .25s ease, border-color .25s ease, transform .4s var(--feder-schnell); }
    .tagleiste button:active { transform: scale(.93); }
    .tagleiste small { font-size: .7rem; color: var(--steel); text-transform: uppercase; }
    .tagleiste b { font-size: 1.05rem; color: var(--text); }
    .tagleiste button.heute b { color: var(--org); }
    .tagleiste button[aria-selected="true"] { background: var(--panel); border-color: rgba(142, 124, 255, .45); }
    .punkte { display: flex; gap: 2px; height: 5px; }
    .punkte i { width: 5px; height: 5px; border-radius: 50%; }
    .handy { display: block; }
    .aktionen { width: 100%; justify-content: space-between; }
  }
</style>
