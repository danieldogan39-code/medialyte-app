<script lang="ts">
  // Kundenkategorien selbst festlegen: Name, Farbe, Reihenfolge; löschen nimmt die Kategorie auch von allen Kunden
  import Blatt from "./Blatt.svelte";
  import Icon from "../Icon.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { federKurve } from "../../lib/bewegung";

  let { zu }: { zu: () => void } = $props();
  const FARBEN = ["#6FA8F0", "#4CC38A", "#E7B94A", "#F24A4A", "#A78BFA", "#F08FC0", "#4FC7D4", "#F2A54A", "#8B98AD"];
  const f = federKurve(0.45, 0.1);
  let neu = $state(""), neuFarbe = $state(FARBEN[0]);
  const liste = $derived([...R.kategorien].sort((a, b) => a.sortierung - b.sortierung || a.name.localeCompare(b.name, "de")));
  const anzahl = (id: string) => R.customers.filter((c) => (c.kategorien ?? []).includes(id)).length;

  const anlegen = () => versuche(async () => {
    const name = neu.trim(); if (!name) return;
    if (R.kategorien.some((k) => k.name.trim().toLowerCase() === name.toLowerCase())) throw new Error(`„${name}“ gibt es schon.`);
    const { error } = await R.write("kundenkategorien", "insert", { name, farbe: neuFarbe, sortierung: (liste.at(-1)?.sortierung ?? 0) + 10 });
    if (error) throw error;
    neu = ""; neuFarbe = FARBEN[(FARBEN.indexOf(neuFarbe) + 1) % FARBEN.length];
  });
  const aendern = (id: string, werte: Record<string, unknown>) => versuche(async () => {
    const { error } = await R.write("kundenkategorien", "update", werte, [["id", id]]); if (error) throw error;
  });
  const umbenennen = (k: any, e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (v && v !== k.name) aendern(k.id, { name: v }); };
  const schieben = (i: number, d: number) => versuche(async () => {
    const a = liste[i], b = liste[i + d]; if (!a || !b) return;
    await R.write("kundenkategorien", "update", { sortierung: b.sortierung }, [["id", a.id]]);
    await R.write("kundenkategorien", "update", { sortierung: a.sortierung === b.sortierung ? b.sortierung + d : a.sortierung }, [["id", b.id]]);
  });
  const loeschen = (k: any) => versuche(async () => {
    const n = anzahl(k.id);
    if (!(await frage(`„${k.name}“ löschen?`, n ? `${n} ${n === 1 ? "Kunde verliert" : "Kunden verlieren"} diese Kategorie. Die Kunden selbst bleiben.` : "Die Kategorie wird entfernt.", "Löschen", true))) return;
    for (const c of R.customers.filter((c) => (c.kategorien ?? []).includes(k.id)))
      await R.write("customers", "update", { kategorien: (c.kategorien ?? []).filter((x: string) => x !== k.id) }, [["id", c.id]]);
    const { error } = await R.write("kundenkategorien", "delete", undefined, [["id", k.id]]); if (error) throw error;
    daten.melden(`„${k.name}“ gelöscht`);
  });
</script>

<Blatt titel="Kundenkategorien" {zu}>
  <p class="muted klein">Ordne deine Kunden so, wie du arbeitest – zum Beispiel nach Leistung (Website, Werbung) oder Art (Stammkunde, Gastronomie). Ein Kunde kann mehrere Kategorien haben. Website-Kunden aus dem Agenten zählen automatisch zu „Website“.</p>
  <div class="liste">
    {#each liste as k, i (k.id)}
      <div class="kat" animate:flip={{ duration: f.ms, easing: f.easing }} in:fly={{ y: 8, duration: f.ms, easing: f.easing }}>
        <details class="farbe">
          <summary style="background: {k.farbe}" aria-label="Farbe ändern"></summary>
          <div class="farben">{#each FARBEN as x}<button type="button" style="background: {x}" class:an={x === k.farbe} aria-label="Farbe {x}" onclick={(e) => { aendern(k.id, { farbe: x }); (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open"); }}></button>{/each}</div>
        </details>
        <input class="input" value={k.name} aria-label="Name der Kategorie" maxlength="40" onchange={(e) => umbenennen(k, e)}>
        <span class="n muted">{anzahl(k.id)}</span>
        <button class="btn btn--quiet btn--icon" aria-label="Nach oben" disabled={i === 0} onclick={() => schieben(i, -1)}><span class="pf hoch">‹</span></button>
        <button class="btn btn--quiet btn--icon" aria-label="Nach unten" disabled={i === liste.length - 1} onclick={() => schieben(i, 1)}><span class="pf">‹</span></button>
        <button class="btn btn--quiet btn--icon del" aria-label="Kategorie löschen" onclick={() => loeschen(k)}><Icon name="trash" size={16} /></button>
      </div>
    {:else}<p class="muted klein">Noch keine Kategorien.</p>{/each}
  </div>
  <form class="neu" onsubmit={(e) => { e.preventDefault(); anlegen(); }}>
    <span class="punkt" style="background: {neuFarbe}"></span>
    <input class="input" placeholder="Neue Kategorie, z. B. Stammkunde" bind:value={neu} maxlength="40" aria-label="Neue Kategorie">
    <button class="btn btn--primary" type="submit" disabled={!neu.trim()}><Icon name="plus" size={16} />Hinzufügen</button>
  </form>
</Blatt>

<style>
  .klein { font-size: .86rem; margin: 0; line-height: 1.5; }
  .liste { display: grid; gap: 6px; }
  .kat { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto auto; gap: 6px; align-items: center; padding: 6px; border-radius: var(--radius-s); background: var(--bg-2); border: 1px solid var(--line); }
  .farbe { position: relative; }
  .farbe summary { list-style: none; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .15); transition: transform .4s var(--feder-schnell); }
  .farbe summary::-webkit-details-marker { display: none; }
  .farbe summary:active { transform: scale(.88); }
  .farben { position: absolute; z-index: 5; top: 34px; left: 0; display: grid; grid-template-columns: repeat(5, 26px); gap: 8px; padding: 10px; border-radius: 14px; background: var(--panel-2); border: 1px solid var(--line-2);
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, .8); transform-origin: top left; animation: auf .38s var(--feder); }
  @keyframes auf { from { opacity: 0; transform: scale(.9) translateY(-4px); } }
  .farben button { width: 26px; height: 26px; border-radius: 50%; border: 0; cursor: pointer; transition: transform .35s var(--feder-schnell); }
  .farben button:active { transform: scale(.85); }
  .farben button.an { box-shadow: 0 0 0 2px var(--panel-2), 0 0 0 4px var(--text); }
  .kat .input { min-height: 34px; }
  .n { min-width: 22px; text-align: center; font-size: .8rem; }
  .pf { display: inline-block; transform: rotate(-90deg); font-size: 1.2rem; line-height: 1; }
  .pf.hoch { transform: rotate(90deg); }
  .del { color: #FF8080; }
  .neu { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; }
  .punkt { width: 14px; height: 14px; border-radius: 50%; margin: 0 6px; transition: background-color .3s ease; }
</style>
