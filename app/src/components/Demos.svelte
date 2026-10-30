<script lang="ts">
  // Live-Demos einer Kategorie: ansehen, bewerten (Daumen, Kommentar), neu generieren lassen, Favoriten, löschen
  import Icon from "./Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten, type Kategorie } from "../lib/daten.svelte";
  import { befehl } from "../lib/befehl";
  import { frage } from "../lib/frage.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { datum, vor } from "../lib/format";
  import { sofort, sparHinweis } from "../lib/agent.svelte";
  import { GERAET } from "../lib/nachfass";

  let { kat }: { kat: Kategorie } = $props();
  let demos = $state<any[]>([]), bew = $state<Record<string, any>>({}), aufrufe = $state<Record<string, any[]>>({}), laedt = $state(true);
  // Filter, Sortierung und Ort bleiben auf diesem Gerät gespeichert (wie im Cockpit)
  const MERK = "medialyte-demos-filter";
  const gemerkt = (() => { try { return JSON.parse(localStorage.getItem(MERK) ?? "{}"); } catch { return {}; } })();
  let filter = $state<string>(gemerkt.filter ?? "alle"), sort = $state<string>(gemerkt.sort ?? "neu"), ort = $state<string>(gemerkt.ort ?? ""), suche = $state(""), anzahl = $state(24);
  $effect(() => { try { localStorage.setItem(MERK, JSON.stringify({ filter, sort, ort })); } catch { /* egal */ } });
  let warumOffen = $state(""), gelernt = $state<Record<string, string>>({});
  let neuOffen = $state(""), wunsch = $state(""), modus = $state("neu"), kommentarOffen = $state(""), kommentar = $state("");
  const darf = $derived(auth.darf("akquise", true));

  async function laden() {
    const [d, b, z] = await Promise.all([
      sb.from("demos").select("slug,url,kurz,erstellt,gebaut,loescht_am,version,vorlage,daten,betriebe!inner(id,name,branche,ort,punkte,status,kategorie,place_id,entfernung_km,bewertung,anzahl_bewertungen,website_art,plattform,daten,briefe(verschickt,test,status,grund,daten))")
        .eq("betriebe.kategorie", kat.slug).is("geloescht", null).limit(500),
      sb.from("bewertungen").select("*"),
      sb.functions.invoke("zaehler", { body: { aktion: "stand" } }),
      sb.from("gedaechtnis").select("daten").eq("kategorie", kat.slug).maybeSingle(),
    ]).then((r) => { gelernt = (r[3] as any).data?.daten?.verarbeitet ?? {}; return r; });
    demos = d.data ?? []; bew = Object.fromEntries((b.data ?? []).map((x: any) => [x.slug, x])); aufrufe = z.data?.aufrufe ?? {}; laedt = false;
  }
  $effect(() => { kat.slug; laden(); });
  $effect(() => { const f = () => laden(); addEventListener("ml:laeufe", f); return () => removeEventListener("ml:laeufe", f); });

  const heute = Date.now();
  const tageBis = (d?: string | null) => (d ? Math.ceil((Date.parse(d + "T23:59:00Z") - heute) / 864e5) : null);
  const brief = (x: any) => (x.betriebe?.briefe ?? [])[0];
  const b = (x: any) => bew[x.slug];
  const aktuell = (x: any) => b(x) && String(b(x).version ?? "") === String(x.version ?? "");
  const geoeffnet = (x: any) => (aufrufe[x.kurz ?? ""] ?? []).filter((a: any) => !brief(x)?.verschickt || Date.parse(a.z) > Date.parse(brief(x).verschickt + "T23:59:59Z"));
  const nurSeite = (x: any, seite: string) => geoeffnet(x).filter((a: any) => (a.s || "demo") === seite);
  const behalten = (x: any) => ["behalten", "interesse", "kunde"].includes(x.betriebe?.status);
  const orte = $derived([...new Set(demos.map((x) => x.betriebe?.ort).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de")) as string[]);
  const istGelernt = (x: any) => { const r = b(x); return !!r && gelernt[`${x.slug}@${x.version}`] === `${r.daumen ?? 0}|${String(r.kommentar ?? "").trim().slice(0, 800)}`; };
  const FILTER: [string, string, (x: any) => boolean][] = [
    ["alle", "Alle", () => true],
    ["fav", "Favoriten", (x) => !!b(x)?.favorit],
    ["offen", "Geöffnet", (x) => geoeffnet(x).length > 0],
    ["neu", "Neu", (x) => !!x.erstellt && heute - Date.parse(x.erstellt) < 7 * 864e5],
    ["ohne", "Ohne Brief", (x) => !brief(x)],
    ["versch", "Verschickt", (x) => !!brief(x)?.verschickt && !brief(x)?.test],
    ["test", "Testbrief", (x) => !!brief(x)?.test],
    ["bald", "Läuft bald ab", (x) => { const t = tageBis(x.loescht_am); return t !== null && t <= 7; }],
  ];
  const passt = (x: any) => (!suche || `${x.betriebe?.name} ${x.betriebe?.ort} ${x.betriebe?.branche}`.toLowerCase().includes(suche.toLowerCase())) && (!ort || x.betriebe?.ort === ort);
  const gefiltert = $derived(filter !== "alle" || !!ort || !!suche || sort !== "neu");
  function zuruecksetzen() { filter = "alle"; ort = ""; suche = ""; sort = "neu"; anzahl = 24; }
  const liste = $derived.by(() => {
    const f = (FILTER.find((y) => y[0] === filter) ?? FILTER[0])[2];
    const l = demos.filter((x) => f(x) && passt(x));
    if (sort === "neu") l.sort((p, q) => String(q.gebaut ?? q.erstellt).localeCompare(String(p.gebaut ?? p.erstellt)));
    if (sort === "ab") l.sort((p, q) => (tageBis(p.loescht_am) ?? 9999) - (tageBis(q.loescht_am) ?? 9999));
    if (sort === "punkte") l.sort((p, q) => (q.betriebe?.punkte ?? 0) - (p.betriebe?.punkte ?? 0));
    return l;
  });

  async function setzen(x: any, felder: Record<string, unknown>) {
    const alt = bew[x.slug];
    bew[x.slug] = { slug: x.slug, version: x.version, daumen: 0, favorit: false, ...(aktuell(x) ? alt : { favorit: alt?.favorit ?? false, neubau: alt?.neubau }), ...felder };
    const { error } = await sb.from("bewertungen").upsert({ slug: x.slug, version: x.version, daumen: bew[x.slug].daumen, kommentar: bew[x.slug].kommentar ?? null,
      favorit: bew[x.slug].favorit, neubau: bew[x.slug].neubau ?? null, zeit: new Date().toISOString() });
    if (error) { bew[x.slug] = alt; daten.melden(fehler(error)); return false; }
    return true;
  }
  async function daumen(x: any, d: number) {
    const neu = aktuell(x) && b(x)?.daumen === d ? 0 : d;    // nochmal tippen = zurücknehmen
    if (!(await setzen(x, { daumen: neu }))) return;
    await befehl("bewertung", { slug: x.slug, version: x.version, daumen: neu, kommentar: b(x)?.kommentar ?? "", name: x.betriebe?.name, welt: x.daten?.welt }, x.slug,
      neu ? "Gespeichert – die KI lernt gleich daraus" : "Bewertung zurückgenommen");
  }
  async function kommentarSpeichern(x: any) {
    if (!(await setzen(x, { kommentar: kommentar.trim().slice(0, 400) || null }))) return;
    kommentarOffen = "";
    await befehl("bewertung", { slug: x.slug, version: x.version, daumen: b(x)?.daumen ?? 0, kommentar: kommentar.trim(), name: x.betriebe?.name, welt: x.daten?.welt }, x.slug, "Kommentar gespeichert");
  }
  async function favorit(x: any) { await setzen(x, { favorit: !b(x)?.favorit }); }
  async function neubau(x: any) {
    const nb = { wunsch: wunsch.trim().slice(0, 1200), modus, zeit: new Date().toISOString(), version: x.version };
    if (!(await setzen(x, { neubau: nb }))) return;
    neuOffen = ""; wunsch = "";
    await befehl("neubau", { slug: x.slug, version: x.version, wunsch: nb.wunsch, modus, name: x.betriebe?.name, welt: x.daten?.welt, sofort: sofort.an }, x.slug,
      (nb.wunsch ? "Neubau angefordert – der Agent baut gleich." : "Frischer Entwurf angefordert – der Agent baut gleich.") + sparHinweis());
  }
  async function neubauZurueck(x: any) {
    if (!(await setzen(x, { neubau: null }))) return;
    await befehl("neubau_zurueck", { slug: x.slug, version: x.version, name: x.betriebe?.name }, x.slug, "Wunsch zurückgezogen");
  }
  async function loeschen(x: any) {
    if (!(await frage("Demo endgültig löschen?", `Die Demo von ${x.betriebe?.name} geht sofort offline – auch Links aus verschickten Briefen.`, "Endgültig löschen", true, "löschen"))) return;
    const bt = x.betriebe;
    await befehl("demo_loeschen", { place_id: bt.place_id, slug: x.slug, name: bt.name, branche: bt.branche, ort: bt.ort, punkte: bt.punkte }, bt.place_id, "Demo wird gelöscht …");
  }
  async function kopieren(x: any) { try { await navigator.clipboard.writeText(x.url); daten.melden("Link kopiert"); } catch { daten.melden(x.url); } }
  function stand(x: any): string {
    const nb = b(x)?.neubau, fe = x.daten?.neubau_fehler;
    if (nb && String(nb.version) === String(x.version)) return daten.offen("neubau", x.slug).length || daten.laufend[kat.slug] ? "Neubau läuft …" : "Neubau angefordert";
    if (fe && (!x.daten?.neubau_erledigt || fe.zeit > x.daten.neubau_erledigt)) return "Neubau fehlgeschlagen: " + String(fe.fehler ?? "").slice(0, 80);
    if (!aktuell(x) && b(x)) return "Neue Version – bitte bewerten";
    if (aktuell(x) && (b(x).daumen || b(x).kommentar)) return istGelernt(x) ? "Gelernt" : "Gespeichert, die KI lernt gleich daraus";
    return "Wie gefällt sie dir?";
  }
</script>

<div class="bar">
  <label class="search"><Icon name="search" size={16} /><input class="input" placeholder="Name, Ort, Art" bind:value={suche}></label>
  <select class="input sel" bind:value={sort} aria-label="Sortierung"><option value="neu">Neueste</option><option value="ab">Läuft ab</option><option value="punkte">Eignung</option></select>
  {#if orte.length > 1}<select class="input sel" bind:value={ort} aria-label="Ort"><option value="">Alle Orte</option>{#each orte as o}<option value={o}>{o}</option>{/each}</select>{/if}
  {#if gefiltert}<button class="btn btn--s btn--quiet" onclick={zuruecksetzen}><Icon name="x" size={14} />Zurücksetzen</button>{/if}
</div>
<div class="chips">
  {#each FILTER as [k, n, f]}<button class="chip" class:on={filter === k} onclick={() => { filter = k; anzahl = 24; }}>{n} <span class="num">{demos.filter((x) => f(x) && passt(x)).length}</span></button>{/each}
</div>

{#if laedt}<p class="muted">Lade …</p>
{:else if !liste.length}<div class="card empty"><b>Keine Demos</b><p>{filter === "alle" ? "Noch keine Demo online." : "Filter ändern."}</p></div>
{:else}
  <div class="grid">
    {#each liste.slice(0, anzahl) as x (x.slug)}
      {@const t = tageBis(x.loescht_am)}{@const r = b(x)}{@const auf = geoeffnet(x)}
      <article class="dk card">
        <div class="dk__v"><iframe src={x.url} title="Vorschau {x.betriebe?.name}" loading="lazy" sandbox="allow-scripts allow-same-origin" tabindex="-1"></iframe>
          <button class="fav" class:on={!!r?.favorit} onclick={() => favorit(x)} aria-pressed={!!r?.favorit} aria-label="Favorit" disabled={!darf}><Icon name="star" size={17} fill={!!r?.favorit} /></button>
          <span class="life" title={t === null ? "bleibt online" : `wird in ${t} Tagen gelöscht`}>{t === null ? "∞" : `${Math.max(t, 0)} T`}</span>
        </div>
        <div class="dk__b">
          <div class="dk__h"><b>{x.betriebe?.name}</b><small class="muted">{[x.betriebe?.branche, x.betriebe?.ort].filter(Boolean).join(" · ")}</small></div>
          <div class="tags">
            {#if x.betriebe?.punkte}<span class="pill pill--plain">Eignung {Math.round(x.betriebe.punkte)}</span>{/if}
            {#if x.daten?.design === "einzeln"}<span class="pill pill--plain pill--lila">Einzelstück{x.daten?.note ? ` · Note ${x.daten.note}/10` : ""}</span>{/if}
            {#if x.daten?.welt_label}<span class="pill pill--plain">{x.daten.welt_label}</span>{/if}
            {#if x.betriebe?.entfernung_km != null}<span class="pill pill--plain">{String(x.betriebe.entfernung_km).replace(".", ",")} km</span>{/if}
            {#if x.betriebe?.bewertung}<span class="pill pill--plain">{String(x.betriebe.bewertung).replace(".", ",")} ★ ({x.betriebe.anzahl_bewertungen ?? 0})</span>{/if}
            {#if x.betriebe?.website_art}<span class="pill pill--plain" title="Website heute">{x.betriebe.website_art}{x.betriebe.plattform ? ` · ${x.betriebe.plattform}` : ""}</span>{/if}
            {#if x.vorlage && !x.daten?.welt_label}<span class="pill pill--plain">{x.vorlage}</span>{/if}
            {#if behalten(x)}<span class="pill pill--plain pill--gruen">bleibt online</span>{/if}
            {#if daten.offen("brief_senden", x.slug).length}<span class="pill pill--plain pill--gelb">Brief wird verschickt</span>
            {:else if brief(x)?.verschickt}<span class="pill pill--plain pill--{brief(x).test ? 'gelb' : 'blau'}">{brief(x).test ? "Testbrief" : "Brief"} {datum(brief(x).verschickt)}</span>
            {:else if brief(x)?.grund}<span class="pill pill--plain pill--rot" title={brief(x).grund}>Brief nicht verschickt: {String(brief(x).grund).slice(0, 40)}</span>
            {:else if brief(x)}<span class="pill pill--plain">Brief bereit</span>{/if}
            {#each [["demo", "Demo"], ["angebot", "Angebot"]] as [seite, wort]}
              {@const a = nurSeite(x, seite)}
              {#if a.length}<span class="pill pill--plain pill--gruen">{wort} angesehen {vor(a[0].z)}{a[0].g && GERAET[a[0].g] ? ` · ${GERAET[a[0].g]}` : ""}{a.length > 1 ? ` · ${a.length}×` : ""}</span>{/if}
            {/each}
          </div>
          <p class="st" class:ok={stand(x) === "Gelernt"}>{stand(x)}</p>
          {#if (x.betriebe?.daten?.bewertung_details ?? []).length}
            <button class="lnk warum" onclick={() => (warumOffen = warumOffen === x.slug ? "" : x.slug)} aria-expanded={warumOffen === x.slug}>Warum ausgewählt?</button>
            {#if warumOffen === x.slug}
              <div class="kats">{#each x.betriebe.daten.bewertung_details.slice(0, 10) as k}
                <div class="kat"><span>{k.name}</span><span class="kb"><i style="width:{Math.round(((k.punkte ?? 0) / (k.max || 1)) * 100)}%"></i></span>{#if k.warum}<small class="muted">{k.warum}</small>{/if}</div>{/each}</div>
            {/if}
          {/if}
          {#if darf}
            <div class="dk__a">
              <button class="btn btn--s btn--icon" class:up={aktuell(x) && r?.daumen > 0} onclick={() => daumen(x, 1)} aria-label="Gefällt mir" aria-pressed={aktuell(x) && r?.daumen > 0}>👍</button>
              <button class="btn btn--s btn--icon" class:down={aktuell(x) && r?.daumen < 0} onclick={() => daumen(x, -1)} aria-label="Gefällt mir nicht" aria-pressed={aktuell(x) && r?.daumen < 0}>👎</button>
              <button class="btn btn--s btn--quiet" onclick={() => { kommentarOffen = kommentarOffen === x.slug ? "" : x.slug; kommentar = (aktuell(x) && r?.kommentar) || ""; }}><Icon name="note" size={14} />Kommentar</button>
              <button class="btn btn--s btn--quiet" onclick={() => { neuOffen = neuOffen === x.slug ? "" : x.slug; wunsch = ""; modus = x.daten?.design === "einzeln" ? "ueberarbeiten" : "neu"; }}><Icon name="refresh" size={14} />Neu generieren</button>
            </div>
          {/if}
          {#if kommentarOffen === x.slug}
            <form class="box" onsubmit={(e) => { e.preventDefault(); kommentarSpeichern(x); }}>
              <input class="input" maxlength="400" placeholder="Was gefällt dir, was nicht?" bind:value={kommentar}>
              <button class="btn btn--s" type="submit">Speichern</button>
            </form>
          {/if}
          {#if neuOffen === x.slug}
            <form class="box col" onsubmit={(e) => { e.preventDefault(); neubau(x); }}>
              <textarea class="input" rows="3" maxlength="1200" placeholder="Was soll anders werden? z. B. heller, mehr Fotos vom Essen, ruhigere Schrift. Leer lassen = ganz frischer Entwurf." bind:value={wunsch}
                onkeydown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); neubau(x); } }}></textarea>
              <div class="seg">
                {#if x.daten?.design === "einzeln"}<button type="button" aria-pressed={modus === "ueberarbeiten"} onclick={() => (modus = "ueberarbeiten")}>Überarbeiten</button>{/if}
                <button type="button" aria-pressed={modus === "neu"} onclick={() => (modus = "neu")}>Neu entwerfen</button>
              </div>
              <div class="row"><button class="btn btn--s btn--quiet" type="button" onclick={() => (neuOffen = "")}>Abbrechen</button><button class="btn btn--s btn--primary" type="submit">{wunsch.trim() ? "Neu generieren" : "Frisch entwerfen"}</button></div>
            </form>
          {/if}
          {#if r?.neubau && String(r.neubau.version) === String(x.version)}
            <div class="wunsch"><span class="muted">Dein Wunsch ({r.neubau.modus === "ueberarbeiten" ? "überarbeiten" : "neu entwerfen"}):</span> {r.neubau.wunsch || "ganz frischer Entwurf"}
              {#if darf && !daten.laufend[kat.slug]}<button class="lnk" onclick={() => neubauZurueck(x)}>Zurückziehen</button>{/if}</div>
          {/if}
          <div class="dk__f">
            <a class="btn btn--s btn--quiet" href={x.url} target="_blank" rel="noopener"><Icon name="external" size={14} />Öffnen</a>
            <button class="btn btn--s btn--quiet" onclick={() => kopieren(x)}><Icon name="copy" size={14} />Link</button>
            <a class="btn btn--s btn--quiet" href="#/akquise/betrieb/{x.betriebe?.id}"><Icon name="letter" size={14} />Brief</a>
            {#if darf}<button class="btn btn--s btn--quiet del" onclick={() => loeschen(x)} aria-label="Demo löschen"><Icon name="trash" size={14} /></button>{/if}
          </div>
        </div>
      </article>
    {/each}
  </div>
  {#if liste.length > anzahl}<div class="mehr"><button class="btn" onclick={() => (anzahl += 24)}>Weitere {Math.min(24, liste.length - anzahl)} laden</button></div>{/if}
{/if}

<style>
  .bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
  .search { position: relative; display: block; width: min(260px, 100%); }
  .search :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--steel); pointer-events: none; }
  .search .input { padding-left: 34px; min-height: 36px; }
  .sel { width: auto; min-height: 36px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; }
  .chip span { color: var(--steel); margin-left: 4px; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .chip.on span { color: rgba(10, 18, 32, .6); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
  .dk { overflow: hidden; display: grid; grid-template-rows: auto 1fr; }
  .dk__v { position: relative; aspect-ratio: 16 / 10; background: #fff; overflow: hidden; border-bottom: 1px solid var(--line); }
  .dk__v iframe { width: 300%; height: 300%; border: 0; transform: scale(.3334); transform-origin: 0 0; pointer-events: none; }
  .fav { position: absolute; top: 8px; right: 8px; width: 34px; height: 34px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer;
    background: rgba(10, 18, 32, .75); color: #fff; backdrop-filter: none; }
  .fav.on { color: #F5C451; }
  .life { position: absolute; top: 8px; left: 8px; padding: 3px 8px; border-radius: 999px; background: rgba(10, 18, 32, .75); color: #fff; font-size: .74rem; font-weight: 600; }
  .dk__b { padding: 12px 14px 10px; display: grid; gap: 8px; align-content: start; }
  .dk__h { display: grid; }
  .dk__h b { color: var(--text); font-weight: 600; }
  .dk__h small { font-size: .8rem; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tags .pill { height: 22px; font-size: .72rem; padding: 0 8px; }
  .st { font-size: .8rem; color: var(--steel); margin: 0; }
  .st.ok { color: #6FD3A2; }
  .warum { justify-self: start; margin: 0; font-size: .8rem; }
  .kats { display: grid; gap: 6px; font-size: .78rem; }
  .kat { display: grid; grid-template-columns: 1fr 60px; gap: 2px 8px; align-items: center; }
  .kat small { grid-column: 1 / -1; font-size: .72rem; }
  .kb { height: 4px; border-radius: 999px; background: rgba(255, 255, 255, .07); overflow: hidden; }
  .kb i { display: block; height: 100%; background: var(--ok); }
  .dk__a, .dk__f { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .dk__f { border-top: 1px solid var(--line); padding-top: 8px; }
  .btn--icon { width: 34px; font-size: 1rem; }
  .up { background: rgba(76, 195, 138, .2) !important; border-color: rgba(76, 195, 138, .6) !important; }
  .down { background: rgba(242, 74, 74, .18) !important; border-color: rgba(242, 74, 74, .55) !important; }
  .box { display: flex; gap: 6px; }
  .box.col { flex-direction: column; }
  .box .input { min-height: 34px; }
  .row { display: flex; justify-content: flex-end; gap: 6px; }
  .seg { display: flex; gap: 6px; }
  .seg button { height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .82rem; }
  .seg button[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
  .wunsch { font-size: .84rem; padding: 8px 10px; border-radius: 8px; background: var(--bg-2); }
  .lnk { border: 0; background: none; color: var(--text-2); text-decoration: underline; cursor: pointer; font: inherit; margin-left: 6px; }
  .del { color: #FF8080; margin-left: auto; }
  .mehr { display: flex; justify-content: center; margin-top: 18px; }
</style>
