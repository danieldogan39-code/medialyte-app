<script lang="ts">
  import { lies, merk } from "../lib/speicher";
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Schalter from "../components/Schalter.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { zahl } from "../lib/format";
  import { BETRIEB_STATUS } from "../lib/status";
  import { ICONS } from "../lib/icons";

  let zahlen = $state<any[]>(lies("akquise_zahlen", [])), neu = $state(false), name = $state(""), icon = $state("store"), farbe = $state("#7C8CF5");
  $effect(() => { sb.rpc("akquise_zahlen").then((r) => { if (!r.error) zahlen = merk("akquise_zahlen", r.data ?? []); }); });
  const z = (k: string, st?: string) => zahlen.filter((x) => x.kategorie === k && (!st || x.status === st)).reduce((a, x) => a + Number(x.anzahl), 0);
  const online = (k: string) => zahlen.filter((x) => x.kategorie === k).reduce((a, x) => a + Number(x.demos_online), 0);
  const KAT_ICONS = ["utensils", "hammer", "stethoscope", "scale", "sparkles", "shopping-bag", "car", "dumbbell", "briefcase", "store", "home", "globe"].filter((i) => ICONS[i]);

  async function anlegen(e: SubmitEvent) {
    e.preventDefault();
    const slug = name.trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return;
    const { error } = await sb.from("kategorien").insert({ slug, name: name.trim(), icon, farbe, sortierung: 100 + daten.kategorien.length, suche: { typen: [], begriffe: [], vorlage: "dienstleistung" } });
    if (error) { daten.melden(fehler(error)); return; }
    neu = false; name = ""; await daten.laden(); location.hash = `#/akquise/${slug}`;
  }
</script>

<Head titel="Akquise" text="Der Agent sucht in jeder aktiven Kategorie Betriebe ohne gute Website, baut Demos und bereitet Briefe vor. Öffne eine Kategorie für Betriebe, Demos, Briefe und Suche.">
  {#if auth.darf("akquise", true)}<button class="btn" onclick={() => (neu = !neu)}><Icon name="plus" size={16} />Kategorie anlegen</button>{/if}
</Head>

{#if neu}
  <form class="card neu" onsubmit={anlegen}>
    <label class="field"><span>Name</span><input class="input" bind:value={name} placeholder="z. B. Immobilien" required></label>
    <div class="field"><span>Symbol</span><div class="icons">{#each KAT_ICONS as i}<button type="button" class="ic" class:on={icon === i} onclick={() => (icon = i)} aria-label={i}><Icon name={i} /></button>{/each}</div></div>
    <label class="field"><span>Farbe</span><input class="input farbe" type="color" bind:value={farbe}></label>
    <div class="neu__a"><button class="btn btn--quiet" type="button" onclick={() => (neu = false)}>Abbrechen</button><button class="btn btn--primary" type="submit">Anlegen</button></div>
  </form>
{/if}

<div class="kats">
  {#each daten.kategorien as k (k.slug)}
    <a class="kat card" href="#/akquise/{k.slug}" style="--c:{k.farbe}">
      <div class="kat__h">
        <span class="kat__ic"><Icon name={k.icon} size={22} /></span>
        <span class="kat__sw"><small class="muted">{k.aktiv ? "Agent sucht" : "Aus"}</small>
          <Schalter an={k.aktiv} label="Akquise {k.name} {k.aktiv ? 'ausschalten' : 'einschalten'}" disabled={!auth.darf("akquise", true)} onchange={(v) => daten.schalten("kategorie", k.slug, v)} /></span>
      </div>
      <div class="kat__t"><h2>{k.name}</h2><p class="muted">{k.beschreibung ?? ""}</p></div>
      <dl class="kat__z">
        <div><dt>Betriebe</dt><dd class="num">{zahl(z(k.slug))}</dd></div>
        <div><dt>Demos online</dt><dd class="num">{zahl(online(k.slug))}</dd></div>
        <div><dt>{BETRIEB_STATUS.verschickt.name}</dt><dd class="num">{zahl(z(k.slug, "verschickt"))}</dd></div>
        <div><dt>Kunden</dt><dd class="num">{zahl(z(k.slug, "kunde"))}</dd></div>
      </dl>
    </a>
  {/each}
</div>

<style>
  .kats { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .kat { display: grid; gap: 16px; padding: 20px; transition: border-color .15s ease, transform .15s var(--ease); }
  @media (hover: hover) and (pointer: fine) { .kat:hover { border-color: color-mix(in srgb, var(--c) 40%, transparent); } }
  .kat__h { display: flex; align-items: center; justify-content: space-between; }
  .kat__sw { display: flex; align-items: center; gap: 10px; }
  .kat__sw small { font-size: .8rem; }
  .kat__ic { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
  .kat__t { display: grid; gap: 4px; }
  .kat__t p { font-size: .88rem; min-height: 2.6em; }
  .kat__z { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0; padding-top: 14px; border-top: 1px solid var(--line); }
  .kat__z div { display: grid; gap: 2px; }
  .kat__z dt { font-size: .72rem; color: var(--steel); line-height: 1.2; }
  .kat__z dd { margin: 0; color: var(--text); font-weight: 600; font-size: 1.1rem; }
  .neu { display: grid; gap: 16px; padding: 20px; margin-bottom: 16px; max-width: 560px; }
  .icons { display: flex; flex-wrap: wrap; gap: 6px; }
  .ic { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--line-2); background: transparent; display: grid; place-items: center; cursor: pointer; color: var(--text-2); }
  .ic.on { border-color: var(--text); color: var(--text); background: var(--hover); }
  .farbe { width: 80px; padding: 4px; }
  .neu__a { display: flex; justify-content: flex-end; gap: 8px; }
</style>
