<script lang="ts">
  // Kacheln der Creatives, per Ziehen sortierbar (Maus: ziehen · Finger: kurz halten, dann ziehen)
  import Icon from "./Icon.svelte";
  import { daten } from "../lib/daten.svelte";
  import { social, STATUS, PLATTFORMEN, typenVon, type Creative } from "../lib/social.svelte";
  import { ziehbar } from "../lib/ziehen";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { federKurve, ruhig } from "../lib/bewegung";
  import { fmtTag } from "../lib/socialformat";

  let { liste, schreiben = false, plattform = "" }: { liste: Creative[]; schreiben?: boolean; plattform?: string } = $props();
  const fk = federKurve(0.45, 0.04);

  let reihe = $state<Creative[]>([]);
  let zieht = $state<string | null>(null);
  $effect(() => { const l = liste; if (!zieht) reihe = l; });

  let gitter: HTMLElement | undefined = $state();
  let plaetze: { l: number; t: number; r: number; b: number }[] = [];
  function start(id: string) {
    zieht = id;
    const sy = scrollY;
    plaetze = [...(gitter?.children ?? [])].map((el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top + sy, r: r.right, b: r.bottom + sy }; });
  }
  function ueber(x: number, y: number) {
    if (!zieht) return;
    const py = y + scrollY, ziel = plaetze.findIndex((p) => x >= p.l && x <= p.r && py >= p.t && py <= p.b);
    const von = reihe.findIndex((c) => c.id === zieht);
    if (ziel < 0 || von < 0 || von === ziel) return;
    const neu = [...reihe]; const [c] = neu.splice(von, 1); neu.splice(ziel, 0, c); reihe = neu;
  }
  async function ende(abgebrochen: boolean) {
    const id = zieht; zieht = null;
    if (!id || abgebrochen || liste.map((c) => c.id).join() === reihe.map((c) => c.id).join()) { reihe = liste; return; }
    try { await social.verschieben(id, reihe); } catch (e: any) { daten.melden("Reihenfolge nicht gespeichert: " + (e?.message || e)); reihe = liste; }
  }
  const bilder = (c: Creative) => c.dateien.filter((d) => d.art === "bild").length;
  const dauer = (c: Creative) => c.dateien.find((d) => d.art === "video")?.dauer;
  const aufPlattform = (c: Creative) => PLATTFORMEN.filter((p) => typenVon(c, p).length);
</script>

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
          {:else if c.art === "karussell"}<Icon name="stapel" size={12} />{bilder(c)} Seiten
          {:else}<Icon name="image" size={12} />Bild{/if}
        </span>
        {#if c.status !== "freigegeben"}<span class="pill pill--{STATUS[c.status].ton} kc__st">{STATUS[c.status].name}</span>{/if}
      </span>
      <span class="kc__t">
        <b>{c.titel}</b>
        <span class="kc__m">
          {#if !plattform}{#each aufPlattform(c) as p (p.key)}<span class="pf" style="--p: {p.farbe}" title={p.name}><Icon name={p.icon} size={13} /></span>{/each}{/if}
          {#if sl}<span class="sl" style="--k: {sl.farbe}"><i></i>{sl.name}</span>{/if}
          {#if c.geplant}<span class="gp"><Icon name="calendar" size={12} />{fmtTag(c.geplant)}</span>{/if}
        </span>
      </span>
    </a>
  {/each}
</div>

<style>
  .gitter { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(46%, 210px), 1fr)); gap: 14px; }
  .kc { display: grid; padding: 0; overflow: hidden; color: inherit; touch-action: pan-y; -webkit-touch-callout: none; align-content: start; }
  .kc.verworfen { opacity: .55; }
  .kc__bild { position: relative; display: block; aspect-ratio: 3 / 4; background: linear-gradient(160deg, var(--panel-2), var(--bg-2)); overflow: hidden; }
  .kc__bild img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s var(--feder-schnell); -webkit-user-drag: none; }
  .kc__art { position: absolute; left: 8px; top: 8px; display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px;
    background: rgba(10, 18, 32, .72); color: #fff; font-size: .74rem; font-weight: 500; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .kc__st { position: absolute; right: 8px; top: 8px; background: rgba(10, 18, 32, .78); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .kc__t { display: grid; gap: 6px; padding: 12px 14px 14px; min-width: 0; }
  .kc__t b { color: var(--text); font-weight: 600; font-size: .95rem; line-height: 1.25; }
  .kc__m { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: .74rem; color: var(--text-2); }
  .kc__m:empty { display: none; }
  .pf { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; color: var(--p); background: color-mix(in srgb, var(--p) 16%, transparent); margin-right: -6px; }
  .sl { display: inline-flex; align-items: center; gap: 6px; }
  .sl i { width: 8px; height: 8px; border-radius: 50%; background: var(--k); }
  .gp { display: inline-flex; align-items: center; gap: 5px; color: var(--steel); }
  @media (hover: hover) and (pointer: fine) {
    a.kc:hover { border-color: var(--line-2); }
    a.kc:hover img { transform: scale(1.03); }
  }
  @media (max-width: 520px) { .gitter { gap: 10px; } .kc__t { padding: 10px 11px 12px; } }
</style>
