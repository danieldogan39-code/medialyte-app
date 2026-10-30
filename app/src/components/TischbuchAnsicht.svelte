<script lang="ts">
  // Tischbuch im Handyrahmen (wie im Cockpit): die echte Oberfläche eines Restaurants nur zum Ansehen, das Beispiel-Tischbuch
  // mit erfundenen Daten oder „Agent ausprobieren“ (der echte Website-Agent arbeitet an einer Demo, online geht nichts).
  // Die Ansicht liegt bei der App (gleiche Adresse) und bekommt Restaurant und Lese-Zugang per Nachricht, nur von hier.
  import Icon from "./Icon.svelte";
  import { modalAuf, modalSanft, modalZu } from "../lib/bewegung";
  import { sb } from "../lib/supabase";
  import { daten } from "../lib/daten.svelte";
  import { hinweise, personen, tischbuch, wartet, dauer, type Lage } from "../lib/kunden";

  let { art, slug = "", name = "", link = null, onclose }: { art: "ansicht" | "beispiel" | "demo"; slug?: string; name?: string; link?: string | null; onclose: () => void } = $props();
  let dlg: HTMLDialogElement | undefined = $state(), frame: HTMLIFrameElement | undefined = $state();
  let zugang = $state<{ url: string; schluessel: string } | null>(null), src = $state("about:blank"), fehlerText = $state("");
  let lage = $state<{ lokal?: Lage & { geraete_liste?: any[]; telefon?: string; mail_aktiv?: boolean }; zeit?: number; fehler?: string } | null>(null);
  let demos = $state<{ slug: string; name: string; ort?: string; url?: string }[]>([]), demoSlug = $state(""), lokal = $state("");
  const MERK = "medialyte-agent-demo";

  async function zugangHolen() {
    const { data } = await sb.functions.invoke("zaehler", { body: { aktion: "zugang" } });
    if (!data?.ok) { fehlerText = data?.error ?? "Der Dienst ist gerade nicht erreichbar."; return false; }
    zugang = { url: data.url, schluessel: data.schluessel }; return true;
  }
  async function lageLaden() {
    if (art !== "ansicht" || !slug) return;
    const d = await tischbuch(slug);
    if (d.fehler) { if (lage?.lokal) lage = { ...lage, fehler: d.fehler }; else lage = { fehler: d.fehler }; return; }
    lage = { lokal: d.lokal as any, zeit: Date.now() };
  }
  async function demoStarten(s: string) {
    const d = demos.find((x) => x.slug === s) ?? demos[0]; if (!d) return;
    demoSlug = d.slug; try { localStorage.setItem(MERK, d.slug); } catch { /* egal */ }
    src = "about:blank"; fehlerText = "";
    const { data } = await sb.functions.invoke("zaehler", { body: { aktion: "agent_demo", slug: d.slug, name: d.name } });
    if (!data?.ok) { fehlerText = "Der Dienst ist gerade nicht erreichbar. Bitte gleich nochmal."; return; }
    lokal = data.lokal; src = "tischbuch-ansicht/index.html?l=" + encodeURIComponent(lokal);
  }
  $effect(() => {
    if (dlg) modalAuf(dlg);
    const sanft = dlg ? modalSanft(dlg) : () => {};
    let t = 0;
    (async () => {
      if (art === "beispiel") { src = "tischbuch-beispiel/index.html"; return; }
      if (!(await zugangHolen())) return;
      if (art === "ansicht") { lokal = slug; src = "tischbuch-ansicht/index.html?l=" + encodeURIComponent(slug); lageLaden(); t = setInterval(lageLaden, 30000) as unknown as number; }
      else {
        const { data } = await sb.from("demos").select("slug,url,betriebe(name,ort)").is("geloescht", null).limit(400);
        demos = ((data ?? []) as any[]).filter((x) => /^[a-z0-9-]{3,75}$/.test(x.slug)).map((x) => ({ slug: x.slug, url: x.url, name: x.betriebe?.name ?? x.slug, ort: x.betriebe?.ort }))
          .sort((a, b) => a.name.localeCompare(b.name, "de"));
        if (!demos.length) { fehlerText = "Es gibt gerade keine Demo, an der der Agent arbeiten könnte."; return; }
        let m = ""; try { m = localStorage.getItem(MERK) ?? ""; } catch { /* egal */ }
        demoStarten(m);
      }
    })();
    const nachricht = (e: MessageEvent) => {
      if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow || e.data?.typ !== "tb-bereit" || !zugang) return;
      frame.contentWindow!.postMessage({ typ: "tb-zugang", slug: lokal, name: art === "demo" ? demos.find((d) => d.slug === demoSlug)?.name ?? lokal : name || lokal,
        farbe: "", telefon: lage?.lokal?.telefon ?? "", dienst: zugang.url, schluessel: zugang.schluessel, demo: art === "demo" }, location.origin === "null" ? "*" : location.origin);
    };
    addEventListener("message", nachricht);
    return () => { clearInterval(t); removeEventListener("message", nachricht); sanft(); };
  });
  function neuLaden() { const s = src; src = "about:blank"; setTimeout(() => (src = s), 50); lageLaden(); }
  const l = $derived(lage?.lokal);
  const zeitText = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "");
</script>

<dialog bind:this={dlg} class="tb" onclose={onclose}>
  <div class="tb__in">
    <div class="tb__seite">
      <div class="kopf">
        <span class="art art--{art}">{art === "beispiel" ? "Beispiel" : art === "demo" ? "Agent-Demo" : "Nur ansehen"}</span>
        <h3>{art === "demo" ? "Website-Agent" : "Tischbuch"} <b>{art === "beispiel" ? "Lokal am Eck" : art === "demo" ? demos.find((d) => d.slug === demoSlug)?.name ?? "" : (l?.name || name)}</b></h3>
        <button class="btn btn--quiet btn--icon" onclick={() => modalZu(dlg)} aria-label="Schließen"><Icon name="x" /></button>
      </div>
      <p class="muted klein">
        {#if art === "beispiel"}So sieht das Tischbuch für deine Kunden aus. Alle Daten sind erfunden, nichts wird gesendet. Probier Bestätigen und Ablehnen, unten den Reiter „Website“ mit dem Agenten.
        {:else if art === "demo"}Schreib im Chat, was sich ändern soll, wie ein Wirt. Der echte Agent arbeitet an dieser Demo: Er fragt nach, wenn etwas unklar ist, und schickt eine echte Vorschau. Online geht nichts. Jede Nachricht dauert ein bis drei Minuten und kostet geschätzt 20–50 Cent.
        {:else}Genau das, was das Restaurant sieht, auch den Website-Agenten (Reiter „Website“ unten). Bestätigen und Senden sind hier gesperrt{link ? "; eingreifen kannst du über „Als Restaurant öffnen“." : "."}{/if}
      </p>
      {#if art === "demo" && demos.length}
        <label class="feld"><span>An dieser Demo arbeitet der Agent</span>
          <select class="input" value={demoSlug} onchange={(e) => demoStarten((e.target as HTMLSelectElement).value)}>{#each demos as d}<option value={d.slug}>{d.name}{d.ort ? ` · ${d.ort}` : ""}</option>{/each}</select></label>
        {#if demos.find((d) => d.slug === demoSlug)?.url}<a class="lnk" href={demos.find((d) => d.slug === demoSlug)?.url} target="_blank" rel="noopener">Demo-Seite öffnen</a>{/if}
      {/if}
      {#if art === "ansicht"}
        {#if l}
          {#if wartet(l)}<p class="hw hw--rot"><b>{l.offen === 1 ? "Ein Gast wartet" : `Die älteste von ${l.offen} Anfragen wartet`} seit {dauer(Date.now() - Date.parse(l.offen_seit!))} auf Antwort.</b>{#if l.telefon} Vielleicht kurz beim Restaurant anrufen: <a href="tel:{l.telefon.replace(/[^\d+]/g, '')}">{l.telefon}</a>.{/if}</p>{/if}
          <p class="zahlen">{l.offen ?? 0} offen · heute {l.heute_tische ?? 0} {l.heute_tische === 1 ? "Tisch" : "Tische"} · {l.kommend ?? 0} kommend · {l.woche ?? 0} Anfragen in 7 Tagen</p>
          <dl>
            <dt>Benachrichtigungen</dt><dd>{#if (l.geraete_liste ?? []).length}{(l.geraete_liste ?? []).map((g: any) => g.geraet || "Gerät").join(", ")}{:else}<span class="warn">keine eingeschaltet</span>{/if}</dd>
            <dt>Automatisch bestätigen</dt><dd>{l.auto_regel?.an ? `an, bis ${personen(l.auto_regel.max)}, ${(l.auto_regel as any).tische ?? 0} ${(l.auto_regel as any).tische === 1 ? "Tisch" : "Tische"} je Uhrzeit` : "aus"}</dd>
            <dt>Online-Anfragen</dt><dd>{#if l.pause_alle}<span class="warn">pausiert</span>{:else if l.pause_bis}<span class="warn">pausiert bis {l.pause_bis.split("-").reverse().join(".")}</span>{:else}an{/if}</dd>
            <dt>Mails an Gäste</dt><dd>{l.mail_aktiv ? "an" : "aus"}</dd>
            {#if l.telefon}<dt>Restaurant</dt><dd><a href="tel:{l.telefon.replace(/[^\d+]/g, '')}">{l.telefon}</a></dd>{/if}
          </dl>
          {#each hinweise(l).filter((h) => h[0] !== "rot") as [ton, text]}<p class="hw hw--{ton}">{text}</p>{/each}
          <small class="muted">{lage?.fehler ? `Dienst nicht erreichbar · Stand ${zeitText(lage.zeit)} Uhr` : `Lage aus dem Dienst, Stand ${zeitText(lage?.zeit)} Uhr`}</small>
        {:else if lage?.fehler}<p class="hw hw--gelb">{lage.fehler}</p>{/if}
      {/if}
      {#if fehlerText}<p class="hw hw--gelb">{fehlerText}</p>{/if}
      <div class="knoepfe">
        {#if link}<a class="btn btn--s" href={link} target="_blank" rel="noopener" title="Öffnet das Tischbuch so, wie das Restaurant es nutzt. Dort entscheidest du im Namen des Restaurants."><Icon name="external" size={14} />Als Restaurant öffnen</a>{/if}
        <button class="btn btn--s btn--quiet" onclick={neuLaden}><Icon name="refresh" size={14} />Neu laden</button>
      </div>
    </div>
    <div class="handy"><iframe bind:this={frame} {src} title="Tischbuch"></iframe></div>
  </div>
</dialog>

<style>
  .tb { padding: 0; border: 0; background: transparent; max-width: min(980px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); width: 100%; color: var(--text); }
  .tb::backdrop { background: rgba(4, 8, 16, .72); }
  .tb__in { display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 18px; align-items: start; background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius); padding: 18px; }
  .tb__seite { display: grid; gap: 12px; align-content: start; }
  .kopf { display: flex; align-items: center; gap: 10px; }
  .kopf h3 { flex: 1; margin: 0; font-weight: 500; }
  .kopf h3 b { font-weight: 600; }
  .art { font-size: .74rem; padding: 3px 9px; border-radius: 999px; background: rgba(255, 255, 255, .07); color: var(--text-2); white-space: nowrap; }
  .art--demo, .art--beispiel { background: rgba(167, 139, 250, .16); color: #BBA6FB; }
  .klein { font-size: .86rem; line-height: 1.5; margin: 0; }
  .feld { display: grid; gap: 5px; font-size: .84rem; color: var(--text-2); }
  .lnk { color: var(--text-2); text-decoration: underline; font-size: .86rem; }
  .zahlen { margin: 0; color: var(--text); }
  dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: .88rem; }
  dt { color: var(--steel); }
  dd { margin: 0; }
  .warn { color: #EBC56B; }
  .hw { margin: 0; font-size: .86rem; line-height: 1.45; padding: 8px 10px; border-radius: var(--radius-s); }
  .hw--rot { background: rgba(242, 74, 74, .12); color: #FF9C9C; }
  .hw--gelb { background: rgba(231, 185, 74, .10); color: #EBC56B; }
  .hw--gruen { background: rgba(76, 195, 138, .10); color: #7FD9AE; }
  .knoepfe { display: flex; gap: 6px; flex-wrap: wrap; }
  .handy { width: 390px; height: min(780px, calc(100dvh - 80px)); border-radius: 34px; border: 9px solid #05080F; background: #F4F3F0; overflow: hidden; box-shadow: 0 30px 80px -30px rgba(0, 0, 0, .9); }
  .handy iframe { width: 100%; height: 100%; border: 0; display: block; }
  @media (max-width: 860px) {
    .tb { max-width: 100vw; max-height: 100dvh; height: 100dvh; margin: 0; }
    .tb__in { grid-template-columns: minmax(0, 1fr); border-radius: 0; height: 100%; overflow: auto; padding: 14px; }
    .handy { width: 100%; height: 75dvh; border-radius: 16px; border-width: 1px; }
  }
</style>
