<script lang="ts">
  // Tabelle zum Selbstausfüllen: Zahlen und Begriffe eintippen, Begriffe aus dem Vorrat einsetzen.
  // Nach dem Prüfen wird jede Zelle einzeln grün oder rot, die richtige Lösung steht darunter.
  import { mdZeile } from "../../lib/lernen/md";
  import { eingaben, istEingabe, vorratVon, zelleLoesung, zelleRichtig, zufall, type TabFrage } from "../../lib/lernen/pruefen";
  let { frage, werte = $bindable([]), fertig = false, seed = 1 }: { frage: TabFrage; werte?: string[]; fertig?: boolean; seed?: number } = $props();

  const ein = $derived(eingaben(frage));
  /** Nummer der Eingabe je Zelle (Zeile, Spalte) */
  const nr = $derived(new Map(ein.map((x, n) => [`${x.i}/${x.j}`, n])));
  // Vorrat gemischt, stabil je Anzeige; jeder Eintrag ist nur einmal verwendbar
  const vorrat = $derived.by(() => { const v = vorratVon(frage), z = zufall(seed * 104729 + v.length); const a = v.map((t, k) => ({ t, k })); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(z.r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
  /** welcher Vorratseintrag in welcher Zelle steckt (Eingabenummer → Vorratsnummer) */
  let belegt = $state<Record<number, number>>({});
  let aktiv = $state<number | null>(null);
  $effect(() => { frage; belegt = {}; aktiv = null; });

  const frei = $derived(vorrat.filter((v) => !Object.values(belegt).includes(v.k)));
  const naechsteLeere = (ab: number) => { for (let d = 1; d <= ein.length; d++) { const n = (ab + d) % ein.length; if ("w" in ein[n].z && belegt[n] === undefined) return n; } return null; };
  function zelle(n: number) {
    if (fertig) return;
    if (belegt[n] !== undefined) { const b = { ...belegt }; delete b[n]; belegt = b; setze(n, ""); aktiv = n; return; }
    aktiv = aktiv === n ? null : n;
  }
  function nimm(v: { t: string; k: number }) {
    if (fertig) return;
    const n = aktiv ?? naechsteLeere(-1); if (n == null) return;
    belegt = { ...belegt, [n]: v.k }; setze(n, v.t); aktiv = naechsteLeere(n);
  }
  function setze(n: number, t: string) { const w = [...werte]; while (w.length < ein.length) w.push(""); w[n] = t; werte = w; }
  const richtig = (n: number) => zelleRichtig(ein[n].z, werte[n] ?? "");
</script>

<div class="tf" class:fertig class:breit={frage.kopf.length >= 5}>
  <div class="roll">
    <table>
      <thead><tr>{#each frage.kopf as k}<th>{@html mdZeile(k)}</th>{/each}</tr></thead>
      <tbody>
        {#each frage.zeilen as zeile, i}
          <tr>
            {#each zeile as z, j}
              {#if !istEingabe(z)}
                <td class="fest">{@html mdZeile(z)}</td>
              {:else}
                {@const n = nr.get(`${i}/${j}`)!}
                <td class="ein" class:r={fertig && richtig(n)} class:f={fertig && !richtig(n)}>
                  {#if "w" in z}
                    <button class="platz" class:an={aktiv === n} class:voll={belegt[n] !== undefined} onclick={() => zelle(n)} disabled={fertig} aria-label={werte[n] ? `Eintrag ${werte[n]} entfernen` : "Feld auswählen"}>{#if werte[n]}{@html mdZeile(werte[n])}{:else}<i>einsetzen</i>{/if}</button>
                  {:else}
                    <input class="input" class:num={"z" in z} inputmode={"z" in z ? "decimal" : "text"} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder={"z" in z ? "0" : "…"} value={werte[n] ?? ""} oninput={(e) => setze(n, e.currentTarget.value)} disabled={fertig} />
                  {/if}
                  {#if fertig && !richtig(n)}<small class="loes">{@html mdZeile(zelleLoesung(z))}</small>{/if}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if vorrat.length && !fertig}
    <div class="vorrat" aria-label="Vorrat">
      {#if frei.length}
        {#each frei as v (v.k)}<button class="chip" onclick={() => nimm(v)}>{@html mdZeile(v.t)}</button>{/each}
      {:else}<small>Alle Begriffe eingesetzt. Tippe ein Feld an, um es wieder zu leeren.</small>{/if}
    </div>
    <p class="hinweis">Feld antippen, dann den passenden Begriff wählen.{#if (frage.vorrat?.length ?? 0) > 0}{" "}Nicht jeder Begriff gehört in die Tabelle.{/if}</p>
  {/if}
  {#if frage.unter}<p class="hinweis">{@html mdZeile(frage.unter)}</p>{/if}
</div>

<style>
  .tf { display: grid; gap: 10px; }
  .roll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--line); border-radius: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th { text-align: left; padding: 9px 10px; font-size: .74rem; text-transform: uppercase; letter-spacing: .05em; color: var(--steel); background: rgba(203, 215, 235, .05); white-space: nowrap; }
  td { padding: 7px 10px; border-top: 1px solid var(--line); vertical-align: middle; }
  .fest { color: var(--text-2); line-height: 1.4; }
  .ein { min-width: 108px; }
  .ein .input { width: 100%; min-width: 86px; height: 36px; padding: 0 9px; }
  .ein .input.num { text-align: right; font-variant-numeric: tabular-nums; }
  .platz { width: 100%; min-height: 36px; padding: 6px 9px; border-radius: 10px; border: 1px dashed rgba(203, 215, 235, .28); background: transparent; color: var(--text); font: inherit; font-size: .88rem; text-align: left; line-height: 1.3; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
  .platz i { color: var(--steel); font-style: normal; opacity: .7; }
  .platz.voll { border-style: solid; background: rgba(203, 215, 235, .06); }
  .platz.an { border-color: var(--org); border-style: solid; box-shadow: 0 0 0 3px rgba(139, 124, 247, .18); }
  .ein.r .input, .ein.r .platz { border-color: rgba(79, 214, 124, .55); background: rgba(79, 214, 124, .1); opacity: 1; }
  .ein.f .input, .ein.f .platz { border-color: rgba(240, 106, 106, .55); background: rgba(240, 106, 106, .1); opacity: 1; }
  .loes { display: block; margin-top: 4px; color: #4FD67C; font-size: .8rem; font-weight: 600; line-height: 1.3; }
  .vorrat { display: flex; flex-wrap: wrap; gap: 7px; padding: 10px; border-radius: 14px; background: rgba(203, 215, 235, .04); border: 1px solid var(--line); }
  .vorrat small { color: var(--steel); }
  .chip { min-height: 34px; padding: 6px 11px; border-radius: 10px; border: 1px solid rgba(203, 215, 235, .2); background: rgba(203, 215, 235, .07); color: var(--text); font: inherit; font-size: .86rem; text-align: left; line-height: 1.3; cursor: pointer; }
  .chip:active { transform: scale(.97); }
  .hinweis { margin: 0; color: var(--steel); font-size: .8rem; }
  /* breite Tabellen: erste Spalte bleibt beim seitlichen Wischen stehen */
  .breit th:first-child, .breit td:first-child { position: sticky; left: 0; z-index: 1; background: #152036; box-shadow: 1px 0 0 var(--line); }
  @media (max-width: 700px) {
    table { font-size: .82rem; } th, td { padding: 6px 5px; } th { font-size: .66rem; letter-spacing: .03em; white-space: normal; vertical-align: bottom; }
    .ein .input.num { max-width: 104px; }
    th:first-child, td:first-child { padding-left: 8px; } th:last-child, td:last-child { padding-right: 8px; }
    .ein { min-width: 74px; } .ein .input { min-width: 62px; padding: 0 6px; } .platz { padding: 6px 7px; font-size: .82rem; }
    .breit td:first-child { max-width: 118px; }
  }
</style>
