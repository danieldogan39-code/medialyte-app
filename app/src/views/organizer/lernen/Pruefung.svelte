<script lang="ts">
  // Prüfungssimulation: gemischte Fragen aus dem ganzen Kurs, Zeitlimit, keine Hilfe – Auswertung mit Notenschätzung erst am Ende
  import Icon from "../../../components/Icon.svelte";
  import FrageKarte from "../../../components/lernen/FrageKarte.svelte";
  import { lernen } from "../../../lib/lernen/lernen.svelte";
  import { erzeuge } from "../../../lib/lernen/generator";
  import { md, mdZeile } from "../../../lib/lernen/md";
  import { loesungText, punkteVon } from "../../../lib/lernen/pruefen";
  import { KURSE, type Frage, type KursId, type Lektion } from "../../../lib/lernen/typen";
  import { note } from "./note";

  let { kurs: kid }: { kurs: KursId } = $props();
  const kopf = KURSE.find((k) => k.id === kid)!;
  const kurs = $derived(lernen.kurse[kid] ?? null);
  type E = { lektion: Lektion; frage: Frage; schluessel: string | null; punkte: number; erreicht?: number };

  let phase = $state<"start" | "laeuft" | "ende">("start");
  let liste = $state<E[]>([]), pos = $state(0), ende = $state(0), rest = $state(0), dauer = $state(0);
  let beginn = 0, uhr: number | undefined;

  function zusammenstellen(anzahl: number) {
    const k = kurs!; const pool: E[] = [];
    for (const c of k.kapitel) for (const l of c.lektionen) {
      for (const f of l.fragen) pool.push({ lektion: l, frage: f, schluessel: lernen.key(kid, l.id, f.id), punkte: punkteVon(f) });
      for (const g of l.generatoren ?? []) { const seed = Math.floor(Math.random() * 2 ** 31), f = { ...erzeuge(g, seed), id: `${g.id}-${seed}` }; pool.push({ lektion: l, frage: f, schluessel: null, punkte: punkteVon(f) }); }
    }
    // je Kapitel anteilig ziehen, damit der ganze Stoff vorkommt
    const nachKap = k.kapitel.map((c) => { const ids = new Set(c.lektionen.map((l) => l.id)); return pool.filter((e) => ids.has(e.lektion.id)).sort(() => Math.random() - 0.5); });
    const out: E[] = []; let i = 0;
    while (out.length < Math.min(anzahl, pool.length)) { const t = nachKap[i % nachKap.length]; if (t.length) out.push(t.pop()!); i++; if (i > anzahl * 20) break; }
    return out.sort(() => Math.random() - 0.5);
  }
  function starten(anzahl: number, min: number) {
    liste = zusammenstellen(anzahl); pos = 0; phase = "laeuft"; beginn = Date.now(); ende = beginn + min * 60_000; rest = min * 60;
    uhr = setInterval(() => { rest = Math.max(0, Math.round((ende - Date.now()) / 1000)); if (!rest) abschliessen(); }, 1000) as unknown as number;
  }
  $effect(() => () => clearInterval(uhr));

  function antwort(anteil: number) {
    const e = liste[pos]; liste[pos] = { ...e, erreicht: anteil * e.punkte };
    if (e.schluessel) lernen.antwort(kopf, e.schluessel, anteil >= 1 ? 1 : anteil > 0 ? 0.5 : 0);
    pos++; scrollTo({ top: 0 });
    if (pos >= liste.length) abschliessen();
  }
  async function abschliessen() {
    if (phase !== "laeuft") return;
    clearInterval(uhr); phase = "ende"; dauer = Math.round((Date.now() - beginn) / 1000);
    await lernen.laufSpeichern({ kurs: kid, punkte: Math.round(summe() * 10) / 10, max: max(), dauer_s: dauer, fehler: liste.filter((e) => (e.erreicht ?? 0) < e.punkte).map((e) => e.lektion.id) });
  }
  const summe = () => liste.reduce((n, e) => n + (e.erreicht ?? 0), 0);
  const max = () => liste.reduce((n, e) => n + e.punkte, 0);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
</script>

<div class="pr" style="--f: {kopf.farbe}">
  <a class="zurueck" href={"#/o/lernen/" + kid}><Icon name="left" size={15} />{kopf.titel}</a>

  {#if phase === "start"}
    <section class="start card">
      <span class="ic"><Icon name="target" size={26} /></span>
      <h1>Prüfungssimulation</h1>
      <p class="muted">Fragen aus allen Kapiteln, gemischt wie in der Klausur. Kein Tipp, keine Lösung zwischendurch – die Auswertung kommt am Ende, mit Notenschätzung und allen Lösungen.</p>
      {#if kurs}<div class="format md">{@html md(kurs.format)}</div>{/if}
      <div class="wahl">
        <button class="btn" disabled={!kurs} onclick={() => starten(20, 35)}><b>Kurz</b><small>20 Aufgaben · 35 Min.</small></button>
        <button class="btn btn--primary org-primary" disabled={!kurs} onclick={() => starten(40, 90)}><b>Voll</b><small>40 Aufgaben · 90 Min.</small></button>
      </div>
    </section>
  {:else if phase === "laeuft" && liste[pos]}
    <div class="leiste">
      <span class="num zahl">Aufgabe {pos + 1} von {liste.length} · {liste[pos].punkte} P.</span>
      <span class="uhr num" class:knapp={rest < 300}><Icon name="clock" size={15} />{mmss(rest)}</span>
      <button class="btn btn--s" onclick={abschliessen}>Abgeben</button>
    </div>
    <div class="fort"><i style="width:{(pos / liste.length) * 100}%"></i></div>
    <div class="karte card">{#key pos}<FrageKarte frage={liste[pos].frage} modus="pruefung" seed={pos + 3} onfertig={antwort} />{/key}</div>
  {:else if phase === "ende"}
    {@const q = summe() / max()}
    <section class="erg card">
      <span class="gross num">{Math.round(q * 100)} %</span>
      <b>{Math.round(summe() * 10) / 10} von {max()} Punkten · Note ≈ {note(q)} · {mmss(dauer)} Min.</b>
      <p class="muted">{q >= 0.5 ? "Bestanden – jetzt die Fehler unten nacharbeiten." : "Noch nicht bestanden. Arbeite die Lektionen mit Fehlern nach und wiederhole die Simulation in ein paar Tagen."} Die Note ist nur eine Schätzung nach der üblichen Skala (50 % = 4,0).</p>
    </section>
    <h2>Auswertung</h2>
    <ol class="liste">
      {#each liste as e, i}
        {@const ok = (e.erreicht ?? 0) >= e.punkte}
        <li class:ok class:offen={e.erreicht == null}>
          <div class="z"><span class="nr num">{i + 1}</span><span class="md fr">{@html md(e.frage.frage)}</span><span class="p num">{Math.round((e.erreicht ?? 0) * 10) / 10}/{e.punkte}</span></div>
          {#if !ok}
            <div class="loes"><span class="muted">Lösung:</span> <span class="md">{@html e.frage.typ === "frei" || e.frage.typ === "karte" ? md(loesungText(e.frage)) : mdZeile(loesungText(e.frage))}</span></div>
            {#if e.frage.erkl}<div class="md erkl">{@html md(e.frage.erkl)}</div>{/if}
            <a href={`#/o/lernen/${kid}/${e.lektion.id}`}>Lektion: {e.lektion.titel}</a>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .pr { max-width: 820px; margin: 0 auto; }
  .zurueck { display: inline-flex; align-items: center; gap: 6px; color: var(--steel); text-decoration: none; font-size: .88rem; margin-bottom: 12px; }
  .start { display: grid; justify-items: center; gap: 10px; padding: 28px 22px; border-radius: 22px; text-align: center; }
  .ic { width: 56px; height: 56px; border-radius: 18px; display: grid; place-items: center; background: color-mix(in srgb, var(--f) 22%, transparent); color: var(--f); }
  h1 { margin: 0; }
  .start p { margin: 0; max-width: 520px; }
  .format { text-align: left; width: 100%; max-width: 560px; padding: 12px 14px; border-radius: 14px; background: var(--bg-2); color: var(--text-2); font-size: .9rem; line-height: 1.55; }
  .format :global(b) { color: var(--text); }
  .format :global(ul) { padding-left: 1.2em; margin: .3em 0; }
  .format :global(p) { margin: 0 0 .4em; }
  .wahl { display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap; justify-content: center; }
  .wahl .btn { flex-direction: column; gap: 0; min-height: 58px; padding: 0 26px; border-radius: 16px; }
  .wahl small { font-weight: 400; font-size: .78rem; opacity: .85; }
  .leiste { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .zahl { color: var(--steel); font-size: .88rem; flex: 1; }
  .uhr { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 1.05rem; }
  .uhr.knapp { color: #F27A6A; }
  .fort { height: 6px; border-radius: 3px; background: rgba(203, 215, 235, .1); overflow: hidden; margin-bottom: 16px; }
  .fort i { display: block; height: 100%; background: var(--f); transition: width .4s var(--ease); }
  .karte { padding: 20px; border-radius: 20px; }
  .erg { display: grid; justify-items: center; gap: 6px; padding: 26px; border-radius: 22px; text-align: center; }
  .erg p { margin: 0; max-width: 520px; }
  .gross { font-size: 3rem; font-weight: 700; color: var(--f); line-height: 1; }
  h2 { font-size: 1.05rem; margin: 24px 0 10px; }
  .liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .liste li { display: grid; gap: 8px; padding: 12px 14px; border-radius: 14px; background: var(--panel); border: 1px solid rgba(242, 122, 106, .3); }
  .liste li.ok { border-color: rgba(76, 195, 138, .3); }
  .z { display: flex; gap: 10px; align-items: flex-start; }
  .nr { width: 24px; height: 24px; flex: none; border-radius: 8px; display: grid; place-items: center; background: var(--bg-2); color: var(--steel); font-size: .76rem; font-weight: 700; }
  .fr { flex: 1; min-width: 0; font-size: .92rem; }
  .p { font-weight: 700; font-size: .86rem; color: #F27A6A; }
  .ok .p { color: var(--ok); }
  .md { color: var(--text-2); line-height: 1.55; }
  .md :global(p) { margin: 0 0 .4em; } .md :global(p:last-child) { margin: 0; }
  .md :global(b) { color: var(--text); }
  .loes { font-size: .9rem; padding: 8px 10px; border-radius: 10px; background: rgba(76, 195, 138, .08); }
  .erkl { font-size: .88rem; }
  .liste a { font-size: .84rem; color: var(--f); text-decoration: none; }
</style>
