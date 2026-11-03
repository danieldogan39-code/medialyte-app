<script lang="ts">
  // Stil & Kanäle eines Social-Kunden: wo er postet und wie seine Creatives gebaut sind.
  // Das Stilprofil schreibt Claude beim Anlernen; danach baut Claude jeden Auftrag danach. Alles lässt sich hier ändern.
  import Icon from "./Icon.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import SocialBeauftragen from "./SocialBeauftragen.svelte";
  import { social, PLATTFORMEN, FARBEN, plattform, type Kanal, type Profil, type SocialKunde } from "../lib/social.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { frage } from "../lib/frage.svelte";
  import { datum } from "../lib/format";

  let { kunde }: { kunde: SocialKunde } = $props();
  const schreiben = $derived(auth.darf("social", true));
  const kanaele = $derived(social.kanaeleVon(kunde.id));
  const anlernen = $derived(social.auftraegeVon(kunde.id).find((a) => a.art === "anlernen" && (a.status === "offen" || a.status === "in_arbeit")));
  let lernen = $state(false);

  // ---------- Kanäle
  let neu = $state<{ id?: string; plattform: string; name: string; url: string } | null>(null), sichert = $state(false);
  const aus = (url: string) => { // Plattform und Name aus einem eingefügten Link erkennen
    const u = url.trim().toLowerCase(), m: [RegExp, string][] = [[/tiktok\.com/, "tiktok"], [/instagram\.com/, "instagram"], [/facebook\.com|fb\.com/, "facebook"],
      [/youtube\.com|youtu\.be/, "youtube"], [/linkedin\.com/, "linkedin"], [/google\.|g\.page|maps\.app/, "google"]];
    const p = m.find(([r]) => r.test(u))?.[1];
    const h = url.match(/(?:tiktok\.com|instagram\.com|youtube\.com)\/(@?[\w.\-]+)/i)?.[1];
    return { p, h: h ? (h.startsWith("@") ? h : "@" + h) : "" };
  };
  function linkGeaendert() {
    if (!neu) return;
    const { p, h } = aus(neu.url);
    if (p) neu.plattform = p;
    if (h && !neu.name) neu.name = h;
  }
  async function kanalSichern() {
    if (!neu || sichert) return;
    if (!neu.name.trim() && !neu.url.trim()) { daten.melden("Name oder Link fehlt"); return; }
    sichert = true;
    try { await social.kanalSpeichern({ ...neu, kunde_id: kunde.id }); daten.melden("Kanal gespeichert"); neu = null; }
    catch (e: any) { daten.melden("Nicht gespeichert: " + e.message); } finally { sichert = false; }
  }
  async function kanalWeg(k: Kanal) {
    if (!(await frage(`${k.name || plattform(k.plattform)?.name} entfernen?`, "Der Kanal verschwindet aus der Liste. Creatives bleiben erhalten.", "Entfernen", true))) return;
    try { await social.kanalWeg(k); } catch (e: any) { daten.melden("Nicht entfernt: " + e.message); }
  }
  const linkZeigen = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const linkOeffnen = (u: string) => (/^https?:/.test(u) ? u : "https://" + u);

  // ---------- Stilprofil (speichert beim Tippen)
  let stand = $state<"" | "speichert" | "gespeichert" | "fehler">("");
  function aendern(teil: Partial<Profil>) {
    stand = "speichert";
    social.planSpeichern(teil).then(() => (stand = "gespeichert")).catch((e) => { stand = "fehler"; daten.melden("Stil nicht gespeichert: " + e.message); });
  }
  const FELDER: { k: keyof Profil; name: string; hilfe: string; breit?: boolean }[] = [
    { k: "format", name: "Format und Länge", hilfe: "z. B. 9:16, 45–70 Sekunden, ein Fakt pro Video" },
    { k: "aufbau", name: "Aufbau eines Videos", hilfe: "Einstieg mit Frage, dann Auflösung in drei Schritten, Schluss mit Pointe …", breit: true },
    { k: "bild", name: "Bildstil", hilfe: "Farben, Formen, Animation, Schrift, Untertitel" },
    { k: "figuren", name: "Figuren", hilfe: "Wer erklärt? Aussehen, Eigenheiten, wiederkehrende Figuren" },
    { k: "stimme", name: "Stimme", hilfe: "Sprecher, Tempo, Tonfall, Anrede" },
    { k: "musik", name: "Musik und Sound", hilfe: "z. B. ruhiger Lo-Fi im Hintergrund, leise Effekte" },
    { k: "texte", name: "Texte zum Posten", hilfe: "Bildunterschrift, Hashtags, Aufrufe" },
    { k: "themen", name: "Themen", hilfe: "Worum es geht und Ideen für die nächsten Folgen", breit: true },
    { k: "vermeiden", name: "Nicht machen", hilfe: "Was nicht zum Kanal passt" },
    { k: "vorbilder", name: "Beispiele", hilfe: "Links zu Videos, die genau so sein sollen" },
  ];
  const gefuellt = $derived(FELDER.filter((f) => String(kunde.profil?.[f.k] ?? "").trim()).length);
</script>

<section class="sek">
  <div class="sek__k"><h2>Kanäle</h2>
    {#if schreiben && !neu}<button class="btn btn--s" onclick={() => (neu = { plattform: "tiktok", name: "", url: "" })}><Icon name="plus" size={15} />Kanal</button>{/if}</div>
  {#if kanaele.length}
    <ul class="kanaele">
      {#each kanaele as k (k.id)}
        <li class="card kn">
          <PlattformLogo name={k.plattform} size={34} />
          <span class="kn__t"><b>{k.name || plattform(k.plattform)?.name}</b>
            {#if k.url}<a href={linkOeffnen(k.url)} target="_blank" rel="noopener">{linkZeigen(k.url)}<Icon name="external" size={12} /></a>{:else}<small class="muted">{plattform(k.plattform)?.name}</small>{/if}</span>
          {#if schreiben}<span class="kn__a">
            <button class="btn btn--quiet btn--icon" aria-label="Bearbeiten" onclick={() => (neu = { id: k.id, plattform: k.plattform, name: k.name, url: k.url })}><Icon name="note" size={16} /></button>
            <button class="btn btn--quiet btn--icon" aria-label="Entfernen" onclick={() => kanalWeg(k)}><Icon name="trash" size={16} /></button>
          </span>{/if}
        </li>
      {/each}
    </ul>
  {:else if !neu}<p class="muted">Noch keine Kanäle. Trag ein, wo {kunde.name} postet – daran lernt Claude den Stil.</p>{/if}

  {#if neu}
    <form class="card form" onsubmit={(e) => { e.preventDefault(); kanalSichern(); }}>
      <label class="field"><span>Link zum Kanal</span><input class="input" bind:value={neu.url} oninput={linkGeaendert} placeholder="https://www.tiktok.com/@…" inputmode="url" autocomplete="off"></label>
      <div class="field"><span>Plattform</span>
        <div class="pw">{#each PLATTFORMEN as p (p.key)}<button type="button" class="chip" class:on={neu.plattform === p.key} aria-pressed={neu.plattform === p.key} onclick={() => neu && (neu.plattform = p.key)}><PlattformLogo name={p.key} size={16} rund={0.3} />{p.name}</button>{/each}</div>
      </div>
      <label class="field"><span>Name</span><input class="input" bind:value={neu.name} maxlength="120" placeholder="@kanalname"></label>
      <div class="fuss"><button type="button" class="btn" onclick={() => (neu = null)}>Abbrechen</button><button class="btn btn--primary" disabled={sichert}>{neu.id ? "Speichern" : "Hinzufügen"}</button></div>
    </form>
  {/if}
</section>

<section class="sek">
  <div class="sek__k"><h2>Stil</h2>
    {#if stand}<span class="stand muted" class:fehler={stand === "fehler"}>{stand === "speichert" ? "Speichert …" : stand === "gespeichert" ? "Gespeichert" : "Nicht gespeichert"}</span>{/if}
    {#if schreiben}
      {#if anlernen}<span class="pill pill--plain pill--blau">Claude lernt gerade an</span>
      {:else}<button class="btn btn--s" class:btn--primary={!kunde.angelernt} onclick={() => (lernen = true)} disabled={!kanaele.length} title={kanaele.length ? "" : "Erst einen Kanal eintragen"}>
        <Icon name="sparkles" size={15} />{kunde.angelernt ? "Neu anlernen" : "Stil anlernen lassen"}</button>{/if}
    {/if}
  </div>
  <p class="muted">{kunde.angelernt ? `Von Claude angelernt am ${datum(kunde.angelernt)}. Claude baut jeden Auftrag danach – was du hier änderst, gilt ab dem nächsten.` : gefuellt ? "Noch nicht von Claude angelernt. Was hier steht, nimmt Claude beim Anlernen als Vorgabe." : "Noch leer. Lass Claude den Stil an den Kanälen anlernen oder schreib ihn selbst auf."}</p>
  <div class="felder">
    {#each FELDER as f (f.k)}
      <label class="feld card" class:breit={f.breit}>
        <span class="feld__n">{f.name}</span>
        <textarea class="input" rows="2" placeholder={f.hilfe} disabled={!schreiben} value={(kunde.profil?.[f.k] as string) ?? ""}
          oninput={(e) => aendern({ [f.k]: e.currentTarget.value })}></textarea>
      </label>
    {/each}
  </div>
</section>

<section class="sek">
  <div class="sek__k"><h2>Farbe</h2></div>
  <div class="farben" role="radiogroup" aria-label="Farbe des Bereichs">
    {#each FARBEN as f (f)}<button type="button" role="radio" aria-checked={kunde.farbe === f} aria-label={f} style="--k: {f}" disabled={!schreiben}
      onclick={() => social.kundeSetzen(kunde.id, { farbe: f }).catch((e) => daten.melden(e.message))}></button>{/each}
  </div>
</section>

{#if lernen}<SocialBeauftragen {kunde} art="anlernen" onclose={() => (lernen = false)} />{/if}

<style>
  .sek { display: grid; gap: 12px; margin-bottom: 34px; min-width: 0; }
  .sek__k { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; }
  .sek__k h2 { font-size: 1.05rem; margin-right: auto; }
  .sek > p { margin-top: -6px; max-width: 70ch; }
  .stand { font-size: .8rem; }
  .stand.fehler { color: #FF8080; }
  .kanaele { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 10px; }
  .kn { display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 14px; }
  .kn__t { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .kn__t a { display: inline-flex; align-items: center; gap: 5px; font-size: .84rem; color: var(--steel); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kn__a { display: flex; }
  .form { display: grid; gap: 12px; padding: 16px; }
  .pw { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px 0 8px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font: inherit; font-size: .86rem; }
  .chip.on { border-color: var(--bereich); color: var(--text); background: color-mix(in srgb, var(--bereich) 14%, transparent); }
  .fuss { display: flex; justify-content: flex-end; gap: 8px; }
  .felder { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .feld { display: grid; gap: 8px; padding: 14px 16px; align-content: start; }
  .feld.breit { grid-column: span 2; }
  .feld__n { font-size: .8rem; font-weight: 600; color: var(--bereich); letter-spacing: .01em; }
  .feld textarea { background: transparent; border-color: transparent; padding: 0; min-height: 0; resize: none; field-sizing: content; font-size: .95rem; color: var(--text); }
  .feld textarea:focus { box-shadow: none; }
  .feld:focus-within { border-color: var(--line-2); }
  .farben { display: flex; gap: 10px; flex-wrap: wrap; }
  .farben button { width: 30px; height: 30px; border-radius: 50%; border: 0; background: var(--k); cursor: pointer; box-shadow: 0 0 0 2px var(--bg); transition: transform .12s ease; }
  .farben button[aria-checked="true"] { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--k); }
  .farben button:active { transform: scale(.92); }
  @media (max-width: 620px) { .felder { grid-template-columns: 1fr; } .feld.breit { grid-column: auto; } .form .fuss .btn { flex: 1; justify-content: center; } }
</style>
