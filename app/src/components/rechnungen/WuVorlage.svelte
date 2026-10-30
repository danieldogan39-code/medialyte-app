<script lang="ts">
  // Vorlage „Website-Update“: Anschreiben (Seite 1), Angebot (Seite 2), Gültigkeit und E-Mail-Text
  import Blatt from "./Blatt.svelte";
  import Positionen from "./Positionen.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { versuche } from "../../lib/rechnungen/blatt.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { DEFAULTS, WU_PLACEHOLDERS, positionsOf, type Posten } from "../../lib/rechnungen/kern";
  let { zu }: { zu: () => void } = $props();
  const S = R.settings;
  const K = ["wu_title", "wu_letter", "wu_intro", "tpl_wu_subject", "tpl_wu_body"] as const;
  let f = $state<Record<string, string>>(Object.fromEntries(K.map((k) => [k, S[k] ?? ""])));
  let tage = $state(String(S.wu_valid_days ?? 30));
  let posten = $state<Posten[]>([]);
  const zuruecksetzen = async () => { if (!(await frage("Standardtext?", "Anschreiben, Einleitung und E-Mail auf den Standardtext zurücksetzen?", "Zurücksetzen"))) return; for (const k of K) f[k] = DEFAULTS[k]; };
  const speichern = () => versuche(async () => {
    const company = { ...R.settings };
    for (const k of K) company[k] = f[k].trim();
    company.wu_valid_days = Math.max(1, parseInt(tage, 10) || 30);
    company.wu_items = posten;
    if (!positionsOf(company.wu_items).length) throw new Error("Bitte mindestens eine Position eintragen.");
    await R.saveSettings(company);
    zu(); daten.melden("Vorlage gespeichert");
  });
</script>

<Blatt titel="Vorlage: Website-Update" {zu} breit>
  <p class="muted klein">Seite 1 ist dein Anschreiben mit Begründung, Seite 2 das Angebot mit Festpreis. Platzhalter werden pro Kunde automatisch ersetzt: {WU_PLACEHOLDERS}</p>
  <label class="field"><span>Überschrift (Seite 1)</span><input class="input" bind:value={f.wu_title}></label>
  <label class="field"><span>Anschreiben</span><textarea class="input brief" rows="16" bind:value={f.wu_letter}></textarea></label>
  <p class="muted klein">Leerzeile = neuer Absatz · <code>## Text</code> = Zwischenüberschrift · <code>- Text</code> = Aufzählungspunkt</p>
  <h3>Angebot (Seite 2)</h3>
  <label class="field"><span>Einleitung</span><textarea class="input" rows="2" bind:value={f.wu_intro}></textarea></label>
  <Positionen anfang={S.wu_items?.length ? S.wu_items : DEFAULTS.wu_items} mitAbrechnung bind:posten />
  <label class="field"><span>Gültig (Tage)</span><input class="input" inputmode="numeric" bind:value={tage}></label>
  <h3>E-Mail an den Kunden</h3>
  <label class="field"><span>Betreff</span><input class="input" bind:value={f.tpl_wu_subject}></label>
  <label class="field"><span>Text</span><textarea class="input" rows="8" bind:value={f.tpl_wu_body}></textarea></label>
  <p class="muted klein">Platzhalter: {"{anrede} {nummer} {betrag} {gueltig} {firma}"}</p>
  {#snippet fuss()}<button class="btn" onclick={zuruecksetzen}>Standardtext</button><button class="btn btn--primary" onclick={speichern}>Vorlage speichern</button>{/snippet}
</Blatt>

<style>
  .klein { font-size: .84rem; margin: 0; line-height: 1.5; }
  .brief { font-size: .92rem; line-height: 1.55; }
  code { font-size: .9em; padding: 1px 5px; border-radius: 4px; background: rgba(255, 255, 255, .07); }
</style>
