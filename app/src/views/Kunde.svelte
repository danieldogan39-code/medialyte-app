<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { befehl } from "../lib/befehl";
  import { frage } from "../lib/frage.svelte";
  import TischbuchAnsicht from "../components/TischbuchAnsicht.svelte";
  import { datum, datumKurz, vor } from "../lib/format";
  import { IMPRESSUM, STAND, datenschutzVorlage, demoLesen, domainPruefen, domainVorschlag, fotoHochladen, hinweise, personen, standMit, tischbuch,
    type DemoInfo, type Impressum, type Kunde, type Lage } from "../lib/kunden";

  let { slug }: { slug: string } = $props();
  const darf = $derived(auth.darf("kunden", true));

  let k = $state<Kunde | null>(null), demo = $state<any>(null), info = $state<DemoInfo | null>(null), link = $state<string | null>(null);
  let befehle = $state<any[]>([]), geladen = $state(false);
  let domain = $state(""), imp = $state<Partial<Impressum>>({}), ds = $state("");
  let eigen = $state<Set<number>>(new Set()), aus = $state<Set<number>>(new Set()), bilder = $state<Record<number, string>>({}), laedtFoto = $state<Record<number, boolean>>({});
  let markieren = $state(false), sendet = $state(false), formGeladen = "";
  let ansicht = $state(false);
  let tb = $state<{ lokal?: Lage; anfragen?: any[]; heute?: string; fehler?: string } | null>(null);

  async function befehleLaden() {
    const { data } = await sb.from("befehle").select("id,art,ziel,daten,status,ergebnis,erstellt").in("art", ["kunde", "kunde_agent_zurueck"]).eq("ziel", slug)
      .order("erstellt", { ascending: false }).limit(10);
    befehle = data ?? [];
  }
  async function laden() {
    const [a, d, z] = await Promise.all([
      sb.from("kunden").select("*").eq("slug", slug).maybeSingle(),
      sb.from("demos").select("url,betrieb_id,betriebe(id,name,telefon,ort,branche)").eq("slug", slug).maybeSingle(),
      darf ? sb.from("kunden_zugang").select("tischbuch").eq("slug", slug).maybeSingle() : Promise.resolve({ data: null }),
      befehleLaden(),
    ]);
    k = (a.data as Kunde) ?? null; demo = d.data; link = (z.data as any)?.tischbuch ?? null; geladen = true;
    if (formGeladen !== slug) await formular();
    if (s.vorschau || s.stand === "live") tb = await tischbuch(slug);
  }
  /** Formular aus den gespeicherten Angaben, sonst mit Vorschlägen aus Betrieb und Demo */
  async function formular() {
    formGeladen = slug;
    const e = k?.eingaben ?? {}, b = demo?.betriebe;
    domain = e.domain ?? k?.stand?.domain ?? domainVorschlag(b?.name ?? k?.name ?? slug);
    imp = { firma: b?.name ?? k?.name ?? "", telefon: b?.telefon ?? "", ...(e.impressum ?? {}) };
    eigen = new Set(e.fotos_eigen ?? []); aus = new Set(e.fotos_aus ?? []); ds = e.datenschutz ?? "";
    if (eigen.size) {
      const { data } = await sb.storage.from("kundenfotos").createSignedUrls([...eigen].map((n) => `${slug}/${n}.jpg`), 3600);
      const neu: Record<number, string> = {};
      for (const x of data ?? []) if (x.signedUrl && x.path) neu[Number(x.path.split("/")[1].split(".")[0])] = x.signedUrl;
      bilder = neu;
    }
    if (demo?.url) {
      info = await demoLesen(demo.url);
      if (!imp.strasse && info.adresse.strasse) imp.strasse = info.adresse.strasse;
      if (!imp.plz_ort && info.adresse.plz_ort) imp.plz_ort = info.adresse.plz_ort;
      if (!ds) ds = await datenschutzVorlage(info);
    } else info = { fotos: [], adresse: {}, reservierung: true, karte: false, fehler: true };
  }
  $effect(() => {
    slug; formGeladen = ""; laden();
    const c = sb.channel("kunde-" + slug)
      .on("postgres_changes", { event: "*", schema: "public", table: "kunden", filter: `slug=eq.${slug}` }, () => laden())
      .on("postgres_changes", { event: "*", schema: "public", table: "befehle" }, () => befehleLaden())
      .subscribe();
    return () => { sb.removeChannel(c); };
  });

  const s = $derived(standMit(k, befehle));
  const name = $derived(demo?.betriebe?.name ?? k?.name ?? slug);
  const istLive = $derived(s.stand === "live" || s.stand === "wartet");
  const baut = $derived(s.stand === "baut");
  const fotos = $derived(info?.fotos ?? []);
  const googleOffen = $derived(fotos.filter((_, i) => !eigen.has(i + 1) && !aus.has(i + 1)).length);
  const fehlt = $derived.by(() => {
    const f: string[] = [];
    if (!domainPruefen(domain)) f.push("Domain");
    for (const x of IMPRESSUM) if (x.pflicht && !String(imp[x.k] ?? "").trim()) f.push(x.label);
    if (imp.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(imp.email)) f.push("gültige E-Mail");
    if (ds.trim().length < 200) f.push("Datenschutzerklärung");
    return f;
  });
  const leer = (k: keyof Impressum) => markieren && IMPRESSUM.find((x) => x.k === k)?.pflicht && !String(imp[k] ?? "").trim();

  async function fotoWaehlen(nr: number, e: Event) {
    const datei = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value = "";
    if (!datei) return;
    laedtFoto[nr] = true;
    const f = await fotoHochladen(slug, nr, datei).catch((x) => String(x?.message ?? x));
    laedtFoto[nr] = false;
    if (f) { daten.melden("Foto nicht hochgeladen: " + f); return; }
    if (bilder[nr]?.startsWith("blob:")) URL.revokeObjectURL(bilder[nr]);
    bilder[nr] = URL.createObjectURL(datei);
    eigen = new Set([...eigen, nr]); const a = new Set(aus); a.delete(nr); aus = a;
    daten.melden(`Foto ${nr} ersetzt`);
  }
  async function fotoUmschalten(nr: number) {
    if (eigen.has(nr)) {  // eigenes Foto weg: wieder das Google-Foto (nur bis zum Live schalten erlaubt)
      await sb.storage.from("kundenfotos").remove([`${slug}/${nr}.jpg`]);
      const e = new Set(eigen); e.delete(nr); eigen = e; delete bilder[nr];
      return;
    }
    const a = new Set(aus); if (a.has(nr)) a.delete(nr); else a.add(nr); aus = a;
  }

  async function auftrag(art: "vorschau" | "live") {
    markieren = true;
    if (fehlt.length || (art === "live" && googleOffen)) { document.getElementById("k-fehlt")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
    if (art === "live" && !istLive && !(await frage(`${name} live schalten?`, `Die Website geht unter www.${domainPruefen(domain)} online. Danach zeigt die App die zwei Nameserver, die du einmal bei INWX einträgst.`, "Live schalten"))) return;
    sendet = true;
    const ok = await befehl("kunde", { slug, name, domain: domainPruefen(domain), impressum: imp, datenschutz: ds.trim(), fotos_aus: [...aus].filter((n) => !eigen.has(n)),
      fotos_eigen: [...eigen], auftrag: art }, slug, art === "live" ? `${name} wird live geschaltet …` : `Vorschau für ${name} wird gebaut (ein paar Minuten) …`);
    sendet = false; markieren = false;
    if (ok) befehleLaden();
  }
  async function zuruecknehmen(g: string, text: string) {
    if (!(await frage("Änderung zurücknehmen?", `„${text}“ wird auf der Website des Restaurants rückgängig gemacht. Das Restaurant sieht es auch in seinem Chat.`, "Zurücknehmen"))) return;
    if (await befehl("kunde_agent_zurueck", { slug, gruppe: g, name }, slug, "Wird zurückgenommen …")) befehleLaden();
  }
  const zuruecklaufend = (g: string) => befehle.some((b) => b.art === "kunde_agent_zurueck" && b.daten?.gruppe === g && b.status !== "fehler");
  const letzteGruppe = $derived((k?.betreuung?.aenderungen ?? []).find((a) => a.status === "live")?.gruppe);

  async function kopieren(t: string, was: string) {
    try { await navigator.clipboard.writeText(t); daten.melden(`${was} kopiert`); } catch { daten.melden(t); }
  }
  async function tischbuchSenden() {
    if (!link) return;
    const text = `Guten Tag, hier ist Ihr Tischbuch für ${name}: ${link}\nEinmal öffnen, „Zum Startbildschirm hinzufügen“ und Benachrichtigungen einschalten. Neue Tischanfragen bestätigen Sie dann mit einem Tipp. Viele Grüße, ${auth.ich?.name ?? "Daniel"}, Medialyte`;
    try { if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ text }); return; } } catch { return; }
    kopieren(text, "Nachricht mit dem Tischbuch-Link");
  }
  const kommend = $derived((tb?.anfragen ?? []).filter((a) => a.datum >= (tb?.heute ?? "") && a.status !== "abgelehnt")
    .sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit)).slice(0, 12));
</script>

<Head titel={name} text={s.stand ? (STAND[s.stand]?.name ?? s.stand) + (s.domain ? " · www." + s.domain : "") : "Aus der Demo wird die echte Website"} zurueck="#/kunden">
  {#if demo?.url}<a class="btn" href={demo.url} target="_blank" rel="noopener"><Icon name="external" size={16} />Demo</a>{/if}
  {#if demo?.betrieb_id}<a class="btn btn--quiet" href="#/akquise/betrieb/{demo.betrieb_id}">Betrieb</a>{/if}
</Head>

{#if geladen}
  <!-- Stand der Übernahme -->
  <section class="card lage lage--{STAND[s.stand ?? '']?.ton ?? 'neu'}" aria-live="polite">
    {#if !s.stand}
      <p><b>So geht es:</b> Domain und Impressum eintragen (Adresse und Telefon stehen schon drin), Google-Fotos durch Fotos des Restaurants ersetzen oder ausblenden, dann Vorschau bauen. Live schalten geht danach mit einem Tipp.</p>
    {:else if baut}
      <p><span class="punkt"></span>{s.art === "live" ? "Wird gebaut und live geschaltet." : "Die Vorschau wird gebaut."} Das dauert ein paar Minuten, die App aktualisiert sich von selbst.</p>
    {:else if s.stand === "vorschau"}
      <p>Die Vorschau ist fertig. Schau sie dir an; wenn alles passt: live schalten.</p>
    {:else if s.stand === "wartet"}
      <p><b>Letzter Schritt bei INWX:</b> Domain <b>{s.domain}</b> öffnen → Nameserver → eigene Nameserver eintragen (antippen zum Kopieren):</p>
      <div class="ns">{#each s.nameserver ?? [] as n}<button onclick={() => kopieren(n, "Nameserver")}><span>{n}</span><small>Kopieren</small></button>{/each}</div>
      <p class="muted">Danach dauert es meist ein paar Stunden, bis www.{s.domain} live ist. {(s.mx ?? []).length ? `E-Mail des Restaurants läuft weiter (übernommen: ${s.mx!.join(", ")}).` : "Unter dieser Domain gab es keine E-Mail-Einträge."}</p>
    {:else if s.stand === "live"}
      <p><b>Live unter www.{s.domain}</b>{s.live_seit ? " seit " + datum(s.live_seit) : ""}. Reservierungen landen im Tischbuch des Restaurants.</p>
    {:else}
      <p><b>Hat nicht geklappt:</b> {s.fehler ?? "unbekannter Fehler"}</p><p class="muted">Angaben prüfen und nochmal bauen.</p>
    {/if}
    {#if !baut && (s.vorschau || s.stand === "live" || link)}
      <div class="reihe">
        {#if s.stand === "live"}<a class="btn btn--s" href="https://www.{s.domain}/" target="_blank" rel="noopener"><Icon name="external" size={15} />Website öffnen</a>
        {:else if s.vorschau}<a class="btn btn--s" href={s.vorschau} target="_blank" rel="noopener"><Icon name="external" size={15} />Vorschau ansehen</a>{/if}
        {#if link}
          <button class="btn btn--s" onclick={tischbuchSenden}><Icon name="whatsapp" size={15} />Tischbuch-Link ans Restaurant</button>
          <a class="btn btn--s btn--quiet" href={link} target="_blank" rel="noopener" title="Dort entscheidest du im Namen des Restaurants">Als Restaurant öffnen</a>
        {/if}
      </div>
    {/if}
  </section>

  {@const rechts = !!((k?.betreuung?.aenderungen ?? []).length || k?.betreuung?.kandidat || tb)}
  <div class="cols" class:eins={!rechts}>
    <form class="card form" onsubmit={(e) => { e.preventDefault(); auftrag("vorschau"); }}>
      <fieldset disabled={!darf || baut}>
        <h3>Domain</h3>
        <label class="feld"><span>Adresse der Website<i>&nbsp;(ohne www)</i></span>
          <input class="input" bind:value={domain} autocapitalize="off" spellcheck="false" aria-invalid={markieren && !domainPruefen(domain)} placeholder="lokal-am-eck.de"></label>
        <p class="muted klein">Die Domain registrierst du bei INWX. Beim Live schalten hängt der Agent sie an die Website, SSL inklusive.</p>

        <h3>Impressum</h3>
        <div class="imp">
          {#each IMPRESSUM as x (x.k)}
            <label class="feld" class:breit={x.breit}><span>{x.label}{#if x.hinweis}<i>&nbsp;({x.hinweis})</i>{/if}</span>
              <input class="input" type={x.typ ?? "text"} bind:value={imp[x.k]} aria-invalid={!!leer(x.k)} autocapitalize={x.typ === "email" ? "off" : undefined}></label>
          {/each}
        </div>

        <h3>Fotos</h3>
        {#if !info}<p class="muted klein">Fotos der Demo werden geladen …</p>
        {:else if info.fehler && !fotos.length}<p class="muted klein">Die Demo ließ sich nicht lesen. Fotos können erst nach dem nächsten Laden ersetzt werden.</p>
        {:else if !fotos.length}<p class="muted klein">Die Seite nutzt keine Fotos von Google Maps.</p>
        {:else}
          <p class="muted klein">{googleOffen ? `${fotos.length} ${fotos.length === 1 ? "Foto stammt" : "Fotos stammen"} von Google Maps und dürfen nicht auf die echte Website. Fotos vom Restaurant (gern per WhatsApp schicken lassen) hier hochladen oder ausblenden. Noch offen: ${googleOffen}.` : "Alle Google-Fotos sind ersetzt oder ausgeblendet."}</p>
          <div class="fotos">
            {#each fotos as u, i (u)}
              {@const nr = i + 1}{@const art = eigen.has(nr) ? "eigen" : aus.has(nr) ? "aus" : "google"}
              <div class="foto foto--{art}" class:laedt={laedtFoto[nr]}>
                {#if art !== "eigen" || bilder[nr]}<img src={art === "eigen" ? bilder[nr] : u} alt="Foto {nr}" loading="lazy" referrerpolicy="no-referrer">{:else}<span class="bild"></span>{/if}
                <span class="marke">{art === "eigen" ? "Eigenes Foto" : art === "aus" ? "Ausgeblendet" : "Google"}</span>
                <div class="wahl">
                  <label class="btn btn--s">{art === "eigen" ? "Anderes" : "Ersetzen"}<input type="file" accept="image/*" onchange={(e) => fotoWaehlen(nr, e)} aria-label="Foto {nr} ersetzen"></label>
                  <button type="button" class="btn btn--s btn--quiet" onclick={() => fotoUmschalten(nr)}>{art === "aus" ? "Einblenden" : art === "eigen" ? "Google" : "Ausblenden"}</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <h3>Datenschutzerklärung</h3>
        <p class="muted klein">Vorlage aus den Bausteinen des Agenten, passend zu dem, was die Seite nutzt. Bitte prüfen. „## “ ist eine Überschrift, „- “ ein Aufzählungspunkt.</p>
        <textarea class="input ds" rows="12" bind:value={ds} aria-invalid={markieren && ds.trim().length < 200}></textarea>
        {#if info && !info.fehler}<button type="button" class="lnk" onclick={async () => (ds = await datenschutzVorlage(info!))}>Vorlage neu einsetzen</button>{/if}
      </fieldset>

      {#if darf}
        <div class="fuss">
          {#if markieren && (fehlt.length || googleOffen)}
            <p id="k-fehlt" class="fehlt">{fehlt.length ? `Es fehlt noch: ${fehlt.join(", ")}.` : ""}{googleOffen ? ` Zum Live schalten: ${googleOffen} ${googleOffen === 1 ? "Google-Foto" : "Google-Fotos"} ersetzen oder ausblenden.` : ""}</p>
          {/if}
          <div class="knoepfe">
            {#if !istLive}<button class="btn" type="submit" disabled={baut || sendet}>{s.vorschau ? "Neu bauen" : "Vorschau bauen"}</button>{/if}
            <button class="btn btn--primary" type="button" onclick={() => auftrag("live")} disabled={baut || sendet}>{istLive ? "Neu veröffentlichen" : "Live schalten"}</button>
          </div>
        </div>
      {/if}
    </form>

    <div class="stack">
      {#if (k?.betreuung?.aenderungen ?? []).length || k?.betreuung?.kandidat}
        <section class="card box">
          <h3>Website-Agent</h3>
          <p class="muted klein">Was das Restaurant über den Chat im Tischbuch an seiner Website geändert hat.</p>
          {#if k?.betreuung?.kandidat}
            <p class="klein">Offene Vorschau: {(k.betreuung.kandidat.teile ?? []).map((t: any) => t.zusammenfassung).join("; ")}{#if k.betreuung.kandidat.vorschau} · <a href={k.betreuung.kandidat.vorschau} target="_blank" rel="noopener">ansehen</a>{/if}</p>
          {/if}
          <ul class="ag">
            {#each (k?.betreuung?.aenderungen ?? []).slice(0, 8) as a (a.id)}
              <li class:weg={a.status !== "live"}>
                <time>{datumKurz(a.live_seit ?? a.zeit)}</time>
                <span><b>{a.zusammenfassung || "Änderung"}</b><small class="muted">„{a.auftrag}“{a.status !== "live" ? " · zurückgenommen" : ""}</small></span>
                {#if darf && a.status === "live" && a.gruppe === letzteGruppe}
                  {#if zuruecklaufend(a.gruppe)}<small class="muted">wird zurückgenommen …</small>
                  {:else}<button class="btn btn--s" onclick={() => zuruecknehmen(a.gruppe, a.zusammenfassung)}>Rückgängig</button>{/if}
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if tb}
        <section class="card box">
          <div class="tbk"><h3>Tischbuch</h3>{#if darf && !tb.fehler}<button class="btn btn--s" onclick={() => (ansicht = true)}><Icon name="eye" size={14} />Live ansehen</button>{/if}</div>
          {#if tb.fehler}<p class="muted klein">{tb.fehler}</p>
          {:else if tb.lokal}
            {#each hinweise(tb.lokal) as [ton, text]}<p class="hw hw--{ton}">{text}</p>{/each}
            <div class="werte">
              <span class:rot={!!tb.lokal.offen}><b class="num">{tb.lokal.offen ?? 0}</b>offen</span>
              <span><b class="num">{tb.lokal.heute_tische ?? 0}</b>heute</span>
              <span><b class="num">{tb.lokal.kommend ?? 0}</b>kommend</span>
              <span><b class="num">{tb.lokal.woche ?? 0}</b>in 7 Tagen</span>
            </div>
            {#if kommend.length}
              <ul class="res">
                {#each kommend as a (a.id)}
                  <li><span class="pill pill--plain pill--{a.status === 'bestaetigt' ? 'gruen' : 'gelb'}">{a.status === "bestaetigt" ? "Bestätigt" : "Offen"}</span>
                    <span><span><b>{datumKurz(a.datum + "T12:00:00Z")}, {a.uhrzeit}</b> · {personen(a.personen)}</span><small class="muted">{a.name}{a.status === "offen" ? " · angefragt " + vor(a.zeit) : ""}</small></span></li>
                {/each}
              </ul>
            {:else}<p class="muted klein">Keine kommenden Reservierungen.</p>{/if}
            <p class="muted klein">Nur zum Ansehen. Gästedaten kommen live aus dem Tischbuch und werden in der App nicht gespeichert.</p>
          {/if}
        </section>
      {/if}
    </div>
  </div>
{/if}
{#if ansicht}<TischbuchAnsicht art="ansicht" {slug} {name} {link} onclose={() => (ansicht = false)} />{/if}

<style>
  .tbk { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
  .tbk h3 { margin: 0 !important; }
  .lage { padding: 16px 20px; display: grid; gap: 10px; margin-bottom: 14px; }
  .lage p { margin: 0; line-height: 1.5; }
  .lage--gruen { border-color: rgba(76, 195, 138, .4); }
  .lage--gelb { border-color: rgba(231, 185, 74, .4); }
  .lage--rot { border-color: rgba(242, 74, 74, .45); }
  .lage--blau { border-color: rgba(111, 168, 240, .4); }
  .punkt { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--warn); margin-right: 8px; animation: puls 1.4s ease-in-out infinite; }
  @keyframes puls { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .punkt { animation: none; } }
  .reihe { display: flex; gap: 8px; flex-wrap: wrap; }
  .ns { display: flex; gap: 8px; flex-wrap: wrap; }
  .ns button { display: grid; gap: 2px; text-align: left; padding: 8px 12px; border-radius: var(--radius-s); border: 1px solid var(--line-2); background: var(--bg-2); color: var(--text); cursor: pointer; font: inherit; }
  .ns button span { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9rem; }
  .ns small { color: var(--steel); font-size: .74rem; }
  .cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
  .cols.eins { grid-template-columns: minmax(0, 860px); }
  @media (max-width: 1000px) { .cols { grid-template-columns: minmax(0, 1fr); } .cols .stack { order: -1; } }
  .stack { display: grid; gap: 14px; }
  .form { padding: 6px 20px 20px; }
  fieldset { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 10px; }
  .form h3 { margin-top: 16px; }
  .feld { display: grid; gap: 5px; font-size: .84rem; color: var(--text-2); }
  .feld i { color: var(--steel); font-style: normal; }
  .imp { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
  .imp .breit { grid-column: 1 / -1; }
  @media (max-width: 560px) { .imp { grid-template-columns: minmax(0, 1fr); } }
  .input[aria-invalid="true"] { border-color: rgba(242, 74, 74, .7); }
  .klein { font-size: .84rem; line-height: 1.45; }
  .ds { font-size: .88rem; min-height: 220px; }
  .lnk { justify-self: start; border: 0; background: none; color: var(--text-2); text-decoration: underline; cursor: pointer; font: inherit; font-size: .86rem; padding: 0; }
  .fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .foto { position: relative; border-radius: var(--radius-s); overflow: hidden; border: 1px solid var(--line); background: var(--bg-2); display: grid; }
  .foto img, .foto .bild { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
  .foto--aus img { opacity: .25; filter: grayscale(1); }
  .foto--google { border-color: rgba(231, 185, 74, .5); }
  .foto--eigen { border-color: rgba(76, 195, 138, .5); }
  .foto.laedt { opacity: .5; pointer-events: none; }
  .marke { position: absolute; top: 6px; left: 6px; font-size: .72rem; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: rgba(8, 14, 26, .78); color: var(--text); }
  .wahl { display: flex; gap: 4px; padding: 6px; flex-wrap: wrap; }
  .wahl label { position: relative; overflow: hidden; cursor: pointer; }
  .wahl input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .fuss { display: grid; gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
  .fehlt { margin: 0; color: #FF9C9C; font-size: .9rem; }
  .knoepfe { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .box { padding: 6px 20px 18px; display: grid; gap: 10px; }
  .box h3 { margin-top: 10px; }
  .box p { margin: 0; }
  .ag, .res { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .ag li { display: grid; grid-template-columns: 76px 1fr auto; gap: 10px; align-items: start; font-size: .88rem; }
  .ag li.weg b { text-decoration: line-through; color: var(--steel); }
  .ag time { color: var(--steel); font-size: .8rem; padding-top: 2px; }
  .ag span, .res li > span:last-child { display: grid; gap: 2px; }
  .ag b, .res b { font-weight: 500; color: var(--text); }
  .res li { display: flex; gap: 10px; align-items: flex-start; font-size: .88rem; color: var(--text-2); }
  .werte { display: flex; gap: 18px; flex-wrap: wrap; }
  .werte > span { display: grid; font-size: .78rem; color: var(--steel); }
  .werte b { font-size: 1.15rem; color: var(--text); font-weight: 600; }
  .werte .rot b { color: #FF8080; }
  .hw { font-size: .84rem; line-height: 1.4; padding: 8px 10px; border-radius: var(--radius-s); }
  .hw--rot { background: rgba(242, 74, 74, .12); color: #FF9C9C; }
  .hw--gelb { background: rgba(231, 185, 74, .10); color: #EBC56B; }
  .hw--gruen { background: rgba(76, 195, 138, .10); color: #7FD9AE; }
</style>
