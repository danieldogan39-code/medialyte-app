<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import SocialPlan from "../components/SocialPlan.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { social, STATUS, ART, type Creative } from "../lib/social.svelte";
  import { ziehbar } from "../lib/ziehen";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { federKurve, gleiter, ruhig } from "../lib/bewegung";
  import { fmtTag } from "../lib/socialformat";

  let { tab = "creatives" }: { tab?: string } = $props();
  const fk = federKurve(0.45, 0.04);
  const schreiben = $derived(auth.darf("social", true));

  $effect(() => { social.laden(); return social.live(); });

  let filter = $state<"alle" | Creative["status"]>("alle");
  const passt = (c: Creative) => (filter === "alle" ? c.status !== "verworfen" : c.status === filter);
  const anzahl = (s: Creative["status"]) => social.liste.filter((c) => c.status === s).length;

  // Reihenfolge: beim Ziehen lokal umsortiert, danach wird nur die Position des gezogenen Creatives gespeichert
  let reihe = $state<Creative[]>([]);
  let zieht = $state<string | null>(null);
  $effect(() => { const l = social.sortiert().filter(passt); if (!zieht) reihe = l; });

  let gitter: HTMLElement | undefined = $state();
  let plaetze: { l: number; t: number; r: number; b: number }[] = [];
  function start(id: string) {
    zieht = id;
    const sy = scrollY;
    plaetze = [...(gitter?.children ?? [])].map((el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top + sy, r: r.right, b: r.bottom + sy }; });
  }
  function ueber(x: number, y: number) {
    if (!zieht) return;
    const py = y + scrollY;
    let ziel = plaetze.findIndex((p) => x >= p.l && x <= p.r && py >= p.t && py <= p.b);
    if (ziel < 0) return;
    const von = reihe.findIndex((c) => c.id === zieht);
    if (von < 0 || von === ziel) return;
    const neu = [...reihe]; const [c] = neu.splice(von, 1); neu.splice(ziel, 0, c); reihe = neu;
  }
  async function ende(abgebrochen: boolean) {
    const id = zieht; zieht = null;
    if (!id || abgebrochen) { reihe = social.sortiert().filter(passt); return; }
    const alt = social.sortiert().filter(passt).map((c) => c.id).join(), jetzt = reihe.map((c) => c.id).join();
    if (alt === jetzt) return;
    try { await social.verschieben(id, reihe); } catch (e: any) { daten.melden("Reihenfolge nicht gespeichert: " + (e?.message || e)); reihe = social.sortiert().filter(passt); }
  }
  const anzahlBilder = (c: Creative) => c.dateien.filter((d) => d.art === "bild").length;
  const dauer = (c: Creative) => c.dateien.find((d) => d.art === "video")?.dauer;
</script>

<Head titel="Social Media" text="Alle Creatives mit Texten zum Herunterladen, dazu der Plan und der rote Faden für Instagram.">
  {#if social.zurFreigabe}<span class="pill pill--gelb">{social.zurFreigabe} zur Freigabe</span>{/if}
</Head>

<div class="reiter" role="tablist" aria-label="Ansicht" use:gleiter>
  <a role="tab" class="chip" href="#/social" aria-selected={tab !== "plan"} class:on={tab !== "plan"}><Icon name="image" size={14} />Creatives</a>
  <a role="tab" class="chip" href="#/social/plan" aria-selected={tab === "plan"} class:on={tab === "plan"}><Icon name="calendar" size={14} />Plan &amp; Kalender</a>
</div>

{#if tab === "plan"}
  <SocialPlan />
{:else}
  {#if social.laedt && !social.liste.length}<div class="skelett" aria-label="Lade …"><i></i><i></i><i></i></div>
  {:else if social.fehler && !social.liste.length}<div class="card empty"><b>Creatives nicht geladen</b><p>{social.fehler}</p></div>
  {:else if !social.liste.length}
    <div class="card empty"><Icon name="image" size={28} /><b>Noch keine Creatives</b><p>Sobald Claude ein Creative fertig hat, erscheint es hier automatisch, mit Bildern, Video, Titelbild und Text.</p></div>
  {:else}
    <div class="bar">
      <div class="chips" role="tablist" aria-label="Nach Status filtern" use:gleiter>
        <button class="chip" role="tab" aria-selected={filter === "alle"} class:on={filter === "alle"} onclick={() => (filter = "alle")}>Alle <span class="z">{social.liste.filter((c) => c.status !== "verworfen").length}</span></button>
        {#each Object.entries(STATUS) as [k, s] (k)}
          {@const n = anzahl(k as Creative["status"])}
          {#if n || k !== "verworfen"}<button class="chip" role="tab" aria-selected={filter === k} class:on={filter === k} onclick={() => (filter = k as Creative["status"])}>{s.name} <span class="z">{n}</span></button>{/if}
        {/each}
      </div>
      {#if schreiben && reihe.length > 1}<span class="tipp muted"><Icon name="stapel" size={14} />Zum Sortieren ziehen{matchMedia("(pointer: coarse)").matches ? " (kurz gedrückt halten)" : ""}</span>{/if}
    </div>

    <div class="gitter" bind:this={gitter}>
      {#each reihe as c (c.id)}
        {@const sl = social.saeule(c.saeule)}
        <a class="kc card" href="#/social/c/{c.slug}" data-cid={c.id} class:verworfen={c.status === "verworfen"}
          animate:flip={{ duration: ruhig() ? 0 : zieht ? 300 : fk.ms, easing: fk.easing }}
          in:fly={{ y: ruhig() ? 0 : 12, duration: ruhig() ? 0 : fk.ms, easing: fk.easing, opacity: 0 }}
          use:ziehbar={{ aus: !schreiben, start: () => start(c.id), bewegt: (x, y) => ueber(x, y), ende: (_x, _y, _u, ab) => ende(ab) }}>
          <span class="kc__bild">
            {#if c.vorschau && social.bild[c.vorschau]}<img src={social.bild[c.vorschau]} alt="" draggable="false" loading="lazy" decoding="async">{/if}
            <span class="kc__art">
              {#if c.art === "video"}<Icon name="play" size={12} />{dauer(c) ? Math.round(dauer(c)!) + " s" : "Video"}
              {:else if c.art === "karussell"}<Icon name="stapel" size={12} />{anzahlBilder(c)}
              {:else}<Icon name="image" size={12} />Bild{/if}
            </span>
            {#if c.status !== "freigegeben"}<span class="pill pill--{STATUS[c.status].ton} kc__st">{STATUS[c.status].name}</span>{/if}
          </span>
          <span class="kc__t">
            <b>{c.titel}</b>
            <small class="muted">{[c.serie, ART[c.art]].filter(Boolean).join(" · ")}</small>
            {#if sl || c.geplant}
              <span class="kc__m">
                {#if sl}<span class="sl" style="--k: {sl.farbe}"><i></i>{sl.name}</span>{/if}
                {#if c.geplant}<span class="gp"><Icon name="calendar" size={12} />{fmtTag(c.geplant)}</span>{/if}
              </span>
            {/if}
          </span>
        </a>
      {:else}<p class="muted">Keine Creatives mit diesem Status.</p>{/each}
    </div>
  {/if}
{/if}

<style>
  .reiter { display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 20px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); }
  .reiter .chip { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; color: var(--text-2); font-size: .9rem; }
  .reiter .chip.on { color: #0A1220; background: transparent; }
  .reiter :global(.gleiter) { background: var(--bereich) !important; }
  .bar { display: flex; gap: 10px 16px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
  .chips { display: flex; gap: 6px; overflow-x: auto; min-width: 0; max-width: 100%; scrollbar-width: none; padding: 2px 0; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font: inherit; font-size: .86rem; white-space: nowrap; }
  .chips .chip.on { background: transparent; border-color: transparent; color: var(--bg); }
  .chips :global(.gleiter) { border-radius: 999px; background: var(--text) !important; }
  .chip .z { opacity: .55; font-size: .8em; margin-left: 2px; }
  .tipp { display: inline-flex; align-items: center; gap: 6px; font-size: .82rem; margin-left: auto; }
  .gitter { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(46%, 210px), 1fr)); gap: 14px; }
  .kc { display: grid; padding: 0; overflow: hidden; color: inherit; touch-action: pan-y; -webkit-touch-callout: none; }
  .kc.verworfen { opacity: .55; }
  .kc__bild { position: relative; display: block; aspect-ratio: 3 / 4; background: linear-gradient(160deg, var(--panel-2), var(--bg-2)); overflow: hidden; }
  .kc__bild img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s var(--feder-schnell); -webkit-user-drag: none; }
  .kc__art { position: absolute; left: 8px; top: 8px; display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px;
    background: rgba(10, 18, 32, .72); color: #fff; font-size: .74rem; font-weight: 500; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .kc__st { position: absolute; right: 8px; top: 8px; background: rgba(10, 18, 32, .78); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .kc__t { display: grid; gap: 3px; padding: 12px 14px 14px; min-width: 0; }
  .kc__t b { color: var(--text); font-weight: 600; font-size: .95rem; line-height: 1.25; }
  .kc__t small { font-size: .78rem; }
  .kc__m { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-top: 4px; font-size: .74rem; color: var(--text-2); }
  .sl { display: inline-flex; align-items: center; gap: 6px; }
  .sl i { width: 8px; height: 8px; border-radius: 50%; background: var(--k); }
  .gp { display: inline-flex; align-items: center; gap: 5px; color: var(--steel); }
  @media (hover: hover) and (pointer: fine) {
    a.kc:hover { border-color: var(--line-2); }
    a.kc:hover img { transform: scale(1.03); }
  }
  @media (max-width: 520px) { .tipp { margin-left: 0; } .gitter { gap: 10px; } .kc__t { padding: 10px 11px 12px; } }
</style>
