<script lang="ts">
  // Lektion: Lernziel, Erklärung mit Grafiken und Beispielen, danach Abfrage und Rechentraining
  import Icon from "../../../components/Icon.svelte";
  import Baustein from "../../../components/lernen/Baustein.svelte";
  import Marke from "../../../components/lernen/Marke.svelte";
  import { MARKEN } from "../../../lib/lernen/marken";
  import { istPraxis } from "../../../lib/lernen/pruefen";
  import { lernen } from "../../../lib/lernen/lernen.svelte";
  import { md, mdZeile } from "../../../lib/lernen/md";
  import { router } from "../../../lib/router.svelte";
  import { KURSE, type KursId } from "../../../lib/lernen/typen";

  let { kurs: kid, id }: { kurs: KursId; id: string } = $props();
  const kopf = KURSE.find((k) => k.id === kid)!;
  // Mathe, BWL und Rechnungswesen zählen Folien, das IM-Skript Seiten
  const wort = kid === "im" ? "S." : "Folie";
  const kurs = $derived(lernen.kurse[kid] ?? null);
  const x = $derived(kurs ? lernen.finde(kurs, id) : null);
  const gelesen = $derived(lernen.gelesen(kid, id));
  const w = $derived(kurs && x ? lernen.lektionStand(kurs, x.lektion) : 0);

  async function abfragen() { await lernen.alsGelesen(kid, id); router.geh(`/o/lernen/abfrage/lektion/${kid}/${id}`); }
</script>

<div class="lek" style="--f: {kopf.farbe}">
  <nav class="brot"><a href="#/o/lernen">Lernen</a><Icon name="right" size={12} /><a href={"#/o/lernen/" + kid}>{kopf.titel}</a>{#if x}<Icon name="right" size={12} /><span>{x.kapitel.titel}</span>{/if}</nav>

  {#if !kurs}
    <div class="empty"><b>Lädt …</b></div>
  {:else if !x}
    <div class="empty"><b>Lektion nicht gefunden</b><a class="btn" href={"#/o/lernen/" + kid}>Zum Kurs</a></div>
  {:else}
    {@const l = x.lektion}
    <header>
      <small>Lektion {x.nr} von {x.gesamt} · {l.dauer_min} Min.{gelesen ? ` · ${Math.round(w * 100)} % sicher` : ""}</small>
      <h1>{l.titel}</h1>
      <div class="ziel"><b>Danach kannst du</b><div class="md">{@html md(l.ziel)}</div></div>
      {#if l.marken && kurs.marken}
        <a class="mks" href={`#/o/lernen/${kid}`} title="Was die Markierungen bedeuten, steht auf der Kursseite">
          <b>Im Skript markiert</b>
          {#each MARKEN.filter((m) => l.marken![m]?.length && kurs.marken![m]) as m (m)}<Marke marke={[m]} legende={kurs.marken} folien={l.marken[m]} {wort} />{/each}
        </a>
      {/if}
    </header>

    <article class="inhalt">
      {#each l.inhalt as b, i (i)}
        {@const v = l.inhalt[i - 1]}
        {#if !(b.t === "grafik" && v?.t === "beispiel" && v.aufgabe)}
          {@const n = l.inhalt[i + 1]}
          {#if b.marke && kurs.marken}<div class="mkz"><Marke marke={b.marke} legende={kurs.marken} folien={b.folien} {wort} /></div>{/if}
          <Baustein {b} farbe={kopf.farbe} loesung={b.t === "beispiel" && b.aufgabe && n?.t === "grafik" ? n : undefined} />
        {/if}
      {/each}
      {#if l.quelle}<p class="quelle">Grundlage: {@html mdZeile(l.quelle)}{#if kurs.skripte?.length}
        {@const s = lernen.folie(l.quelle)}
        · <button class="skript" onclick={() => lernen.skriptOeffnen(kurs.skripte![0].datei, s)}><Icon name="external" size={13} />{s ? `Im Skript ansehen (Folie ${s})` : "Skript öffnen"}</button>{/if}</p>{/if}
    </article>

    <section class="ende card">
      <div><b>Jetzt prüfen, ob es sitzt</b><span class="muted">{l.fragen.length} Fragen zu dieser Lektion. Falsche kommen in der Abfrage gleich nochmal und danach öfter, bis sie sitzen.</span></div>
      <div class="ende__a">
        <button class="btn btn--primary org-primary" onclick={abfragen}><Icon name="check" size={15} />{gelesen ? "Nochmal abfragen" : "Gelesen – jetzt abfragen"}</button>
        {#if l.fragen.some(istPraxis)}{@const praxis = l.fragen.filter(istPraxis).length}<a class="btn" href={`#/o/lernen/abfrage/praxis/${kid}/${id}`} title="Nur Aufgaben zum Selbermachen: rechnen, buchen, Tabellen ausfüllen"><Icon name="stift" size={15} />Praxis ({praxis})</a>{/if}
        {#each l.generatoren ?? [] as g (g.id)}<a class="btn" href={`#/o/lernen/abfrage/training/${kid}/${id}/${g.id}`}><Icon name="refresh" size={15} />{g.titel}</a>{/each}
      </div>
    </section>

    <nav class="nachbar">
      {#if x.vor}<a href={`#/o/lernen/${kid}/${x.vor.id}`}><Icon name="left" size={15} /><span><small>Vorherige</small>{x.vor.titel}</span></a>{:else}<span></span>{/if}
      {#if x.nach}<a class="r" href={`#/o/lernen/${kid}/${x.nach.id}`}><span><small>Nächste</small>{x.nach.titel}</span><Icon name="right" size={15} /></a>{/if}
    </nav>
  {/if}
</div>

<style>
  .lek { max-width: 820px; margin: 0 auto; }
  .brot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: .84rem; color: var(--steel); margin-bottom: 14px; }
  .brot a { color: var(--steel); text-decoration: none; }
  @media (hover: hover) and (pointer: fine) { .brot a:hover { color: var(--text); } }
  header { display: grid; gap: 8px; margin-bottom: 22px; }
  header small { color: var(--f); font-weight: 700; font-size: .76rem; text-transform: uppercase; letter-spacing: .05em; }
  h1 { margin: 0; font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1.2; }
  .ziel { display: grid; gap: 4px; padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--f) 8%, var(--panel)); border: 1px solid color-mix(in srgb, var(--f) 30%, transparent); }
  .mks { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-top: 10px; padding: 9px 14px; border-radius: 14px; background: rgba(203, 215, 235, .04); border: 1px solid var(--line); }
  .mks b { font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; color: var(--steel); }
  /* Markierung sitzt rechts über dem Baustein – wie der Stern oben rechts auf der Folie */
  .mkz { display: flex; justify-content: flex-end; margin: 14px 0 -8px; }
  .ziel b { font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; color: var(--f); }
  .ziel .md { color: var(--text-2); line-height: 1.55; }
  .ziel .md :global(ul) { margin: 0; padding-left: 1.2em; }
  .ziel .md :global(p) { margin: 0; }
  .inhalt { display: grid; gap: 18px; }
  .quelle { font-size: .8rem; color: var(--steel); margin: 0; }
  .skript { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: none; color: var(--f); font: inherit; cursor: pointer; text-decoration: underline; }
  .ende { display: grid; gap: 12px; margin-top: 30px; padding: 18px; border-radius: 18px; border-color: color-mix(in srgb, var(--f) 40%, transparent); background: color-mix(in srgb, var(--f) 7%, var(--panel)); }
  .ende > div:first-child { display: grid; gap: 3px; }
  .ende .muted { font-size: .9rem; }
  .ende__a { display: flex; flex-wrap: wrap; gap: 8px; }
  .nachbar { display: flex; justify-content: space-between; gap: 12px; margin: 18px 0 30px; }
  .nachbar a { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); text-decoration: none; color: var(--text); max-width: 48%; }
  .nachbar a span { display: grid; min-width: 0; }
  .nachbar small { color: var(--steel); font-size: .74rem; }
  .nachbar .r { text-align: right; margin-left: auto; }
  @media (max-width: 560px) { .nachbar { flex-direction: column; } .nachbar a { max-width: none; } .nachbar .r { justify-content: space-between; } }
</style>
