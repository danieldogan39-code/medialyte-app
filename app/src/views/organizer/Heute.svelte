<script lang="ts">
  import Icon from "../../components/Icon.svelte";
  import Ring from "../../components/organizer/Ring.svelte";
  import Zeitleiste from "../../components/organizer/Zeitleiste.svelte";
  import { auth } from "../../lib/auth.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { MIN, countdown, dauer, gruss, plusTage, tageBis, tagKey, tagLang, uhr, wt } from "../../lib/organizer/zeit";

  const heute = $derived(new Date(org.jetzt));
  const bloecke = $derived(org.bloecke(heute));
  const machbar = $derived(bloecke.filter((b) => b.art !== "termin"));
  const fertig = $derived(machbar.filter((b) => b.erledigt).length);
  const jetzt = $derived(bloecke.find((b) => !b.ganztag && b.start.getTime() <= org.jetzt && b.ende.getTime() > org.jetzt && !b.erledigt));
  const naechster = $derived(bloecke.find((b) => !b.ganztag && b.start.getTime() > org.jetzt));
  const morgen = $derived(org.bloecke(plusTage(heute, 1)).filter((b) => !b.ganztag));
  const ungeplant = $derived(org.offen.filter((a) => !a.geplant));
  const liegen = $derived(org.liegengeblieben);
  const neuHier = $derived(org.geladen && !org.faecher.length && !org.aufgaben.length && !org.termine.length);
  const gewohnheiten = $derived(org.gewohnheiten.filter((g) => g.aktiv));
  const fortschritt = (b: { start: Date; ende: Date }) => Math.min(1, Math.max(0, (org.jetzt - b.start.getTime()) / (b.ende.getTime() - b.start.getTime())));
</script>

<div class="kopf">
  <div>
    <small class="datum">{tagLang(heute)}</small>
    <h1>{gruss()}, {auth.ich?.name?.split(" ")[0] ?? ""}</h1>
    <p class="muted">
      {#if !machbar.length}Heute ist nichts zum Abhaken geplant.
      {:else if fertig === machbar.length}Alles für heute erledigt. Stark.
      {:else}Noch {machbar.length - fertig} von {machbar.length} {machbar.length === 1 ? "Block" : "Blöcken"} offen.{/if}
    </p>
  </div>
  {#if machbar.length}<Ring wert={fertig / machbar.length} size={64} dicke={6}><span class="num">{Math.round((fertig / machbar.length) * 100)}%</span></Ring>{/if}
</div>

{#if neuHier}
  <a class="willkommen card" href="#/o/einstellungen">
    <span class="wi"><Icon name="sparkles" size={22} /></span>
    <span><b>Willkommen im Organizer</b><small>Einmal einrichten: Fächer anlegen, ISM- und Google-Kalender verbinden und deinen Lernplan übernehmen – danach plant die App für dich.</small></span>
    <Icon name="right" size={18} />
  </a>
{/if}

<div class="hinweise">
  {#each org.pruefungen.slice(0, 2) as p (p.id)}
    {@const n = tageBis(p.start)}
    <a class="hw card" href="#/o/pruefungen" style="--f: {org.farbe(p.fach_id, '#F24A4A')}">
      <span class="hw__z num">{n <= 0 ? "!" : n}</span>
      <span><small>{p.art === "abgabe" ? "Abgabe" : "Klausur"} · {countdown(n)}</small><b>{p.titel}</b></span>
    </a>
  {/each}
  {#if liegen.length}
    <div class="hw card warn">
      <span class="hw__i"><Icon name="clock" size={18} /></span>
      <span><small>Liegengeblieben</small><b>{liegen.length} {liegen.length === 1 ? "Aufgabe" : "Aufgaben"}</b></span>
      <button class="btn btn--s org-primary btn--primary" disabled={org.plant} onclick={() => org.planen(new Set(liegen.map((a) => a.id)), false, true)}><Icon name="wand" size={14} />Neu einplanen</button>
    </div>
  {/if}
  {#if ungeplant.length}
    <div class="hw card">
      <span class="hw__i"><Icon name="inbox" size={18} /></span>
      <span><small>Noch ohne Zeit</small><b>{ungeplant.length} {ungeplant.length === 1 ? "Aufgabe" : "Aufgaben"}</b></span>
      <button class="btn btn--s" disabled={org.plant} onclick={() => org.planen(new Set(ungeplant.map((a) => a.id)))}><Icon name="wand" size={14} />Einplanen</button>
    </div>
  {/if}
</div>

{#if jetzt || naechster}
  {@const b = (jetzt ?? naechster)!}
  <section class="held card" style="--f: {b.farbe}">
    <div class="held__t">
      <small>{jetzt ? "Jetzt" : `Als Nächstes · ${uhr(b.start)} Uhr`}</small>
      <h2>{b.titel}</h2>
      <p class="muted">{b.unter ? b.unter + " · " : ""}{uhr(b.start)} – {uhr(b.ende)}{jetzt ? ` · noch ${dauer(Math.round((b.ende.getTime() - org.jetzt) / MIN))}` : ` · in ${dauer(Math.max(1, Math.round((b.start.getTime() - org.jetzt) / MIN)))}`}</p>
      {#if jetzt}<div class="balken"><i style="width: {fortschritt(b) * 100}%"></i></div>{/if}
    </div>
    <div class="held__a">
      {#if b.aufgabe && !b.erledigt}
        <button class="btn" onclick={() => blatt.auf({ art: "fokus", a: b.aufgabe! })}><Icon name="play" size={14} fill />Fokus</button>
        <button class="btn btn--primary org-primary" onclick={() => org.erledigen(b.aufgabe!)}><Icon name="check" size={16} />Erledigt</button>
      {:else if b.gewohnheit && !b.erledigt}
        <button class="btn btn--primary org-primary" onclick={() => org.abhaken(b.gewohnheit!)}><Icon name="check" size={16} />Geschafft</button>
      {/if}
    </div>
  </section>
{/if}

<div class="raster">
  <section>
    <div class="abschnitt"><h2>Dein Tag</h2><button class="btn btn--quiet btn--s" onclick={() => blatt.auf({ art: "schnell" })}><Icon name="plus" size={15} />Hinzufügen</button></div>
    <Zeitleiste tag={heute} leer="Heute ist noch nichts geplant. Tipp auf + und schreib einfach los." />
  </section>

  <aside>
    {#if gewohnheiten.length}
      <section>
        <div class="abschnitt"><h2>Gewohnheiten</h2><a class="btn btn--quiet btn--s" href="#/o/ziele">Alle</a></div>
        <div class="gw">
          {#each gewohnheiten as g (g.id)}
            {@const s = org.wocheStand(g)}
            {@const an = org.hatLog(g, tagKey(org.jetzt))}
            <button class="gw__k card" class:an style="--f: {g.farbe}" onclick={() => org.abhaken(g)}>
              <Ring wert={s.erreicht / s.ziel} size={42} dicke={4} farbe={g.farbe}><Icon name={an ? "check" : g.icon} size={16} /></Ring>
              <span><b>{g.name}</b><small>{s.erreicht} von {s.ziel} diese Woche{org.heuteDran(g) && !an ? " · heute dran" : ""}</small></span>
            </button>
          {/each}
        </div>
      </section>
    {/if}
    <section>
      <div class="abschnitt"><h2>Morgen</h2><a class="btn btn--quiet btn--s" href="#/o/woche">Woche</a></div>
      {#if morgen.length}
        <ul class="morgen card">
          {#each morgen.slice(0, 5) as b (b.id)}<li style="--f: {b.farbe}"><span class="num">{uhr(b.start)}</span><i></i><b>{b.titel}</b></li>{/each}
          {#if morgen.length > 5}<li class="muted mehr">+ {morgen.length - 5} weitere</li>{/if}
        </ul>
      {:else}<p class="muted klein">Morgen ({wt(plusTage(heute, 1))}) ist noch frei.</p>{/if}
    </section>
  </aside>
</div>

<style>
  .kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 20px; }
  .kopf > div { display: grid; gap: 4px; }
  .datum { color: var(--org); font-weight: 600; letter-spacing: .05em; text-transform: uppercase; font-size: .74rem; }
  h1 { font-size: clamp(1.5rem, 3vw, 1.9rem); }
  .willkommen { display: flex; align-items: center; gap: 14px; padding: 16px; margin-bottom: 16px; border-color: rgba(142, 124, 255, .4);
    background: linear-gradient(120deg, rgba(142, 124, 255, .16), rgba(79, 209, 181, .06)); }
  .willkommen > span:nth-child(2) { flex: 1; display: grid; gap: 3px; }
  .willkommen b { color: var(--text); }
  .willkommen small { color: var(--text-2); font-size: .86rem; }
  .wi { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: var(--org); color: #fff; flex: none; }
  .hinweise { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px 16px; padding: 2px 16px; scroll-snap-type: x mandatory; }
  .hinweise:empty { display: none; }
  @media (min-width: 901px) { .hinweise { flex-wrap: wrap; overflow: visible; margin: 0 0 16px; padding: 0; } }
  .hw { flex: none; scroll-snap-align: start; display: flex; align-items: center; gap: 12px; padding: 12px 14px; min-width: 220px; border-radius: 16px; }
  .hw > span:nth-child(2) { display: grid; line-height: 1.3; flex: 1; min-width: 0; }
  .hw small { color: var(--steel); font-size: .76rem; }
  .hw b { color: var(--text); font-weight: 500; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hw__z { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; font-weight: 700; font-size: 1.1rem; color: var(--f);
    background: color-mix(in srgb, var(--f) 16%, transparent); flex: none; }
  .hw__i { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: var(--panel-2); color: var(--text-2); flex: none; }
  .hw.warn .hw__i { background: rgba(231, 185, 74, .16); color: var(--warn); }
  .held { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 18px; margin-bottom: 22px; border-radius: 20px; border-color: color-mix(in srgb, var(--f) 45%, transparent);
    background: linear-gradient(115deg, color-mix(in srgb, var(--f) 20%, var(--panel)), var(--panel) 65%); box-shadow: 0 24px 60px -36px color-mix(in srgb, var(--f) 90%, transparent); }
  .held__t { flex: 1 1 280px; display: grid; gap: 4px; min-width: 0; }
  .held__t small { color: color-mix(in srgb, var(--f) 75%, #fff); font-weight: 600; font-size: .76rem; letter-spacing: .05em; text-transform: uppercase; }
  .held__t h2 { font-size: 1.3rem; }
  .balken { height: 6px; border-radius: 6px; background: rgba(203, 215, 235, .12); overflow: hidden; margin-top: 6px; }
  .balken i { display: block; height: 100%; border-radius: 6px; background: var(--f); transition: width 1s ease; }
  .held__a { display: flex; gap: 8px; }
  .raster { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 26px; align-items: start; }
  aside { display: grid; gap: 22px; position: sticky; top: 24px; }
  section { display: grid; gap: 10px; }
  .abschnitt { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .abschnitt h2 { font-size: 1.02rem; }
  .gw { display: grid; gap: 8px; }
  .gw__k { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; text-align: left; font: inherit; color: inherit; cursor: pointer; transition: transform .45s var(--feder-schnell), border-color .2s ease; }
  .gw__k:active { transform: scale(.97); }
  .gw__k.an { border-color: color-mix(in srgb, var(--f) 50%, transparent); }
  .gw__k > span { display: grid; line-height: 1.3; }
  .gw__k b { color: var(--text); font-weight: 500; }
  .gw__k small { color: var(--steel); font-size: .8rem; }
  .gw__k :global(.in svg) { color: var(--f); }
  .morgen { list-style: none; margin: 0; padding: 8px 12px; display: grid; }
  .morgen li { display: grid; grid-template-columns: 44px 4px minmax(0, 1fr); align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: .9rem; }
  .morgen li:last-child { border-bottom: 0; }
  .morgen li span { color: var(--steel); font-size: .82rem; text-align: right; }
  .morgen li i { width: 4px; height: 18px; border-radius: 3px; background: var(--f); }
  .morgen li b { color: var(--text-2); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .morgen .mehr { display: block; font-size: .82rem; }
  .klein { font-size: .9rem; }
  @media (max-width: 1100px) { .raster { grid-template-columns: minmax(0, 1fr); } aside { position: static; } }
</style>
