<script lang="ts">
  // Kacheln der Creatives, per Ziehen sortierbar (Maus: ziehen · Finger: kurz halten, dann ziehen)
  // Die Nummer ist die Posting-Reihenfolge: 1 kommt als Nächstes dran. Gepostete und verworfene stehen ohne Nummer dahinter.
  import Icon from "./Icon.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import { daten } from "../lib/daten.svelte";
  import { haptik } from "../lib/haptik";
  import { social, STATUS, PLATTFORMEN, typenVon, offen, type Creative } from "../lib/social.svelte";
  import { ziehbar } from "../lib/ziehen";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { federKurve, ruhig } from "../lib/bewegung";
  import { fmtTag } from "../lib/socialformat";

  // global: Nummer aus der Gesamt-Reihenfolge (Bibliothek, Favoriten) statt der Position in dieser Liste
  let { liste, schreiben = false, plattform = "", sortierbar = true, global = false }: { liste: Creative[]; schreiben?: boolean; plattform?: string; sortierbar?: boolean; global?: boolean } = $props();
  const gesamt = $derived(global ? new Map(social.sortiert().filter(offen).map((c, i) => [c.id, i + 1])) : null);
  const fk = federKurve(0.45, 0.04);

  // offene (nummeriert, sortierbar) und dahinter die erledigten
  let reihe = $state<Creative[]>([]);
  let zieht = $state<string | null>(null);
  $effect(() => { const l = liste.filter(offen); if (!zieht) reihe = l; });
  const erledigt = $derived(liste.filter((c) => !offen(c)));

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
    const vorher = liste.filter(offen);
    if (!id || abgebrochen || vorher.map((c) => c.id).join() === reihe.map((c) => c.id).join()) { reihe = vorher; return; }
    try { await social.verschieben(id, reihe); } catch (e: any) { daten.melden("Reihenfolge nicht gespeichert: " + (e?.message || e)); reihe = vorher; }
  }
  async function stern(e: MouseEvent, c: Creative) {
    e.preventDefault(); e.stopPropagation();
    if (!schreiben) return;
    try { await social.favorit(c); haptik("leicht"); } catch (err: any) { daten.melden("Nicht gespeichert: " + (err?.message || err)); }
  }
  const bilder = (c: Creative) => c.dateien.filter((d) => d.art === "bild").length;
  const dauer = (c: Creative) => c.dateien.find((d) => d.art === "video")?.dauer;
  const aufPlattform = (c: Creative) => PLATTFORMEN.filter((p) => typenVon(c, p).length);
</script>

{#snippet inhalt(c: Creative, n: number)}
  {@const sl = social.saeule(c.saeule)}
      <span class="kc__bild">
        {#if c.vorschau && social.bild[c.vorschau]}<img src={social.bild[c.vorschau]} alt="" draggable="false" loading="lazy" decoding="async">{/if}
        {#if n}<span class="kc__nr num" title="Posting-Reihenfolge">{n}</span>{/if}
        {#if schreiben}
          <button type="button" class="kc__stern" class:an={c.favorit} aria-pressed={!!c.favorit} aria-label={c.favorit ? "Aus Favoriten entfernen" : "Zu Favoriten"} onclick={(e) => stern(e, c)}><Icon name="star" size={16} fill={!!c.favorit} /></button>
        {:else if c.favorit}<span class="kc__stern an"><Icon name="star" size={16} fill /></span>{/if}
        <span class="kc__unten">
          <span class="kc__art">
            {#if c.art === "video"}<Icon name="play" size={12} />{dauer(c) ? Math.round(dauer(c)!) + " s" : "Video"}
            {:else if c.art === "karussell"}<Icon name="stapel" size={12} />{bilder(c)} Seiten
            {:else}<Icon name="image" size={12} />Bild{/if}
          </span>
          {#if c.status !== "freigegeben"}<span class="pill pill--{STATUS[c.status].ton} kc__st">{STATUS[c.status].name}</span>{/if}
        </span>
      </span>
      <span class="kc__t">
        <b>{c.titel}</b>
        <span class="kc__m">
          {#if !plattform}{#each aufPlattform(c) as p (p.key)}<span class="pf" title={p.name}><PlattformLogo name={p.key} size={20} rund={0.3} /></span>{/each}{/if}
          {#if c.eigen}<span class="eg"><Icon name="upload" size={12} />Eigenes</span>{/if}
          {#if sl}<span class="sl" style="--k: {sl.farbe}"><i></i>{sl.name}</span>{/if}
          {#if c.geplant}<span class="gp"><Icon name="calendar" size={12} />{fmtTag(c.geplant)}</span>{/if}
        </span>
      </span>
{/snippet}

<div class="gitter" bind:this={gitter}>
  {#each reihe as c, i (c.id)}
    <a class="kc card" href="#/social/c/{c.slug}" data-cid={c.id}
      animate:flip={{ duration: ruhig() ? 0 : zieht ? 300 : fk.ms, easing: fk.easing }}
      in:fly={{ y: ruhig() ? 0 : 12, duration: ruhig() ? 0 : fk.ms, easing: fk.easing, opacity: 0 }}
      use:ziehbar={{ aus: !schreiben || !sortierbar, start: () => start(c.id), bewegt: (x, y) => ueber(x, y), ende: (_x, _y, _u, ab) => ende(ab) }}>
      {@render inhalt(c, gesamt?.get(c.id) ?? i + 1)}
    </a>
  {/each}
</div>
{#if erledigt.length}
  {#if reihe.length}<div class="trenner"><span>Gepostet und verworfen</span></div>{/if}
  <div class="gitter">
    {#each erledigt as c (c.id)}
      <a class="kc card erledigt" href="#/social/c/{c.slug}" class:verworfen={c.status === "verworfen"}>{@render inhalt(c, 0)}</a>
    {/each}
  </div>
{/if}

<style>
  .gitter { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(46%, 210px), 1fr)); gap: 14px; }
  .trenner { display: flex; align-items: center; gap: 12px; margin: 22px 0 12px; color: var(--steel); font-size: .8rem; }
  .trenner::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  .kc { display: grid; padding: 0; overflow: hidden; color: inherit; touch-action: pan-y; -webkit-touch-callout: none; align-content: start; }
  .kc.erledigt { opacity: .72; }
  .kc.verworfen { opacity: .5; }
  .kc__bild { position: relative; display: block; aspect-ratio: 3 / 4; background: linear-gradient(160deg, var(--panel-2), var(--bg-2)); overflow: hidden; }
  .kc__bild img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s var(--feder-schnell); -webkit-user-drag: none; }
  .kc__nr { position: absolute; left: 8px; top: 8px; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 999px; display: grid; place-items: center;
    background: var(--text); color: var(--bg); font-weight: 700; font-size: .92rem; letter-spacing: -.02em; box-shadow: 0 6px 16px -6px rgba(0, 0, 0, .7); }
  .kc__stern { position: absolute; right: 6px; top: 6px; width: 36px; height: 36px; border: 0; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
    color: rgba(255, 255, 255, .85); background: rgba(10, 18, 32, .55); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    transition: transform .35s var(--feder-schnell), color .2s ease, background-color .2s ease; }
  .kc__stern:active { transform: scale(.88); }
  .kc__stern.an { color: #F7C65E; background: rgba(10, 18, 32, .72); }
  .kc__unten { position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .kc__art { flex: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px;
    background: rgba(10, 18, 32, .72); color: #fff; font-size: .74rem; font-weight: 500; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .kc__st { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: rgba(10, 18, 32, .78); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .kc__t { display: grid; gap: 6px; padding: 12px 14px 14px; min-width: 0; }
  .kc__t b { color: var(--text); font-weight: 600; font-size: .95rem; line-height: 1.25; }
  .kc__m { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: .74rem; color: var(--text-2); }
  .kc__m:empty { display: none; }
  .pf { display: inline-grid; margin-right: -4px; }
  .eg { display: inline-flex; align-items: center; gap: 4px; color: var(--steel); }
  .sl { display: inline-flex; align-items: center; gap: 6px; }
  .sl i { width: 8px; height: 8px; border-radius: 50%; background: var(--k); }
  .gp { display: inline-flex; align-items: center; gap: 5px; color: var(--steel); }
  @media (hover: hover) and (pointer: fine) {
    a.kc:hover { border-color: var(--line-2); }
    a.kc:hover img { transform: scale(1.03); }
    .kc__stern:hover { color: #F7C65E; }
  }
  @media (max-width: 520px) { .gitter { gap: 10px; } .kc__t { padding: 10px 11px 12px; } .kc__unten { left: 6px; right: 6px; bottom: 6px; gap: 4px; } .kc__art, .kc__st { font-size: .7rem; padding: 0 7px; } }
</style>
