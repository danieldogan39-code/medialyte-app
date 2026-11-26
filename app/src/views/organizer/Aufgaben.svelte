<script lang="ts">
  import Icon from "../../components/Icon.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { blatt } from "../../lib/organizer/blatt.svelte";
  import { erkennen } from "../../lib/organizer/schnell";
  import { gleiter } from "../../lib/bewegung";
  import { dauer, relativTag, tageBis, tagKey, uhr, wochenBeginn, plusTage } from "../../lib/organizer/zeit";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { federKurve, ruhig } from "../../lib/bewegung";
  import type { Aufgabe } from "../../lib/organizer/typen";

  let ansicht = $state<"offen" | "erledigt">("offen"), gruppe = $state<"zeit" | "fach">("zeit"), filter = $state<string | null>(null), eingabe = $state("");
  const fl = federKurve(0.45, 0.05);
  const e = $derived(erkennen(eingabe, org.faecher));

  const liste = $derived(org.aufgaben.filter((a) => (ansicht === "offen" ? !a.erledigt : !!a.erledigt) && (!filter || a.fach_id === filter)));
  const gruppen = $derived.by(() => {
    if (ansicht === "erledigt") return [{ k: "e", titel: "Erledigt", l: [...liste].sort((a, b) => (b.erledigt ?? "").localeCompare(a.erledigt ?? "")) }];
    if (gruppe === "fach") {
      const m = new Map<string, Aufgabe[]>();
      for (const a of liste) { const k = a.fach_id ?? "-"; m.set(k, [...(m.get(k) ?? []), a]); }
      return [...m.entries()].map(([k, l]) => ({ k, titel: org.fach(k)?.name ?? "Ohne Fach", l: l.sort(sortieren) })).sort((a, b) => a.titel.localeCompare(b.titel));
    }
    const j = org.jetzt, heute = tagKey(j), wEnde = plusTage(wochenBeginn(j), 7).getTime();
    const g = { liegen: [] as Aufgabe[], ohne: [] as Aufgabe[], heute: [] as Aufgabe[], woche: [] as Aufgabe[], spaeter: [] as Aufgabe[] };
    for (const a of liste) {
      if (!a.geplant) g.ohne.push(a);
      else if (Date.parse(a.geplant) + a.dauer_min * 6e4 < j) g.liegen.push(a);
      else if (tagKey(a.geplant) === heute) g.heute.push(a);
      else if (Date.parse(a.geplant) < wEnde) g.woche.push(a);
      else g.spaeter.push(a);
    }
    return [
      { k: "liegen", titel: "Liegengeblieben", l: g.liegen }, { k: "ohne", titel: "Noch ohne Zeit", l: g.ohne }, { k: "heute", titel: "Heute", l: g.heute },
      { k: "woche", titel: "Diese Woche", l: g.woche }, { k: "spaeter", titel: "Später", l: g.spaeter },
    ].map((x) => ({ ...x, l: x.l.sort(sortieren) })).filter((x) => x.l.length);
  });
  function sortieren(a: Aufgabe, b: Aufgabe) { return (a.geplant ?? "9").localeCompare(b.geplant ?? "9") || (a.frist ?? "9").localeCompare(b.frist ?? "9") || a.prio - b.prio; }
  const summe = $derived(org.offen.reduce((n, a) => n + a.dauer_min, 0));

  async function schnell(ev: Event) {
    ev.preventDefault();
    if (!e.titel) return;
    const r = await org.aufgabeSpeichern({ titel: e.titel, fach_id: e.fach?.id ?? filter ?? null, dauer_min: e.dauer_min ?? 60, frist: e.frist ?? (e.geplant ? tagKey(e.geplant) : null), prio: e.prio,
      geplant: e.geplant?.toISOString() ?? null, fixiert: !!e.geplant });
    if (r) eingabe = "";
  }
  const fristTon = (a: Aufgabe) => { if (!a.frist || a.erledigt) return ""; const n = tageBis(a.frist); return n < 0 ? "rot" : n <= 2 ? "gelb" : ""; };
</script>

<div class="kopf">
  <div><h1>Aufgaben</h1><p class="muted">{org.offen.length} offen · zusammen {dauer(summe)}</p></div>
  <button class="btn btn--primary org-primary" disabled={org.plant} onclick={() => org.planen()}><Icon name="wand" size={16} />{org.plant ? "Plant …" : "Alles automatisch planen"}</button>
</div>

<form class="schnell card" onsubmit={schnell}>
  <Icon name="plus" size={18} />
  <input bind:value={eingabe} placeholder="Neue Aufgabe – z. B. „Mathe Kapitel 5 90min bis Fr !“" enterkeyhint="done" autocomplete="off">
  {#if eingabe.trim()}<span class="erk">{#each e.teile as t}<span class="pill pill--plain">{t}</span>{/each}</span><button class="btn btn--s btn--primary org-primary" type="submit">Anlegen</button>{/if}
</form>

<div class="leiste">
  <div class="seg" role="tablist" use:gleiter>
    <button role="tab" aria-selected={ansicht === "offen"} onclick={() => (ansicht = "offen")}>Offen</button>
    <button role="tab" aria-selected={ansicht === "erledigt"} onclick={() => (ansicht = "erledigt")}>Erledigt</button>
  </div>
  {#if ansicht === "offen"}
    <div class="seg" role="tablist" use:gleiter>
      <button role="tab" aria-selected={gruppe === "zeit"} onclick={() => (gruppe = "zeit")}><Icon name="clock" size={14} />Zeit</button>
      <button role="tab" aria-selected={gruppe === "fach"} onclick={() => (gruppe = "fach")}><Icon name="layers" size={14} />Fach</button>
    </div>
  {/if}
  <div class="filter">
    {#each org.aktiveFaecher as f (f.id)}<button class="fchip" class:on={filter === f.id} style="--c: {f.farbe}" onclick={() => (filter = filter === f.id ? null : f.id)}><i></i>{f.name}</button>{/each}
  </div>
</div>

{#if !gruppen.length}
  <div class="empty"><Icon name="check" size={28} /><b>{ansicht === "offen" ? "Nichts offen" : "Noch nichts erledigt"}</b><span>{ansicht === "offen" ? "Tipp oben eine Aufgabe ein – die App plant sie in deine freie Zeit." : "Abgehakte Aufgaben landen hier."}</span></div>
{/if}
{#each gruppen as g (g.k)}
  <section>
    <h2 class:warn={g.k === "liegen"}>{g.titel}<span class="num">{g.l.length}</span>
      {#if g.k === "liegen" || g.k === "ohne"}<button class="btn btn--quiet btn--s" disabled={org.plant} onclick={() => org.planen(new Set(g.l.map((a) => a.id)), false, g.k === "liegen")}><Icon name="wand" size={14} />Einplanen</button>{/if}</h2>
    <ul class="liste">
      {#each g.l as a (a.id)}
        <li animate:flip={{ duration: ruhig() ? 0 : fl.ms, easing: fl.easing }} in:fly={{ y: ruhig() ? 0 : 6, duration: 220 }}>
          <div class="zeile" style="--f: {org.farbe(a.fach_id, '#8E7CFF')}" role="button" tabindex="0" onclick={() => blatt.auf({ art: "aufgabe", a })} onkeydown={(ev) => { if (ev.key === "Enter") blatt.auf({ art: "aufgabe", a }); }}>
            <button class="haken" class:an={!!a.erledigt} aria-label={a.erledigt ? "Wieder öffnen" : "Erledigt"} onclick={(ev) => { ev.stopPropagation(); org.erledigen(a); }}><Icon name="check" size={15} /></button>
            <span class="txt">
              <b>{#if a.prio === 1}<span class="prio" title="Wichtig">!</span>{/if}{a.titel}</b>
              <small>
                {#if org.fach(a.fach_id)}<span class="fach"><i></i>{org.fach(a.fach_id)?.name}</span>{/if}
                <span>{dauer(a.dauer_min)}</span>
                {#if a.geplant && !a.erledigt}<span>{a.fixiert ? "📌 " : ""}{relativTag(a.geplant)} {uhr(a.geplant)}</span>{/if}
                {#if a.frist && !a.erledigt}<span class="frist {fristTon(a)}">bis {relativTag(a.frist)}</span>{/if}
                {#if a.erledigt}<span>erledigt {relativTag(a.erledigt)}</span>{/if}
              </small>
            </span>
            <Icon name="right" size={16} />
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
  .schnell { display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 14px; border-radius: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .schnell :global(svg) { color: var(--org); flex: none; }
  .schnell input { flex: 1 1 240px; min-height: 42px; border: 0; background: transparent; color: var(--text); outline: none; font-size: 1rem; }
  .erk { display: flex; gap: 4px; flex-wrap: wrap; }
  .leiste { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }
  .seg { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); --bereich: var(--org); }
  .seg button { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font: inherit; font-size: .88rem; cursor: pointer; }
  .seg button[aria-selected="true"] { color: #fff; font-weight: 600; }
  .filter { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; flex: 1; }
  .fchip { flex: none; display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); font: inherit; font-size: .84rem; cursor: pointer; }
  .fchip i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .fchip.on { border-color: var(--c); color: var(--text); background: color-mix(in srgb, var(--c) 16%, transparent); }
  section { margin-bottom: 22px; }
  h2 { display: flex; align-items: center; gap: 8px; font-size: .95rem; margin-bottom: 8px; color: var(--text-2); }
  h2 span { color: var(--steel); font-weight: 500; font-size: .85rem; }
  h2 .btn { margin-left: auto; }
  h2.warn { color: var(--warn); }
  .liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .zeile { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); cursor: pointer; transition: transform .45s var(--feder-schnell), background-color .2s ease; }
  .zeile > :global(svg:last-child) { color: var(--steel); flex: none; }
  .zeile:active { transform: scale(.985); }
  @media (hover: hover) and (pointer: fine) { .zeile:hover { background: var(--panel-2); } }
  .txt { flex: 1; display: grid; gap: 3px; min-width: 0; }
  .txt b { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .txt small { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--steel); font-size: .8rem; }
  .fach { display: inline-flex; align-items: center; gap: 5px; color: var(--text-2); }
  .fach i { width: 7px; height: 7px; border-radius: 50%; background: var(--f); }
  .frist.gelb { color: var(--warn); } .frist.rot { color: #FF8080; }
  .prio { color: var(--coral-2); font-weight: 700; margin-right: 6px; }
  .haken { flex: none; width: 28px; height: 28px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--f) 70%, var(--line-2)); background: transparent; color: transparent; display: grid; place-items: center; cursor: pointer;
    transition: background-color .25s ease, color .25s ease, transform .4s var(--feder-schnell); }
  .haken.an { background: var(--f); border-color: var(--f); color: #0A1220; }
  .haken:active { transform: scale(.85); }
  .empty :global(svg) { color: var(--org); }
  /* Handy: Titel dürfen zwei Zeilen haben, statt mitten im Wort abgeschnitten zu werden */
  @media (max-width: 700px) { .txt b { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; } .zeile { padding: 12px; } }
</style>
