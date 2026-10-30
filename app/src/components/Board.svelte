<script lang="ts">
  // Akquise-Board einer Kategorie: Kandidaten → Website bauen → Demo online, dazu Aussortiert (wie im Cockpit).
  // Karten ziehen (Maus) oder per Knopf verschieben; jede Entscheidung lässt sich rückgängig machen.
  // Eine Entscheidung steht sofort in der App und geht als Befehl an den Agenten (data/entscheidungen.json).
  import Icon from "./Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten, type Kategorie } from "../lib/daten.svelte";
  import { befehl } from "../lib/befehl";
  import { frage } from "../lib/frage.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { sofort, sparHinweis } from "../lib/agent.svelte";

  let { kat }: { kat: Kategorie } = $props();
  type B = any;
  type Sp = "kandidaten" | "bauen" | "online" | "aus";
  let alle = $state<B[]>([]), laedt = $state(true), suche = $state(""), branche = $state(""), km = $state(""), offenId = $state("");
  let stufen = $state<Record<string, boolean>>({ A: false, B: false, C: false });
  let mehr = $state<Record<string, boolean>>({});
  let demoAuf = $state(lesen("medialyte-board-demos") !== "zu");
  let eingereiht = $state(0);
  const darf = $derived(auth.darf("akquise", true));
  function lesen(k: string) { try { return localStorage.getItem(k); } catch { return null; } }

  async function laden() {
    const { data } = await sb.from("betriebe").select("id,place_id,name,branche,ort,gebiet,punkte,stufe,entfernung_km,status,entscheidung,maps_url,daten,geaendert,demos(slug,url,geloescht,loescht_am)")
      .eq("kategorie", kat.slug).order("punkte", { ascending: false, nullsFirst: false }).limit(600);
    alle = data ?? []; laedt = false;
  }
  $effect(() => { kat.slug; laden(); });
  $effect(() => { const f = () => laden(); addEventListener("ml:laeufe", f); return () => removeEventListener("ml:laeufe", f); });

  const demo = (b: B) => (b.demos ?? []).find((d: any) => !d.geloescht);
  function spalte(b: B): Sp {
    if (demo(b)) return b.entscheidung === "nie" ? "aus" : "online";
    if (b.entscheidung === "nie" || ["abgelehnt", "uebersprungen"].includes(b.status)) return "aus";
    if (b.entscheidung === "bauen") return "bauen";
    return "kandidaten";
  }
  const stufeVon = (b: B) => b.stufe ?? ((b.punkte ?? 0) >= 85 ? "A" : (b.punkte ?? 0) >= 75 ? "B" : "C");
  const passt = (b: B) => (!suche || `${b.name} ${b.branche} ${b.ort} ${b.gebiet}`.toLowerCase().includes(suche.toLowerCase()))
    && (!Object.values(stufen).some(Boolean) || stufen[stufeVon(b)]) && (!branche || b.branche === branche)
    && (!km || (b.entfernung_km != null && b.entfernung_km <= Number(km)));
  const gefiltert = $derived(alle.filter(passt));
  const spalten = $derived({
    kandidaten: gefiltert.filter((b) => spalte(b) === "kandidaten"),
    bauen: gefiltert.filter((b) => spalte(b) === "bauen"),
    online: gefiltert.filter((b) => spalte(b) === "online"),
    aus: gefiltert.filter((b) => spalte(b) === "aus"),
  });
  const branchen = $derived.by(() => {
    const n: Record<string, number> = {};
    for (const b of alle) if (b.branche) n[b.branche] = (n[b.branche] ?? 0) + 1;
    return Object.entries(n).sort((a, b) => a[0].localeCompare(b[0], "de"));
  });

  // ---------- Was passiert gerade mit deiner Auswahl?
  const live = $derived(daten.laufend[kat.slug]?.live ?? null);
  const lauf = $derived(daten.laufend[kat.slug] ?? null);
  const beauftragt = $derived(daten.offen("bauen").length + daten.offen("lauf").length > 0);
  const busy = $derived(!!lauf || beauftragt);
  function imLauf(b: B) {
    if (live?.auswahl) return live.auswahl.some((a: any) => a.place_id === b.place_id);
    return !lauf || !b.geaendert || !lauf.start || Date.parse(b.geaendert) <= Date.parse(lauf.start);
  }
  const neuDazu = $derived(busy ? spalten.bauen.filter((b) => !imLauf(b)) : []);
  $effect(() => { if (!busy) eingereiht = 0; });
  function abzeichen(b: B, sp: Sp): { text: string; ton: string } | null {
    if (sp === "bauen") {
      if (!busy) return { text: "deine Auswahl", ton: "hot" };
      if (!imLauf(b)) return eingereiht ? { text: "eingereiht, startet direkt danach", ton: "work" } : { text: "„Danach bauen“ reiht es ein", ton: "" };
      if (!live) return { text: lauf ? "in diesem Lauf dabei" : "Lauf startet, gleich dran", ton: "work" };
      return { text: (live.in_arbeit ?? []).includes(b.name) || live.phase === "Baue Websites" ? "wird gerade gebaut" : "in diesem Lauf, gleich dran", ton: "work" };
    }
    if (sp === "aus" && demo(b)) return { text: "Demo wird gelöscht", ton: "work" };
    if (b.daten?.note) return { text: `Einzelstück · Note ${b.daten.note}/10`, ton: "" };
    return null;
  }
  const minuten = $derived(lauf?.start ? Math.max(0, Math.round((Date.now() - Date.parse(lauf.start)) / 60000)) : null);
  const bauText = $derived(!busy ? "Jetzt bauen" : neuDazu.length && !eingereiht ? `Danach bauen (${neuDazu.length})` : eingereiht ? "Eingereiht · startet danach"
    : lauf ? `Wird gebaut${minuten != null ? ` · ${minuten} Min.` : ""}` : "Bau startet …");

  // ---------- Entscheiden, mit Rückgängig
  async function setzen(b: B, aktion: "bauen" | "offen" | "nie" | "zuruecksetzen"): Promise<boolean> {
    const neu = aktion === "zuruecksetzen" ? null : aktion;
    const { error } = await sb.from("betriebe").update({ entscheidung: neu }).eq("id", b.id);
    if (error) { daten.melden(fehler(error)); return false; }
    b.entscheidung = neu; b.geaendert = new Date().toISOString();
    await befehl("entscheidung", { place_id: b.place_id, aktion, name: b.name, branche: b.branche, ort: b.ort, punkte: b.punkte }, b.place_id);
    return true;
  }
  async function verschieben(b: B, nach: Sp) {
    const von = spalte(b);
    if (von === nach || nach === "online") return;
    if (nach === "aus" && demo(b)) { await demoLoeschen(b); return; }
    const vorher = b.entscheidung;
    if (!(await setzen(b, nach === "bauen" ? "bauen" : nach === "aus" ? "nie" : "offen"))) return;
    daten.melden(nach === "bauen" ? `${b.name} bekommt beim nächsten Lauf eine Website.` : nach === "aus" ? `${b.name} wird nie gebaut.` : `${b.name} ist wieder ein normaler Kandidat.`,
      { label: "Rückgängig", fn: () => setzen(b, vorher === "bauen" || vorher === "nie" || vorher === "offen" ? vorher : "zuruecksetzen") });
  }
  async function demoLoeschen(b: B) {
    const d = demo(b); if (!d) return;
    if (!(await frage("Demo endgültig löschen?", `Die Demo von ${b.name} geht sofort offline – auch Links aus verschickten Briefen. Der Betrieb landet unter „Aussortiert“. Bewertungen und Gelerntes bleiben.`, "Endgültig löschen", true, "löschen"))) return;
    b.entscheidung = "nie";
    await befehl("demo_loeschen", { place_id: b.place_id, slug: d.slug, name: b.name, branche: b.branche, ort: b.ort, punkte: b.punkte }, b.place_id, "Demo wird gelöscht …");
  }
  async function jetztBauen() {
    if (busy) {
      if (!neuDazu.length) { daten.melden("Deine Auswahl wird gerade gebaut. Die Demos erscheinen nach und nach unter „Demo online“."); return; }
      if (eingereiht) { daten.melden("Ist schon eingereiht: startet direkt nach dem laufenden Lauf."); return; }
      if (await befehl("bauen", { sofort: sofort.an }, kat.slug, `${neuDazu.map((b) => b.name).join(", ")}: eingereiht, wird direkt nach dem laufenden Lauf gebaut.`)) eingereiht = Date.now();
      return;
    }
    const n = spalten.bauen.length;
    if (!(await frage("Jetzt bauen?", `Der Agent baut ${n === 1 ? "eine Demo" : `${n} Demos`} aus „Website bauen“ – ohne neue Suche.${sparHinweis()}`, "Jetzt bauen"))) return;
    await befehl("bauen", { sofort: sofort.an }, kat.slug, "Bau gestartet. Die Karten zeigen den Stand, live mit Protokoll in ein bis zwei Minuten." + sparHinweis());
  }

  // ---------- Ziehen mit der Maus; am Handy gehen die Knöpfe auf der Karte
  let gezogen = $state<B | null>(null), ueber = $state<Sp | "">("");
  function ziehStart(e: DragEvent, b: B) { if (!darf) return; gezogen = b; e.dataTransfer?.setData("text/plain", b.id); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; }
  function ueberZiel(e: DragEvent, sp: Sp) { if (gezogen && sp !== "online") { e.preventDefault(); ueber = sp; } }
  function ablegen(e: DragEvent, sp: Sp) { e.preventDefault(); const b = gezogen; gezogen = null; ueber = ""; if (b) verschieben(b, sp); }

  const GCOL: Record<string, string> = { Bedarf: "#FF5757", Zugkraft: "#7BAFFF", Budget: "#FFB547", Basis: "#4BE3A6" };
  const GTXT: Record<string, string> = { Bedarf: "Fehlende Website, Reservierung, Bestellung", Zugkraft: "Bekanntheit, Sterne, Fotos", Budget: "Preisniveau, Betriebsart", Basis: "Öffnungszeiten, Angebot, Telefon" };
  const zahlText = (n: number) => String(Math.round((n ?? 0) * 10) / 10).replace(".", ",");
  function kategorienNach(b: B) {
    const g: Record<string, any[]> = {};
    for (const k of b.daten?.bewertung_details ?? []) (g[k.gruppe ?? "Weitere"] ??= []).push(k);
    return g;
  }
  const ton = (s: string) => (s === "A" ? "gruen" : s === "B" ? "blau" : "grau");
  const LIMIT: Record<Sp, number> = { kandidaten: 12, bauen: 30, online: 12, aus: 6 };
  function zeige(sp: Sp) { const l = spalten[sp]; return mehr[sp] ? l : l.slice(0, LIMIT[sp]); }
  $effect(() => { try { localStorage.setItem("medialyte-board-demos", demoAuf ? "auf" : "zu"); } catch { /* egal */ } });
</script>

{#snippet karte(b: B, sp: Sp)}
  {@const st = stufeVon(b)}{@const ab = abzeichen(b, sp)}{@const grp = (b.daten?.gruppen ?? []) as any[]}
  <article class="bk" class:is-open={offenId === b.id} class:zieht={gezogen === b} draggable={darf} ondragstart={(e) => ziehStart(e, b)} ondragend={() => { gezogen = null; ueber = ""; }}>
    <button class="bk__h" onclick={() => (offenId = offenId === b.id ? "" : b.id)} aria-expanded={offenId === b.id}>
      <span class="st st--{ton(st)}" title="Stufe {st}">{st}</span>
      <span class="bk__t"><b class:muted={!b.name}>{b.name ?? "Gelöschte Demo (Daten entfernt)"}</b><small class="muted">{[b.branche, b.ort, b.entfernung_km != null ? `${String(b.entfernung_km).replace(".", ",")} km` : ""].filter(Boolean).join(" · ")}</small></span>
      {#if b.punkte != null}<span class="pt num">{Math.round(b.punkte)}<small>/100</small></span>{/if}
    </button>
    {#if ab}<span class="badge badge--{ab.ton}">{ab.text}</span>{/if}
    {#if grp.length}
      <div class="gr" title={grp.map((g) => `${g.name} ${zahlText(g.punkte)}/${zahlText(g.max)}`).join(" · ")}>
        {#each grp as g}<span style="flex:{g.max || 1}"><i style="width:{g.max ? Math.round((g.punkte / g.max) * 100) : 0}%;background:{GCOL[g.name] ?? 'var(--info)'}"></i></span>{/each}
      </div>
    {/if}
    {#if offenId === b.id}
      {@const cats = kategorienNach(b)}
      <div class="bk__d">
        {#if b.daten?.warum}<p class="muted">{b.daten.warum}</p>{/if}
        {#each ["Bedarf", "Zugkraft", "Budget", "Basis", "Weitere"].filter((n) => cats[n]) as n}
          {@const gg = grp.find((z) => z.name === n) ?? { punkte: 0, max: 0 }}
          <h4><span style="color:{GCOL[n] ?? 'var(--text)'}">{n}</span>{#if gg.max}<span class="muted">{zahlText(gg.punkte)} / {zahlText(gg.max)}</span>{/if}</h4>
          {#each cats[n] as k}
            <div class="kz"><span>{k.name}</span><span class="kz__b"><i style="width:{Math.round(((k.punkte ?? 0) / (k.max || 1)) * 100)}%;background:{GCOL[n] ?? 'var(--ok)'}"></i></span><small class="muted">{k.warum ?? ""}</small></div>
          {/each}
        {/each}
      </div>
    {/if}
    <div class="bk__a">
      {#if darf}
        {#if sp === "kandidaten"}<button class="btn btn--s" onclick={() => verschieben(b, "bauen")}><Icon name="plus" size={14} />Bauen</button><button class="btn btn--s btn--quiet" onclick={() => verschieben(b, "aus")}>Aussortieren</button>{/if}
        {#if sp === "bauen"}<button class="btn btn--s btn--quiet" onclick={() => verschieben(b, "kandidaten")}>Zurück</button><button class="btn btn--s btn--quiet" onclick={() => verschieben(b, "aus")}>Aussortieren</button>{/if}
        {#if sp === "online"}<button class="btn btn--s btn--quiet del" onclick={() => demoLoeschen(b)}><Icon name="trash" size={13} />Löschen</button>{/if}
        {#if sp === "aus" && !demo(b) && b.name && b.status === "gefunden"}<button class="btn btn--s btn--quiet" onclick={() => verschieben(b, "kandidaten")}>Zurückholen</button><button class="btn btn--s btn--quiet" onclick={() => verschieben(b, "bauen")}>Bauen</button>{/if}
      {/if}
      <span class="sp"></span>
      {#if demo(b)?.url}<a class="btn btn--s btn--quiet ic" href={demo(b).url} target="_blank" rel="noopener" title="Demo öffnen" aria-label="Demo öffnen"><Icon name="external" size={15} /></a>{/if}
      {#if b.maps_url && b.name}<a class="btn btn--s btn--quiet ic" href={b.maps_url} target="_blank" rel="noopener" title="In Google Maps" aria-label="In Google Maps"><Icon name="pin" size={15} /></a>{/if}
      <a class="btn btn--s btn--quiet ic" href="#/akquise/betrieb/{b.id}" title="Details" aria-label="Details zu {b.name ?? 'Betrieb'}"><Icon name="right" size={15} /></a>
    </div>
  </article>
{/snippet}

{#snippet mehrKnopf(sp: Sp)}
  {#if spalten[sp].length > LIMIT[sp]}<button class="btn btn--s btn--quiet mehr" onclick={() => (mehr[sp] = !mehr[sp])}>{mehr[sp] ? "Weniger anzeigen" : `Alle ${spalten[sp].length} anzeigen`}</button>{/if}
{/snippet}

<div class="bar">
  <label class="search"><Icon name="search" size={16} /><input class="input" placeholder="Name, Art, Ort" bind:value={suche} data-suche></label>
  <select class="input sel" bind:value={km} aria-label="Entfernung zu Medialyte"><option value="">Jede Entfernung</option>{#each [5, 10, 15, 25, 40] as k}<option value={String(k)}>bis {k} km</option>{/each}</select>
  {#if branchen.length > 1}<select class="input sel" bind:value={branche} aria-label="Art"><option value="">Alle Arten</option>{#each branchen as [x, n]}<option value={x}>{x} ({n})</option>{/each}</select>{/if}
  <div class="tiers" role="group" aria-label="Stufe">
    {#each [["A", "ab 85 Punkte"], ["B", "75 bis 84 Punkte"], ["C", "unter 75 Punkte"]] as [t, txt]}
      <button type="button" aria-pressed={stufen[t]} title={txt} onclick={() => (stufen[t] = !stufen[t])}>{t}</button>
    {/each}
  </div>
</div>

{#if !laedt && !alle.length}
  <div class="card empty"><b>Noch keine Betriebe</b><p>Nach dem ersten Lauf in dieser Kategorie stehen hier die Kandidaten.</p></div>
{:else}
  <div class="cols">
    <section class="col" class:drop={ueber === "kandidaten"} role="list" ondragover={(e) => ueberZiel(e, "kandidaten")} ondragleave={() => ueber === "kandidaten" && (ueber = "")} ondrop={(e) => ablegen(e, "kandidaten")}>
      <header><h3><i style="background:#7BAFFF"></i>Kandidaten</h3><span class="num muted">{spalten.kandidaten.length}</span></header>
      <p class="hint muted">Die besten 5 bekommen beim nächsten Lauf automatisch eine Demo.</p>
      {#each zeige("kandidaten") as b (b.id)}{@render karte(b, "kandidaten")}{/each}
      {@render mehrKnopf("kandidaten")}
    </section>
    <section class="col col--bauen" class:drop={ueber === "bauen"} role="list" ondragover={(e) => ueberZiel(e, "bauen")} ondragleave={() => ueber === "bauen" && (ueber = "")} ondrop={(e) => ablegen(e, "bauen")}>
      <header><h3><i style="background:#FF5757"></i>Website bauen</h3><span class="num muted">{spalten.bauen.length}</span></header>
      <p class="hint muted">Deine Auswahl, wird zuerst gebaut.</p>
      {#if darf && spalten.bauen.length}<button class="btn btn--s jetzt" class:btn--primary={!busy || (neuDazu.length > 0 && !eingereiht)} onclick={jetztBauen}
        title={busy && neuDazu.length ? "Reiht einen Lauf direkt nach dem laufenden ein, für die Karten, die neu dazugekommen sind." : ""}><Icon name="play" size={13} />{bauText}</button>{/if}
      {#each zeige("bauen") as b (b.id)}{@render karte(b, "bauen")}{/each}
      {#if !spalten.bauen.length}<p class="leer">Hierher ziehen oder „Bauen“ antippen: bekommt sicher eine Website.</p>{/if}
    </section>
    <section class="col" class:zu={!demoAuf}>
      <header><h3><i style="background:#4CC38A"></i>Demo online</h3><span class="num muted">{spalten.online.length}</span><button class="btn btn--s btn--quiet auf" onclick={() => (demoAuf = !demoAuf)} aria-expanded={demoAuf}>{demoAuf ? "Verbergen" : "Anzeigen"}</button></header>
      {#if demoAuf}
        <p class="hint muted">Schon gebaut. Nach „Aussortiert“ ziehen löscht die Demo.</p>
        {#each zeige("online") as b (b.id)}{@render karte(b, "online")}{/each}
        {@render mehrKnopf("online")}
      {/if}
    </section>
    <section class="col col--aus" class:drop={ueber === "aus"} role="list" ondragover={(e) => ueberZiel(e, "aus")} ondragleave={() => ueber === "aus" && (ueber = "")} ondrop={(e) => ablegen(e, "aus")}>
      <header><h3><i style="background:#6E7AA6"></i>Aussortiert</h3><span class="num muted">{spalten.aus.length}</span></header>
      <p class="hint muted">Bekommt nie eine Website. Eine Demo hier wird nach Bestätigung gelöscht.</p>
      {#each zeige("aus") as b (b.id)}{@render karte(b, "aus")}{/each}
      {@render mehrKnopf("aus")}
      {#if !spalten.aus.length}<p class="leer">Hierher ziehen: bekommt nie eine Website.</p>{/if}
    </section>
  </div>
  <div class="legende">
    {#each Object.entries(GCOL) as [n, f]}<span title={GTXT[n]}><i style="background:{f}"></i>{n}</span>{/each}
    <span class="muted">Balken auf jeder Karte: Punkte je Bereich. Karte antippen zeigt die Begründung.</span>
  </div>
{/if}

<style>
  .bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
  .search { position: relative; display: block; width: min(260px, 100%); }
  .search :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--steel); pointer-events: none; }
  .search .input { padding-left: 34px; min-height: 36px; }
  .sel { width: auto; min-height: 36px; }
  .tiers { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); }
  .tiers button { width: 34px; height: 28px; border: 0; border-radius: 999px; background: transparent; color: var(--steel); font-weight: 700; cursor: pointer; }
  .tiers button[aria-pressed="true"] { background: var(--text); color: var(--bg); }
  .cols { display: grid; grid-template-columns: repeat(4, minmax(250px, 1fr)); gap: 12px; align-items: start; overflow-x: auto; padding-bottom: 6px; }
  @media (max-width: 1200px) { .cols { grid-template-columns: repeat(4, minmax(260px, 300px)); } }
  .col { display: grid; gap: 8px; padding: 12px; border-radius: var(--radius); background: var(--bg-2); border: 1px solid var(--line); min-width: 0; transition: border-color .15s, background-color .15s; }
  .col.drop { border-color: rgba(123, 175, 255, .6); background: rgba(123, 175, 255, .06); }
  .col header { display: flex; align-items: center; gap: 8px; padding: 2px 4px 4px; }
  .col header h3 { flex: 1; display: flex; align-items: center; gap: 8px; }
  .col header h3 i { width: 8px; height: 8px; border-radius: 50%; }
  .auf { min-height: 26px; padding: 0 8px; font-size: .76rem; }
  .col--bauen { border-color: rgba(242, 74, 74, .25); }
  .hint { font-size: .8rem; padding: 0 4px 4px; margin: 0; }
  .leer { font-size: .8rem; color: var(--steel); text-align: center; padding: 18px 8px; border: 1px dashed var(--line-2); border-radius: 10px; margin: 0; }
  .jetzt { width: 100%; }
  .mehr { justify-self: center; }
  .bk { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px; display: grid; gap: 8px; }
  @media (pointer: fine) { .bk[draggable="true"] { cursor: grab; } }
  .bk.zieht { opacity: .4; }
  .bk.is-open { border-color: var(--line-2); }
  .bk__h { display: flex; align-items: flex-start; gap: 10px; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; color: inherit; }
  .bk__t { display: grid; flex: 1; min-width: 0; }
  .bk__t b { color: var(--text); font-weight: 500; font-size: .92rem; line-height: 1.3; }
  .bk__t small { font-size: .76rem; }
  .st { flex: none; width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-weight: 700; font-size: .8rem; }
  .st--gruen { background: rgba(76, 195, 138, .16); color: #6FD3A2; }
  .st--blau { background: rgba(111, 168, 240, .16); color: #8DBBF5; }
  .st--grau { background: rgba(139, 152, 173, .16); color: #AEB9CA; }
  .pt { color: var(--text); font-weight: 600; font-size: .95rem; }
  .pt small { color: var(--steel); font-weight: 400; font-size: .7rem; }
  .badge { justify-self: start; font-size: .72rem; padding: 3px 8px; border-radius: 999px; background: rgba(255, 255, 255, .06); color: var(--text-2); }
  .badge--hot { background: rgba(242, 74, 74, .15); color: #FF9C9C; }
  .badge--work { background: rgba(231, 185, 74, .14); color: #EBC56B; }
  .gr { display: flex; gap: 3px; }
  .gr span { height: 4px; border-radius: 999px; background: rgba(255, 255, 255, .07); overflow: hidden; }
  .gr i { display: block; height: 100%; }
  .bk__d { display: grid; gap: 6px; font-size: .8rem; }
  .bk__d p { margin: 0; }
  .bk__d h4 { display: flex; justify-content: space-between; font-size: .8rem; margin: 6px 0 0; }
  .kz { display: grid; grid-template-columns: 1fr 60px; gap: 2px 8px; align-items: center; }
  .kz small { grid-column: 1 / -1; font-size: .74rem; }
  .kz__b { height: 4px; border-radius: 999px; background: rgba(255, 255, 255, .07); overflow: hidden; }
  .kz__b i { display: block; height: 100%; }
  .bk__a { display: flex; gap: 2px; margin: 0 -4px -4px; flex-wrap: nowrap; align-items: center; }
  .bk__a .btn { min-height: 30px; padding: 0 9px; font-size: .8rem; }
  .bk__a .ic { width: 30px; padding: 0; }
  .del { color: #FF8080; }
  .sp { flex: 1; }
  .legende { display: flex; gap: 14px; flex-wrap: wrap; font-size: .78rem; color: var(--text-2); margin-top: 10px; }
  .legende i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 6px; }
</style>
