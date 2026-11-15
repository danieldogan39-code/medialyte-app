<script lang="ts">
  // Lernen – Startseite: heute geplante Lektionen, fällige Wiederholungen, Klausur-Zeitstrahl und alle Kurse mit Lernstand
  import Icon from "../../../components/Icon.svelte";
  import Ring from "../../../components/organizer/Ring.svelte";
  import { lernen } from "../../../lib/lernen/lernen.svelte";
  import { org } from "../../../lib/organizer/org.svelte";
  import { daten } from "../../../lib/daten.svelte";
  import { KURSE, type KursKopf } from "../../../lib/lernen/typen";
  import { tageBis, tagKey, uhr, wt, dm } from "../../../lib/organizer/zeit";

  const faellig = $derived(lernen.anzahlFaellig());
  const kurse = $derived(KURSE.map((k) => ({ kopf: k, kurs: lernen.kurse[k.id] ?? null })).sort((a, b) => lernen.klausur(a.kopf).localeCompare(lernen.klausur(b.kopf))));
  const gesamt = $derived.by(() => {
    let w = 0, n = 0, gelesen = 0, lek = 0;
    for (const { kurs } of kurse) if (kurs) { const s = lernen.kursStand(kurs); w += s.wert * s.fragen; n += s.fragen; gelesen += s.gelesen; lek += s.lektionen; }
    return { wert: n ? w / n : 0, gelesen, lek };
  });

  // heute geplante Lerneinheiten (Aufgaben mit Lektion)
  const heute = $derived.by(() => {
    const h = tagKey(org.jetzt);
    return org.aufgaben.filter((a) => a.lektion && a.geplant && tagKey(a.geplant) === h)
      .sort((a, b) => a.geplant!.localeCompare(b.geplant!))
      .map((a) => {
        const [kid, lid] = a.lektion!.split("/"), kopf = KURSE.find((k) => k.id === kid)!;
        const k = kopf ? lernen.kurse[kopf.id] : null, l = k && lid !== "pruefung" ? lernen.finde(k, lid)?.lektion : null;
        return { a, kopf, titel: lid === "pruefung" ? "Prüfungssimulation" : l?.titel ?? a.titel, link: lid === "pruefung" ? `#/o/lernen/pruefung/${kid}` : `#/o/lernen/${a.lektion}` };
      }).filter((x) => x.kopf);
  });
  const heuteOffen = $derived(heute.filter((x) => !x.a.erledigt));
  const heuteMin = $derived(heuteOffen.reduce((n, x) => n + x.a.dauer_min, 0));

  const ungeplant = $derived(KURSE.reduce((n, k) => n + lernen.ungeplant(k.id), 0));
  let plant = $state(false);
  async function planLegen() {
    if (plant) return; plant = true;
    try { const n = await lernen.planAnlegen(KURSE.map((k) => k.id)); daten.melden(n ? `${n} Lerneinheiten in deinen Kalender geplant` : "Alles ist schon eingeplant"); }
    finally { plant = false; }
  }
  const laeufeVon = (id: string) => lernen.laeufe.filter((l) => l.kurs === id);
  const vorbereitung = (k: KursKopf) => { const kurs = lernen.kurse[k.id]; if (!kurs) return 0; const s = lernen.kursStand(kurs); return s.lektionen ? s.gelesen / s.lektionen : 0; };
</script>

<header class="kopf">
  <div>
    <h1>Lernen</h1>
    <p class="muted">Erklärungen, Abfragen und Prüfungssimulation für deine vier Klausuren.</p>
  </div>
  <div class="gesamt">
    <Ring wert={gesamt.wert} size={54} dicke={5} farbe="#B48CFF"><span class="num">{Math.round(gesamt.wert * 100)}%</span></Ring>
    <span><b class="num">{gesamt.gelesen}/{gesamt.lek}</b><small>Lektionen geschafft</small></span>
  </div>
</header>

<div class="oben">
  <section class="heute card">
    <div class="h-kopf">
      <span class="h-ic"><Icon name="sun" size={18} /></span>
      <span class="h-t"><small>Heute</small><b>{heuteOffen.length ? `${heuteOffen.length} ${heuteOffen.length === 1 ? "Lerneinheit" : "Lerneinheiten"} · ${(Math.round(heuteMin / 6) / 10).toLocaleString("de-DE")} Std.` : heute.length ? "Alles für heute geschafft" : "Heute nichts geplant"}</b></span>
    </div>
    {#if heute.length}
      <ol class="h-liste">
        {#each heute as x (x.a.id)}
          <li class:fertig={!!x.a.erledigt} style="--f: {x.kopf.farbe}">
            <a href={x.link}>
              <span class="h-zeit num">{uhr(x.a.geplant!)}</span>
              <i class="h-pkt"></i>
              <span class="h-lek"><b>{x.titel}</b><small>{x.kopf.titel} · {x.a.dauer_min} Min.</small></span>
              {#if x.a.erledigt}<Icon name="check" size={16} />{:else}<Icon name="right" size={15} />{/if}
            </a>
          </li>
        {/each}
      </ol>
    {/if}
    <a class="wdh" class:leer={!faellig} href={faellig ? "#/o/lernen/abfrage/faellig" : "#/o/lernen/abfrage/neu"}>
      <Icon name="refresh" size={16} />
      <span>{faellig ? `${faellig} ${faellig === 1 ? "Wiederholung" : "Wiederholungen"} fällig` : "Keine Wiederholung fällig – neue Fragen üben"}</span>
      <Icon name="right" size={14} />
    </a>
  </section>

  <section class="zeit card">
    <div class="h-kopf"><span class="h-ic z"><Icon name="target" size={18} /></span><span class="h-t"><small>Klausuren</small><b>Wie weit du bist</b></span></div>
    <ol class="z-liste">
      {#each kurse as { kopf } (kopf.id)}
        {@const n = tageBis(lernen.klausur(kopf))}
        {@const v = vorbereitung(kopf)}
        <li style="--f: {kopf.farbe}">
          <a href={"#/o/lernen/" + kopf.id}>
            <span class="z-datum"><b>{wt(lernen.klausur(kopf))}</b><small class="num">{dm(lernen.klausur(kopf))}</small></span>
            <span class="z-mitte"><b>{kopf.titel}</b><span class="z-balken"><i style="width:{Math.max(2, v * 100)}%"></i></span></span>
            <span class="z-tage num">{Math.max(0, n)}<small>{n === 1 ? "Tag" : "Tage"}</small></span>
          </a>
        </li>
      {/each}
    </ol>
  </section>
</div>

{#if ungeplant}
  <div class="planen card">
    <span><b>{ungeplant} {ungeplant === 1 ? "Lektion ist" : "Lektionen sind"} noch nicht in deinem Kalender</b><small>Ich verteile sie bis 3 Tage vor jeder Klausur in deine Lernzeiten – dazu je eine kurze Prüfungssimulation.</small></span>
    <button class="btn btn--primary org-primary" disabled={plant} onclick={planLegen}><Icon name="calendar" size={15} />{plant ? "Plant …" : "Lernplan einplanen"}</button>
  </div>
{/if}

<h2>Fächer</h2>
<div class="kurse">
  {#each kurse as { kopf, kurs } (kopf.id)}
    {@const n = tageBis(lernen.klausur(kopf))}
    {@const st = kurs ? lernen.kursStand(kurs) : null}
    {@const nx = kurs ? lernen.naechste(kurs) : null}
    {@const fl = kurs ? lernen.faellig(kurs).length : 0}
    {@const letzte = laeufeVon(kopf.id)[0]}
    <article class="kk card" style="--f: {kopf.farbe}">
      <a class="kk__k" href={"#/o/lernen/" + kopf.id}>
        <span class="kk__t">
          <small>{wt(lernen.klausur(kopf))}, {dm(lernen.klausur(kopf))} · {uhr(lernen.klausur(kopf))} Uhr</small>
          <b>{kopf.titel}</b>
        </span>
        <span class="tg num">{Math.max(0, n)} {n === 1 ? "Tag" : "Tage"}</span>
      </a>
      <div class="kk__m">
        <Ring wert={st?.wert ?? 0} size={58} dicke={6} farbe={kopf.farbe}><span class="num">{Math.round((st?.wert ?? 0) * 100)}%</span></Ring>
        {#if st}
          <dl class="kk__z">
            <div><dt>Gelesen</dt><dd class="num">{st.gelesen}<small>/{st.lektionen}</small></dd></div>
            <div><dt>Sicher</dt><dd class="num">{st.sicher}<small>/{st.fragen}</small></dd></div>
            <div><dt>Fällig</dt><dd class="num" class:warn={fl > 0}>{fl}</dd></div>
          </dl>
        {:else}<span class="muted">{lernen.fehlt.includes(kopf.id) ? "Inhalte werden vorbereitet" : "Lädt …"}</span>{/if}
      </div>
      {#if kurs && st}
        <div class="balken" aria-hidden="true">
          {#each kurs.kapitel as c}{@const w = c.lektionen.reduce((s, l) => s + lernen.lektionStand(kurs, l), 0) / c.lektionen.length}<i title={c.titel} style="--w:{w}"></i>{/each}
        </div>
        {#if nx}
          <a class="weiter" href={`#/o/lernen/${kopf.id}/${nx.id}`}>
            <span class="w-ic"><Icon name="play" size={13} fill /></span>
            <span class="w-t"><small>{lernen.gelesen(kopf.id, nx.id) ? "Festigen" : "Weiter"}</small><b>{nx.titel}</b></span>
            <Icon name="right" size={15} />
          </a>
        {/if}
        <div class="kk__a">
          <a class="mini" href={`#/o/lernen/abfrage/kurs/${kopf.id}`}><Icon name="check" size={14} />Abfragen</a>
          <a class="mini" href={`#/o/lernen/pruefung/${kopf.id}`}><Icon name="target" size={14} />Simulation{letzte ? ` · ${Math.round((letzte.punkte / letzte.max) * 100)} %` : ""}</a>
        </div>
      {/if}
    </article>
  {/each}
</div>

<style>
  .kopf { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
  .kopf h1 { margin: 0; }
  .kopf p { margin: 4px 0 0; }
  .gesamt { display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 10px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); }
  .gesamt span { display: grid; line-height: 1.2; }
  .gesamt b { font-size: 1.05rem; }
  .gesamt small { color: var(--steel); font-size: .76rem; }
  h2 { font-size: 1rem; margin: 26px 0 12px; color: var(--text-2); font-weight: 600; }

  .oben { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; }
  .heute, .zeit { display: grid; gap: 12px; align-content: start; padding: 16px; border-radius: 20px; min-width: 0; }
  .heute { background: linear-gradient(150deg, rgba(180, 140, 255, .14), var(--panel) 55%); border-color: rgba(180, 140, 255, .3); }
  .h-kopf { display: flex; align-items: center; gap: 12px; }
  .h-ic { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; flex: none; background: rgba(180, 140, 255, .2); color: #CDB8FF; }
  .h-ic.z { background: rgba(242, 122, 106, .16); color: #F49A8C; }
  .h-t { display: grid; line-height: 1.25; min-width: 0; }
  .h-t small { font-size: .72rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--steel); }
  .h-t b { font-size: 1.04rem; color: var(--text); }
  .h-liste, .z-liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .h-liste a, .z-liste a { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 12px; text-decoration: none; color: inherit; min-width: 0; transition: background .2s; }
  .h-liste a:hover, .z-liste a:hover { background: var(--hover); }
  .h-zeit { width: 42px; flex: none; font-size: .84rem; color: var(--steel); }
  .h-pkt { width: 9px; height: 9px; border-radius: 50%; background: var(--f); flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--f) 20%, transparent); }
  .h-lek { display: grid; flex: 1; min-width: 0; }
  .h-lek b, .z-mitte b { font-weight: 600; font-size: .93rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .h-lek small { color: var(--steel); font-size: .76rem; }
  .h-liste :global(svg) { color: var(--steel); flex: none; }
  .fertig .h-lek b { text-decoration: line-through; color: var(--steel); }
  .fertig :global(svg) { color: var(--ok) !important; }
  .wdh { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 14px; background: rgba(180, 140, 255, .14); border: 1px solid rgba(180, 140, 255, .35); color: var(--text); text-decoration: none; font-weight: 600; font-size: .92rem; }
  .wdh span { flex: 1; min-width: 0; }
  .wdh.leer { background: var(--bg-2); border-color: var(--line); color: var(--text-2); font-weight: 500; }
  .z-datum { width: 46px; flex: none; display: grid; text-align: center; line-height: 1.15; }
  .z-datum b { color: var(--f); font-size: .8rem; text-transform: uppercase; }
  .z-datum small { color: var(--text-2); font-size: .82rem; }
  .z-mitte { display: grid; gap: 6px; flex: 1; min-width: 0; }
  .z-balken { height: 5px; border-radius: 3px; background: rgba(203, 215, 235, .1); overflow: hidden; }
  .z-balken i { display: block; height: 100%; border-radius: 3px; background: var(--f); transition: width .8s var(--ease); }
  .z-tage { display: grid; justify-items: end; font-size: 1.25rem; font-weight: 700; color: var(--f); line-height: 1; flex: none; }
  .z-tage small { font-size: .66rem; font-weight: 600; color: var(--steel); }

  .planen { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 16px; border-radius: 16px; margin-top: 14px; border-style: dashed; border-color: rgba(180, 140, 255, .45); }
  .planen span { display: grid; gap: 2px; flex: 1 1 260px; min-width: 0; }
  .planen small { color: var(--steel); }

  .kurse { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 14px; align-items: start; }
  .kk { display: grid; gap: 14px; padding: 16px; border-radius: 20px; min-width: 0; position: relative; overflow: hidden;
    background: linear-gradient(165deg, color-mix(in srgb, var(--f) 12%, var(--panel)), var(--panel) 58%); }
  .kk::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--f); opacity: .8; }
  .kk__k { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; text-decoration: none; color: inherit; min-width: 0; }
  .kk__t { display: grid; gap: 3px; min-width: 0; }
  .kk__t small { color: color-mix(in srgb, var(--f) 75%, var(--text-2)); font-weight: 600; font-size: .74rem; letter-spacing: .02em; }
  .kk__t b { font-size: 1.08rem; color: var(--text); line-height: 1.25; }
  .tg { flex: none; padding: 4px 10px; border-radius: 999px; font-size: .8rem; font-weight: 700; color: var(--f); background: color-mix(in srgb, var(--f) 16%, transparent); white-space: nowrap; }
  .kk__m { display: flex; align-items: center; gap: 16px; }
  .kk__z { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 0; flex: 1; min-width: 0; }
  .kk__z div { display: grid; gap: 1px; }
  .kk__z dt { font-size: .7rem; color: var(--steel); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  .kk__z dd { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text); }
  .kk__z dd small { font-size: .78rem; font-weight: 500; color: var(--steel); }
  .kk__z dd.warn { color: var(--warn); }
  .balken { display: flex; gap: 3px; }
  .balken i { flex: 1; height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--f) calc(var(--w) * 100%), rgba(203, 215, 235, .1) calc(var(--w) * 100%)); }
  .weiter { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 14px; background: color-mix(in srgb, var(--f) 12%, var(--bg-2)); border: 1px solid color-mix(in srgb, var(--f) 40%, transparent); text-decoration: none; color: var(--text); min-width: 0; transition: transform .2s var(--ease), background .2s; }
  .weiter:hover { background: color-mix(in srgb, var(--f) 18%, var(--bg-2)); }
  .weiter:active { transform: scale(.985); }
  .w-ic { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--f); color: #0A1220; }
  .w-t { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
  .w-t small { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: color-mix(in srgb, var(--f) 80%, var(--text-2)); }
  .w-t b { font-weight: 600; font-size: .92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .weiter > :global(svg:last-child) { color: var(--steel); flex: none; }
  .kk__a { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mini { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 0 10px; border-radius: 12px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); text-decoration: none; font-size: .86rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background .2s, color .2s; }
  .mini:hover { background: var(--hover); color: var(--text); }
  @media (max-width: 860px) { .oben { grid-template-columns: minmax(0, 1fr); } }
</style>
