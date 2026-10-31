<script lang="ts">
  import Icon from "./Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { frage } from "../lib/frage.svelte";
  import { social, FARBEN, STATUS, type Creative, type Plan, type Saeule } from "../lib/social.svelte";
  import { ziehbar } from "../lib/ziehen";
  import { iso, monatsblatt, MONATE, WOCHENTAGE } from "../lib/socialformat";
  import { flip } from "svelte/animate";
  import { federKurve, ruhig } from "../lib/bewegung";

  const fk = federKurve(0.45, 0.04);
  const schreiben = $derived(auth.darf("social", true));

  // ---------- Grundidee und roter Faden (speichert beim Tippen, kurz verzögert)
  let stand = $state<"" | "speichert" | "gespeichert" | "fehler">("");
  function aendern(teil: Partial<Plan>) {
    stand = "speichert";
    social.planSpeichern(teil).then(() => (stand = "gespeichert")).catch((e) => { stand = "fehler"; daten.melden("Plan nicht gespeichert: " + e.message); });
  }
  const FELDER: { k: keyof Plan; name: string; hilfe: string; zeilen: number }[] = [
    { k: "idee", name: "Grundidee", hilfe: "Wofür steht der Kanal? Was soll jemand nach drei Posts über Medialyte wissen?", zeilen: 3 },
    { k: "faden", name: "Roter Faden", hilfe: "Wie hängen die Posts zusammen? Welche Geschichte erzählt der Kanal über Wochen?", zeilen: 3 },
    { k: "zielgruppe", name: "Zielgruppe", hilfe: "Wen wollen wir erreichen?", zeilen: 2 },
    { k: "ton", name: "Tonalität", hilfe: "Wie klingen wir?", zeilen: 2 },
    { k: "rhythmus", name: "Rhythmus", hilfe: "Wie oft und in welcher Mischung posten wir?", zeilen: 2 },
  ];

  // ---------- Content-Säulen
  const saeulen = $derived(social.plan.saeulen ?? []);
  const proSaeule = (id: string) => social.liste.filter((c) => c.saeule === id && c.status !== "verworfen").length;
  function saeuleSetzen(i: number, werte: Partial<Saeule>) { const l = saeulen.map((s, j) => (j === i ? { ...s, ...werte } : s)); aendern({ saeulen: l }); }
  function saeuleNeu() { const id = "s" + Date.now().toString(36); aendern({ saeulen: [...saeulen, { id, name: "Neue Säule", farbe: FARBEN[saeulen.length % FARBEN.length], text: "" }] }); }
  async function saeuleWeg(i: number) {
    const s = saeulen[i]; const n = proSaeule(s.id);
    if (!(await frage(`„${s.name}“ entfernen?`, n ? `${n} Creatives sind dieser Säule zugeordnet. Sie bleiben erhalten, nur ohne Säule.` : "Die Säule wird aus dem Plan entfernt.", "Entfernen", true))) return;
    aendern({ saeulen: saeulen.filter((_, j) => j !== i) });
    for (const c of social.liste.filter((c) => c.saeule === s.id)) social.setzen(c.id, { saeule: null }).catch(() => {});
  }
  const naechsteFarbe = (f: string) => FARBEN[(FARBEN.indexOf(f) + 1) % FARBEN.length];

  // ---------- Kalender
  const heute = new Date();
  let jahr = $state(heute.getFullYear()), monat = $state(heute.getMonth());
  const blatt = $derived(monatsblatt(jahr, monat));
  const heuteIso = iso(heute);
  function blaettern(d: number) { const x = new Date(jahr, monat + d, 1); jahr = x.getFullYear(); monat = x.getMonth(); }
  const amTag = $derived.by(() => {
    const m: Record<string, Creative[]> = {};
    for (const c of social.sortiert()) if (c.geplant && c.status !== "verworfen") (m[c.geplant] ||= []).push(c);
    return m;
  });
  const offen = $derived(social.sortiert().filter((c) => !c.geplant && (c.status === "freigegeben" || c.status === "pruefen")));
  const imMonat = $derived(blatt.filter((t) => t.imMonat).reduce((n, t) => n + (amTag[t.iso]?.length ?? 0), 0));

  let zieht = $state<string | null>(null), ziel = $state<string | null>(null);
  function ueber(u: HTMLElement | null) {
    const t = u?.closest<HTMLElement>("[data-tag]")?.dataset.tag ?? (u?.closest("[data-ungeplant]") ? "-" : null);
    ziel = t;
  }
  async function ablegen(c: Creative, u: HTMLElement | null, abgebrochen: boolean) {
    zieht = null; const t = ziel; ziel = null;
    if (abgebrochen || !t) return;
    const neu = t === "-" ? null : t;
    if (neu === c.geplant) return;
    try { await social.setzen(c.id, { geplant: neu }); daten.melden(neu ? `„${c.titel}“ eingeplant` : `„${c.titel}“ aus dem Kalender genommen`); }
    catch (e: any) { daten.melden("Nicht gespeichert: " + e.message); }
  }
  const bild = (c: Creative) => (c.vorschau ? social.bild[c.vorschau] : "");
</script>

<section class="sek">
  <div class="sek__k"><h2>Grundidee und roter Faden</h2>
    {#if stand}<span class="stand muted" class:fehler={stand === "fehler"}>{stand === "speichert" ? "Speichert …" : stand === "gespeichert" ? "Gespeichert" : "Nicht gespeichert"}</span>{/if}</div>
  <div class="felder">
    {#each FELDER as f (f.k)}
      <label class="feld card" class:breit={f.k === "idee" || f.k === "faden"}>
        <span class="feld__n">{f.name}</span>
        <textarea class="input" rows={f.zeilen} placeholder={f.hilfe} disabled={!schreiben} value={(social.plan[f.k] as string) ?? ""}
          oninput={(e) => aendern({ [f.k]: (e.currentTarget as HTMLTextAreaElement).value })}></textarea>
      </label>
    {/each}
  </div>
</section>

<section class="sek">
  <div class="sek__k"><h2>Content-Säulen</h2>{#if schreiben}<button class="btn btn--s" onclick={saeuleNeu}><Icon name="plus" size={14} />Säule</button>{/if}</div>
  <p class="muted klein">Jedes Creative gehört zu einer Säule. So bleibt die Mischung im Feed ausgewogen.</p>
  <div class="saeulen">
    {#each saeulen as s, i (s.id)}
      <div class="saeule card" style="--k: {s.farbe}">
        <div class="saeule__k">
          <button class="punkt" title="Farbe wechseln" aria-label="Farbe wechseln" disabled={!schreiben} onclick={() => saeuleSetzen(i, { farbe: naechsteFarbe(s.farbe) })}></button>
          <input class="name" value={s.name} disabled={!schreiben} aria-label="Name der Säule" onchange={(e) => saeuleSetzen(i, { name: (e.currentTarget as HTMLInputElement).value.trim() || s.name })}>
          <span class="zahl num" title="Creatives in dieser Säule">{proSaeule(s.id)}</span>
          {#if schreiben}<button class="btn btn--quiet btn--icon btn--s" aria-label="Säule entfernen" onclick={() => saeuleWeg(i)}><Icon name="x" size={14} /></button>{/if}
        </div>
        <textarea class="input" rows="2" placeholder="Worum geht es in dieser Säule?" disabled={!schreiben} value={s.text}
          onchange={(e) => saeuleSetzen(i, { text: (e.currentTarget as HTMLTextAreaElement).value })}></textarea>
      </div>
    {/each}
  </div>
</section>

<section class="sek">
  <div class="sek__k">
    <h2>Kalender</h2>
    <div class="monat">
      <button class="btn btn--quiet btn--icon btn--s" aria-label="Voriger Monat" onclick={() => blaettern(-1)}><Icon name="left" size={16} /></button>
      <b>{MONATE[monat]} {jahr}</b>
      <button class="btn btn--quiet btn--icon btn--s" aria-label="Nächster Monat" onclick={() => blaettern(1)}><Icon name="right" size={16} /></button>
      {#if jahr !== heute.getFullYear() || monat !== heute.getMonth()}<button class="btn btn--s" onclick={() => { jahr = heute.getFullYear(); monat = heute.getMonth(); }}>Heute</button>{/if}
    </div>
    <span class="muted klein">{imMonat} {imMonat === 1 ? "Post" : "Posts"} geplant</span>
  </div>

  <div class="ablage card" data-ungeplant class:ziel={ziel === "-"}>
    <div class="ablage__k"><b>Noch nicht eingeplant</b><span class="muted klein">{schreiben ? "Auf einen Tag ziehen" : ""}</span></div>
    <div class="ablage__l">
      {#each offen as c (c.id)}
        {@const sl = social.saeule(c.saeule)}
        <a class="mini" href="#/social/c/{c.slug}" style="--k: {sl?.farbe ?? 'var(--line-2)'}" title={c.titel}
          animate:flip={{ duration: ruhig() ? 0 : fk.ms, easing: fk.easing }}
          use:ziehbar={{ aus: !schreiben, start: () => (zieht = c.id), bewegt: (_x, _y, u) => ueber(u), ende: (_x, _y, u, ab) => ablegen(c, u, ab) }}>
          {#if bild(c)}<img src={bild(c)} alt="" draggable="false">{/if}
          {#if c.status === "pruefen"}<span class="mini__p" title={STATUS.pruefen.name}></span>{/if}
        </a>
      {:else}<span class="muted klein">Alles eingeplant.</span>{/each}
    </div>
  </div>

  <div class="kal" class:zieht>
    {#each WOCHENTAGE as w}<span class="kal__w">{w}</span>{/each}
    {#each blatt as t (t.iso)}
      <div class="tag" data-tag={t.iso} class:aus={!t.imMonat} class:heute={t.iso === heuteIso} class:ziel={ziel === t.iso}>
        <span class="tag__n num">{t.tag}</span>
        <div class="tag__l">
          {#each amTag[t.iso] ?? [] as c (c.id)}
            {@const sl = social.saeule(c.saeule)}
            <a class="mini" href="#/social/c/{c.slug}" style="--k: {sl?.farbe ?? 'var(--line-2)'}" title={c.titel} class:gepostet={c.status === "gepostet"}
              use:ziehbar={{ aus: !schreiben, start: () => (zieht = c.id), bewegt: (_x, _y, u) => ueber(u), ende: (_x, _y, u, ab) => ablegen(c, u, ab) }}>
              {#if bild(c)}<img src={bild(c)} alt="" draggable="false">{/if}
              {#if c.status === "pruefen"}<span class="mini__p" title={STATUS.pruefen.name}></span>{/if}
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  {#if saeulen.length}<div class="legende">{#each saeulen as s (s.id)}<span style="--k: {s.farbe}"><i></i>{s.name}</span>{/each}<span><i class="p"></i>Zur Freigabe</span></div>{/if}
</section>

<style>
  .sek { display: grid; gap: 12px; margin-bottom: 34px; min-width: 0; }
  .sek__k { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; }
  .sek__k h2 { font-size: 1.05rem; margin-right: auto; }
  .klein { font-size: .84rem; }
  .sek > p { margin-top: -6px; }
  .stand { font-size: .8rem; }
  .stand.fehler { color: #FF8080; }
  .felder { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .feld { display: grid; gap: 8px; padding: 14px 16px; align-content: start; }
  .feld.breit { grid-column: span 3; }
  .feld__n { font-size: .8rem; font-weight: 600; color: var(--bereich); letter-spacing: .01em; }
  .feld textarea { background: transparent; border-color: transparent; padding: 0; min-height: 0; resize: none; field-sizing: content; font-size: .95rem; color: var(--text); }
  .feld textarea:focus { box-shadow: none; }
  .feld:focus-within { border-color: var(--line-2); }
  .saeulen { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 12px; }
  .saeule { display: grid; gap: 8px; padding: 14px 16px; border-top: 3px solid var(--k); }
  .saeule__k { display: flex; align-items: center; gap: 10px; }
  .punkt { width: 18px; height: 18px; flex: none; border-radius: 50%; border: 0; background: var(--k); box-shadow: 0 0 0 4px color-mix(in srgb, var(--k) 20%, transparent); cursor: pointer; padding: 0; }
  .name { flex: 1 1 0; width: 0; min-width: 0; border: 0; background: transparent; color: var(--text); font: inherit; font-weight: 600; font-size: 1rem; padding: 4px 0; outline: none; }
  .zahl { font-size: .8rem; color: var(--steel); }
  .saeule textarea { background: transparent; border-color: transparent; padding: 0; min-height: 0; resize: none; field-sizing: content; font-size: .88rem; color: var(--text-2); }
  .monat { display: flex; align-items: center; gap: 4px; }
  .monat b { min-width: 130px; text-align: center; font-weight: 600; }
  .ablage { padding: 12px 14px; display: grid; gap: 10px; transition: border-color .2s ease, background-color .2s ease; }
  .ablage.ziel { border-color: var(--bereich); background: color-mix(in srgb, var(--bereich) 8%, var(--panel)); }
  .ablage__k { display: flex; justify-content: space-between; gap: 10px; font-size: .9rem; }
  .ablage__l { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; min-height: 64px; align-items: center; }
  .ablage .mini { width: 48px; }
  .mini { position: relative; display: block; flex: none; aspect-ratio: 3 / 4; border-radius: 7px; overflow: hidden; background: var(--panel-2);
    box-shadow: 0 0 0 2px var(--k); touch-action: pan-y; -webkit-touch-callout: none; }
  .mini img { width: 100%; height: 100%; object-fit: cover; display: block; -webkit-user-drag: none; }
  .mini.gepostet { opacity: .5; }
  .mini__p { position: absolute; right: 3px; top: 3px; width: 8px; height: 8px; border-radius: 50%; background: #EBC56B; box-shadow: 0 0 0 2px rgba(10, 18, 32, .8); }
  .kal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .kal__w { font-size: .74rem; color: var(--steel); text-align: center; padding-bottom: 2px; }
  .tag { min-height: 104px; padding: 6px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); display: grid; align-content: start; gap: 6px; min-width: 0;
    transition: border-color .2s ease, background-color .2s ease, transform .3s var(--feder-schnell); }
  .tag.aus { opacity: .4; }
  .tag.heute .tag__n { background: var(--bereich); color: #0A1220; }
  .tag.ziel { border-color: var(--bereich); background: color-mix(in srgb, var(--bereich) 12%, var(--panel)); transform: scale(1.02); }
  .tag__n { justify-self: start; min-width: 22px; height: 22px; padding: 0 5px; border-radius: 11px; display: grid; place-items: center; font-size: .76rem; color: var(--text-2); }
  .tag__l { display: grid; grid-template-columns: repeat(auto-fill, minmax(28px, 1fr)); gap: 5px; }
  .legende { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: .78rem; color: var(--text-2); }
  .legende span { display: inline-flex; align-items: center; gap: 6px; }
  .legende i { width: 9px; height: 9px; border-radius: 3px; background: var(--k); }
  .legende i.p { border-radius: 50%; background: #EBC56B; }
  @media (max-width: 760px) {
    .felder { grid-template-columns: minmax(0, 1fr); }
    .feld.breit { grid-column: auto; }
    .kal { gap: 3px; }
    .tag { min-height: 68px; padding: 4px; border-radius: 8px; gap: 4px; }
    .tag__n { font-size: .7rem; min-width: 18px; height: 18px; }
    .tag__l { grid-template-columns: minmax(0, 1fr); gap: 3px; }
    .tag .mini { border-radius: 4px; box-shadow: 0 0 0 1.5px var(--k); }
  }
</style>
