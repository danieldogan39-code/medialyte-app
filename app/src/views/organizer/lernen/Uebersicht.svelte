<script lang="ts">
  // Lernen – Startseite: was heute dran ist, alle Kurse mit Lernstand und Klausur-Countdown, der Plan der nächsten Tage
  import Icon from "../../../components/Icon.svelte";
  import Ring from "../../../components/organizer/Ring.svelte";
  import { lernen } from "../../../lib/lernen/lernen.svelte";
  import { org } from "../../../lib/organizer/org.svelte";
  import { daten } from "../../../lib/daten.svelte";
  import { KURSE } from "../../../lib/lernen/typen";
  import { countdown, relativTag, tageBis, tagKey, tagLang, uhr } from "../../../lib/organizer/zeit";

  const faellig = $derived(lernen.anzahlFaellig());
  const kurse = $derived(KURSE.map((k) => ({ kopf: k, kurs: lernen.kurse[k.id] ?? null })).sort((a, b) => lernen.klausur(a.kopf).localeCompare(lernen.klausur(b.kopf))));

  // Plan: Lern-Aufgaben mit Lektion, nach Tag gruppiert (heute + 6 Tage)
  const plan = $derived.by(() => {
    const heute = tagKey(org.jetzt), tage = new Map<string, { a: (typeof org.aufgaben)[number]; kurs: (typeof KURSE)[number]; titel: string }[]>();
    for (const a of org.aufgaben) {
      if (!a.lektion || !a.geplant || a.erledigt) continue;
      const tag = tagKey(a.geplant); if (tag < heute) continue;
      const [kid, lid] = a.lektion.split("/"), kopf = KURSE.find((k) => k.id === kid); if (!kopf) continue;
      const k = lernen.kurse[kopf.id], l = k ? lernen.finde(k, lid)?.lektion : null;
      (tage.get(tag) ?? tage.set(tag, []).get(tag)!).push({ a, kurs: kopf, titel: l?.titel ?? a.titel });
    }
    return [...tage.entries()].sort(([x], [y]) => x.localeCompare(y)).slice(0, 7).map(([tag, l]) => [tag, l.sort((x, y) => x.a.geplant!.localeCompare(y.a.geplant!))] as const);
  });
  const laeufeVon = (id: string) => lernen.laeufe.filter((l) => l.kurs === id);
  const ungeplant = $derived(KURSE.reduce((n, k) => n + lernen.ungeplant(k.id), 0));
  let plant = $state(false);
  async function planLegen() {
    if (plant) return; plant = true;
    try { const n = await lernen.planAnlegen(KURSE.map((k) => k.id)); daten.melden(n ? `${n} Lerneinheiten in deinen Kalender geplant` : "Alles ist schon eingeplant"); }
    finally { plant = false; }
  }
</script>

<div class="kopf">
  <div><h1>Lernen</h1><p class="muted">Erklärungen, Abfragen und Prüfungssimulation für deine vier Klausuren.</p></div>
</div>

<a class="heute card" href={faellig ? "#/o/lernen/abfrage/faellig" : "#/o/lernen/abfrage/neu"}>
  <span class="heute__i"><Icon name="sparkles" size={22} /></span>
  <span class="heute__t">
    <small>Heute</small>
    {#if faellig}<b>{faellig} {faellig === 1 ? "Wiederholung ist" : "Wiederholungen sind"} fällig</b><span>Kurz durchgehen – dann sitzt es bis zur Klausur.</span>
    {:else}<b>Keine Wiederholung fällig</b><span>Starte mit neuen Fragen aus den Lektionen, die du schon gelesen hast.</span>{/if}
  </span>
  <span class="btn btn--primary org-primary">{faellig ? "Abfrage starten" : "Neue Fragen"}<Icon name="right" size={15} /></span>
</a>

{#if ungeplant}
  <div class="planen card">
    <span><b>{ungeplant} Lektionen sind noch nicht in deinem Kalender</b><small>Ich verteile sie bis 3 Tage vor jeder Klausur in deine Lernzeiten – dazu je zwei Prüfungssimulationen.</small></span>
    <button class="btn btn--primary org-primary" disabled={plant} onclick={planLegen}><Icon name="calendar" size={15} />{plant ? "Plant …" : "Lernplan einplanen"}</button>
  </div>
{/if}

<div class="kurse">
  {#each kurse as { kopf, kurs } (kopf.id)}
    {@const n = tageBis(lernen.klausur(kopf))}
    {@const st = kurs ? lernen.kursStand(kurs) : null}
    {@const nx = kurs ? lernen.naechste(kurs) : null}
    {@const fl = kurs ? lernen.faellig(kurs).length : 0}
    {@const letzte = laeufeVon(kopf.id)[0]}
    <article class="kk card" style="--f: {kopf.farbe}">
      <a class="kk__k" href={"#/o/lernen/" + kopf.id}>
        <Ring wert={st?.wert ?? 0} size={62} dicke={6} farbe={kopf.farbe}><span class="num">{Math.round((st?.wert ?? 0) * 100)}%</span></Ring>
        <span class="kk__t"><small>Klausur {countdown(n)} · {tagLang(lernen.klausur(kopf))}</small><b>{kopf.titel}</b>
          {#if st}<span class="muted">{st.gelesen}/{st.lektionen} Lektionen · {st.sicher}/{st.fragen} Fragen sicher{fl ? ` · ${fl} fällig` : ""}</span>{:else}<span class="muted">{lernen.fehlt.includes(kopf.id) ? "Inhalte werden gerade vorbereitet" : "Lädt …"}</span>{/if}</span>
        <span class="tage num">{Math.max(0, n)}<small>{n === 1 ? "Tag" : "Tage"}</small></span>
      </a>
      {#if kurs && st}
        <div class="balken" aria-hidden="true">
          {#each kurs.kapitel as c}{@const w = c.lektionen.reduce((s, l) => s + lernen.lektionStand(kurs, l), 0) / c.lektionen.length}<i title={c.titel} style="--w:{w}"></i>{/each}
        </div>
        <div class="kk__a">
          {#if nx}<a class="btn btn--s weiter" href={`#/o/lernen/${kopf.id}/${nx.id}`}><Icon name="play" size={14} />{lernen.gelesen(kopf.id, nx.id) ? "Festigen" : "Weiter"}: {nx.titel}</a>{/if}
          <a class="btn btn--s" href={`#/o/lernen/abfrage/kurs/${kopf.id}`}><Icon name="check" size={14} />Abfragen</a>
          <a class="btn btn--s" href={`#/o/lernen/pruefung/${kopf.id}`}><Icon name="target" size={14} />Prüfung simulieren{letzte ? ` · zuletzt ${Math.round((letzte.punkte / letzte.max) * 100)} %` : ""}</a>
        </div>
      {/if}
    </article>
  {/each}
</div>

{#if plan.length}
  <section class="plan">
    <h2>Dein Lernplan</h2>
    {#each plan as [tag, liste] (tag)}
      <div class="tag"><span class="tag__n">{relativTag(new Date(tag + "T12:00"))}</span>
        <div class="tag__l">{#each liste as x (x.a.id)}<a href={"#/o/lernen/" + x.a.lektion} style="--f:{x.kurs.farbe}"><span class="zeit num">{uhr(x.a.geplant!)}</span><span class="pkt"></span><span class="t"><b>{x.titel}</b><small>{x.kurs.titel}</small></span><Icon name="right" size={14} /></a>{/each}</div>
      </div>
    {/each}
  </section>
{/if}

<style>
  .kopf { margin-bottom: 18px; }
  h2 { font-size: 1.05rem; margin: 0 0 10px; }
  .heute { display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: 20px; text-decoration: none; color: inherit; margin-bottom: 18px;
    background: linear-gradient(135deg, rgba(142, 124, 255, .18), rgba(79, 199, 212, .08) 70%), var(--panel); border-color: rgba(165, 152, 255, .35); }
  .heute__i { width: 48px; height: 48px; border-radius: 15px; display: grid; place-items: center; flex: none; background: rgba(142, 124, 255, .25); color: #C4B9FF; }
  .heute__t { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .heute__t small { font-size: .74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #B7AAFF; }
  .heute__t b { font-size: 1.12rem; color: var(--text); }
  .heute__t span { color: var(--text-2); font-size: .9rem; }
  .planen { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 16px; border-radius: 16px; margin-bottom: 14px; border-style: dashed; border-color: rgba(180, 140, 255, .45); }
  .planen span { display: grid; gap: 2px; flex: 1 1 260px; }
  .planen small { color: var(--steel); }
  .kurse { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 14px; align-items: start; }
  .kk { display: grid; gap: 12px; padding: 16px; border-radius: 20px; background: linear-gradient(150deg, color-mix(in srgb, var(--f) 11%, var(--panel)), var(--panel) 62%); }
  .kk__k { display: flex; align-items: center; gap: 14px; text-decoration: none; color: inherit; }
  .kk__t { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .kk__t small { color: color-mix(in srgb, var(--f) 70%, var(--text-2)); font-weight: 600; font-size: .74rem; text-transform: uppercase; letter-spacing: .04em; }
  .kk__t b { font-size: 1.1rem; color: var(--text); }
  .kk__t .muted { font-size: .84rem; }
  .tage { display: grid; justify-items: center; font-size: 1.6rem; font-weight: 700; color: var(--f); line-height: 1; }
  .tage small { font-size: .7rem; font-weight: 600; }
  .balken { display: flex; gap: 4px; }
  .balken i { flex: 1; height: 7px; border-radius: 4px; background: linear-gradient(90deg, var(--f) calc(var(--w) * 100%), rgba(203, 215, 235, .1) calc(var(--w) * 100%)); }
  .kk__a { display: flex; flex-wrap: wrap; gap: 8px; }
  .weiter { border-color: color-mix(in srgb, var(--f) 55%, transparent); color: var(--text); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; }
  .plan { margin-top: 26px; }
  .tag { display: grid; grid-template-columns: 110px 1fr; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
  .tag__n { font-weight: 600; color: var(--text-2); font-size: .9rem; padding-top: 8px; }
  .tag__l { display: grid; gap: 6px; }
  .tag__l a { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); text-decoration: none; color: inherit; }
  .tag__l a:hover { background: var(--panel-2); }
  .zeit { font-size: .82rem; color: var(--steel); width: 42px; }
  .pkt { width: 8px; height: 8px; border-radius: 50%; background: var(--f); flex: none; }
  .t { display: grid; flex: 1; min-width: 0; }
  .t b { font-weight: 600; font-size: .92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t small { color: var(--steel); font-size: .76rem; }
  @media (max-width: 520px) { .kurse { grid-template-columns: minmax(0, 1fr); } .tag { grid-template-columns: 1fr; gap: 4px; } .tag__n { padding: 0; } .heute { flex-wrap: wrap; } .heute .btn { width: 100%; } }
</style>
