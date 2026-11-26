<script lang="ts">
  // Abfrage: fällige Wiederholungen, neue Fragen, ein Kurs, Schwachstellen, eine Lektion oder Rechentraining.
  // Falsche Antworten kommen in derselben Runde nochmal (ohne zu zählen) und danach öfter, bis sie sitzen.
  import Icon from "../../../components/Icon.svelte";
  import FrageKarte from "../../../components/lernen/FrageKarte.svelte";
  import Marke from "../../../components/lernen/Marke.svelte";
  import { lernen } from "../../../lib/lernen/lernen.svelte";
  import { erzeuge } from "../../../lib/lernen/generator";
  import { istPraxis, STUFE, stufeVon } from "../../../lib/lernen/pruefen";
  import { router } from "../../../lib/router.svelte";
  import { mdZeile } from "../../../lib/lernen/md";
  import { KURSE, type Frage, type Kurs, type KursId, type Lektion, type Marke as MarkeT } from "../../../lib/lernen/typen";

  let { art, kurs: kid, lektion: lid, gen }: { art: string; kurs: KursId | null; lektion: string | null; gen: string | null } = $props();
  type E = { kurs: Kurs; lektion: Lektion; frage: Frage; schluessel: string; seed: number; wieder?: boolean };

  let liste = $state<E[]>([]), pos = $state(0), gebaut = $state(false);
  let richtig = $state(0), gezaehlt = $state(0);
  let falsche = $state<E[]>([]);
  const start = Date.now();

  const kurseDa = $derived(KURSE.every((k) => lernen.kurse[k.id]));
  // art „marke“: nur Fragen zu einer Skript-Markierung, z. B. alle Sternfolien (lektion = Name der Markierung)
  const markeInfo = $derived(art === "marke" && kid && lid ? lernen.kurse[kid]?.marken?.[lid as MarkeT] ?? null : null);
  const titel = $derived(art === "praxis" ? "Praxis: selbst rechnen, buchen, ausfüllen" : art === "marke" ? (markeInfo ? `Nur: ${markeInfo.name}` : "Abfrage") : art === "faellig" ? "Fällige Wiederholungen" : art === "neu" ? "Neue Fragen" : art === "schwach" ? "Schwachstellen" : art === "training" ? "Rechentraining" : art === "lektion" ? "Abfrage zur Lektion" : "Abfrage");
  const kopf = $derived(kid ? KURSE.find((k) => k.id === kid)! : null);

  function mische<T>(a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function alle(k: Kurs): E[] { return k.kapitel.flatMap((c) => c.lektionen.flatMap((l) => l.fragen.map((f) => ({ kurs: k, lektion: l, frage: f, schluessel: lernen.key(k.id, l.id, f.id), seed: 1 })))); }

  function bauen() {
    const kurse = (kid ? [lernen.kurse[kid]!] : KURSE.map((k) => lernen.kurse[k.id]!)).sort((a, b) => lernen.klausur(a).localeCompare(lernen.klausur(b)));
    const neu = (k: Kurs) => alle(k).filter((e) => !lernen.stand[e.schluessel] && lernen.gelesen(k.id, e.lektion.id));
    let l: E[] = [];
    if (art === "lektion" && kid && lid) {
      const x = lernen.finde(lernen.kurse[kid]!, lid);
      // von leicht nach schwer
      if (x) l = x.lektion.fragen.map((f) => ({ kurs: lernen.kurse[kid]!, lektion: x.lektion, frage: f, schluessel: lernen.key(kid, lid, f.id), seed: 1 })).sort((a, b) => stufeVon(a.frage) - stufeVon(b.frage));
    } else if (art === "praxis" && kid) {
      // Learning by Doing: nur Aufgaben zum Selbermachen. Mit Lektion: alle davon, leicht → schwer.
      // Für den ganzen Kurs: 20 je Runde – Unsicheres und Neues zuerst, Tabellen bevorzugt, innerhalb davon leicht → schwer.
      const pool = alle(lernen.kurse[kid]!).filter((e) => istPraxis(e.frage) && (!lid || e.lektion.id === lid));
      const rang = (e: E) => { const s = lernen.stand[e.schluessel]; return (!s ? 1 : s.box <= 1 || s.falsch > s.richtig ? 0 : 2 + s.box) * 2 + (e.frage.typ === "tabelle" ? 0 : 1); };
      l = lid ? pool.sort((a, b) => stufeVon(a.frage) - stufeVon(b.frage)) : mische(pool).sort((a, b) => rang(a) - rang(b)).slice(0, 20).sort((a, b) => stufeVon(a.frage) - stufeVon(b.frage));
    } else if (art === "training" && kid && lid && gen) {
      const x = lernen.finde(lernen.kurse[kid]!, lid), g = x?.lektion.generatoren?.find((y) => y.id === gen);
      if (x && g) l = Array.from({ length: 10 }, () => { const seed = Math.floor(Math.random() * 2 ** 31); const f = erzeuge(g, seed); return { kurs: lernen.kurse[kid]!, lektion: x.lektion, frage: { ...f, id: `${g.id}-${seed}` }, schluessel: `gen:${kid}/${lid}/${g.id}`, seed }; });
    } else if (art === "marke" && kid && lid) {
      // unsichere und neue Fragen zuerst, sichere zuletzt – 40 je Runde
      const rang = (e: E) => { const s = lernen.stand[e.schluessel]; return !s ? 1 : s.box <= 1 || s.falsch > s.richtig ? 0 : 2 + s.box; };
      l = mische(alle(lernen.kurse[kid]!).filter((e) => e.frage.marke?.includes(lid as MarkeT))).sort((a, b) => rang(a) - rang(b)).slice(0, 40);
    } else if (art === "schwach") {
      l = mische(kurse.flatMap((k) => alle(k).filter((e) => { const s = lernen.stand[e.schluessel]; return s && (s.box <= 1 || s.falsch > s.richtig); }))).slice(0, 30);
    } else if (art === "neu") {
      l = kurse.flatMap((k) => neu(k).slice(0, 10)).slice(0, 25);
    } else {
      // fällig zuerst (wackelige vorn), dann neue aus gelesenen Lektionen
      const f = kurse.flatMap((k) => lernen.faellig(k).map((e) => ({ ...e, seed: 1 }))).sort((a, b) => (lernen.stand[a.schluessel]?.box ?? 0) - (lernen.stand[b.schluessel]?.box ?? 0));
      l = [...mische(f).sort((a, b) => (lernen.stand[a.schluessel]?.box ?? 0) - (lernen.stand[b.schluessel]?.box ?? 0)), ...(art === "kurs" ? kurse.flatMap((k) => neu(k).slice(0, 15)) : [])].slice(0, 40);
    }
    liste = l; gebaut = true;
  }
  $effect(() => { if (!gebaut && (kid ? lernen.kurse[kid] : kurseDa)) bauen(); });

  const jetzt = $derived(liste[pos] ?? null);
  async function fertig(anteil: number) {
    const e = liste[pos];
    if (!e.wieder) {
      gezaehlt++; if (anteil >= 1) richtig++; else falsche = [...falsche, e];
      lernen.antwort(e.kurs, e.schluessel, anteil);
    }
    if (anteil < 1 && !e.wieder && art !== "training") { const l = [...liste]; l.splice(Math.min(l.length, pos + 4), 0, { ...e, wieder: true, seed: e.seed + 1 }); liste = l; }
    pos++;
    scrollTo({ top: 0 });
  }
  const minuten = () => Math.max(1, Math.round((Date.now() - start) / 60000));
</script>

<div class="ab" style="--f: {kopf?.farbe ?? '#8E7CFF'}">
  <div class="leiste">
    <button class="btn btn--quiet btn--icon" aria-label="Beenden" onclick={() => history.length > 1 ? history.back() : router.geh("/o/lernen")}><Icon name="x" size={18} /></button>
    <div class="fort"><i style="width:{liste.length ? (pos / liste.length) * 100 : 0}%"></i></div>
    <span class="num zahl">{Math.min(pos + 1, liste.length)}/{liste.length}</span>
  </div>

  {#if !gebaut}
    <div class="empty"><b>Fragen werden geladen …</b></div>
  {:else if !liste.length}
    <div class="empty">
      <Icon name="check" size={28} />
      {#if art === "faellig"}<b>Nichts fällig</b><span>Alles, was du schon geübt hast, sitzt für heute. Lies eine neue Lektion oder übe neue Fragen.</span>
      {:else if art === "schwach"}<b>Keine Schwachstellen</b><span>Keine Frage ist gerade wackelig. Stark!</span>
      {:else}<b>Noch keine Fragen offen</b><span>Lies zuerst eine Lektion – danach kommen ihre Fragen hier dran.</span>{/if}
      <a class="btn" href={kid ? "#/o/lernen/" + kid : "#/o/lernen"}>{kid ? "Zum Kurs" : "Zur Übersicht"}</a>
    </div>
  {:else if jetzt}
    <div class="kopf">
      <small>{titel}{jetzt.wieder ? " · nochmal" : ""} · {STUFE[stufeVon(jetzt.frage)]} <Marke marke={jetzt.frage.marke} legende={jetzt.kurs.marken} /></small>
      <a href={`#/o/lernen/${jetzt.kurs.id}/${jetzt.lektion.id}`}>{jetzt.kurs.titel} · {jetzt.lektion.titel}</a>
    </div>
    <div class="karte card">
      {#key pos}<FrageKarte frage={jetzt.frage} seed={pos + jetzt.seed} onfertig={fertig} />{/key}
    </div>
  {:else}
    {@const q = gezaehlt ? richtig / gezaehlt : 0}
    <div class="ende card">
      <span class="gross num">{Math.round(q * 100)} %</span>
      <b>{richtig} von {gezaehlt} richtig · {minuten()} Min.</b>
      <p class="muted">{q >= 0.9 ? "Sehr stark. Die Fragen kommen erst in ein paar Tagen wieder." : q >= 0.6 ? "Gut. Die falschen kommen morgen wieder, bis sie sitzen." : "Kein Problem – genau dafür ist die Abfrage da. Lies die markierten Lektionen nochmal kurz nach."}</p>
      {#if falsche.length}
        <div class="falsch">
          <small>Nochmal anschauen</small>
          {#each [...new Map(falsche.map((e) => [e.kurs.id + e.lektion.id, e])).values()] as e}<a href={`#/o/lernen/${e.kurs.id}/${e.lektion.id}`}><Icon name="note" size={14} />{e.kurs.titel}: {@html mdZeile(e.lektion.titel)}</a>{/each}
        </div>
      {/if}
      <div class="ende__a">
        <a class="btn" href={kid ? "#/o/lernen/" + kid : "#/o/lernen"}>Fertig</a>
        {#if art === "training"}<button class="btn btn--primary org-primary" onclick={() => { gebaut = false; pos = 0; richtig = 0; gezaehlt = 0; falsche = []; }}>Noch 10 Aufgaben</button>{/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .ab { max-width: 760px; margin: 0 auto; }
  .leiste { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .fort { flex: 1; height: 8px; border-radius: 4px; background: rgba(203, 215, 235, .1); overflow: hidden; }
  .fort i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #8E7CFF, var(--f)); transition: width .5s var(--ease); }
  .zahl { color: var(--steel); font-size: .86rem; }
  .kopf { display: grid; gap: 2px; margin-bottom: 10px; }
  .kopf small { color: var(--f); font-weight: 700; font-size: .74rem; text-transform: uppercase; letter-spacing: .05em; }
  .kopf a { color: var(--steel); text-decoration: none; font-size: .86rem; }
  .karte { padding: 20px; border-radius: 20px; }
  .ende { display: grid; justify-items: center; gap: 8px; padding: 28px 20px; border-radius: 22px; text-align: center; }
  .gross { font-size: 3rem; font-weight: 700; color: var(--f); line-height: 1; }
  .ende p { margin: 0; max-width: 460px; }
  .falsch { display: grid; gap: 6px; width: 100%; max-width: 520px; margin-top: 10px; text-align: left; }
  .falsch small { color: var(--steel); font-weight: 600; font-size: .76rem; text-transform: uppercase; letter-spacing: .05em; }
  .falsch a { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; background: var(--bg-2); text-decoration: none; color: var(--text); font-size: .9rem; }
  .ende__a { display: flex; gap: 8px; margin-top: 10px; }
  @media (max-width: 560px) { .karte { padding: 16px; } }
</style>
