<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Verlauf from "../components/Verlauf.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { datum } from "../lib/format";
  import { BETRIEB_STATUS } from "../lib/status";

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
</script>

{#if b}
  <Head titel={b.name ?? "Betrieb"} text={[b.branche, b.ort, kat?.name].filter(Boolean).join(" · ")} zurueck="#/akquise/{b.kategorie}">
    {#if b.telefon}<a class="btn" href="tel:{b.telefon.replace(/[^+\d]/g, '')}"><Icon name="phone" size={16} />Anrufen</a>{/if}
    {#if b.maps_url}<a class="btn" href={b.maps_url} target="_blank" rel="noopener"><Icon name="pin" size={16} />Google Maps</a>{/if}
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
        <div class="box__h"><h3>Demo-Website</h3>{#if demo?.url && !demo.geloescht}<a class="btn btn--s" href={demo.url} target="_blank" rel="noopener"><Icon name="external" size={15} />Öffnen</a>{/if}</div>
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
        <div class="box__h"><h3>Brief</h3></div>
        {#if brief}
          <dl class="dl">
            <div><dt>Status</dt><dd>{brief.status}{brief.test ? " (Test)" : ""}</dd></div>
            <div><dt>Vorbereitet</dt><dd>{datum(brief.vorbereitet)}</dd></div>
            <div><dt>Verschickt</dt><dd>{datum(brief.verschickt)}</dd></div>
            {#if brief.grund}<div><dt>Hinweis</dt><dd>{brief.grund}</dd></div>{/if}
          </dl>
        {:else}<p class="muted pad">Noch kein Brief.</p>{/if}
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
  .dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 20px; margin: 0; padding: 10px 20px 14px; }
  .dl div { display: grid; gap: 2px; min-width: 0; }
  .dl dt { font-size: .78rem; color: var(--steel); }
  .dl dd { margin: 0; color: var(--text); }
  .brk { overflow-wrap: anywhere; }
  .pad { padding: 6px 20px 14px; }
  .frame { margin: 4px 20px 14px; border-radius: var(--radius-s); overflow: hidden; border: 1px solid var(--line); aspect-ratio: 16 / 10; background: #fff; }
  .frame iframe { width: 200%; height: 200%; border: 0; transform: scale(.5); transform-origin: 0 0; pointer-events: none; }
</style>
