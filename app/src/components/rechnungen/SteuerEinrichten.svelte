<script lang="ts">
  // Steuern einrichten: wie Medialyte Umsatzsteuer abführt, ob Gewerbesteuer anfällt, und die persönlichen Angaben für die Einkommensteuer-Schätzung
  import Blatt from "./Blatt.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { auth } from "../../lib/auth.svelte";
  import { fmtNum, num, todayISO } from "../../lib/rechnungen/kern";
  import { privatSet, steuerSet, zeitraeume, type SteuerSet } from "../../lib/rechnungen/steuer";

  let { zu }: { zu: () => void } = $props();
  const darf = auth.darf("rechnungen", true);
  const s0 = steuerSet(R.settings), p0 = privatSet(R.steuerPrivat), erstesMal = !s0.eingerichtet;
  let f = $state({ art: s0.art, zeitraum: s0.zeitraum, dauerfrist: s0.dauerfrist, gewerbe: s0.gewerbe, hebesatz: String(s0.hebesatz),
    andere: p0.andere ? fmtNum(p0.andere) : "", abzuege: p0.abzuege ? fmtNum(p0.abzuege) : "", kirche: p0.kirche, kirchensatz: p0.kirchensatz });
  let altErledigt = $state(true);
  const klein = R.small;

  const speichern = () => versuche(async () => {
    const heute = todayISO(), cy = +heute.slice(0, 4);
    if (darf) {
      const hebesatz = Math.round(num(f.hebesatz));
      if (f.gewerbe && (hebesatz < 200 || hebesatz > 900)) throw new Error("Der Hebesatz liegt zwischen 200 und 900 Prozent (Hamburg: 470).");
      const steuer: SteuerSet = { ...s0, eingerichtet: true, art: f.art, zeitraum: f.zeitraum, dauerfrist: f.dauerfrist, gewerbe: f.gewerbe, hebesatz: f.gewerbe ? hebesatz : s0.hebesatz };
      // Beim ersten Einrichten: alles, dessen Frist schon vorbei ist, gilt als abgegeben – sonst stünde die ganze Vergangenheit als offen da
      if (erstesMal && altErledigt && f.zeitraum !== "jahr") {
        const e = { ...steuer.erledigt };
        for (let j = 2024; j <= cy; j++) for (const z of zeitraeume(j, f.zeitraum, f.dauerfrist)) if (z.frist < heute && !e[z.key]) e[z.key] = "vorher";
        steuer.erledigt = e;
      }
      await R.saveSteuer(steuer);
    }
    const privat = { andere: Math.max(num(f.andere), 0), abzuege: Math.max(num(f.abzuege), 0), kirche: f.kirche, kirchensatz: f.kirchensatz };
    const geaendert = privat.andere !== p0.andere || privat.abzuege !== p0.abzuege || privat.kirche !== p0.kirche || privat.kirchensatz !== p0.kirchensatz;
    if (geaendert) await R.savePrivat(privat);
    zu(); daten.melden("Steuer-Einstellungen gespeichert");
  });
</script>

<Blatt titel="Steuern einrichten" {zu}>
  {#if !klein}
    <h3>Umsatzsteuer</h3>
    <div class="wahl" role="radiogroup" aria-label="Versteuerung">
      <label class="opt" class:on={f.art === "soll"}><input type="radio" bind:group={f.art} value="soll" disabled={!darf}><span><b>Soll-Versteuerung</b><small>Der Normalfall. Die Umsatzsteuer wird fällig, sobald du die Rechnung schreibst – auch wenn der Kunde noch nicht gezahlt hat.</small></span></label>
      <label class="opt" class:on={f.art === "ist"}><input type="radio" bind:group={f.art} value="ist" disabled={!darf}><span><b>Ist-Versteuerung</b><small>Die Umsatzsteuer wird erst fällig, wenn das Geld da ist. Gilt nur, wenn du sie beim Finanzamt beantragt hast (Fragebogen zur steuerlichen Erfassung) und sie genehmigt wurde.</small></span></label>
    </div>
    <label class="field"><span>Wie oft gibst du die Umsatzsteuer-Voranmeldung ab?</span>
      <select class="input" bind:value={f.zeitraum} disabled={!darf}><option value="quartal">Vierteljährlich</option><option value="monat">Monatlich</option><option value="jahr">Gar nicht – nur die Jahreserklärung</option></select></label>
    <p class="hinweis">Steht im Schreiben des Finanzamts oder in ELSTER unter „Mein ELSTER“. Im Zweifel: vierteljährlich.</p>
    {#if f.zeitraum !== "jahr"}
      <label class="check"><input type="checkbox" bind:checked={f.dauerfrist} disabled={!darf}><span>Ich habe eine Dauerfristverlängerung (einen Monat mehr Zeit)</span></label>
      {#if erstesMal && darf}<label class="check"><input type="checkbox" bind:checked={altErledigt}><span>Alle Voranmeldungen, deren Frist schon vorbei ist, habe ich abgegeben</span></label>{/if}
    {/if}
  {:else}
    <p class="hinweis">Du bist als Kleinunternehmer eingestellt (Rechnungen → Einstellungen → Steuer). Umsatzsteuer und Voranmeldungen fallen damit weg.</p>
  {/if}

  <h3>Gewerbesteuer</h3>
  <label class="check"><input type="checkbox" bind:checked={f.gewerbe} disabled={!darf}><span>Medialyte ist als Gewerbe angemeldet</span></label>
  {#if f.gewerbe}<label class="field kurz"><span>Hebesatz deiner Stadt in %</span><input class="input" inputmode="numeric" bind:value={f.hebesatz} disabled={!darf}></label>
    <p class="hinweis">Hamburg: 470. Gewerbesteuer fällt erst an, wenn der Gewinn im Jahr über 24.500 € liegt.</p>{/if}

  <h3>Für deine Einkommensteuer</h3>
  <p class="hinweis oben">Diese Angaben siehst nur du. Auch andere im Team mit Zugriff auf die Rechnungen sehen sie nicht.</p>
  <label class="field"><span>Dein übriges zu versteuerndes Einkommen im Jahr in €</span><input class="input" inputmode="decimal" bind:value={f.andere} placeholder="0"></label>
  <p class="hinweis">Zum Beispiel aus einer Anstellung: grob das Jahresbrutto minus ein Fünftel. Leer lassen, wenn Medialyte dein einziges Einkommen ist. Dann rechnet die App so, als käme alles aus Medialyte.</p>
  <label class="field"><span>Abzüge im Jahr in € (optional)</span><input class="input" inputmode="decimal" bind:value={f.abzuege} placeholder="0"></label>
  <p class="hinweis">Zum Beispiel selbst gezahlte Kranken- und Pflegeversicherung oder Rentenbeiträge.</p>
  <label class="check"><input type="checkbox" bind:checked={f.kirche}><span>Ich zahle Kirchensteuer</span></label>
  {#if f.kirche}<label class="field kurz"><span>Satz</span><select class="input" bind:value={f.kirchensatz}><option value={9}>9 % (Hamburg und die meisten Länder)</option><option value={8}>8 % (Bayern, Baden-Württemberg)</option></select></label>{/if}

  {#snippet fuss()}<button class="btn btn--primary" onclick={speichern}>Speichern</button>{/snippet}
</Blatt>

<style>
  h3 { font-size: 1rem; margin-top: 6px; }
  h3:first-child { margin-top: 0; }
  .wahl { display: grid; gap: 8px; }
  .opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius-s); border: 1px solid var(--line-2); background: var(--bg-2); cursor: pointer; }
  .opt.on { border-color: var(--text); }
  .opt input { margin-top: 3px; accent-color: var(--coral); flex: none; width: 16px; height: 16px; }
  .opt span { display: grid; gap: 3px; }
  .opt b { color: var(--text); font-weight: 600; }
  .opt small { color: var(--steel); font-size: .84rem; line-height: 1.5; }
  .hinweis { margin: -6px 0 0; color: var(--steel); font-size: .84rem; line-height: 1.5; }
  .hinweis.oben { margin-top: -8px; }
  .check { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; line-height: 1.45; color: var(--text-2); }
  .check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--coral); flex: none; }
  .kurz { max-width: 320px; }
</style>
