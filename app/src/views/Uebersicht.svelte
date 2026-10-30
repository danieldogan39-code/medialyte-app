<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb } from "../lib/supabase";
  import { datumZeit, vor, zahl } from "../lib/format";
  import { ANFRAGE_STATUS, FORMATE } from "../lib/status";

  let termine = $state<any[]>([]), neu = $state<any[]>([]), zahlen = $state<any[]>([]), laeufe = $state<any[]>([]);

  async function laden() {
    const jobs: PromiseLike<any>[] = [];
    if (auth.darf("anfragen")) {
      jobs.push(sb.from("anfragen").select("id,firma,name,termin,format,status").gte("termin", new Date(Date.now() - 3600e3).toISOString())
        .not("status", "in", "(verloren,spam)").order("termin").limit(5).then((r) => (termine = r.data ?? [])));
      jobs.push(sb.from("anfragen").select("id,firma,name,eingang,anliegen,status").eq("status", "neu").order("eingang", { ascending: false }).limit(5)
        .then((r) => (neu = r.data ?? [])));
    }
    if (auth.darf("akquise")) {
      jobs.push(sb.rpc("akquise_zahlen").then((r) => (zahlen = r.data ?? [])));
      jobs.push(sb.from("laeufe").select("id,kategorie,art,start,status,zahlen").order("start", { ascending: false }).limit(5).then((r) => (laeufe = r.data ?? [])));
    }
    await Promise.all(jobs);
  }
  $effect(() => { laden(); const f = () => laden(); addEventListener("ml:anfragen", f); return () => removeEventListener("ml:anfragen", f); });

  const summe = (kat: string | null, st?: string[]) => zahlen.filter((z) => (!kat || z.kategorie === kat) && (!st || st.includes(z.status))).reduce((a, z) => a + Number(z.anzahl), 0);
  const online = (kat: string | null) => zahlen.filter((z) => !kat || z.kategorie === kat).reduce((a, z) => a + Number(z.demos_online), 0);
  const gruss = () => { const h = new Date().getHours(); return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend"; };
</script>

<Head titel="{gruss()}, {auth.ich?.name}" text="Das Wichtigste auf einen Blick." />

<div class="kpis">
  {#if auth.darf("anfragen")}
    <a class="kpi card" href="#/anfragen"><small>Neue Anfragen</small><b class="num">{daten.neueAnfragen}</b><span class="muted">warten auf Antwort</span></a>
    <a class="kpi card" href="#/anfragen"><small>Anstehende Termine</small><b class="num">{termine.length}</b><span class="muted">{termine[0] ? "nächster " + datumZeit(termine[0].termin) : "keine geplant"}</span></a>
  {/if}
  {#if auth.darf("akquise")}
    <a class="kpi card" href="#/akquise"><small>Demos online</small><b class="num">{zahl(online(null))}</b><span class="muted">in allen Kategorien</span></a>
    <a class="kpi card" href="#/akquise"><small>Briefe verschickt</small><b class="num">{zahl(summe(null, ["verschickt", "interesse", "kunde"]))}</b><span class="muted">insgesamt</span></a>
  {/if}
</div>

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

{#if auth.darf("akquise")}
  <div class="box__h sec"><h2>Akquise nach Kategorien</h2><a class="btn btn--s btn--quiet" href="#/akquise">Alle Kategorien</a></div>
  <div class="kats">
    {#each daten.kategorien as k (k.slug)}
      <a class="kat card" href="#/akquise/{k.slug}" style="--c:{k.farbe}">
        <span class="kat__ic"><Icon name={k.icon} size={20} /></span>
        <span class="kat__t"><b>{k.name}</b><small class="muted">{summe(k.slug) ? `${zahl(summe(k.slug))} Betriebe · ${zahl(online(k.slug))} Demos online` : "Noch keine Betriebe"}</small></span>
      </a>
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
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .kpi { display: grid; gap: 2px; padding: 18px 20px; transition: border-color .15s ease; }
  .kpi small { color: var(--steel); font-size: .84rem; }
  .kpi b { font-size: clamp(1.6rem, 5vw, 2rem); font-weight: 600; color: var(--text); letter-spacing: -.03em; line-height: 1.15; }
  .kpi span { font-size: .84rem; line-height: 1.35; }
  @media (hover: hover) { .kpi:hover, .kat:hover { border-color: var(--line-2); } }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
  .box { padding: 6px 0; }
  .box__h { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px 8px; }
  .sec { padding: 32px 0 12px; }
  .list { list-style: none; margin: 0; padding: 0; }
  .list li + li { border-top: 1px solid var(--line); }
  .list a, .list .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; }
  @media (hover: hover) { .list a:hover { background: var(--hover); } }
  .list span:first-child { display: grid; min-width: 0; }
  .list b { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .list small { font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .r { font-size: .84rem; white-space: nowrap; }
  .pad { padding: 8px 20px 16px; }
  .kats { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .kat { display: flex; align-items: center; gap: 14px; padding: 16px; transition: border-color .15s ease; }
  .kat__ic { width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center; flex: none;
    color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
  .kat__t { display: grid; min-width: 0; }
  .kat__t b { color: var(--text); font-weight: 500; }
  .kat__t small { font-size: .82rem; }
</style>
