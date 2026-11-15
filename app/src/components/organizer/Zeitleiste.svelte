<script lang="ts">
  // Zeitleiste eines Tages: Termine, geplante Aufgaben und Gewohnheiten in der richtigen Reihenfolge,
  // mit „Jetzt“-Linie, laufendem Block (Restzeit, Fokus) und freien Lücken dazwischen.
  import Icon from "../Icon.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { MIN, dauer, minuten, tagBeginn, tagKey, uhr } from "../../lib/organizer/zeit";
  import { TERMIN_ART, type Block } from "../../lib/organizer/typen";
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { federKurve, ruhig } from "../../lib/bewegung";

  let { tag, leer = "Nichts geplant." }: { tag: Date; leer?: string } = $props();
  const fl = federKurve(0.45, 0.05);

  const bloecke = $derived(org.bloecke(tag));
  const heute = $derived(tagKey(tag) === tagKey(org.jetzt));
  type Zeile = { typ: "block"; b: Block } | { typ: "jetzt" } | { typ: "frei"; von: Date; min: number; key: string };
  const zeilen = $derived.by(() => {
    const out: Zeile[] = [], j = org.jetzt;
    const ganz = bloecke.filter((b) => b.ganztag), rest = bloecke.filter((b) => !b.ganztag);
    for (const b of ganz) out.push({ typ: "block", b });
    const fruehestens = Math.max(tagBeginn(tag).getTime() + minuten(org.einst.tag_start) * MIN, heute ? j : 0);
    const spaetestens = tagBeginn(tag).getTime() + minuten(org.einst.tag_ende) * MIN;
    let ende = fruehestens, jetztGesetzt = !heute;
    for (const b of rest) {
      if (!jetztGesetzt && b.start.getTime() > j) { out.push({ typ: "jetzt" }); jetztGesetzt = true; }
      const luecke = (b.start.getTime() - ende) / MIN;
      if (luecke >= 45 && ende < spaetestens) out.push({ typ: "frei", von: new Date(ende), min: Math.min(luecke, (spaetestens - ende) / MIN), key: "f" + ende });
      out.push({ typ: "block", b });
      ende = Math.max(ende, b.ende.getTime());
    }
    if (!jetztGesetzt && j < tagBeginn(tag).getTime() + 86_400_000) out.push({ typ: "jetzt" });
    if (spaetestens - ende >= 45 * MIN) out.push({ typ: "frei", von: new Date(ende), min: (spaetestens - ende) / MIN, key: "f" + ende });
    return out;
  });
  const laeuft = (b: Block) => !b.ganztag && b.start.getTime() <= org.jetzt && b.ende.getTime() > org.jetzt;
  const rest = (b: Block) => Math.max(1, Math.round((b.ende.getTime() - org.jetzt) / MIN));

  function oeffnen(b: Block) {
    if (b.aufgabe) blatt.auf({ art: "aufgabe", a: b.aufgabe });
    else if (b.termin) blatt.auf({ art: "termin", t: b.termin });
    else if (b.gewohnheit) blatt.auf({ art: "gewohnheit", g: b.gewohnheit });
  }
  function haken(b: Block, e: Event) {
    e.stopPropagation();
    if (b.aufgabe) org.erledigen(b.aufgabe);
    else if (b.gewohnheit) org.abhaken(b.gewohnheit, tagKey(tag));
  }
  const key = (z: Zeile) => (z.typ === "block" ? z.b.id : z.typ === "jetzt" ? "jetzt" : z.key);
</script>

{#if !bloecke.length}
  <div class="leer"><Icon name="sun" size={22} /><span>{leer}</span></div>
{:else}
  <ol class="zl">
    {#each zeilen as z (key(z))}
      <li animate:flip={{ duration: ruhig() ? 0 : fl.ms, easing: fl.easing }} in:fly={{ y: ruhig() ? 0 : 8, duration: ruhig() ? 0 : 280 }}>
        {#if z.typ === "jetzt"}
          <div class="jetzt" aria-label="Jetzt"><span>{uhr(org.jetzt)}</span><i></i></div>
        {:else if z.typ === "frei"}
          <button class="frei" onclick={() => blatt.auf({ art: "schnell" })}><span class="zeit">{uhr(z.von)}</span><span>Frei · {dauer(z.min)}</span><Icon name="plus" size={14} /></button>
        {:else}
          {@const b = z.b}
          <div class="zeile" class:lauf={laeuft(b)} class:fertig={b.erledigt} class:termin={b.art === "termin"} style="--f: {b.farbe}" role="button" tabindex="0"
            onclick={() => oeffnen(b)} onkeydown={(e) => { if (e.key === "Enter") oeffnen(b); }}>
            <span class="zeit num">{#if b.ganztag}<b>ganztägig</b>{:else}<b>{uhr(b.start)}</b><small>{uhr(b.ende)}</small>{/if}</span>
            <span class="balken" aria-hidden="true"></span>
            <span class="txt">
              <b>{b.titel}</b>
              <small>
                {#if b.termin}<span class="art"><Icon name={TERMIN_ART[b.termin.art].icon} size={12} />{TERMIN_ART[b.termin.art].name}</span>{/if}
                {#if b.art === "gewohnheit"}<span class="art"><Icon name={b.gewohnheit?.icon ?? "dumbbell"} size={12} />Gewohnheit</span>{/if}
                {#if b.unter}<span>{b.unter}</span>{/if}
                {#if !b.ganztag}<span>{dauer((b.ende.getTime() - b.start.getTime()) / MIN)}</span>{/if}
              </small>
              {#if laeuft(b)}<span class="restzeit">läuft · noch {dauer(rest(b))}</span>{/if}
            </span>
            {#if b.art !== "termin"}
              {#if laeuft(b) && b.aufgabe && !b.erledigt}
                <button class="fokus" aria-label="Fokus starten" onclick={(e) => { e.stopPropagation(); blatt.auf({ art: "fokus", a: b.aufgabe! }); }}><Icon name="play" size={14} fill /></button>
              {/if}
              <button class="haken" class:an={b.erledigt} aria-label={b.erledigt ? "Wieder offen" : "Erledigt"} onclick={(e) => haken(b, e)}><Icon name="check" size={16} /></button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
{/if}

<style>
  .zl { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .leer { display: flex; align-items: center; gap: 10px; padding: 18px 16px; border-radius: var(--radius); border: 1px dashed var(--line-2); color: var(--steel); }
  .zeile { display: grid; grid-template-columns: 54px 4px minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 10px 12px 10px 10px;
    border-radius: 14px; background: var(--panel); border: 1px solid var(--line); cursor: pointer; transition: transform .45s var(--feder-schnell), background-color .2s ease, border-color .2s ease, box-shadow .3s ease, opacity .3s ease; }
  .zeile:active { transform: scale(.985); transition-duration: .08s; }
  @media (hover: hover) and (pointer: fine) { .zeile:hover { background: var(--panel-2); } }
  .zeile.termin { background: color-mix(in srgb, var(--f) 7%, var(--panel)); }
  .zeile.lauf { border-color: color-mix(in srgb, var(--f) 55%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--f) 30%, transparent), 0 14px 34px -18px color-mix(in srgb, var(--f) 70%, transparent);
    background: linear-gradient(100deg, color-mix(in srgb, var(--f) 16%, var(--panel)), var(--panel) 70%); }
  .zeile.fertig { opacity: .55; }
  .zeile.fertig .txt b { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--text) 50%, transparent); }
  .zeit { display: grid; line-height: 1.2; text-align: right; }
  .zeit b { color: var(--text); font-weight: 600; font-size: .92rem; }
  .zeit small { color: var(--steel); font-size: .76rem; }
  .balken { align-self: stretch; width: 4px; border-radius: 4px; background: var(--f); min-height: 34px; }
  .txt { display: grid; gap: 2px; min-width: 0; }
  .txt b { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .txt small { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--steel); font-size: .8rem; }
  .txt small span { display: inline-flex; align-items: center; gap: 4px; }
  .art { color: color-mix(in srgb, var(--f) 70%, var(--text-2)); }
  .restzeit { color: color-mix(in srgb, var(--f) 75%, #fff); font-size: .8rem; font-weight: 500; }
  .haken { width: 30px; height: 30px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--f) 70%, var(--line-2)); background: transparent; color: transparent;
    display: grid; place-items: center; cursor: pointer; transition: background-color .25s ease, color .25s ease, transform .45s var(--feder-schnell), border-color .25s ease; }
  .haken.an { background: var(--f); border-color: var(--f); color: #0A1220; }
  .haken.an :global(svg) { animation: hak .45s var(--feder); }
  @keyframes hak { from { transform: scale(.3); } }
  .haken:active { transform: scale(.85); }
  @media (hover: hover) and (pointer: fine) { .haken:not(.an):hover { color: color-mix(in srgb, var(--f) 80%, transparent); } }
  .fokus { width: 30px; height: 30px; border-radius: 50%; border: 0; background: var(--f); color: #0A1220; display: grid; place-items: center; cursor: pointer; }
  .zeile:not(:has(.fokus)) { grid-template-columns: 54px 4px minmax(0, 1fr) auto; }
  .zeile.termin { grid-template-columns: 54px 4px minmax(0, 1fr); }
  .jetzt { display: flex; align-items: center; gap: 8px; color: var(--coral-2); font-size: .74rem; font-weight: 600; padding: 2px 0; }
  .jetzt span { width: 54px; text-align: right; }
  .jetzt i { flex: 1; height: 2px; border-radius: 2px; background: linear-gradient(90deg, var(--coral), transparent); position: relative; }
  .jetzt i::before { content: ""; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 4px rgba(242, 74, 74, .2); }
  .frei { display: grid; grid-template-columns: 54px 1fr auto; gap: 12px; align-items: center; width: 100%; padding: 6px 12px 6px 10px; border: 1px dashed var(--line); border-radius: 12px;
    background: transparent; color: var(--steel); font: inherit; font-size: .82rem; text-align: left; cursor: pointer; transition: border-color .2s ease, color .2s ease; }
  .frei .zeit { text-align: right; font-size: .78rem; }
  @media (hover: hover) and (pointer: fine) { .frei:hover { border-color: var(--line-2); color: var(--text-2); } }
</style>
