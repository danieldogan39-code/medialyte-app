<script lang="ts">
  import Zahl from "../components/Zahl.svelte";
  // Nachfassen: wen rufe ich heute an? Alle Betriebe mit verschicktem Brief oder Rückrufwunsch, nach Dringlichkeit.
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { frage } from "../lib/frage.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { NF_STATUS, einschaetzen, grund, skript, verlauf, wiederFuer, tagHeute, tagPlus, werktag, tagText, zeitFmt, datumLang,
    nachfassDaten, nachfassGemerkt, letzteAktivitaet, type Fall, type Eintrag, type Anfrage, type Aufruf, type Einschaetzung } from "../lib/nachfass";
  import { lies, merk } from "../lib/speicher";
  import { agent } from "../lib/agent.svelte";
  import { STAND } from "../lib/kunden";

  let { slug: ziel }: { slug?: string } = $props();
  const g = nachfassGemerkt();   // letzter Stand: Liste steht sofort, frische Zahlen kommen im Hintergrund
  let faelle = $state<Fall[]>(g?.faelle ?? []), eintraege = $state<Record<string, Eintrag>>(g?.eintraege ?? {}), aufrufe = $state<Record<string, Aufruf[]>>(g?.aufrufe ?? {}),
    anfragen = $state<Record<string, Anfrage[]>>(g?.anfragen ?? {}), kunden = $state<Record<string, any>>(lies("nf:kunden", {})), laedt = $state(!g), offen = $state<Record<string, boolean>>({}), zeigeErledigt = $state(false);
  const darf = $derived(auth.darf("akquise", true));

  async function laden() {
    const d = await nachfassDaten();
    faelle = d.faelle; eintraege = d.eintraege; aufrufe = d.aufrufe; anfragen = d.anfragen;
    laedt = false;
    if (ziel && !offen[ziel]) { offen[ziel] = true; setTimeout(() => document.getElementById("nf-" + ziel)?.scrollIntoView({ block: "center", behavior: "smooth" }), 100); }
    const k = await sb.from("kunden").select("slug,stand");
    if (!k.error) kunden = merk("nf:kunden", Object.fromEntries(((k.data ?? []) as any[]).map((x) => [x.slug, x.stand ?? {}])));
  }
  $effect(() => { laden(); const t = setInterval(laden, 120000); const k = sb.channel("nachfass-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "nachfass" }, (p: any) => { if (p.new?.slug) eintraege[p.new.slug] = p.new; }).subscribe();
    return () => { clearInterval(t); sb.removeChannel(k); }; });

  const tage = $derived(agent.c.einstellungen?.nachfass_tage ?? 6);
  const liste = $derived(faelle.map((x) => ({ x, n: einschaetzen(x, eintraege[x.slug], aufrufe[x.kurz ?? ""] ?? [], anfragen[x.slug] ?? [], tage) })));
  const ORD = { heiss: 0, heute: 1, spaeter: 2, erledigt: 3 } as const;
  // heiße Fälle: neueste Aktivität zuerst; sonst nach Fälligkeit
  const sortiert = $derived([...liste].sort((a, b) => ORD[a.n.g] - ORD[b.n.g] || (a.n.g === "heiss" ? letzteAktivitaet(b.n) - letzteAktivitaet(a.n) : 0)
    || (a.n.faellig ?? "9").localeCompare(b.n.faellig ?? "9") || a.x.name.localeCompare(b.x.name)));
  const gruppen = $derived({
    neueKunden: sortiert.filter((y) => y.n.st === "kunde" && !y.n.anfNeu),
    dran: sortiert.filter((y) => (y.n.g === "heiss" || y.n.g === "heute") && !(y.n.st === "kunde" && !y.n.anfNeu)),
    spaeter: sortiert.filter((y) => y.n.g === "spaeter"),
    erledigt: sortiert.filter((y) => y.n.g === "erledigt" && y.n.st !== "kunde"),
  });
  const naechster = $derived(gruppen.spaeter.filter((y) => y.n.faellig).sort((a, b) => a.n.faellig!.localeCompare(b.n.faellig!))[0]);
  $effect(() => { daten.nachfassHeute = gruppen.dran.length; });
  let spaeterAlle = $state(false);
  // Zurück vom Telefonat: die Karte geht auf und fragt nach dem Stand
  let anruf: { slug: string; t: number } | null = null;
  $effect(() => {
    const f = () => {
      if (document.hidden || !anruf) return;
      const a = anruf, d = Date.now() - a.t; anruf = null;
      if (d < 2500 || d > 3 * 36e5) return;
      const y = liste.find((z) => z.x.slug === a.slug); if (!y) return;
      offen[a.slug] = true; setTimeout(() => document.getElementById("nf-" + a.slug)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
      daten.melden(`Wie lief es mit ${y.x.name}? Tipp den Stand an.`);
    };
    document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f);
  });
  let gespeichert = $state<Record<string, boolean>>({});
  function kundenZeile(slug: string): string {
    const s = kunden[slug];
    if (!s?.stand) return "Website noch nicht übernommen.";
    if (s.stand === "vorschau") return "Vorschau fertig. Ansehen und live schalten.";
    if (s.stand === "wartet") return `Nameserver bei INWX eintragen, dann ist www.${s.domain} live.`;
    if (s.stand === "live") return `Live unter www.${s.domain}`;
    return STAND[s.stand]?.name ?? s.stand;
  }

  async function speichern(slug: string, neu: Partial<Eintrag>, was: string, rueck?: Eintrag | null) {
    const alt = eintraege[slug] ?? null;
    const basis: Eintrag = { slug, status: "offen", wieder: null, notiz: "", verlauf: [], zeit: null };
    const e: Eintrag = Object.assign(basis, alt ?? {}, neu, { zeit: new Date().toISOString() });
    if (neu.status || "wieder" in neu) e.verlauf = [...(alt?.verlauf ?? []), { zeit: e.zeit!, status: e.status, wieder: e.wieder }].slice(-30);
    eintraege[slug] = e;
    const { error } = await sb.from("nachfass").upsert({ slug, status: e.status, wieder: e.wieder, notiz: e.notiz, verlauf: e.verlauf, zeit: e.zeit });
    if (error) { if (alt) eintraege[slug] = alt; else delete eintraege[slug]; daten.melden(fehler(error)); return; }
    if (was) daten.melden(was, rueck !== undefined ? { label: "Rückgängig", fn: () => zurueck(slug, rueck) } : undefined);
  }
  async function zurueck(slug: string, alt: Eintrag | null) {
    if (alt) { eintraege[slug] = alt; await sb.from("nachfass").upsert(alt); }
    else { delete eintraege[slug]; await sb.from("nachfass").delete().eq("slug", slug); }
    daten.melden("Zurückgenommen");
  }
  function status(y: { x: Fall; n: Einschaetzung }, st: string) {
    const alt = eintraege[y.x.slug] ? structuredClone($state.snapshot(eintraege[y.x.slug])) as Eintrag : null;
    speichern(y.x.slug, { status: st, wieder: wiederFuer(st, alt?.wieder ?? null) }, `${y.x.name}: ${NF_STATUS[st]}`, alt);
  }
  function wieder(y: { x: Fall }, tag: string | null) {
    const alt = eintraege[y.x.slug] ? structuredClone($state.snapshot(eintraege[y.x.slug])) as Eintrag : null;
    speichern(y.x.slug, { wieder: tag }, tag ? `${y.x.name}: wieder ${tagText(tag)}` : "Wiedervorlage entfernt", alt);
  }
  const nt: Record<string, number> = {};
  function notiz(slug: string, text: string) {
    clearTimeout(nt[slug]);
    gespeichert[slug] = false;
    nt[slug] = setTimeout(async () => { await speichern(slug, { notiz: text.slice(0, 1200) }, ""); gespeichert[slug] = true; }, 900) as unknown as number;
  }
  async function testEntfernen(y: { x: Fall; n: Einschaetzung }) {
    const r = y.n.anfNeu ?? y.n.anf[0]; if (!r) return;
    if (!(await frage("Rückrufwunsch entfernen?", "Nur, wenn es ein Test war (z. B. du hast das Formular auf der Angebotsseite selbst ausprobiert). Der Wunsch und die Aufrufe dabei werden gelöscht.", "Entfernen", true))) return;
    const { data } = await sb.functions.invoke("zaehler", { body: { aktion: "anfrage_entfernen", slug: r.slug, zeit: r.zeit } });
    daten.melden(data?.ok ? "Rückrufwunsch entfernt" : "Nicht entfernt – bitte später nochmal");
    laden();
  }
  const kurzlink = (x: Fall) => { if (!x.kurz || !x.url) return x.url ?? ""; try { return new URL(x.url).origin + "/k/" + x.kurz; } catch { return x.url; } };
  async function linkSenden(x: Fall) {
    const e = agent.c.einstellungen;
    const text = `Guten Tag, hier ist der Entwurf für die neue Website von ${x.name}: ${kurzlink(x)} Viele Grüße, ${e?.absender || auth.ich?.name || "Daniel"}${e?.firma ? ", " + e.firma : ", Medialyte"}`;
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(text); daten.melden("Text mit Link kopiert"); } catch { daten.melden(kurzlink(x)); }
  }
  const tel = (y: { x: Fall; n: Einschaetzung }) => (y.n.anfNeu?.telefon ?? y.x.telefon ?? "").trim();
  const wahl = (t: string) => t.replace(/[^+\d]/g, "").replace(/^00/, "+").replace(/^0/, "+49");
  const TONE: Record<string, string> = { heiss: "rot", heute: "gelb", spaeter: "blau", erledigt: "grau" };
  const WOERTER: Record<string, string> = { heiss: "Heiß", heute: "Heute dran", spaeter: "Später", erledigt: "Erledigt" };
</script>

{#snippet karte(y: { x: Fall; n: Einschaetzung })}
  {@const x = y.x}{@const n = y.n}{@const auf = !!offen[x.slug]}
  <article class="nk card g-{n.g}" class:is-open={auf} id="nf-{x.slug}">
    <button class="nk__h" onclick={() => (offen[x.slug] = !auf)} aria-expanded={auf}>
      <span class="nk__t">
        <span class="nk__n"><b>{x.name}</b>{#if n.st !== "offen"}<span class="pill pill--plain pill--{n.st === 'kunde' || n.st === 'interesse' ? 'gruen' : n.st === 'kein_interesse' ? 'grau' : 'gelb'}">{NF_STATUS[n.st]}</span>{/if}</span>
        <small class="muted">{[x.branche, x.ort, x.verschickt ? "Brief " + datumLang(x.verschickt.slice(0, 10)) : "ohne Brief"].filter(Boolean).join(" · ")}</small>
        <span class="nk__g">{grund(n)}</span>
        {#if n.anfNeu?.nachricht}<q class="nk__q">{n.anfNeu.nachricht}</q>{/if}
        {#if n.st === "kunde"}<span class="nk__k">{kundenZeile(x.slug)}</span>{/if}
      </span>
      <span class="pill pill--{TONE[n.g]}">{WOERTER[n.g]}</span>
    </button>
    <div class="nk__a">
      {#if tel(y)}<a class="btn btn--s btn--primary" href="tel:{wahl(tel(y))}" onclick={() => (anruf = { slug: x.slug, t: Date.now() })}><Icon name="phone" size={14} />Anrufen</a>
      {:else}<a class="btn btn--s" href="https://www.google.com/maps/search/{encodeURIComponent(x.name + ' ' + (x.ort ?? ''))}" target="_blank" rel="noopener"><Icon name="search" size={14} />Nummer suchen</a>{/if}
      {#if x.url}<a class="btn btn--s btn--quiet" href={x.url} target="_blank" rel="noopener"><Icon name="external" size={14} />Demo</a>{/if}
      <button class="btn btn--s btn--quiet" onclick={() => linkSenden(x)}><Icon name="link" size={14} />Link senden</button>
      {#if x.betriebId}<a class="btn btn--s btn--quiet" href="#/akquise/betrieb/{x.betriebId}"><Icon name="letter" size={14} />Brief</a>{/if}
      {#if n.st === "kunde" && auth.darf("kunden")}<a class="btn btn--s" href="#/kunden/{x.slug}"><Icon name="globe" size={14} />Website übernehmen</a>{/if}
    </div>
    {#if auf}
      <div class="nk__d">
        {#if darf}
          <div class="seg" role="radiogroup" aria-label="Stand">
            {#each Object.entries(NF_STATUS) as [k, v]}<button role="radio" aria-checked={n.st === k} onclick={() => status(y, k)}>{v}</button>{/each}
          </div>
          {#if ["nicht_erreicht", "rueckruf", "interesse"].includes(n.st)}
            <div class="wv"><span class="muted">Wieder dran:</span>
              {#each [[1, "Morgen"], [3, "In 3 Tagen"], [7, "Nächste Woche"]] as [t, l]}<button class="btn btn--s" onclick={() => wieder(y, werktag(tagPlus(tagHeute(), t as number)))}>{l}</button>{/each}
              <input class="input dat" type="date" value={n.e.wieder ?? ""} onchange={(e) => wieder(y, (e.target as HTMLInputElement).value || null)}>
            </div>
          {/if}
          <label class="field"><span>Notiz{#if gespeichert[x.slug]}<small class="ok"> · Gespeichert</small>{/if}</span><textarea class="input" rows="2" maxlength="1200" value={n.e.notiz ?? ""} oninput={(e) => notiz(x.slug, (e.target as HTMLTextAreaElement).value)} placeholder="z. B. Inhaber ist ab 15 Uhr da"></textarea></label>
        {/if}
        <details class="sk"><summary>Was sage ich am Telefon?</summary>
          <div>{#each skript(x, n).text as p}<p>{p}</p>{/each}<p class="muted tipp">{skript(x, n).tipp}</p></div></details>
        <div class="nk__l">
          {#if x.url}<a href="{x.url.replace(/\/$/, '')}/angebot/" target="_blank" rel="noopener">Angebotsseite ansehen</a>{/if}
          {#if n.anfNeu?.telefon && x.telefon && wahl(n.anfNeu.telefon) !== wahl(x.telefon)}<a href="tel:{wahl(x.telefon)}">Restaurant: {x.telefon}</a>{/if}
          {#if darf && n.anf.length}<button class="lnk" onclick={() => testEntfernen(y)}>War nur ein Test: Rückrufwunsch entfernen</button>{/if}
        </div>
        <ol class="vl">{#each verlauf(n) as v}<li><time>{v.zeit ? zeitFmt.format(new Date(v.zeit)) : tagText(v.tag)}</time><span>{v.text}</span></li>{/each}</ol>
      </div>
    {/if}
  </article>
{/snippet}

<Head titel="Nachfassen" text="Wen du heute anrufen solltest – Rückrufwünsche und wer die Demo geöffnet hat stehen ganz oben. Am besten zwischen 15 und 17 Uhr." />

<div class="kz">
  <div class="card ton ton-gelb"><small>Heute dran</small><b class="num"><Zahl wert={gruppen.dran.length} /></b></div>
  <div class="card ton ton-grau"><small>Später</small><b class="num"><Zahl wert={gruppen.spaeter.length} /></b></div>
  <div class="card ton ton-gruen"><small>Kunden</small><b class="num"><Zahl wert={gruppen.neueKunden.length} /></b></div>
</div>

{#if laedt}<p class="muted">Lade …</p>
{:else if !faelle.length}<div class="card empty"><b>Noch niemand zum Nachfassen</b><p>Sobald ein Brief verschickt ist oder jemand um Rückruf bittet, steht der Betrieb hier.</p></div>
{:else}
  {#if gruppen.neueKunden.length}<h2 class="sec">Neue Kunden: Website übernehmen</h2><div class="list">{#each gruppen.neueKunden as y (y.x.slug)}{@render karte(y)}{/each}</div>{/if}
  <h2 class="sec">Jetzt anrufen</h2>
  {#if gruppen.dran.length}<div class="list">{#each gruppen.dran as y (y.x.slug)}{@render karte(y)}{/each}</div>
  {:else}<p class="muted">Heute ist niemand dran.{#if naechster} Als Nächstes: {naechster.x.name}, {tagText(naechster.n.faellig)}.{/if}</p>{/if}
  {#if gruppen.spaeter.length}<h2 class="sec">Später</h2><div class="list">{#each (spaeterAlle ? gruppen.spaeter : gruppen.spaeter.slice(0, 4)) as y (y.x.slug)}{@render karte(y)}{/each}</div>
    {#if gruppen.spaeter.length > 4}<button class="btn btn--s btn--quiet mehr" onclick={() => (spaeterAlle = !spaeterAlle)}>{spaeterAlle ? "Weniger anzeigen" : `Alle ${gruppen.spaeter.length} anzeigen`}</button>{/if}{/if}
  {#if gruppen.erledigt.length}
    <button class="btn btn--quiet sec" onclick={() => (zeigeErledigt = !zeigeErledigt)}><Icon name={zeigeErledigt ? "down" : "right"} size={15} />Erledigt ({gruppen.erledigt.length})</button>
    {#if zeigeErledigt}<div class="list">{#each gruppen.erledigt as y (y.x.slug)}{@render karte(y)}{/each}</div>{/if}
  {/if}
{/if}

<style>
  .kz { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 8px; max-width: 560px; }
  .kz .card { padding: 14px 16px; display: grid; }
  .kz small { color: var(--steel); font-size: .82rem; }
  .kz b { color: var(--text); font-size: 1.7rem; font-weight: 600; line-height: 1.2; }
  .sec { margin: 26px 0 10px; }
  .list { display: grid; gap: 10px; }
  .nk { padding: 0; overflow: hidden; border-left: 3px solid transparent; }
  .nk.g-heiss { border-left-color: var(--coral); }
  .nk.g-heute { border-left-color: var(--warn); }
  .nk__h { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; width: 100%; padding: 14px 16px 8px; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; }
  .nk__t { display: grid; gap: 3px; min-width: 0; }
  .nk__n { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .nk__n b { color: var(--text); font-weight: 600; font-size: 1.02rem; }
  .nk__t small { font-size: .8rem; }
  .nk__g { color: var(--text-2); font-size: .9rem; }
  .nk__k { font-size: .86rem; color: #6FD3A2; }
  .ok { color: #6FD3A2; font-size: .78rem; }
  .mehr { margin-top: 8px; }
  .nk__q { display: block; margin-top: 4px; padding: 8px 12px; border-radius: 8px; background: var(--bg-2); font-size: .88rem; color: var(--text-2); quotes: "„" "“"; }
  .nk__a { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 14px; }
  .nk__d { display: grid; gap: 14px; padding: 14px 16px 16px; border-top: 1px solid var(--line); }
  .seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .seg button { height: 34px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; }
  .seg button[aria-checked="true"] { background: var(--text); border-color: var(--text); color: var(--bg); font-weight: 600; }
  .wv { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .dat { width: auto; min-height: 32px; padding: 4px 10px; }
  .sk { border: 1px solid var(--line); border-radius: 10px; background: rgba(255, 255, 255, .02); }
  .sk summary { cursor: pointer; padding: 10px 12px; font-weight: 500; color: var(--text-2); font-size: .9rem; }
  .sk div { padding: 0 14px 12px; display: grid; gap: 6px; color: var(--text); font-size: .92rem; line-height: 1.55; }
  .tipp { font-size: .82rem; }
  .nk__l { display: flex; flex-wrap: wrap; gap: 14px; font-size: .86rem; }
  .nk__l a, .lnk { color: var(--text-2); text-decoration: underline; text-underline-offset: 3px; }
  .lnk { border: 0; background: none; padding: 0; cursor: pointer; font: inherit; }
  .vl { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: .82rem; }
  .vl li { display: grid; grid-template-columns: 150px 1fr; gap: 10px; color: var(--text-2); }
  .vl time { color: var(--steel); }
  @media (max-width: 520px) { .vl li { grid-template-columns: 1fr; gap: 0; } }
</style>
