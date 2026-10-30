<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Board from "../components/Board.svelte";
  import LaufSteuerung from "../components/LaufSteuerung.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { datum, vor, zahl } from "../lib/format";
  import { BETRIEB_STATUS } from "../lib/status";

  let { slug, tab }: { slug: string; tab: string } = $props();
  const kat = $derived(daten.kat(slug));

  let betriebe = $state<any[]>([]), zahlen = $state<any[]>([]), laeufe = $state<any[]>([]), laedt = $state(true);
  let filter = $state(""), suche = $state("");

  async function laden() {
    laedt = true;
    let q = sb.from("betriebe").select("id,name,branche,ort,gebiet,bewertung,anzahl_bewertungen,status,geaendert,demos(slug,url,geloescht)")
      .eq("kategorie", slug).order("geaendert", { ascending: false }).limit(300);
    if (filter) q = q.eq("status", filter);
    if (suche.trim()) q = q.or(`name.ilike.%${suche.trim().replace(/[%,()]/g, "")}%,ort.ilike.%${suche.trim().replace(/[%,()]/g, "")}%`);
    const [b, z] = await Promise.all([q, sb.rpc("akquise_zahlen")]);
    betriebe = b.data ?? []; zahlen = (z.data ?? []).filter((x: any) => x.kategorie === slug); laedt = false;
  }
  $effect(() => { slug; filter; laden(); });
  let st: number;
  function tippen() { clearTimeout(st); st = setTimeout(laden, 250) as unknown as number; }
  $effect(() => { if (tab === "laeufe") sb.from("laeufe").select("*").eq("kategorie", slug).order("start", { ascending: false }).limit(30).then((r) => (laeufe = r.data ?? [])); });

  const anzahl = (s?: string) => zahlen.filter((x) => !s || x.status === s).reduce((a, x) => a + Number(x.anzahl), 0);
  const demo = (b: any) => (b.demos ?? []).find((d: any) => !d.geloescht);

  // Suche bearbeiten
  let s = $state<any>(null), sNeu = $state(""), tNeu = $state(""), speichert = $state(false);
  $effect(() => { if (kat) s = { aktiv: kat.aktiv, beschreibung: kat.beschreibung ?? "", begriffe: [...(kat.suche?.begriffe ?? [])], typen: [...(kat.suche?.typen ?? [])],
    vorlage: kat.suche?.vorlage ?? "", mindestbewertung: kat.suche?.mindestbewertung ?? 4.0, mindestanzahl: kat.suche?.mindestanzahl ?? 20 }; });
  async function sucheSpeichern() {
    speichert = true;
    const { error } = await sb.from("kategorien").update({ aktiv: s.aktiv, beschreibung: s.beschreibung,
      suche: { ...(kat?.suche ?? {}), begriffe: s.begriffe, typen: s.typen, vorlage: s.vorlage, mindestbewertung: Number(s.mindestbewertung), mindestanzahl: Number(s.mindestanzahl) } }).eq("slug", slug);
    speichert = false;
    if (error) daten.melden(fehler(error)); else { daten.melden("Gespeichert"); daten.laden(); }
  }
</script>

{#if kat}
  <div style="--c:{kat.farbe}">
    <Head titel={kat.name} text={kat.beschreibung ?? ""} zurueck="#/akquise" />
    <LaufSteuerung {kat} />

    <div class="tabs" role="tablist">
      <a role="tab" aria-selected={tab === "board"} href="#/akquise/{slug}">Board</a>
      <a role="tab" aria-selected={tab === "betriebe"} href="#/akquise/{slug}/betriebe">Liste <span class="num muted">{zahl(anzahl())}</span></a>
      <a role="tab" aria-selected={tab === "laeufe"} href="#/akquise/{slug}/laeufe">Läufe</a>
      <a role="tab" aria-selected={tab === "suche"} href="#/akquise/{slug}/suche">Suche & Einstellungen</a>
    </div>

    {#if tab === "board"}
      <Board {kat} />
    {:else if tab === "betriebe"}
      <div class="bar">
        <div class="chips">
          <button class="chip" class:on={!filter} onclick={() => (filter = "")}>Alle <span class="num">{anzahl()}</span></button>
          {#each Object.entries(BETRIEB_STATUS) as [k, v]}
            {#if anzahl(k)}<button class="chip" class:on={filter === k} onclick={() => (filter = k)}>{v.name} <span class="num">{anzahl(k)}</span></button>{/if}
          {/each}
        </div>
        <label class="search"><Icon name="search" size={16} /><input class="input" placeholder="Name oder Ort" bind:value={suche} oninput={tippen}></label>
      </div>

      {#if betriebe.length}
        <div class="card tw"><table class="table">
          <thead><tr><th>Betrieb</th><th class="h-m">Ort</th><th class="h-s">Bewertung</th><th>Status</th><th class="h-s">Demo</th><th class="h-m">Geändert</th></tr></thead>
          <tbody>
            {#each betriebe as b (b.id)}
              <tr onclick={() => (location.hash = `#/akquise/betrieb/${b.id}`)}>
                <td><b>{b.name ?? "(Name nach Löschung der Demo entfernt)"}</b>{#if b.branche}<br><small class="muted">{b.branche}</small>{/if}</td>
                <td class="h-m">{b.ort ?? "–"}</td>
                <td class="h-s num">{b.bewertung ? `${String(b.bewertung).replace(".", ",")} ★ (${b.anzahl_bewertungen ?? 0})` : "–"}</td>
                <td><span class="pill pill--{BETRIEB_STATUS[b.status]?.ton ?? 'grau'}">{BETRIEB_STATUS[b.status]?.name ?? b.status}</span></td>
                <td class="h-s">{#if demo(b)?.url}<a class="btn btn--s btn--quiet" href={demo(b).url} target="_blank" rel="noopener" onclick={(e) => e.stopPropagation()}><Icon name="external" size={15} />Öffnen</a>{:else}<span class="muted">–</span>{/if}</td>
                <td class="h-m muted">{vor(b.geaendert)}</td>
              </tr>
            {/each}
          </tbody>
        </table></div>
      {:else if !laedt}
        <div class="card empty"><b>{suche || filter ? "Keine Treffer" : "Noch keine Betriebe"}</b>
          <p>{suche || filter ? "Filter ändern oder Suche leeren." : kat.aktiv ? "Sobald der Agent in dieser Kategorie sucht, erscheinen die Betriebe hier." : "Die Suche ist für diese Kategorie pausiert."}</p></div>
      {/if}

    {:else if tab === "laeufe"}
      {#if laeufe.length}
        <div class="card tw"><table class="table">
          <thead><tr><th>Start</th><th>Art</th><th>Status</th><th class="h-m">Ergebnis</th></tr></thead>
          <tbody>{#each laeufe as l (l.id)}<tr><td>{datum(l.start)} <small class="muted">{vor(l.start)}</small></td><td>{l.art}</td><td>{l.status ?? "–"}</td>
            <td class="h-m muted">{Object.entries(l.zahlen ?? {}).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td></tr>{/each}</tbody>
        </table></div>
      {:else}<div class="card empty"><b>Noch keine Läufe</b><p>Hier erscheint jeder Lauf des Agenten in dieser Kategorie mit Ergebnis und Protokoll.</p></div>{/if}

    {:else if s}
      <div class="card einst">
        <label class="tog"><input type="checkbox" bind:checked={s.aktiv} disabled={!auth.darf("akquise", true)}><span><b>Agent sucht in dieser Kategorie</b><small class="muted">Ausgeschaltet: keine neuen Betriebe, bestehende bleiben.</small></span></label>
        <label class="field"><span>Beschreibung</span><input class="input" bind:value={s.beschreibung}></label>
        <div class="field"><span>Suchbegriffe bei Google (z. B. „Tischlerei“)</span>
          <div class="tags">{#each s.begriffe as b, i}<span class="tag">{b}<button aria-label="{b} entfernen" onclick={() => s.begriffe.splice(i, 1)}><Icon name="x" size={13} /></button></span>{/each}
            <input class="input tag-in" placeholder="Begriff + Enter" bind:value={sNeu} onkeydown={(e) => { if (e.key === "Enter" && sNeu.trim()) { e.preventDefault(); s.begriffe.push(sNeu.trim()); sNeu = ""; } }}></div></div>
        <div class="field"><span>Google-Betriebsarten (technische Namen, z. B. „electrician“)</span>
          <div class="tags">{#each s.typen as b, i}<span class="tag">{b}<button aria-label="{b} entfernen" onclick={() => s.typen.splice(i, 1)}><Icon name="x" size={13} /></button></span>{/each}
            <input class="input tag-in" placeholder="Art + Enter" bind:value={tNeu} onkeydown={(e) => { if (e.key === "Enter" && tNeu.trim()) { e.preventDefault(); s.typen.push(tNeu.trim()); tNeu = ""; } }}></div></div>
        <div class="row3">
          <label class="field"><span>Mindestbewertung</span><input class="input" type="number" step="0.1" min="1" max="5" bind:value={s.mindestbewertung}></label>
          <label class="field"><span>Mindestens Bewertungen</span><input class="input" type="number" min="0" bind:value={s.mindestanzahl}></label>
          <label class="field"><span>Demo-Vorlage</span><input class="input" bind:value={s.vorlage}></label>
        </div>
        {#if auth.darf("akquise", true)}<div class="einst__a"><button class="btn btn--primary" onclick={sucheSpeichern} disabled={speichert}>Speichern</button></div>{/if}
      </div>
    {/if}
  </div>
{:else}
  <div class="card empty"><b>Kategorie nicht gefunden</b></div>
{/if}

<style>
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin: -8px 0 18px; overflow-x: auto; }
  .tabs a { padding: 10px 12px; color: var(--steel); font-weight: 500; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; }
  .tabs a[aria-selected="true"] { color: var(--text); border-bottom-color: var(--c); }
  .bar { display: flex; gap: 12px; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; }
  .chip span { color: var(--steel); margin-left: 4px; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .chip.on span { color: rgba(10, 18, 32, .6); }
  .search { position: relative; display: block; width: min(260px, 100%); }
  .search :global(svg) { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--steel); pointer-events: none; }
  .search .input { padding-left: 34px; min-height: 36px; }
  .tw { overflow-x: auto; }
  .einst { padding: 22px; display: grid; gap: 18px; max-width: 760px; }
  .tog { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; }
  .tog input { width: 18px; height: 18px; margin-top: 3px; accent-color: var(--coral); }
  .tog span { display: grid; }
  .tog b { color: var(--text); font-weight: 500; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag { display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 6px 0 12px; border-radius: 999px; background: var(--panel-2); color: var(--text); font-size: .86rem; }
  .tag button { display: grid; place-items: center; width: 22px; height: 22px; border: 0; border-radius: 50%; background: transparent; color: var(--steel); cursor: pointer; }
  .tag-in { width: 180px; min-height: 30px; padding: 4px 10px; }
  .row3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .einst__a { display: flex; justify-content: flex-end; }
  @media (max-width: 700px) { .h-m { display: none; } }
  @media (max-width: 480px) { .h-s { display: none; } }
</style>
