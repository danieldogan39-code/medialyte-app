<script lang="ts">
  // Material: Dateien zur Arbeit sortiert ablegen (Vorgaben, Quellen-PDFs, Material, Entwürfe, Abgabe)
  import Icon from "../../../components/Icon.svelte";
  import { arbeiten } from "../../../lib/arbeiten/arbeiten.svelte";
  import { frage } from "../../../lib/frage.svelte";
  import { tagKurz } from "../../../lib/organizer/zeit";
  import type { Arbeit, Datei } from "../../../lib/arbeiten/typen";

  let { arbeit }: { arbeit: Arbeit } = $props();
  const KAT: [Datei["kategorie"], string, string][] = [["vorgabe", "Vorgaben", "Aufgabenstellung, Bewertungsraster, Hinweise des Dozenten"], ["quelle", "Quellen", "Aufsätze, Buchkapitel, Studien als PDF"], ["material", "Material", "Notizen, Daten, Grafiken, Mitschriften"], ["entwurf", "Entwürfe", "Deine Fassungen (.docx) – hier liegt der Verlauf"], ["abgabe", "Abgabe", "Endfassung, wie hochgeladen"]];
  let kat = $state<Datei["kategorie"]>("material");
  const alle = $derived(arbeiten.von(arbeiten.dateien, arbeit.id));
  const liste = $derived(alle.filter((d) => d.kategorie === kat));
  let ueber = $state(false), laedt = $state(false), feld = $state<HTMLInputElement>();
  async function hoch(files: FileList | File[] | null) {
    const l = [...(files ?? [])]; if (!l.length) return;
    const zuGross = l.filter((f) => f.size > 50 * 1024 * 1024);
    laedt = true; await arbeiten.hochladen(arbeit, l.filter((f) => f.size <= 50 * 1024 * 1024), kat); laedt = false;
    if (zuGross.length) alert(`${zuGross.map((f) => f.name).join(", ")}: größer als 50 MB`);
  }
  const groesse = (b: number) => (b > 1e6 ? `${(b / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
  const ikon = (d: Datei) => (/pdf/i.test(d.typ ?? d.name) ? "note" : /word|docx?$/i.test(d.typ ?? d.name) ? "stift" : /image|png|jpe?g/i.test(d.typ ?? d.name) ? "image" : "layers");
  async function weg(d: Datei) { if (await frage(`„${d.name}“ löschen?`, "Die Datei wird endgültig aus deinem Speicher entfernt.", "Löschen", true)) await arbeiten.dateiLoeschen(d); }
</script>

<div class="kat">
  {#each KAT as [k, l]}<button class:an={kat === k} onclick={() => (kat = k)}>{l}<span class="num">{alle.filter((d) => d.kategorie === k).length}</span></button>{/each}
</div>

<label class="drop card" class:ueber class:laedt
  ondragover={(e) => { e.preventDefault(); ueber = true; }} ondragleave={() => (ueber = false)}
  ondrop={(e) => { e.preventDefault(); ueber = false; hoch(e.dataTransfer?.files ?? null); }}>
  <input bind:this={feld} type="file" multiple onchange={(e) => { hoch((e.currentTarget as HTMLInputElement).files); (e.currentTarget as HTMLInputElement).value = ""; }} />
  <span class="d-ic"><Icon name="upload" size={20} /></span>
  <span><b>{laedt ? "Lädt hoch …" : `In „${KAT.find((x) => x[0] === kat)![1]}“ ablegen`}</b><small>{KAT.find((x) => x[0] === kat)![2]} · Dateien hierher ziehen oder klicken · privat in deinem Speicher</small></span>
</label>

{#if liste.length}
  <ul class="dl">
    {#each liste as d (d.id)}
      <li class="card">
        <span class="f-ic"><Icon name={ikon(d)} size={18} /></span>
        <button class="f-t" onclick={() => arbeiten.oeffnen(d)}><b>{d.name}</b><small>{groesse(d.groesse)} · {tagKurz(d.erstellt)}</small></button>
        <select class="input" value={d.kategorie} onchange={(e) => arbeiten.dateiAendern(d, { kategorie: (e.currentTarget as HTMLSelectElement).value as Datei["kategorie"] })} aria-label="Kategorie">
          {#each KAT as [k, l]}<option value={k}>{l}</option>{/each}
        </select>
        {#if /docx$/i.test(d.name)}<a class="btn btn--s btn--quiet" href={`#/o/arbeiten/${arbeit.id}/pruefen?datei=${d.id}`} onclick={() => sessionStorage.setItem("arb:pruefe", d.id)}><Icon name="check" size={14} />Prüfen</a>{/if}
        <button class="btn btn--quiet btn--icon" aria-label="Löschen" onclick={() => weg(d)}><Icon name="trash" size={16} /></button>
      </li>
    {/each}
  </ul>
{:else}
  <p class="muted leer">Noch nichts in „{KAT.find((x) => x[0] === kat)![1]}“.</p>
{/if}

<style>
  .kat { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .kat button { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); font: inherit; font-size: .88rem; cursor: pointer; }
  .kat button span { font-size: .76rem; color: var(--steel); }
  .kat button.an { background: rgba(231, 185, 74, .16); border-color: rgba(231, 185, 74, .5); color: var(--text); font-weight: 600; }
  .drop { display: flex; align-items: center; gap: 14px; padding: 18px; border-radius: 18px; border: 1.5px dashed var(--line-2); cursor: pointer; transition: border-color .2s, background .2s; }
  .drop input { display: none; }
  .drop.ueber { border-color: var(--warn); background: rgba(231, 185, 74, .08); }
  .drop.laedt { opacity: .7; pointer-events: none; }
  .drop > span:last-child { display: grid; }
  .drop small { color: var(--steel); font-size: .82rem; }
  .d-ic { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; background: rgba(231, 185, 74, .16); color: var(--warn); flex: none; }
  .dl { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
  .dl li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; }
  .f-ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--bg-2); color: var(--text-2); flex: none; }
  .f-t { display: grid; flex: 1; min-width: 0; text-align: left; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; padding: 0; }
  .f-t b { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .f-t:hover b { text-decoration: underline; }
  .f-t small { color: var(--steel); font-size: .78rem; }
  .dl select { width: auto; min-height: 32px; padding: 4px 8px; font-size: .84rem; }
  .leer { margin-top: 12px; }
  @media (max-width: 560px) { .dl select { display: none; } }
</style>
