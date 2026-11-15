<script lang="ts">
  // Hausarbeiten: Übersicht aller Arbeiten oder eine Arbeit im Detail (Reiter)
  import Icon from "../../../components/Icon.svelte";
  import { router } from "../../../lib/router.svelte";
  import { arbeiten } from "../../../lib/arbeiten/arbeiten.svelte";
  import { org } from "../../../lib/organizer/org.svelte";
  import { countdown, tageBis, tagLang } from "../../../lib/organizer/zeit";
  import { fachFuer } from "../../../lib/organizer/schnell";
  import ArbeitSeite from "./ArbeitSeite.svelte";

  $effect(() => { arbeiten.laden(); });
  const id = $derived(router.teile[2] ?? "");
  const STATUS: Record<string, string> = { idee: "Idee", recherche: "Recherche", schreiben: "Schreiben", korrektur: "Korrektur", abgegeben: "Abgegeben" };
  const offen = $derived((arbeiten.regelwerk?.arbeiten ?? []).filter((v) => !arbeiten.liste.some((a) => a.titel === v.titel)));

  async function uebernehmen(v: NonNullable<typeof arbeiten.regelwerk>["arbeiten"][number]) {
    const fach = fachFuer(org.faecher, v.modul);
    const a = await arbeiten.speichern({ titel: v.titel, art: v.art, abgabe: v.abgabe, woerter_ziel: v.woerter_ziel, toleranz: v.toleranz, min_quellen: v.min_quellen, max_zitate: v.max_zitate, aufgabe: v.aufgabe, fach_id: fach?.id ?? null });
    if (a) router.geh("/o/arbeiten/" + a.id);
  }
  let neuTitel = $state("");
  async function neu(e: Event) { e.preventDefault(); if (!neuTitel.trim()) return; const a = await arbeiten.speichern({ titel: neuTitel }); if (a) { neuTitel = ""; router.geh("/o/arbeiten/" + a.id); } }
  const letzte = (aid: string) => arbeiten.pruefungen.find((p) => p.arbeit_id === aid);
</script>

{#if id}
  {#key id}<ArbeitSeite {id} />{/key}
{:else}
  <header class="kopf">
    <div><h1>Hausarbeiten</h1><p class="muted">Vorgaben, Material, Quellen und ein Prüfer, der deine Arbeit gegen die Regeln der ISM checkt.</p></div>
    <form class="neu" onsubmit={neu}><input class="input" placeholder="Neue Arbeit …" bind:value={neuTitel} maxlength="300" /><button class="btn btn--primary org-primary" disabled={!neuTitel.trim()}><Icon name="plus" size={15} />Anlegen</button></form>
  </header>

  {#if offen.length}
    <section class="moodle">
      <h2>Aus Moodle – noch nicht angelegt</h2>
      <div class="m-liste">
        {#each offen as v (v.id)}
          <button class="m card" onclick={() => uebernehmen(v)}>
            <span class="m-ic"><Icon name="download" size={16} /></span>
            <span class="m-t"><b>{v.titel}</b><small>{v.modul}{v.woerter_ziel ? ` · ${v.woerter_ziel.toLocaleString("de-DE")} Wörter` : ""}{v.abgabe ? ` · bis ${tagLang(v.abgabe)}` : ""}</small></span>
            <span class="btn btn--s">Übernehmen</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if !arbeiten.liste.length && !offen.length}
    <div class="empty"><Icon name="stift" size={28} /><b>Noch keine Hausarbeit</b><span>Leg oben eine an – Vorgaben der ISM sind schon hinterlegt.</span></div>
  {/if}

  <div class="liste">
    {#each arbeiten.liste as a (a.id)}
      {@const n = a.abgabe ? tageBis(a.abgabe) : null}
      {@const p = letzte(a.id)}
      {@const f = org.farbe(a.fach_id, "#E7B94A")}
      <a class="ak card" href={"#/o/arbeiten/" + a.id} style="--f: {f}">
        <div class="ak__k">
          <span class="ak__t"><small>{org.fach(a.fach_id)?.name ?? "Ohne Fach"} · {STATUS[a.status]}</small><b>{a.titel}</b>{#if a.thema}<span class="muted">{a.thema}</span>{/if}</span>
          {#if n != null}<span class="tage num" class:bald={n <= 7}>{Math.max(0, n)}<small>{n === 1 ? "Tag" : "Tage"}</small></span>{/if}
        </div>
        <div class="ak__s">
          {#if a.abgabe}<span><Icon name="calendar" size={14} />{countdown(n ?? 0)} · {tagLang(a.abgabe)}</span>{/if}
          {#if a.woerter_ziel}<span><Icon name="stift" size={14} />{p?.woerter ? `${p.woerter.toLocaleString("de-DE")} / ` : ""}{a.woerter_ziel.toLocaleString("de-DE")} Wörter</span>{/if}
          <span><Icon name="note" size={14} />{arbeiten.von(arbeiten.quellen, a.id).length} Quellen</span>
          {#if p}<span class:rot={p.fehler > 0} class:gruen={p.fehler === 0}><Icon name={p.fehler ? "x" : "check"} size={14} />{p.fehler ? `${p.fehler} Fehler` : "Prüfung bestanden"}</span>{/if}
        </div>
      </a>
    {/each}
  </div>
{/if}

<style>
  .kopf { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
  .kopf h1 { margin: 0; } .kopf p { margin: 4px 0 0; }
  .neu { display: flex; gap: 8px; flex: 0 1 420px; }
  .neu .input { flex: 1; }
  h2 { font-size: .95rem; color: var(--text-2); margin: 0 0 10px; font-weight: 600; }
  .moodle { margin-bottom: 20px; }
  .m-liste { display: grid; gap: 8px; }
  .m { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; color: inherit; font: inherit; text-align: left; cursor: pointer; border-style: dashed; border-color: rgba(231, 185, 74, .45); background: rgba(231, 185, 74, .05); }
  .m:hover { background: rgba(231, 185, 74, .1); }
  .m-ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: rgba(231, 185, 74, .16); color: var(--warn); flex: none; }
  .m-t { display: grid; flex: 1; min-width: 0; }
  .m-t small { color: var(--steel); font-size: .8rem; }
  .liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 14px; }
  .ak { display: grid; gap: 12px; padding: 16px; border-radius: 20px; text-decoration: none; color: inherit; position: relative; overflow: hidden; background: linear-gradient(160deg, color-mix(in srgb, var(--f) 10%, var(--panel)), var(--panel) 60%); }
  .ak::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--f); }
  .ak__k { display: flex; justify-content: space-between; gap: 12px; }
  .ak__t { display: grid; gap: 2px; min-width: 0; }
  .ak__t small { color: color-mix(in srgb, var(--f) 75%, var(--text-2)); font-weight: 600; font-size: .74rem; text-transform: uppercase; letter-spacing: .04em; }
  .ak__t b { font-size: 1.08rem; }
  .ak__t .muted { font-size: .86rem; }
  .tage { display: grid; justify-items: center; font-size: 1.6rem; font-weight: 700; color: var(--f); line-height: 1; flex: none; }
  .tage small { font-size: .68rem; font-weight: 600; }
  .tage.bald { color: #F27A6A; }
  .ak__s { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: .84rem; color: var(--text-2); }
  .ak__s span { display: inline-flex; align-items: center; gap: 6px; }
  .rot { color: #F27A6A; } .gruen { color: var(--ok); }
</style>
