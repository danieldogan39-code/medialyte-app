<script lang="ts">
  // Akquise-Board einer Kategorie: Kandidaten → Website bauen → Demo online, dazu Aussortiert.
  // Eine Entscheidung steht sofort in der App und geht als Befehl an den Agenten (data/entscheidungen.json).
  import Icon from "./Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten, type Kategorie } from "../lib/daten.svelte";
  import { befehl } from "../lib/befehl";
  import { frage } from "../lib/frage.svelte";
  import { sb, fehler } from "../lib/supabase";

  let { kat }: { kat: Kategorie } = $props();
  type B = any;
  let alle = $state<B[]>([]), laedt = $state(true), suche = $state(""), stufe = $state(""), branche = $state(""), offenId = $state(""), mehr = $state(false);
  const darf = $derived(auth.darf("akquise", true));

  async function laden() {
    const { data } = await sb.from("betriebe").select("id,place_id,name,branche,ort,gebiet,punkte,stufe,entfernung_km,status,entscheidung,maps_url,daten,geaendert,demos(slug,url,geloescht,loescht_am)")
      .eq("kategorie", kat.slug).order("punkte", { ascending: false, nullsFirst: false }).limit(600);
    alle = data ?? []; laedt = false;
  }
  $effect(() => { kat.slug; laden(); });
  $effect(() => { const f = () => laden(); addEventListener("ml:laeufe", f); return () => removeEventListener("ml:laeufe", f); });

  const demo = (b: B) => (b.demos ?? []).find((d: any) => !d.geloescht);
  function spalte(b: B): "kandidaten" | "bauen" | "online" | "aus" {
    if (demo(b)) return "online";
    if (b.entscheidung === "nie" || ["abgelehnt", "uebersprungen"].includes(b.status)) return "aus";
    if (b.entscheidung === "bauen") return "bauen";
    return "kandidaten";
  }
  const passt = (b: B) => (!suche || `${b.name} ${b.branche} ${b.ort} ${b.gebiet}`.toLowerCase().includes(suche.toLowerCase()))
    && (!stufe || b.stufe === stufe) && (!branche || b.branche === branche);
  const gefiltert = $derived(alle.filter(passt));
  const spalten = $derived({
    kandidaten: gefiltert.filter((b) => spalte(b) === "kandidaten"),
    bauen: gefiltert.filter((b) => spalte(b) === "bauen"),
    online: gefiltert.filter((b) => spalte(b) === "online"),
    aus: gefiltert.filter((b) => spalte(b) === "aus"),
  });
  const branchen = $derived([...new Set(alle.map((b) => b.branche).filter(Boolean))].sort() as string[]);

  async function entscheiden(b: B, aktion: "bauen" | "offen" | "nie" | "zuruecksetzen") {
    const vorher = b.entscheidung;
    b.entscheidung = aktion === "zuruecksetzen" ? null : aktion;
    const { error } = await sb.from("betriebe").update({ entscheidung: b.entscheidung }).eq("id", b.id);
    if (error) { b.entscheidung = vorher; daten.melden(fehler(error)); return; }
    await befehl("entscheidung", { place_id: b.place_id, aktion, name: b.name, branche: b.branche, ort: b.ort, punkte: b.punkte }, b.place_id,
      aktion === "bauen" ? `${b.name}: kommt in „Website bauen“` : aktion === "nie" ? `${b.name} aussortiert` : `${b.name} zurück bei den Kandidaten`);
  }
  async function jetztBauen() {
    const n = spalten.bauen.length;
    if (!(await frage("Jetzt bauen?", `Der Agent baut ${n === 1 ? "eine Demo" : `${n} Demos`} aus „Website bauen“ – ohne neue Suche.`, "Jetzt bauen"))) return;
    await befehl("bauen", {}, kat.slug, "Bau wird gestartet …");
  }
  const bauWartet = $derived(daten.offen("bauen").length > 0 || !!daten.laufend[kat.slug]);
  const ton = (s: string) => (s === "A" ? "gruen" : s === "B" ? "blau" : "grau");
</script>

{#snippet karte(b: B, sp: string)}
  <article class="bk" class:is-open={offenId === b.id}>
    <button class="bk__h" onclick={() => (offenId = offenId === b.id ? "" : b.id)} aria-expanded={offenId === b.id}>
      {#if b.stufe}<span class="st st--{ton(b.stufe)}">{b.stufe}</span>{/if}
      <span class="bk__t"><b class:muted={!b.name}>{b.name ?? "Gelöschte Demo (Daten entfernt)"}</b><small class="muted">{[b.branche, b.ort, b.entfernung_km ? `${String(b.entfernung_km).replace(".", ",")} km` : ""].filter(Boolean).join(" · ")}</small></span>
      {#if b.punkte != null}<span class="pt num">{Math.round(b.punkte)}<small>/100</small></span>{/if}
    </button>
    {#if (b.daten?.gruppen ?? []).length}
      <div class="gr">{#each b.daten.gruppen as g}<span title="{g.name}: {g.punkte} von {g.max}"><i style="width:{Math.round((g.punkte / g.max) * 100)}%"></i></span>{/each}</div>
    {/if}
    {#if offenId === b.id}
      <div class="bk__d">
        {#if b.daten?.warum}<p class="muted">{b.daten.warum}</p>{/if}
        {#each (b.daten?.bewertung_details ?? []).slice(0, 8) as k}
          <div class="kz"><span>{k.name}</span><span class="kz__b"><i style="width:{Math.round(((k.punkte ?? 0) / (k.max || 1)) * 100)}%"></i></span><small class="muted">{k.warum ?? ""}</small></div>
        {/each}
      </div>
    {/if}
    <div class="bk__a">
      {#if darf}
        {#if sp === "kandidaten"}<button class="btn btn--s" onclick={() => entscheiden(b, "bauen")}><Icon name="plus" size={14} />Bauen</button><button class="btn btn--s btn--quiet" onclick={() => entscheiden(b, "nie")}>Aussortieren</button>{/if}
        {#if sp === "bauen"}<button class="btn btn--s btn--quiet" onclick={() => entscheiden(b, "offen")}>Zurück</button><button class="btn btn--s btn--quiet" onclick={() => entscheiden(b, "nie")}>Aussortieren</button>{/if}
        {#if sp === "aus" && !demo(b) && b.entscheidung === "nie" && b.status === "gefunden"}<button class="btn btn--s btn--quiet" onclick={() => entscheiden(b, "zuruecksetzen")}>Zurückholen</button>{/if}
      {/if}
      <span class="sp"></span>
      {#if demo(b)?.url}<a class="btn btn--s btn--quiet ic" href={demo(b).url} target="_blank" rel="noopener" title="Demo öffnen" aria-label="Demo öffnen"><Icon name="external" size={15} /></a>{/if}
      {#if b.maps_url && b.name}<a class="btn btn--s btn--quiet ic" href={b.maps_url} target="_blank" rel="noopener" title="In Google Maps" aria-label="In Google Maps"><Icon name="pin" size={15} /></a>{/if}
      <a class="btn btn--s btn--quiet ic" href="#/akquise/betrieb/{b.id}" title="Details" aria-label="Details zu {b.name ?? 'Betrieb'}"><Icon name="right" size={15} /></a>
    </div>
  </article>
{/snippet}

<div class="bar">
  <label class="search"><Icon name="search" size={16} /><input class="input" placeholder="Name, Ort, Gebiet" bind:value={suche}></label>
  <select class="input sel" bind:value={stufe} aria-label="Stufe"><option value="">Alle Stufen</option><option value="A">Stufe A (ab 85)</option><option value="B">Stufe B (75–84)</option><option value="C">Stufe C (unter 75)</option></select>
  {#if branchen.length > 1}<select class="input sel" bind:value={branche} aria-label="Branche"><option value="">Alle Arten</option>{#each branchen as x}<option value={x}>{x}</option>{/each}</select>{/if}
</div>

{#if !laedt && !alle.length}
  <div class="card empty"><b>Noch keine Betriebe</b><p>Nach dem ersten Lauf in dieser Kategorie stehen hier die Kandidaten.</p></div>
{:else}
  <div class="cols">
    <section class="col">
      <header><h3>Kandidaten</h3><span class="num muted">{spalten.kandidaten.length}</span></header>
      <p class="hint muted">Die besten 5 bekommen beim nächsten Lauf automatisch eine Demo.</p>
      {#each (mehr ? spalten.kandidaten : spalten.kandidaten.slice(0, 12)) as b (b.id)}{@render karte(b, "kandidaten")}{/each}
      {#if spalten.kandidaten.length > 12}<button class="btn btn--s btn--quiet mehr" onclick={() => (mehr = !mehr)}>{mehr ? "Weniger anzeigen" : `Alle ${spalten.kandidaten.length} anzeigen`}</button>{/if}
    </section>
    <section class="col col--bauen">
      <header><h3>Website bauen</h3><span class="num muted">{spalten.bauen.length}</span></header>
      {#if darf && spalten.bauen.length}<button class="btn btn--s jetzt" class:btn--primary={!bauWartet} onclick={jetztBauen} disabled={bauWartet}><Icon name="play" size={13} />{bauWartet ? "Bau läuft oder ist beauftragt" : "Jetzt bauen"}</button>{/if}
      {#each spalten.bauen as b (b.id)}{@render karte(b, "bauen")}{/each}
      {#if !spalten.bauen.length}<p class="hint muted">Wähle Kandidaten mit „Bauen“ aus – dann baut der Agent genau diese.</p>{/if}
    </section>
    <section class="col">
      <header><h3>Demo online</h3><span class="num muted">{spalten.online.length}</span></header>
      {#each spalten.online.slice(0, 40) as b (b.id)}{@render karte(b, "online")}{/each}
      {#if spalten.online.length > 40}<a class="btn btn--s btn--quiet mehr" href="#/akquise/{kat.slug}/betriebe">Alle {spalten.online.length} in der Liste</a>{/if}
    </section>
    <section class="col col--aus">
      <header><h3>Aussortiert</h3><span class="num muted">{spalten.aus.length}</span></header>
      {#each spalten.aus.slice(0, 30) as b (b.id)}{@render karte(b, "aus")}{/each}
    </section>
  </div>
{/if}

<style>
  .bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .search { position: relative; display: block; width: min(260px, 100%); }
  .search :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--steel); pointer-events: none; }
  .search .input { padding-left: 34px; min-height: 36px; }
  .sel { width: auto; min-height: 36px; }
  .cols { display: grid; grid-template-columns: repeat(4, minmax(250px, 1fr)); gap: 12px; align-items: start; overflow-x: auto; padding-bottom: 6px; }
  @media (max-width: 1200px) { .cols { grid-template-columns: repeat(4, minmax(260px, 300px)); } }
  .col { display: grid; gap: 8px; padding: 12px; border-radius: var(--radius); background: var(--bg-2); border: 1px solid var(--line); min-width: 0; }
  .col header { display: flex; align-items: baseline; justify-content: space-between; padding: 2px 4px 4px; }
  .col--bauen { border-color: rgba(76, 195, 138, .25); }
  .hint { font-size: .8rem; padding: 0 4px 4px; }
  .jetzt { width: 100%; }
  .mehr { justify-self: center; }
  .bk { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px; display: grid; gap: 8px; }
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
  .gr { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .gr span { height: 4px; border-radius: 999px; background: rgba(255, 255, 255, .07); overflow: hidden; }
  .gr i { display: block; height: 100%; background: var(--info); }
  .bk__d { display: grid; gap: 6px; font-size: .8rem; }
  .kz { display: grid; grid-template-columns: 1fr 60px; gap: 2px 8px; align-items: center; }
  .kz small { grid-column: 1 / -1; font-size: .74rem; }
  .kz__b { height: 4px; border-radius: 999px; background: rgba(255, 255, 255, .07); overflow: hidden; }
  .kz__b i { display: block; height: 100%; background: var(--ok); }
  .bk__a { display: flex; flex-wrap: wrap; gap: 2px; margin: 0 -4px -4px; }
  .bk__a .btn { min-height: 30px; padding: 0 9px; font-size: .8rem; }
  .bk__a .ic { width: 30px; padding: 0; }
  .sp { flex: 1; }
  .bk__a { flex-wrap: nowrap; align-items: center; }
</style>
