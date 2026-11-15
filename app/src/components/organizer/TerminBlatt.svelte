<script lang="ts">
  import Fenster from "./Fenster.svelte";
  import Icon from "../Icon.svelte";
  import Schalter from "../Schalter.svelte";
  import { org } from "../../lib/organizer/org.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { dauer, tagKey, tagLang, uhr } from "../../lib/organizer/zeit";
  import { TERMIN_ART, type Termin, type TerminArt } from "../../lib/organizer/typen";

  let { t = {}, onclose }: { t?: Partial<Termin>; onclose: () => void } = $props();
  let fenster: Fenster | undefined = $state();
  const neu = !t.id || !org.termine.some((x) => x.id === t.id);
  const extern = !!t.kalender_id;
  const kal = t.kalender_id ? org.kalender.find((k) => k.id === t.kalender_id) : null;
  const hhmm = (iso?: string) => (iso ? uhr(iso) : "");
  const s0 = t.start ? new Date(t.start) : new Date(Math.ceil(Date.now() / 36e5) * 36e5);
  const e0 = t.ende ? new Date(t.ende) : new Date(s0.getTime() + 36e5);

  let titel = $state(t.titel ?? ""), art = $state<TerminArt>(t.art ?? "termin"), tag = $state(tagKey(s0)), von = $state(hhmm(s0.toISOString())), bis = $state(hhmm(e0.toISOString())),
    ganztag = $state(t.ganztag ?? false), fach = $state<string | null>(t.fach_id ?? null), ort = $state(t.ort ?? ""), notiz = $state(t.notiz ?? ""), laeuft = $state(false);
  const ARTEN: TerminArt[] = ["termin", "vorlesung", "klausur", "abgabe", "privat"];

  async function speichern(e?: Event) {
    e?.preventDefault();
    if (!titel.trim() || laeuft) return;
    const [y, m, d] = tag.split("-").map(Number);
    let start: Date, ende: Date;
    if (ganztag) { start = new Date(y, m - 1, d); ende = new Date(y, m - 1, d + 1); }
    else {
      const [h1, m1] = (von || "09:00").split(":").map(Number), [h2, m2] = (bis || von || "10:00").split(":").map(Number);
      start = new Date(y, m - 1, d, h1, m1); ende = new Date(y, m - 1, d, h2, m2);
      if (ende <= start) ende = new Date(start.getTime() + (art === "abgabe" ? 0 : 36e5));
    }
    laeuft = true;
    const ok = await org.terminSpeichern({ ...(neu ? {} : { id: t.id }), titel, art, start: start.toISOString(), ende: ende.toISOString(), ganztag, fach_id: fach, ort: ort.trim() || null, notiz: notiz.trim() || null });
    laeuft = false;
    if (ok) fenster?.zu();
  }
  async function loeschen() {
    if (!(await frage("Termin löschen?", `„${t.titel}“ wird gelöscht.`, "Löschen", true))) return;
    if (await org.terminLoeschen(t as Termin)) fenster?.zu();
  }
</script>

<Fenster bind:this={fenster} titel={extern ? "Termin aus Kalender" : neu ? "Neuer Termin" : "Termin"} {onclose} farbe={org.farbe(fach, art === "klausur" ? "#F24A4A" : "var(--org)")}>
  {#if extern}
    <div class="extern">
      <h2>{t.titel}</h2>
      <p class="muted">{tagLang(t.start!)}{#if !t.ganztag} · {uhr(t.start!)} – {uhr(t.ende!)} Uhr ({dauer((Date.parse(t.ende!) - Date.parse(t.start!)) / 60000)}){/if}</p>
      {#if t.ort}<p><Icon name="pin" size={14} /> {t.ort}</p>{/if}
      {#if t.notiz}<p class="notiz">{t.notiz}</p>{/if}
      <div class="hinweis"><Icon name="refresh" size={16} /><span>Kommt aus dem Kalender-Abo <b>{kal?.name ?? "Kalender"}</b> und wird dort geändert. Die Auto-Planung hält die Zeit frei.</span></div>
      <div class="field"><span>Fach zuordnen (Farbe)</span>
        <div class="chips">
          {#each org.aktiveFaecher as f (f.id)}<button type="button" class="chip" class:on={fach === f.id} style="--c: {f.farbe}" onclick={async () => { fach = fach === f.id ? null : f.id; await org.terminSpeichern({ id: t.id, titel: t.titel!, start: t.start!, ende: t.ende!, fach_id: fach }); }}><i></i>{f.name}</button>{/each}
        </div>
      </div>
    </div>
  {:else}
    <form class="f" onsubmit={speichern}>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input titel" bind:value={titel} placeholder="Titel" autofocus={neu} maxlength="200" required>
      <div class="seg" role="radiogroup" aria-label="Art">
        {#each ARTEN as x}<button type="button" role="radio" aria-checked={art === x} class:on={art === x} onclick={() => (art = x)}><Icon name={TERMIN_ART[x].icon} size={14} />{TERMIN_ART[x].name}</button>{/each}
      </div>
      <div class="reihe">
        <label class="field"><span>Tag</span><input class="input" type="date" bind:value={tag} required></label>
        {#if !ganztag}
          <label class="field"><span>{art === "abgabe" ? "Uhrzeit" : "Von"}</span><input class="input" type="time" bind:value={von} step="300"></label>
          {#if art !== "abgabe"}<label class="field"><span>Bis</span><input class="input" type="time" bind:value={bis} step="300"></label>{/if}
        {/if}
      </div>
      <div class="schalter"><span>Ganztägig</span><Schalter an={ganztag} label="Ganztägig" onchange={(v) => (ganztag = v)} /></div>
      <div class="field"><span>Fach</span>
        <div class="chips">
          {#each org.aktiveFaecher as f (f.id)}<button type="button" class="chip" class:on={fach === f.id} style="--c: {f.farbe}" onclick={() => (fach = fach === f.id ? null : f.id)}><i></i>{f.name}</button>{/each}
        </div>
      </div>
      <label class="field"><span>Ort</span><input class="input" bind:value={ort} placeholder="Raum, Adresse, Online-Link"></label>
      <label class="field"><span>Notiz</span><textarea class="input" bind:value={notiz} rows="2"></textarea></label>
      {#if art === "klausur" || art === "abgabe"}<div class="hinweis"><Icon name="target" size={16} /><span>Erscheint unter Prüfungen mit Countdown und Lernfortschritt des Fachs.</span></div>{/if}
      <button type="submit" hidden aria-hidden="true"></button>
    </form>
  {/if}
  {#snippet fuss()}
    {#if !neu && !extern}<button class="btn btn--quiet btn--gefahr links" type="button" onclick={loeschen}><Icon name="trash" size={16} />Löschen</button>{/if}
    {#if extern}<button class="btn btn--primary org-primary" type="button" onclick={() => fenster?.zu()}>Fertig</button>
    {:else}<button class="btn btn--primary org-primary" type="button" disabled={!titel.trim() || laeuft} onclick={() => speichern()}>{neu ? "Anlegen" : "Speichern"}</button>{/if}
  {/snippet}
</Fenster>

<style>
  .f, .extern { display: grid; gap: 14px; }
  .titel { font-size: 1.05rem; min-height: 48px; }
  .extern h2 { font-size: 1.25rem; }
  .extern p { display: flex; gap: 6px; align-items: center; }
  .notiz { white-space: pre-wrap; color: var(--text-2); font-size: .9rem; max-height: 160px; overflow: auto; display: block !important; }
  input[type="date"], input[type="time"] { color-scheme: dark; }
</style>
