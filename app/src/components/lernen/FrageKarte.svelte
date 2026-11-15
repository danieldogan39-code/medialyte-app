<script lang="ts">
  // Eine Abfrage: Multiple Choice, Richtig/Falsch, Rechenaufgabe, Buchungssatz, Zuordnung, Reihenfolge, Karteikarte, Freitext.
  // modus „lernen“: sofort Rückmeldung mit Erklärung. modus „pruefung“: Antwort wird nur gespeichert.
  import Icon from "../Icon.svelte";
  import { md, mdZeile } from "../../lib/lernen/md";
  import { bewerten, de, loesungText, teilpunkte, toleranz, zufall, type Antwort } from "../../lib/lernen/pruefen";
  import type { Frage } from "../../lib/lernen/typen";
  let { frage, modus = "lernen", seed = 1, onfertig }: { frage: Frage; modus?: "lernen" | "pruefung"; seed?: number; onfertig: (anteil: number, a: Antwort) => void } = $props();

  // gemischte Reihenfolge, stabil je Anzeige
  function mischen(n: number) { const z = zufall(seed * 7919 + n), a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(z.r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const ordnung = $derived(frage.typ === "mc" ? mischen(frage.optionen.length) : frage.typ === "reihe" ? mischen(frage.elemente.length) : []);

  let wahl = $state<number[]>([]);
  let wahrWahl = $state<boolean | null>(null);
  let text = $state("");
  let soll = $state<[string, string][]>([["", ""]]), haben = $state<[string, string][]>([["", ""]]);
  let zu = $state<(number | null)[]>([]);
  let folge = $state<number[]>([]);
  let aufgedeckt = $state(false), freiText = $state("");
  let ergebnis = $state<{ anteil: number; a: Antwort } | null>(null);
  let feld = $state<HTMLInputElement>();

  $effect(() => {
    frage; wahl = []; wahrWahl = null; text = ""; soll = [["", ""]]; haben = [["", ""]]; aufgedeckt = false; freiText = ""; ergebnis = null;
    zu = frage.typ === "zuordnen" ? frage.elemente.map(() => null) : [];
    folge = frage.typ === "reihe" ? [...ordnung] : [];
    if (frage.typ === "buchung") { soll = frage.soll.map(() => ["", ""] as [string, string]); haben = frage.haben.map(() => ["", ""] as [string, string]); }
    if (frage.typ === "zahl") queueMicrotask(() => feld?.focus({ preventScroll: true }));
  });

  const mehrere = $derived(frage.typ === "mc" && frage.richtig.length > 1);
  const bereit = $derived.by(() => {
    switch (frage.typ) {
      case "mc": return wahl.length > 0;
      case "wahr": return wahrWahl != null;
      case "zahl": return text.trim().length > 0;
      case "buchung": return soll.some(([k, b]) => k && b) && haben.some(([k, b]) => k && b);
      case "zuordnen": return zu.every((x) => x != null);
      case "reihe": return true;
      default: return false;
    }
  });

  function antwortVon(): Antwort {
    switch (frage.typ) {
      case "mc": return { typ: "mc", wahl };
      case "wahr": return { typ: "wahr", wahl: !!wahrWahl };
      case "zahl": return { typ: "zahl", text };
      case "buchung": return { typ: "buchung", soll, haben };
      case "zuordnen": return { typ: "zuordnen", wahl: zu };
      case "reihe": return { typ: "reihe", folge };
      default: return { typ: "selbst", note: 0 };
    }
  }
  function pruefen() {
    if (!bereit || ergebnis) return;
    const a = antwortVon(), anteil = modus === "pruefung" ? teilpunkte(frage, a) : bewerten(frage, a);
    if (modus === "pruefung") { onfertig(anteil, a); return; }
    ergebnis = { anteil, a };
  }
  function selbst(note: 0 | 1 | 2) { const a: Antwort = { typ: "selbst", note }; onfertig(bewerten(frage, a), a); }
  function weiter() { if (ergebnis) onfertig(ergebnis.anteil, ergebnis.a); }
  function mcKlick(i: number) {
    if (ergebnis) return;
    if (mehrere) wahl = wahl.includes(i) ? wahl.filter((x) => x !== i) : [...wahl, i];
    else wahl = [i];
  }
  function schiebe(i: number, d: -1 | 1) { const j = i + d; if (j < 0 || j >= folge.length || ergebnis) return; const f = [...folge]; [f[i], f[j]] = [f[j], f[i]]; folge = f; }

  // Tastatur: 1–9 wählt, Enter prüft bzw. geht weiter
  $effect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && !e.shiftKey && !t?.closest?.("textarea")) { if (ergebnis) { e.preventDefault(); weiter(); } else if (bereit) { e.preventDefault(); pruefen(); } return; }
      if (t?.closest?.("input, textarea, select")) return;
      const n = Number(e.key);
      if (frage.typ === "mc" && n >= 1 && n <= ordnung.length) mcKlick(ordnung[n - 1]);
      if (frage.typ === "wahr" && !ergebnis) { if (e.key === "1" || e.key.toLowerCase() === "r") wahrWahl = true; if (e.key === "2" || e.key.toLowerCase() === "f") wahrWahl = false; }
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const richtigText = $derived(loesungText(frage));
</script>

<div class="fk" class:ok={ergebnis?.anteil === 1} class:falsch={ergebnis && ergebnis.anteil < 1}>
  <div class="frage md">{@html md(frage.frage)}</div>

  {#if frage.typ === "mc"}
    {#if mehrere}<p class="hinweis">Mehrere Antworten sind richtig – wähle alle.</p>{/if}
    <div class="opts">
      {#each ordnung as i, n}
        {@const gewaehlt = wahl.includes(i)}
        {@const istRichtig = frage.richtig.includes(i)}
        <button class="opt" class:an={gewaehlt} class:r={ergebnis && istRichtig} class:f={ergebnis && gewaehlt && !istRichtig} onclick={() => mcKlick(i)} disabled={!!ergebnis}>
          <span class="nr">{n + 1}</span><span class="md">{@html mdZeile(frage.optionen[i])}</span>
          {#if ergebnis && istRichtig}<Icon name="check" size={16} />{/if}
        </button>
      {/each}
    </div>
  {:else if frage.typ === "wahr"}
    <div class="zwei">
      <button class="opt" class:an={wahrWahl === true} class:r={ergebnis && frage.wahr} class:f={ergebnis && wahrWahl === true && !frage.wahr} onclick={() => !ergebnis && (wahrWahl = true)} disabled={!!ergebnis}><span class="nr">R</span>Richtig</button>
      <button class="opt" class:an={wahrWahl === false} class:r={ergebnis && !frage.wahr} class:f={ergebnis && wahrWahl === false && frage.wahr} onclick={() => !ergebnis && (wahrWahl = false)} disabled={!!ergebnis}><span class="nr">F</span>Falsch</button>
    </div>
  {:else if frage.typ === "zahl"}
    <label class="zahl">
      <input bind:this={feld} class="input num" inputmode="decimal" autocomplete="off" placeholder="Ergebnis" bind:value={text} disabled={!!ergebnis} />
      {#if frage.einheit}<span>{frage.einheit}</span>{/if}
    </label>
    <p class="hinweis">Komma oder Punkt, beides geht. Gewertet wird auf {de(toleranz(frage), 4)} genau.</p>
  {:else if frage.typ === "buchung"}
    <div class="bs">
      <div class="bs__s"><b>Soll</b>
        {#each soll as z, i}<div class="bs__z"><select class="input" bind:value={z[0]} disabled={!!ergebnis}><option value="">Konto …</option>{#each frage.konten as k}<option>{k}</option>{/each}</select><input class="input num" inputmode="decimal" placeholder="Betrag" bind:value={z[1]} disabled={!!ergebnis} /></div>{/each}
      </div>
      <span class="anw">an</span>
      <div class="bs__s"><b>Haben</b>
        {#each haben as z, i}<div class="bs__z"><select class="input" bind:value={z[0]} disabled={!!ergebnis}><option value="">Konto …</option>{#each frage.konten as k}<option>{k}</option>{/each}</select><input class="input num" inputmode="decimal" placeholder="Betrag" bind:value={z[1]} disabled={!!ergebnis} /></div>{/each}
      </div>
    </div>
    <p class="hinweis">{frage.soll.length} Soll- und {frage.haben.length} Habenbuchung{frage.haben.length > 1 ? "en" : ""}.</p>
  {:else if frage.typ === "zuordnen"}
    <div class="zo">
      {#each frage.elemente as [e, g], i}
        <div class="zo__z" class:r={ergebnis && zu[i] === g} class:f={ergebnis && zu[i] !== g}>
          <span class="md">{@html mdZeile(e)}</span>
          <div class="seg">{#each frage.gruppen as gr, j}<button class:an={zu[i] === j} onclick={() => { if (!ergebnis) { const z = [...zu]; z[i] = j; zu = z; } }} disabled={!!ergebnis}>{gr}</button>{/each}</div>
        </div>
      {/each}
    </div>
  {:else if frage.typ === "reihe"}
    <ol class="rh">
      {#each folge as e, i (e)}
        <li class:r={ergebnis && e === i} class:f={ergebnis && e !== i}><span class="md">{@html mdZeile(frage.elemente[e])}</span>
          <span class="pf"><button aria-label="Nach oben" onclick={() => schiebe(i, -1)} disabled={i === 0 || !!ergebnis}><Icon name="left" size={14} /></button><button aria-label="Nach unten" onclick={() => schiebe(i, 1)} disabled={i === folge.length - 1 || !!ergebnis}><Icon name="right" size={14} /></button></span></li>
      {/each}
    </ol>
  {:else if frage.typ === "karte" || frage.typ === "frei"}
    {#if frage.typ === "frei" && !aufgedeckt}<textarea class="input" rows="5" placeholder="Schreib deine Antwort wie in der Klausur – dann vergleichen." bind:value={freiText}></textarea>{/if}
    {#if !aufgedeckt}
      <button class="btn btn--primary org-primary zeigen" onclick={() => (aufgedeckt = true)}>{frage.typ === "frei" ? "Mit Musterlösung vergleichen" : "Antwort zeigen"}</button>
    {:else}
      <div class="loes md">{@html md(frage.antwort)}</div>
      {#if frage.erkl}<div class="erkl md">{@html md(frage.erkl)}</div>{/if}
      <p class="hinweis">Sei ehrlich zu dir – davon hängt ab, wann die Frage wiederkommt.</p>
      <div class="selbst">
        <button class="btn s0" onclick={() => selbst(0)}>Nicht gewusst</button>
        <button class="btn s1" onclick={() => selbst(1)}>Teilweise</button>
        <button class="btn s2" onclick={() => selbst(2)}>Gewusst</button>
      </div>
    {/if}
  {/if}

  {#if frage.typ !== "karte" && frage.typ !== "frei"}
    {#if !ergebnis}
      <div class="aktion">
        {#if frage.tipp && modus === "lernen"}<details class="tipp"><summary>Tipp</summary><div class="md">{@html md(frage.tipp)}</div></details>{/if}
        <button class="btn btn--primary org-primary" disabled={!bereit} onclick={pruefen}>{modus === "pruefung" ? "Antwort speichern" : "Prüfen"}</button>
      </div>
    {:else}
      <div class="rueck" role="status">
        <b class="titel">{#if ergebnis.anteil === 1}<Icon name="check" size={18} />Richtig{:else}<Icon name="x" size={18} />Noch nicht{/if}</b>
        {#if ergebnis.anteil < 1}<div class="md"><span class="muted">Richtig ist:</span> {@html mdZeile(richtigText)}</div>{/if}
        {#if frage.erkl}<div class="md erkl">{@html md(frage.erkl)}</div>{/if}
        <button class="btn btn--primary org-primary" onclick={weiter}>Weiter <Icon name="right" size={15} /></button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .fk { display: grid; gap: 14px; }
  .md { color: var(--text-2); line-height: 1.6; }
  .md :global(p) { margin: 0 0 .6em; } .md :global(p:last-child) { margin: 0; }
  .md :global(b) { color: var(--text); }
  .md :global(ul), .md :global(ol) { margin: .2em 0 .6em; padding-left: 1.3em; }
  .frage { font-size: 1.08rem; color: var(--text); }
  .frage :global(b) { font-weight: 700; }
  .hinweis { margin: -4px 0 0; font-size: .8rem; color: var(--steel); }
  .opts { display: grid; gap: 8px; }
  .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .opt { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--panel); color: var(--text); font: inherit; text-align: left; cursor: pointer; transition: border-color .2s, background .2s, transform .2s var(--ease); }
  .opt:hover:not(:disabled) { background: var(--panel-2); }
  .opt:active:not(:disabled) { transform: scale(.985); }
  .opt:disabled { cursor: default; }
  .opt .md { flex: 1; color: var(--text); }
  .opt .md :global(.katex) { font-size: 1.22em; }
  .nr { width: 24px; height: 24px; flex: none; border-radius: 8px; display: grid; place-items: center; font-size: .76rem; font-weight: 700; background: var(--bg-2); color: var(--steel); }
  .opt.an { border-color: #A598FF; background: rgba(142, 124, 255, .12); }
  .opt.an .nr { background: #8E7CFF; color: #fff; }
  .opt.r, .zo__z.r, .rh li.r { border-color: rgba(76, 195, 138, .6); background: rgba(76, 195, 138, .1); }
  .opt.r :global(svg) { color: var(--ok); }
  .opt.f, .zo__z.f, .rh li.f { border-color: rgba(242, 122, 106, .6); background: rgba(242, 122, 106, .1); }
  .zahl { display: flex; align-items: center; gap: 10px; max-width: 320px; }
  .zahl .input { font-size: 1.15rem; min-height: 48px; }
  .zahl span { color: var(--text-2); font-weight: 600; }
  .bs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: start; }
  .bs__s { display: grid; gap: 6px; }
  .bs__s > b { font-size: .76rem; text-transform: uppercase; letter-spacing: .06em; color: var(--steel); }
  .bs__z { display: grid; grid-template-columns: 1fr 110px; gap: 6px; }
  .anw { align-self: center; font-weight: 700; color: var(--text-2); padding-top: 18px; }
  .zo { display: grid; gap: 8px; }
  .zo__z { display: grid; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--bg-2); color: var(--text-2); font: inherit; font-size: .84rem; cursor: pointer; }
  .seg button.an { background: rgba(142, 124, 255, .2); border-color: #A598FF; color: var(--text); }
  .rh { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; counter-reset: r; }
  .rh li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--panel); counter-increment: r; }
  .rh li::before { content: counter(r); width: 22px; height: 22px; flex: none; border-radius: 7px; display: grid; place-items: center; background: var(--bg-2); color: var(--steel); font-size: .76rem; font-weight: 700; }
  .rh .md { flex: 1; color: var(--text); }
  .pf { display: flex; gap: 4px; }
  .pf button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--bg-2); color: var(--text-2); display: grid; place-items: center; cursor: pointer; }
  .pf button :global(svg) { transform: rotate(90deg); }
  .pf button:disabled { opacity: .35; cursor: default; }
  .aktion { display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-wrap: wrap; }
  .tipp { margin-right: auto; font-size: .88rem; color: var(--text-2); }
  .tipp summary { cursor: pointer; color: var(--warn); font-weight: 600; }
  .rueck { display: grid; gap: 10px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--panel); }
  .ok .rueck { border-color: rgba(76, 195, 138, .45); background: rgba(76, 195, 138, .08); }
  .falsch .rueck { border-color: rgba(242, 122, 106, .45); background: rgba(242, 122, 106, .07); }
  .titel { display: flex; align-items: center; gap: 8px; font-size: 1.02rem; }
  .ok .titel { color: var(--ok); } .falsch .titel { color: #F27A6A; }
  .rueck .btn { justify-self: end; }
  .erkl { font-size: .94rem; }
  .zeigen { justify-self: start; }
  .loes { padding: 14px 16px; border-radius: 14px; background: rgba(76, 195, 138, .08); border: 1px solid rgba(76, 195, 138, .35); color: var(--text); }
  .selbst { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .s0 { border-color: rgba(242, 122, 106, .5); } .s1 { border-color: rgba(231, 185, 74, .5); } .s2 { border-color: rgba(76, 195, 138, .6); }
  textarea.input { min-height: 120px; resize: vertical; font: inherit; line-height: 1.5; }
  @media (max-width: 560px) { .bs { grid-template-columns: 1fr; } .anw { padding: 0; } .bs__z { grid-template-columns: 1fr 96px; } }
</style>
