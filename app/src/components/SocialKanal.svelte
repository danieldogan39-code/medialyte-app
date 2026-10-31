<script lang="ts">
  // Eine Plattform: oben die Inhaltstypen als Kacheln (Story, Video, Beitrag, mehrseitig), darunter die Creatives
  import Icon from "./Icon.svelte";
  import CreativeGitter from "./CreativeGitter.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import { auth } from "../lib/auth.svelte";
  import { social, STATUS, TYPEN, PLATTFORMEN, plattform, typName, typenVon, type Creative, type Typ } from "../lib/social.svelte";
  import { fly } from "svelte/transition";
  import { federKurve, ruhig } from "../lib/bewegung";

  let { kanal, typ = "" }: { kanal: string; typ?: string } = $props();
  const fk = federKurve(0.45, 0.04);
  $effect(() => { kanal; typ; social.zuletzt = location.hash; });
  const p = $derived(plattform(kanal));
  const schreiben = $derived(auth.darf("social", true));

  let status = $state<"aktiv" | Creative["status"]>("aktiv");
  $effect(() => { kanal; status = kanal === "freigabe" ? "pruefen" : "aktiv"; });
  const passtStatus = (c: Creative) => (status === "aktiv" ? c.status !== "verworfen" : c.status === status);

  // alle Creatives dieser Plattform (bzw. Sammlung „Zur Freigabe“ / „Ohne Plattform“)
  const basis = $derived.by(() => {
    const l = social.sortiert();
    if (p) return l.filter((c) => typenVon(c, p).length);
    if (kanal === "ohne") return l.filter((c) => !PLATTFORMEN.some((x) => typenVon(c, x).length));
    return l;
  });
  const typen = $derived(p ? p.typen.map((t) => ({ t, l: basis.filter((c) => c.status !== "verworfen" && typenVon(c, p).includes(t)) })) : []);
  const liste = $derived(basis.filter((c) => passtStatus(c) && (!p || !typ || typenVon(c, p).includes(typ as Typ))));
  const titel = $derived(p ? p.name : kanal === "freigabe" ? "Zur Freigabe" : "Ohne Plattform");
  const bild = (c: Creative) => (c.vorschau ? social.bild[c.vorschau] : "");
  const leerText = $derived(p && typ ? `Noch keine ${typName(p, typ as Typ, true)} für ${p.name}.` : p ? `Noch nichts für ${p.name}.` : "Hier ist gerade nichts.");
</script>

<div class="kopf" style="--p: {p?.farbe ?? 'var(--bereich)'}; --fl: {p?.flaeche ?? 'var(--bereich)'}">
  <a class="zurueck" href="#/social"><Icon name="left" size={16} />Alle Plattformen</a>
  <div class="kopf__z">
    {#if p}<PlattformLogo name={p.key} size={46} />{:else}<span class="logo"><Icon name={kanal === "freigabe" ? "check" : "image"} size={24} /></span>{/if}
    <h2>{titel}</h2>
    <span class="muted zahl">{basis.filter((c) => c.status !== "verworfen").length} Creatives</span>
  </div>
</div>

{#if p}
  <div class="typen" style="--p: {p.farbe}">
    <a class="tk" class:on={!typ} href="#/social/k/{p.key}" aria-current={!typ ? "page" : undefined}>
      <span class="tk__i"><Icon name="layers" size={18} /></span>
      <span class="tk__t"><b>Alle</b><small>{basis.filter((c) => c.status !== "verworfen").length}</small></span>
    </a>
    {#each typen as x, i (x.t)}
      <a class="tk" class:on={typ === x.t} class:leer={!x.l.length} href={typ === x.t ? `#/social/k/${p.key}` : `#/social/k/${p.key}/${x.t}`} aria-current={typ === x.t ? "page" : undefined}
        in:fly={{ y: ruhig() ? 0 : 10, duration: ruhig() ? 0 : fk.ms, delay: ruhig() ? 0 : 40 + i * 40, easing: fk.easing, opacity: 0 }}>
        <span class="tk__i"><Icon name={TYPEN[x.t].icon} size={18} /></span>
        <span class="tk__t"><b>{typName(p, x.t)}</b><small>{x.l.length}</small></span>
        <span class="tk__bilder" aria-hidden="true">{#each x.l.slice(0, 3) as c (c.id)}{#if bild(c)}<img src={bild(c)} alt="" draggable="false">{/if}{/each}</span>
      </a>
    {/each}
  </div>
{/if}

<div class="leiste">
  <h3>{p && typ ? typName(p, typ as Typ, true) : "Alle Creatives"} <span class="muted">{liste.length}</span></h3>
  <label class="st"><span class="sr">Status</span>
    <select class="input" bind:value={status}>
      <option value="aktiv">Alle außer verworfen</option>
      {#each Object.entries(STATUS) as [k, s] (k)}<option value={k}>{s.name}</option>{/each}
    </select></label>
</div>

{#if liste.length}
  {#key kanal + typ + status}<CreativeGitter {liste} {schreiben} plattform={p?.key ?? ""} />{/key}
  {#if schreiben && liste.length > 1}<p class="tipp muted"><Icon name="stapel" size={14} />Zum Sortieren ziehen{matchMedia("(pointer: coarse)").matches ? " (kurz gedrückt halten)" : ""}.</p>{/if}
{:else}
  <div class="card empty"><Icon name={p?.icon ?? "image"} size={26} /><b>{leerText}</b><p>Sag Claude, was du brauchst. Neue Creatives erscheinen hier automatisch.</p></div>
{/if}

<style>
  .kopf { display: grid; gap: 12px; margin: -4px 0 18px; }
  .zurueck { display: inline-flex; align-items: center; gap: 4px; justify-self: start; color: var(--steel); font-size: .88rem; }
  .zurueck:hover { color: var(--text); }
  @media (max-width: 900px) { .zurueck { display: none; } }
  .kopf__z { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .logo { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; color: #fff; background: var(--fl); box-shadow: 0 12px 26px -12px var(--p), inset 0 1px 0 rgba(255, 255, 255, .3); }
  h2 { font-size: 1.6rem; letter-spacing: -.025em; }
  .zahl { font-size: .9rem; }
  .typen { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 26px; }
  .tk { position: relative; overflow: hidden; display: grid; gap: 10px; align-content: start; min-height: 112px; padding: 14px; border-radius: 16px; color: inherit;
    background: var(--panel); border: 1px solid var(--line); transition: transform .45s var(--feder-schnell), border-color .25s ease, background-color .25s ease; }
  .tk:active { transform: scale(.97); }
  .tk.leer { opacity: .6; }
  .tk.on { border-color: color-mix(in srgb, var(--p) 70%, transparent); background: color-mix(in srgb, var(--p) 12%, var(--panel)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--p) 40%, transparent); }
  .tk__i { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; color: var(--p); background: color-mix(in srgb, var(--p) 15%, transparent); transition: background-color .25s ease, color .25s ease; }
  .tk.on .tk__i { background: var(--p); color: #fff; }
  .tk__t { display: grid; gap: 1px; position: relative; z-index: 1; }
  .tk__t b { font-weight: 600; font-size: .95rem; color: var(--text); line-height: 1.2; }
  .tk__t small { color: var(--steel); font-size: .8rem; }
  .tk__bilder { position: absolute; right: 10px; top: 12px; display: flex; }
  .tk__bilder img { width: 30px; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 6px; margin-left: -12px; box-shadow: 0 6px 14px -6px rgba(0, 0, 0, .8), 0 0 0 1.5px var(--panel); }
  @media (hover: hover) and (pointer: fine) { .tk:hover { border-color: color-mix(in srgb, var(--p) 40%, var(--line)); } }
  .leiste { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  h3 { font-size: 1.05rem; font-weight: 600; }
  h3 .muted { font-weight: 400; margin-left: 4px; }
  .st select { min-height: 36px; font-size: .86rem; width: auto; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .tipp { display: flex; align-items: center; gap: 6px; font-size: .8rem; margin-top: 12px; }
  @media (max-width: 520px) {
    .typen { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tk { min-height: 96px; padding: 12px; }
    .tk__bilder img { width: 24px; }
  }
</style>
