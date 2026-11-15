<script lang="ts">
  import Icon from "../../components/Icon.svelte";
  import Ring from "../../components/organizer/Ring.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { plusTage, tagKey, wochenBeginn, wt, dm } from "../../lib/organizer/zeit";
  import type { Gewohnheit } from "../../lib/organizer/typen";

  const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  let woche = $state(0);   // 0 = diese Woche, -1 = letzte …
  const mo = $derived(plusTage(wochenBeginn(org.jetzt), woche * 7));
  const tage = $derived(Array.from({ length: 7 }, (_, i) => plusTage(mo, i)));
  const heute = $derived(tagKey(org.jetzt));
  const verlauf = (g: Gewohnheit) => Array.from({ length: 10 }, (_, i) => { const w = plusTage(wochenBeginn(org.jetzt), -(9 - i) * 7); return { w, n: org.wocheStand(g, w.getTime()).erreicht }; });
  const plan = (g: Gewohnheit) => [g.pro_woche + "× pro Woche", g.tage.length ? g.tage.map((t) => TAGE[t - 1]).join(", ") : "", g.uhrzeit ? g.uhrzeit.slice(0, 5) + " Uhr" : ""].filter(Boolean).join(" · ");
</script>

<div class="kopf">
  <div><h1>Gewohnheiten</h1><p class="muted">Dranbleiben, Woche für Woche. Tipp auf einen Tag zum Abhaken.</p></div>
  <button class="btn btn--primary org-primary" onclick={() => blatt.auf({ art: "gewohnheit" })}><Icon name="plus" size={16} />Neue Gewohnheit</button>
</div>

{#if !org.gewohnheiten.length}
  <button class="vorschlag card" onclick={() => blatt.auf({ art: "gewohnheit", g: { name: "Training", pro_woche: 3, tage: [2, 5, 7], uhrzeit: "16:30", dauer_min: 90, icon: "dumbbell", farbe: "#4CC38A" } })}>
    <span class="vi"><Icon name="dumbbell" size={22} /></span>
    <span><b>Training 3× pro Woche anlegen</b><small>Di, Fr und So um 16:30 – die Auto-Planung hält die Zeit frei. Anpassen kannst du alles.</small></span>
    <Icon name="plus" size={18} />
  </button>
{:else}
  <div class="wochenwahl">
    <button class="btn btn--icon btn--quiet" aria-label="Vorige Woche" onclick={() => woche--}><Icon name="left" size={18} /></button>
    <span>{woche === 0 ? "Diese Woche" : woche === -1 ? "Letzte Woche" : `${dm(tage[0])} – ${dm(tage[6])}`}</span>
    <button class="btn btn--icon btn--quiet" aria-label="Nächste Woche" disabled={woche >= 0} onclick={() => woche++}><Icon name="right" size={18} /></button>
  </div>
  <div class="liste">
    {#each org.gewohnheiten as g (g.id)}
      {@const s = org.wocheStand(g, mo.getTime())}
      {@const serie = org.serie(g)}
      <article class="gk card" class:aus={!g.aktiv} style="--f: {g.farbe}">
        <div class="gk__k">
          <Ring wert={s.erreicht / s.ziel} size={54} dicke={5} farbe={g.farbe}><Icon name={g.icon} size={20} /></Ring>
          <div class="gk__t"><b>{g.name}</b><small>{plan(g)}</small></div>
          <button class="btn btn--quiet btn--icon" aria-label="Bearbeiten" onclick={() => blatt.auf({ art: "gewohnheit", g })}><Icon name="stift" size={16} /></button>
        </div>
        <div class="tage">
          {#each tage as d, i (tagKey(d))}
            {@const k = tagKey(d)}
            {@const an = org.hatLog(g, k)}
            <button class="tag" class:an class:heute={k === heute} class:soll={g.tage.includes(i + 1)} disabled={k > heute} aria-pressed={an} aria-label="{wt(d)} {dm(d)}" onclick={() => org.abhaken(g, k)}>
              <small>{TAGE[i]}</small><span>{#if an}<Icon name="check" size={15} />{:else}{d.getDate()}{/if}</span>
            </button>
          {/each}
        </div>
        <div class="fuss">
          <span class="stand"><b class="num">{s.erreicht}</b> von {s.ziel}{s.erreicht >= s.ziel ? " – geschafft" : ""}</span>
          {#if serie > 0}<span class="serie"><Icon name="flame" size={14} />{serie} {serie === 1 ? "Woche" : "Wochen"} in Folge</span>{/if}
          <span class="verlauf" aria-label="Letzte 10 Wochen">
            {#each verlauf(g) as v}<i style="height: {Math.max(3, Math.min(1, v.n / g.pro_woche) * 22)}px" class:voll={v.n >= g.pro_woche} title="{dm(v.w)}: {v.n}×"></i>{/each}
          </span>
        </div>
      </article>
    {/each}
  </div>
{/if}

<style>
  .kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .vorschlag { display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px; text-align: left; font: inherit; color: inherit; cursor: pointer; border-style: dashed; border-color: rgba(76, 195, 138, .45); }
  .vorschlag > span:nth-child(2) { flex: 1; display: grid; gap: 3px; }
  .vorschlag b { color: var(--text); }
  .vorschlag small { color: var(--text-2); }
  .vi { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: var(--ok); color: #0A1220; }
  .wochenwahl { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; color: var(--text-2); font-weight: 500; }
  .liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
  .gk { display: grid; gap: 14px; padding: 16px; border-radius: 20px; }
  .gk.aus { opacity: .55; }
  .gk__k { display: flex; align-items: center; gap: 14px; }
  .gk__k :global(.in svg) { color: var(--f); }
  .gk__t { flex: 1; display: grid; gap: 2px; min-width: 0; }
  .gk__t b { color: var(--text); font-size: 1.05rem; font-weight: 600; }
  .gk__t small { color: var(--steel); font-size: .82rem; }
  .tage { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .tag { display: grid; justify-items: center; gap: 4px; padding: 0; border: 0; background: none; color: var(--text-2); font: inherit; cursor: pointer; }
  .tag small { font-size: .7rem; color: var(--steel); }
  .tag span { width: 100%; aspect-ratio: 1; max-width: 42px; border-radius: 12px; display: grid; place-items: center; font-size: .9rem; background: var(--bg-2); border: 1px solid var(--line);
    transition: background-color .25s ease, border-color .25s ease, transform .45s var(--feder-schnell), color .2s ease; }
  .tag.soll span { border-color: color-mix(in srgb, var(--f) 45%, transparent); border-style: dashed; }
  .tag.heute small { color: var(--text); font-weight: 600; }
  .tag.an span { background: var(--f); border-color: var(--f); border-style: solid; color: #0A1220; }
  .tag.an span :global(svg) { animation: hak .45s var(--feder); }
  @keyframes hak { from { transform: scale(.3); } }
  .tag:active:not(:disabled) span { transform: scale(.88); }
  .tag:disabled { opacity: .35; cursor: default; }
  .fuss { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: .84rem; color: var(--steel); }
  .stand b { color: var(--text); font-size: 1rem; }
  .serie { display: inline-flex; align-items: center; gap: 4px; color: #FFB86B; font-weight: 500; }
  .verlauf { margin-left: auto; display: flex; align-items: flex-end; gap: 3px; height: 22px; }
  .verlauf i { width: 6px; border-radius: 3px; background: color-mix(in srgb, var(--f) 35%, transparent); }
  .verlauf i.voll { background: var(--f); }
  @media (max-width: 520px) { .liste { grid-template-columns: minmax(0, 1fr); } }
</style>
