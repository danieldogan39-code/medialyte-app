<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Verlauf from "../components/Verlauf.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { datum } from "../lib/format";
  import { BETRIEB_STATUS } from "../lib/status";
  import { befehl } from "../lib/befehl";
  import { frage } from "../lib/frage.svelte";
  import { agent } from "../lib/agent.svelte";

  let { id }: { id: string } = $props();
  let b = $state<any>(null), fehlt = $state(false);

  async function laden() {
    const { data } = await sb.from("betriebe").select("*, demos(*), briefe(*)").eq("id", id).maybeSingle();
    b = data; fehlt = !data;
  }
  $effect(() => { id; laden(); });

  async function status(neu: string) {
    const alt = b.status;
    const { error } = await sb.from("betriebe").update({ status: neu }).eq("id", id);
    if (error) { daten.melden(fehler(error)); return; }
    await sb.from("verlauf").insert({ bezug: "betrieb", bezug_id: id, art: "status",
      text: `Status: ${BETRIEB_STATUS[alt]?.name ?? alt} → ${BETRIEB_STATUS[neu]?.name ?? neu}` });
    laden(); daten.melden("Status geändert");
  }
  const demo = $derived((b?.demos ?? []).find((d: any) => !d.geloescht) ?? (b?.demos ?? [])[0]);
  const brief = $derived((b?.briefe ?? [])[0]);
  const kat = $derived(daten.kat(b?.kategorie));
  const pdfDa = $derived(!!brief?.daten?.pdf_hash);
  const sendetGerade = $derived(!!demo && daten.offen("brief_senden", demo.slug).length > 0);
  const vorschauGerade = $derived(!!demo && daten.offen("brief_vorschau", demo.slug).length > 0);
  const loeschtGerade = $derived(!!b && daten.offen("demo_loeschen", b.place_id).length > 0);
  let pdfUrl = $state("");

  async function briefAnsehen() {
    const { data, error } = await sb.storage.from("briefe").createSignedUrl(brief.pdf, 600);
    if (error || !data) { daten.melden(fehler(error)); return; }
    pdfUrl = data.signedUrl;
  }
  async function briefSenden() {
    const e = agent.c.einstellungen, test = e && e.briefmodus !== "live";
    if (!(await frage(`${test ? "Testbrief" : "Brief"} an ${b.name} verschicken?`,
      `${test ? "Testmodus: Der Brief geht nicht wirklich in den Druck. " : "Echter Versand über LetterXpress, das kostet Porto. "}Vorher prüft der Agent bei Google, ob der Betrieb noch geöffnet ist und weiterhin keine eigene Website hat. Der Brief bekommt das Datum des Versandtags und ein frisches Bild der Demo.${e?.loeschen_nach ? ` Die Demo bleibt danach ${e.loeschen_nach} Tage online.` : ""}`,
      test ? "Testbrief verschicken" : "Brief verschicken"))) return;
    await befehl("brief_senden", { slug: demo.slug, place_id: b.place_id, name: b.name }, demo.slug, "Brief geht an den Agenten …");
  }
  async function vorschau() {
    await befehl("brief_vorschau", { slug: demo.slug, place_id: b.place_id, name: b.name }, demo.slug, "Vorschau wird erstellt …");
  }
  async function demoLoeschen() {
    if (!(await frage("Demo endgültig löschen?", `Die Demo von ${b.name} geht sofort offline – auch Links aus verschickten Briefen. Bauinfos und ältere Versionen werden entfernt, der Betrieb landet unter „Aussortiert“. Bewertungen und Gelerntes bleiben.`, "Endgültig löschen", true, "löschen"))) return;
    await befehl("demo_loeschen", { place_id: b.place_id, slug: demo.slug, name: b.name, branche: b.branche, ort: b.ort, punkte: b.punkte }, b.place_id, "Demo wird gelöscht …");
  }
</script>

{#if b}
  <Head titel={b.name ?? "Betrieb"} text={[b.branche, b.ort, kat?.name].filter(Boolean).join(" · ")} zurueck="#/akquise/{b.kategorie}">
    {#if b.telefon}<a class="btn" href="tel:{b.telefon.replace(/[^+\d]/g, '')}"><Icon name="phone" size={16} />Anrufen</a>{/if}
    {#if b.maps_url}<a class="btn" href={b.maps_url} target="_blank" rel="noopener"><Icon name="pin" size={16} />Google Maps</a>{/if}
    {#if b.status === "kunde" && demo && auth.darf("kunden")}<a class="btn btn--primary" href="#/kunden/{demo.slug}"><Icon name="globe" size={16} />Website übernehmen</a>{/if}
  </Head>

  <div class="cols">
    <div class="stack">
      <section class="card box">
        <div class="box__h"><h3>Status</h3>
          {#if auth.darf("akquise", true)}
            <select class="input st" value={b.status} onchange={(e) => status((e.target as HTMLSelectElement).value)}>
              {#each Object.entries(BETRIEB_STATUS) as [k, v]}<option value={k}>{v.name}</option>{/each}
              {#if !BETRIEB_STATUS[b.status]}<option value={b.status}>{b.status}</option>{/if}
            </select>
          {:else}<span class="pill pill--{BETRIEB_STATUS[b.status]?.ton ?? 'grau'}">{BETRIEB_STATUS[b.status]?.name ?? b.status}</span>{/if}
        </div>
        <dl class="dl">
          <div><dt>Adresse</dt><dd>{b.adresse ?? b.ort ?? "–"}</dd></div>
          <div><dt>Telefon</dt><dd>{b.telefon ?? "–"}</dd></div>
          <div><dt>Website heute</dt><dd>{b.website_art ?? "–"}{b.plattform ? ` (${b.plattform})` : ""}</dd></div>
          <div><dt>Google-Bewertung</dt><dd class="num">{b.bewertung ? `${String(b.bewertung).replace(".", ",")} ★ aus ${b.anzahl_bewertungen ?? 0}` : "–"}</dd></div>
          <div><dt>Punkte im Ranking</dt><dd class="num">{b.punkte ?? "–"}</dd></div>
          <div><dt>Gebiet</dt><dd>{b.gebiet ?? "–"}{b.entfernung_km ? ` · ${String(b.entfernung_km).replace(".", ",")} km` : ""}</dd></div>
        </dl>
      </section>

      <section class="card box">
        <div class="box__h"><h3>Demo-Website</h3>
          <div class="acts">
            {#if demo?.url && !demo.geloescht}<a class="btn btn--s" href={demo.url} target="_blank" rel="noopener"><Icon name="external" size={15} />Öffnen</a>{/if}
            {#if demo && !demo.geloescht && auth.darf("akquise", true)}<button class="btn btn--s btn--quiet del" onclick={demoLoeschen} disabled={loeschtGerade}><Icon name="trash" size={15} />{loeschtGerade ? "Wird gelöscht …" : "Löschen"}</button>{/if}
          </div></div>
        {#if demo}
          <dl class="dl">
            <div><dt>Adresse</dt><dd class="brk">{demo.url ?? "–"}</dd></div>
            <div><dt>Kurzlink im Brief</dt><dd>{demo.kurz ?? "–"}</dd></div>
            <div><dt>Erstellt</dt><dd>{datum(demo.erstellt)}</dd></div>
            <div><dt>{demo.geloescht ? "Gelöscht am" : "Wird gelöscht am"}</dt><dd>{datum(demo.geloescht ?? demo.loescht_am)}</dd></div>
          </dl>
          {#if demo.url && !demo.geloescht}<div class="frame"><iframe src={demo.url} title="Vorschau der Demo" loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe></div>{/if}
        {:else}<p class="muted pad">Noch keine Demo.</p>{/if}
      </section>

      <section class="card box">
        <div class="box__h"><h3>Brief{#if agent.c.einstellungen}<span class="modus" class:test={agent.c.einstellungen.briefmodus !== "live"}>{agent.c.einstellungen.briefmodus === "live" ? "Echter Versand" : "Testmodus"}</span>{/if}</h3>
          <div class="acts">
            {#if brief && pdfDa}<button class="btn btn--s" onclick={briefAnsehen}><Icon name="eye" size={15} />Ansehen</button>{/if}
            {#if demo && !demo.geloescht && auth.darf("briefe", true)}
              {#if brief?.verschickt}<span class="pill pill--lila">verschickt am {datum(brief.verschickt)}</span>
              {:else if pdfDa}<button class="btn btn--s btn--primary" onclick={briefSenden} disabled={sendetGerade}><Icon name="letter" size={15} />{sendetGerade ? "Wird verschickt …" : "Brief verschicken"}</button>
              {:else}<button class="btn btn--s" onclick={vorschau} disabled={vorschauGerade}>{vorschauGerade ? "Vorschau wird erstellt …" : "Vorschau erstellen lassen"}</button>{/if}
            {/if}
          </div></div>
        {#if brief}
          <dl class="dl">
            <div><dt>Status</dt><dd>{brief.status}{brief.test ? " (Test)" : ""}</dd></div>
            <div><dt>Vorbereitet</dt><dd>{datum(brief.vorbereitet)}</dd></div>
            <div><dt>Verschickt</dt><dd>{datum(brief.verschickt)}</dd></div>
            {#if brief.grund}<div><dt>Hinweis</dt><dd>{brief.grund}</dd></div>{/if}
          </dl>
        {:else}<p class="muted pad">Noch kein Brief.</p>{/if}
        {#if pdfUrl}
          <div class="pdf"><iframe src={pdfUrl} title="Brief als PDF"></iframe></div>
          <div class="pdf__a"><a class="btn btn--s" href={pdfUrl} target="_blank" rel="noopener"><Icon name="external" size={15} />PDF öffnen</a><button class="btn btn--s btn--quiet" onclick={() => (pdfUrl = "")}>Schließen</button></div>
        {/if}
      </section>
    </div>
    <Verlauf bezug="betrieb" {id} schreiben={auth.darf("akquise", true)} />
  </div>
{:else if fehlt}
  <div class="card empty"><b>Betrieb nicht gefunden</b><a class="btn" href="#/akquise">Zur Akquise</a></div>
{/if}

<style>
  .cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
  @media (max-width: 1000px) { .cols { grid-template-columns: minmax(0, 1fr); } }
  .stack { display: grid; gap: 14px; }
  .box { padding: 4px 0 8px; }
  .box__h { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px 6px; }
  .st { width: auto; min-height: 34px; }
  .modus { margin-left: 10px; font-size: .72rem; font-weight: 500; padding: 3px 8px; border-radius: 999px; background: rgba(76, 195, 138, .14); color: #6FD3A2; vertical-align: middle; }
  .modus.test { background: rgba(231, 185, 74, .14); color: #EBC56B; }
  .acts { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
  .del { color: #FF8080; }
  .pdf { margin: 4px 20px 10px; border-radius: var(--radius-s); overflow: hidden; border: 1px solid var(--line); height: min(80vh, 900px); background: #fff; }
  .pdf iframe { width: 100%; height: 100%; border: 0; }
  .pdf__a { display: flex; gap: 8px; padding: 0 20px 14px; }
  .dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 20px; margin: 0; padding: 10px 20px 14px; }
  .dl div { display: grid; gap: 2px; min-width: 0; }
  .dl dt { font-size: .78rem; color: var(--steel); }
  .dl dd { margin: 0; color: var(--text); }
  .brk { overflow-wrap: anywhere; }
  .pad { padding: 6px 20px 14px; }
  .frame { margin: 4px 20px 14px; border-radius: var(--radius-s); overflow: hidden; border: 1px solid var(--line); aspect-ratio: 16 / 10; background: #fff; }
  .frame iframe { width: 200%; height: 200%; border: 0; transform: scale(.5); transform-origin: 0 0; pointer-events: none; }
</style>
