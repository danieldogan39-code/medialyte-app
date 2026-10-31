<script lang="ts">
  import Zahl from "../components/Zahl.svelte";
  import Radar from "../components/Radar.svelte";
  import { agent } from "../lib/agent.svelte";
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Schalter from "../components/Schalter.svelte";
  import { frage } from "../lib/frage.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb } from "../lib/supabase";
  import { datumZeit, vor, zahl } from "../lib/format";
  import { ANFRAGE_STATUS, FORMATE } from "../lib/status";
  import { lies, merk } from "../lib/speicher";

  let termine = $state<any[]>(lies("ue:termine", [])), neu = $state<any[]>(lies("ue:neu", [])), zahlen = $state<any[]>(lies("akquise_zahlen", [])), laeufe = $state<any[]>(lies("ue:laeufe", []));

  // Das Radar ist das aufwendigste Bild der App: erst aufbauen, wenn der Seitenwechsel durch ist
  let radarBereit = $state(false);
  $effect(() => { const t = setTimeout(() => (radarBereit = true), 340); return () => clearTimeout(t); });
  async function laden() {
    const jobs: PromiseLike<any>[] = [];
    if (auth.darf("anfragen")) {
      jobs.push(sb.from("anfragen").select("id,firma,name,termin,format,status").gte("termin", new Date(Date.now() - 3600e3).toISOString())
        .not("status", "in", "(verloren,spam)").order("termin").limit(5).then((r) => { if (!r.error) termine = merk("ue:termine", r.data ?? []); }));
      jobs.push(sb.from("anfragen").select("id,firma,name,eingang,anliegen,status").eq("status", "neu").order("eingang", { ascending: false }).limit(5)
        .then((r) => { if (!r.error) neu = merk("ue:neu", r.data ?? []); }));
    }
    if (auth.darf("akquise")) {
      jobs.push(sb.rpc("akquise_zahlen").then((r) => { if (!r.error) zahlen = merk("akquise_zahlen", r.data ?? []); }));
      jobs.push(sb.from("laeufe").select("id,kategorie,art,start,status,zahlen").order("start", { ascending: false }).limit(5).then((r) => { if (!r.error) laeufe = merk("ue:laeufe", r.data ?? []); }));
    }
    await Promise.all(jobs);
  }
  $effect(() => { laden(); const f = () => laden(); addEventListener("ml:anfragen", f); return () => removeEventListener("ml:anfragen", f); });

  const summe = (kat: string | null, st?: string[]) => zahlen.filter((z) => (!kat || z.kategorie === kat) && (!st || st.includes(z.status))).reduce((a, z) => a + Number(z.anzahl), 0);
  const online = (kat: string | null) => zahlen.filter((z) => !kat || z.kategorie === kat).reduce((a, z) => a + Number(z.demos_online), 0);
  const darfAgent = $derived(auth.darf("einstellungen", true));
  const darfKat = $derived(auth.darf("akquise", true));
  async function agentSchalten(a: any, an: boolean) {
    if (!an && a.schluessel === "website" && !(await frage("Website-Agent ausschalten?", "Neue Änderungswünsche deiner Kunden bleiben dann liegen, bis du ihn wieder einschaltest. Übernehmen und Zurücknehmen funktioniert weiter.", "Ausschalten", true))) return;
    await daten.schalten("agent", a.schluessel, an);
  }
  const anzahlAn = $derived(daten.agenten.filter((a) => a.aktiv).length);
  const ART: Record<string, string> = { lauf: "Lauf starten", bauen: "Jetzt bauen", abbrechen: "Lauf abbrechen", entscheidung: "Board", demo_loeschen: "Demo löschen", brief_senden: "Brief verschicken", brief_vorschau: "Brief-Vorschau", bewertung: "Bewertung", neubau: "Neu generieren", neubau_zurueck: "Wunsch zurückgezogen", regel_verwerfen: "Regel verworfen", regel_zurueck: "Regel wiederhergestellt", kunde: "Kunden-Website", kunde_agent_zurueck: "Änderung zurücknehmen", suchgebiete: "Suchgebiete", analyse: "KI-Analyse" };
  const bis = (iso?: string) => {
    if (!iso) return ""; const ms = Date.parse(iso) - Date.now(); if (!(ms > 0)) return "läuft gleich";
    const t = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return t ? `in ${t} ${t === 1 ? "Tag" : "Tagen"}${h ? ` ${h} Std.` : ""}` : h ? `in ${h} Std. ${m} Min.` : `in ${m} Min.`;
  };
  const gruss = () => { const h = new Date().getHours(); return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend"; };
</script>

<Head titel="{gruss()}, {auth.ich?.name}" text="Das Wichtigste auf einen Blick." />

<div class="kpis">
  {#if auth.darf("anfragen")}
    <a class="kpi card ton ton-rot" href="#/anfragen"><small>Neue Anfragen</small><b class="num"><Zahl wert={daten.neueAnfragen} /></b><span class="muted">warten auf Antwort</span></a>
    <a class="kpi card ton ton-rot" href="#/anfragen"><small>Anstehende Termine</small><b class="num"><Zahl wert={termine.length} /></b><span class="muted">{termine[0] ? "nächster " + datumZeit(termine[0].termin) : "keine geplant"}</span></a>
  {/if}
  {#if auth.darf("akquise")}
    <a class="kpi card ton ton-blau" href="#/akquise"><small>Demos online</small><b class="num"><Zahl wert={online(null)} /></b><span class="muted">in allen Kategorien</span></a>
    <a class="kpi card ton ton-gelb" href="#/akquise"><small>Briefe verschickt</small><b class="num">{zahl(summe(null, ["verschickt", "interesse", "kunde"]))}</b><span class="muted">insgesamt</span></a>
  {/if}
</div>

{#if auth.darf("akquise") && (agent.c.gebiete ?? []).length}
  <section class="card held">
    <div class="held__k">
      <span class="live"><i></i>Live</span>
      <h2>Suchradar</h2>
      <p class="muted">Der Agent durchkämmt deine Suchgebiete reihum nach Betrieben ohne gute Website.{#if agent.c.naechster_lauf}{" "}Nächster Lauf: {bis(agent.c.naechster_lauf)}{/if}</p>
    </div>
    {#if radarBereit}<Radar gebiete={agent.c.gebiete} index={agent.c.gebiet_index ?? 0} gross />{:else}<div class="radar-platz" aria-hidden="true"></div>{/if}
  </section>
{/if}

<div class="grid">
  {#if auth.darf("anfragen")}
    <section class="card box">
      <div class="box__h"><h2>Neue Anfragen</h2><a class="btn btn--s btn--quiet" href="#/anfragen">Alle</a></div>
      {#if neu.length}
        <ul class="list">
          {#each neu as a (a.id)}
            <li><a href="#/anfragen/{a.id}"><span><b>{a.firma || a.name}</b><small class="muted">{(a.anliegen ?? []).join(", ") || "Anfrage"}</small></span><span class="muted r">{vor(a.eingang)}</span></a></li>
          {/each}
        </ul>
      {:else}<p class="muted pad">Alles beantwortet.</p>{/if}
    </section>
    <section class="card box">
      <div class="box__h"><h2>Nächste Termine</h2></div>
      {#if termine.length}
        <ul class="list">
          {#each termine as a (a.id)}
            <li><a href="#/anfragen/{a.id}"><span><b>{a.firma || a.name}</b><small class="muted">{FORMATE[a.format] ?? ""} · {ANFRAGE_STATUS[a.status]?.name}</small></span><span class="r num">{datumZeit(a.termin)}</span></a></li>
          {/each}
        </ul>
      {:else}<p class="muted pad">Keine Termine geplant.</p>{/if}
    </section>
  {/if}
</div>

{#if daten.agenten.length}
  <div class="box__h sec"><h2>Agenten</h2><span class="muted small">{anzahlAn} von {daten.agenten.length} an{darfAgent ? "" : " · nur der Inhaber kann schalten"}</span></div>
  <div class="agents">
    {#each daten.agenten as a (a.schluessel)}
      <div class="agent card" class:is-off={!a.aktiv}>
        <span class="agent__ic"><Icon name={a.icon} size={19} /></span>
        <div class="agent__t">
          <div class="agent__h"><b>{a.name}</b><span class="state">{a.aktiv ? "an" : "aus"}</span></div>
          <p class="muted">{a.beschreibung}</p>
          <small class="muted">{a.rhythmus}{a.geaendert_von && daten.name(a.geaendert_von) ? ` · zuletzt geschaltet von ${daten.name(a.geaendert_von)}, ${vor(a.geaendert)}` : ""}</small>
        </div>
        <Schalter an={a.aktiv} label="{a.name} {a.aktiv ? 'ausschalten' : 'einschalten'}" disabled={!darfAgent} onchange={(v) => agentSchalten(a, v)} />
      </div>
    {/each}
  </div>
{/if}

{#if daten.befehle.length}
  <div class="box__h sec"><h2>Aufträge an den Agenten</h2><span class="muted small">letzte 6 Stunden</span></div>
  <div class="card"><ul class="list">
    {#each daten.befehle.slice(0, 8) as b (b.id)}
      <li><div class="row"><span><b>{ART[b.art] ?? b.art}{b.daten?.name ? ` · ${b.daten.name}` : ""}</b><small class="muted">{b.ergebnis ?? (b.status === "offen" ? "wird übergeben" : b.status === "laeuft" ? "Agent arbeitet daran" : "")}</small></span>
        <span class="r"><span class="pill pill--{b.status === 'erledigt' ? 'gruen' : b.status === 'fehler' ? 'rot' : 'gelb'}">{({ offen: "offen", laeuft: "läuft", erledigt: "erledigt", fehler: "Fehler" } as any)[b.status]}</span></span></div></li>
    {/each}
  </ul></div>
{/if}

{#if auth.darf("akquise")}
  <div class="box__h sec"><h2>Akquise-Agent je Branche</h2><a class="btn btn--s btn--quiet" href="#/akquise">Alle Kategorien</a></div>
  <div class="kats">
    {#each daten.kategorien as k (k.slug)}
      <div class="kat card" class:is-off={!k.aktiv} style="--c:{k.farbe}">
        <a class="kat__a" href="#/akquise/{k.slug}">
          <span class="kat__ic"><Icon name={k.icon} size={20} /></span>
          <span class="kat__t"><b>{k.name}</b><small class="muted">{summe(k.slug) ? `${zahl(summe(k.slug))} Betriebe · ${zahl(online(k.slug))} Demos online` : k.suche?.bereit ? "Noch keine Betriebe" : "Branchen-Vorlage folgt"}</small></span>
        </a>
        <Schalter an={k.aktiv} label="Akquise {k.name} {k.aktiv ? 'ausschalten' : 'einschalten'}" disabled={!darfKat} onchange={(v) => daten.schalten("kategorie", k.slug, v)} />
      </div>
    {/each}
  </div>
  {#if laeufe.length}
    <div class="box__h sec"><h2>Letzte Läufe des Agenten</h2></div>
    <div class="card"><ul class="list">
      {#each laeufe as l (l.id)}
        <li><div class="row"><span><b>{daten.kat(l.kategorie)?.name ?? "Agent"}</b><small class="muted">{l.art} · {l.status ?? ""}</small></span><span class="muted r">{vor(l.start)}</span></div></li>
      {/each}
    </ul></div>
  {/if}
{/if}

<style>
  .held { padding: 22px 24px 26px; margin-bottom: 16px; display: grid; gap: 6px; overflow: hidden; position: relative;
    background: radial-gradient(120% 90% at 30% 40%, rgba(111, 168, 240, .08), transparent 60%), var(--panel); }
  .held__k { display: grid; gap: 4px; max-width: 60ch; }
  .held__k h2 { font-size: 1.35rem; letter-spacing: -.01em; }
  .live { display: inline-flex; align-items: center; gap: 7px; justify-self: start; height: 24px; padding: 0 10px; border-radius: 999px; background: rgba(76, 195, 138, .12); color: #7FD9AE; font-size: .76rem; font-weight: 600; }
  .live i { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 0 rgba(76, 195, 138, .6); animation: live 1.8s ease-out infinite; }
  @keyframes live { 70% { box-shadow: 0 0 0 7px rgba(76, 195, 138, 0); } 100% { box-shadow: 0 0 0 0 rgba(76, 195, 138, 0); } }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .kpi { display: grid; gap: 2px; padding: 18px 20px; transition: border-color .15s ease; }
  .kpi small { color: var(--steel); font-size: .84rem; }
  .kpi b { font-size: clamp(1.6rem, 5vw, 2rem); font-weight: 600; color: var(--text); letter-spacing: -.03em; line-height: 1.15; }
  .kpi span { font-size: .84rem; line-height: 1.35; }
  @media (hover: hover) and (pointer: fine) { .kpi:hover, .kat:hover { border-color: var(--line-2); } }
  @media (max-width: 420px) { .agents { grid-template-columns: minmax(0, 1fr); } }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
  .box { padding: 6px 0; }
  .box__h { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px 8px; }
  .sec { padding: 32px 0 12px; }
  .list { list-style: none; margin: 0; padding: 0; }
  .list li + li { border-top: 1px solid var(--line); }
  .list a, .list .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; }
  @media (hover: hover) and (pointer: fine) { .list a:hover { background: var(--hover); } }
  .list span:first-child { display: grid; min-width: 0; }
  .list b { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .list small { font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r { font-size: .84rem; white-space: nowrap; }
  .pad { padding: 8px 20px 16px; }
  .kats { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .small { font-size: .84rem; }
  .agents { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 12px; }
  .agent { display: flex; align-items: flex-start; gap: 14px; padding: 16px 16px 16px 18px; transition: border-color .2s ease; }
  .agent__ic { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; flex: none; color: var(--ok); background: rgba(76, 195, 138, .12); transition: color .2s ease, background-color .2s ease; }
  .agent__t { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .agent__h { display: flex; align-items: center; gap: 8px; }
  .agent__h b { color: var(--text); font-weight: 600; }
  .state { font-size: .72rem; font-weight: 600; letter-spacing: .02em; color: var(--ok); }
  .agent p { font-size: .86rem; line-height: 1.45; }
  .agent small { font-size: .76rem; }
  .agent.is-off .agent__ic { color: var(--steel); background: rgba(139, 152, 173, .12); }
  .agent.is-off .state { color: var(--steel); }
  .agent.is-off b { color: var(--text-2); }
  .kat { display: flex; align-items: center; gap: 12px; padding: 12px 14px 12px 12px; transition: border-color .15s ease; }
  .kat__a { flex: 1; min-width: 0; display: flex; align-items: center; gap: 14px; padding: 4px; border-radius: 8px; }
  .kat.is-off .kat__ic { filter: grayscale(1); opacity: .55; }
  .kat__ic { width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center; flex: none;
    color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
  .kat__t { display: grid; min-width: 0; }
  .kat__t b { color: var(--text); font-weight: 500; }
  .kat__t small { font-size: .82rem; }
  .radar-platz { width: min(100%, 500px); aspect-ratio: 1; margin: 0 auto; }
  @media (min-width: 761px) { .radar-platz { width: calc(100% - 304px); margin: 0; } }
</style>
