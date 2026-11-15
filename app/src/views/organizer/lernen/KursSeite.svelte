<script lang="ts">
  // Kurs: Klausuraufbau, Lernpfad (Kapitel → Lektionen mit Stand und Plantermin), Abfragen, Prüfungsläufe
  import Icon from "../../../components/Icon.svelte";
  import Ring from "../../../components/organizer/Ring.svelte";
  import { lernen } from "../../../lib/lernen/lernen.svelte";
  import { md } from "../../../lib/lernen/md";
  import { KURSE, type KursId } from "../../../lib/lernen/typen";
  import { countdown, tageBis, tagKurz, tagLang, uhr } from "../../../lib/organizer/zeit";
  import { note } from "./note";

  let { kurs: id }: { kurs: KursId } = $props();
  const kopf = KURSE.find((k) => k.id === id)!;
  const kurs = $derived(lernen.kurse[id] ?? null);
  const st = $derived(kurs ? lernen.kursStand(kurs) : null);
  const plan = $derived(lernen.plan(id));
  const laeufe = $derived(lernen.laeufe.filter((l) => l.kurs === id).slice(0, 6));
  const n = $derived(tageBis(lernen.klausur(kopf)));
  const schwach = $derived(kurs ? kurs.kapitel.flatMap((c) => c.lektionen.flatMap((l) => l.fragen.filter((f) => { const s = lernen.stand[lernen.key(id, l.id, f.id)]; return s && (s.box <= 1 || s.falsch > s.richtig); }))).length : 0);
  let format = $state(false);
</script>

<a class="zurueck" href="#/o/lernen"><Icon name="left" size={15} />Lernen</a>
<header class="kh card" style="--f: {kopf.farbe}">
  <Ring wert={st?.wert ?? 0} size={84} dicke={7} farbe={kopf.farbe}><span class="num gross">{Math.round((st?.wert ?? 0) * 100)}%</span></Ring>
  <div class="kh__t">
    <small>Klausur {countdown(n)} · {tagLang(lernen.klausur(kopf))}, {uhr(lernen.klausur(kopf))} Uhr</small>
    <h1>{kopf.titel}</h1>
    {#if st}<p class="muted">{st.gelesen} von {st.lektionen} Lektionen gelesen · {st.sicher} von {st.fragen} Fragen sicher · {st.neu} noch nie beantwortet</p>{/if}
    <div class="kh__a">
      <a class="btn btn--primary org-primary" href={`#/o/lernen/abfrage/kurs/${id}`}><Icon name="check" size={15} />Abfragen</a>
      {#if schwach}<a class="btn" href={`#/o/lernen/abfrage/schwach/${id}`}><Icon name="flame" size={15} />Schwachstellen ({schwach})</a>{/if}
      <a class="btn" href={`#/o/lernen/pruefung/${id}`}><Icon name="target" size={15} />Prüfung simulieren</a>
      {#if kurs}<button class="btn btn--quiet" onclick={() => (format = !format)}><Icon name="note" size={15} />Klausuraufbau</button>{/if}
      {#if kurs?.skripte?.length}
        <details class="unterlagen"><summary class="btn btn--quiet"><Icon name="external" size={15} />Unterlagen ({kurs.skripte.length})</summary>
          <div class="ul-liste">{#each kurs.skripte as s (s.datei)}<button onclick={() => lernen.skriptOeffnen(s.datei)}><Icon name="note" size={14} />{s.titel}</button>{/each}</div>
        </details>
      {/if}
    </div>
  </div>
</header>

{#if kurs && format}<div class="format card md">{@html md(kurs.format)}<p class="quelle">{kurs.quelle}</p></div>{/if}

{#if laeufe.length}
  <div class="laeufe">
    {#each laeufe as l (l.id)}{@const p = l.punkte / l.max}<span class="lauf" class:gut={p >= 0.5}><b class="num">{Math.round(p * 100)} %</b><small>Note ≈ {note(p)} · {tagKurz(l.erstellt)}</small></span>{/each}
  </div>
{/if}

{#if !kurs}
  <div class="empty"><b>Lädt …</b></div>
{:else}
  <div class="pfad" style="--f: {kopf.farbe}">
    {#each kurs.kapitel as c, ci (c.id)}
      {@const cw = c.lektionen.reduce((s, l) => s + lernen.lektionStand(kurs, l), 0) / c.lektionen.length}
      <section class="kap">
        <div class="kap__k"><span class="kap__nr num">{ci + 1}</span><h2>{c.titel}</h2><span class="kap__w num">{Math.round(cw * 100)} %</span></div>
        <ol>
          {#each c.lektionen as l (l.id)}
            {@const w = lernen.lektionStand(kurs, l)}
            {@const g = lernen.gelesen(id, l.id)}
            {@const p = plan.get(l.id)}
            <li class:fertig={g && w >= 0.75} class:halb={g && w < 0.75}>
              <a href={`#/o/lernen/${id}/${l.id}`}>
                <span class="knoten">{#if g && w >= 0.75}<Icon name="check" size={14} />{:else if g}<i style="--w:{w}"></i>{/if}</span>
                <span class="lt"><b>{l.titel}</b><small>{l.dauer_min} Min. · {l.fragen.length} Fragen{l.generatoren?.length ? " · Rechentraining" : ""}{p?.geplant && !g ? ` · geplant ${tagKurz(p.geplant)}, ${uhr(p.geplant)}` : ""}</small></span>
                <span class="lw num">{g ? Math.round(w * 100) + " %" : "neu"}</span>
              </a>
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </div>
{/if}

<style>
  .zurueck { display: inline-flex; align-items: center; gap: 6px; color: var(--steel); text-decoration: none; font-size: .88rem; margin-bottom: 10px; }
  .kh { display: flex; gap: 18px; align-items: center; padding: 18px; border-radius: 22px; background: linear-gradient(140deg, color-mix(in srgb, var(--f) 14%, var(--panel)), var(--panel) 65%); }
  .gross { font-size: 1.1rem; }
  .kh__t { display: grid; gap: 4px; min-width: 0; }
  .kh__t small { color: color-mix(in srgb, var(--f) 70%, var(--text-2)); font-weight: 600; font-size: .76rem; text-transform: uppercase; letter-spacing: .04em; }
  h1 { margin: 0; font-size: 1.6rem; }
  .kh__t .muted { margin: 0; font-size: .88rem; }
  .kh__a { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .unterlagen { position: relative; }
  .unterlagen summary { list-style: none; cursor: pointer; }
  .unterlagen summary::-webkit-details-marker { display: none; }
  .ul-liste { position: absolute; z-index: 5; top: calc(100% + 6px); left: 0; min-width: 240px; display: grid; gap: 2px; padding: 6px; border-radius: 14px; background: var(--panel-2); border: 1px solid var(--line-2); box-shadow: 0 12px 30px rgba(0, 0, 0, .4); }
  .ul-liste button { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 0; border-radius: 10px; background: none; color: var(--text); font: inherit; font-size: .9rem; text-align: left; cursor: pointer; }
  .ul-liste button:hover { background: var(--hover); }
  .format { margin-top: 12px; padding: 16px; color: var(--text-2); line-height: 1.6; }
  .format :global(b) { color: var(--text); }
  .format :global(ul) { padding-left: 1.2em; }
  .quelle { font-size: .78rem; color: var(--steel); margin: 8px 0 0; }
  .laeufe { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .lauf { display: grid; padding: 8px 12px; border-radius: 12px; background: var(--panel); border: 1px solid rgba(242, 122, 106, .35); }
  .lauf.gut { border-color: rgba(76, 195, 138, .4); }
  .lauf small { color: var(--steel); font-size: .74rem; }
  .pfad { display: grid; gap: 22px; margin-top: 22px; }
  .kap__k { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .kap__nr { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--f) 22%, transparent); color: var(--f); font-weight: 700; }
  h2 { margin: 0; font-size: 1.08rem; flex: 1; }
  .kap__w { color: var(--steel); font-size: .86rem; }
  ol { list-style: none; margin: 0; padding: 0 0 0 15px; border-left: 2px solid var(--line-2); display: grid; gap: 4px; }
  li a { display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 0; text-decoration: none; color: inherit; border-radius: 12px; }
  li a:hover { background: var(--hover); }
  .knoten { width: 22px; height: 22px; margin-left: -27px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--bg); border: 2px solid var(--line-2); color: #fff; overflow: hidden; }
  .knoten i { width: 100%; height: 100%; background: conic-gradient(var(--f) calc(var(--w) * 360deg), transparent 0); }
  .fertig .knoten { background: var(--f); border-color: var(--f); }
  .halb .knoten { border-color: var(--f); }
  .lt { display: grid; flex: 1; min-width: 0; gap: 1px; }
  .lt b { font-weight: 600; }
  .lt small { color: var(--steel); font-size: .8rem; }
  .lw { color: var(--text-2); font-size: .84rem; }
  .fertig .lw { color: var(--f); }
  @media (max-width: 560px) { .kh { flex-direction: column; align-items: flex-start; } h1 { font-size: 1.35rem; } }
</style>
