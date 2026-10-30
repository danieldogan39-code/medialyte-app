<script lang="ts">
  import Zahl from "../components/Zahl.svelte";
  // Kosten & Verbrauch des Agenten (letzte 30 Tage, Schätzwerte aus config.yaml) und die KI-Analyse dazu
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { agent, TOOL_NAME } from "../lib/agent.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { befehl } from "../lib/befehl";
  import { datum, datumZeit, zahl } from "../lib/format";

  const v = $derived(agent.c.verbrauch);
  const a = $derived(agent.c.kostenanalyse);
  const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const eurFein = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const TCOL: Record<string, string> = { anthropic: "#D9A47A", recraft: "#B58CF0", google: "#7BAFFF", elevenlabs: "#4CC38A", github: "#AEB9CA", letterxpress: "#F24A4A" };
  const maxTool = $derived(Math.max(0.0001, ...(v?.tools ?? []).map((t) => t.eur)));
  const FREI: Record<string, string> = { google_suche: "Google-Suchen", google_details: "Google-Details", google_fotos: "Google-Fotos", github_minuten: "GitHub-Minuten" };
  const frei = $derived.by(() => {
    const f: [string, number, number][] = Object.entries(FREI).map(([k, n]) => [n, v?.freikontingente?.[k]?.[0] ?? 0, v?.freikontingente?.[k]?.[1] ?? 1]);
    const sk = v?.stimme_konto;
    if (sk?.limit) f.push([`ElevenLabs-Zeichen${sk.tarif ? ` (${sk.tarif})` : ""}${sk.reset ? `, neu ab ${datum(sk.reset)}` : ""}`, sk.verbraucht ?? 0, sk.limit]);
    return f;
  });
  const MENGE: Record<string, string> = { eingabe: "Tokens rein", ausgabe: "Tokens raus", eingabe_stapel: "Tokens rein (Stapel)", ausgabe_stapel: "Tokens raus (Stapel)",
    cache_lesen: "Cache gelesen", cache_schreiben: "Cache geschrieben", aufrufe: "Aufrufe", bilder: "Bilder", vektoren: "Vektoren", freistellungen: "Freistellungen",
    suche: "Suchen", details: "Details", fotos: "Fotos", zeichen: "Zeichen", minuten: "Minuten", briefe: "Briefe" };
  const menge = (p: any) => Object.keys(MENGE).filter((k) => p[k]).map((k) => `${zahl(Math.round(p[k]))} ${MENGE[k]}`).join(" · ") || "–";

  let gestartet = $state<number>(0);
  const laeuft = $derived(!!gestartet && (!a || Date.parse(a.erstellt) < gestartet) && Date.now() - gestartet < 300000);
  async function analyse() {
    if (await befehl("analyse", {}, undefined, "KI-Analyse gestartet. Das Ergebnis erscheint hier automatisch.")) gestartet = Date.now();
  }
  // kleine, sichere Markdown-Darstellung (Überschriften, Listen, fett)
  function md(t: string) {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inl = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
    const out: string[] = []; let liste = false;
    for (const z of String(t ?? "").split("\n")) {
      const l = z.trim();
      if (/^[-*] /.test(l)) { if (!liste) { out.push("<ul>"); liste = true; } out.push(`<li>${inl(l.slice(2))}</li>`); continue; }
      if (liste) { out.push("</ul>"); liste = false; }
      if (/^#{1,4} /.test(l)) out.push(`<h4>${inl(l.replace(/^#+ /, ""))}</h4>`);
      else if (l) out.push(`<p>${inl(l)}</p>`);
    }
    if (liste) out.push("</ul>");
    return out.join("");
  }
</script>

<Head titel="Kosten & Verbrauch" text="Was der Agent in den letzten {v?.tage ?? 30} Tagen gekostet hat. Schätzwerte aus den Preisen in config.yaml." />

{#if v}
  <div class="kz">
    <div class="card"><small>Gesamt, geschätzt</small><b class="num"><Zahl wert={v.gesamt_eur ?? 0} format={(n) => eur.format(n)} /></b><span class="muted">letzte {v.tage} Tage</span></div>
    <div class="card"><small>Pro gebauter Demo</small><b class="num">{v.pro_demo_eur != null ? eur.format(v.pro_demo_eur) : "–"}</b><span class="muted">{v.demos ?? 0} Demos</span></div>
    <div class="card"><small>Läufe</small><b class="num"><Zahl wert={v.laeufe ?? 0} /></b><span class="muted">Wochenläufe</span></div>
  </div>

  <div class="cols">
    <section class="card box">
      <h3>Nach Dienst</h3>
      <div class="tools">
        {#each v.tools ?? [] as t (t.tool)}
          <div class="tool"><span>{TOOL_NAME[t.tool] ?? t.tool}</span><span class="bar"><i style="width:{Math.max(2, Math.round((t.eur / maxTool) * 100))}%;background:{TCOL[t.tool] ?? '#7BAFFF'}"></i></span><b class="num">{eur.format(t.eur)}</b></div>
        {:else}<p class="muted">Noch keine Kosten erfasst.</p>{/each}
      </div>
      <h3 class="sek">Gratiskontingente diesen Monat</h3>
      <div class="tools">
        {#each frei as [n, ist, max] (n)}
          {@const pc = Math.min(100, Math.round((ist / (max || 1)) * 100))}
          <div class="tool"><span>{n}</span><span class="bar"><i style="width:{pc}%;background:{pc > 85 ? '#F24A4A' : pc > 60 ? '#E7B94A' : '#4CC38A'}"></i></span><small class="num muted">{zahl(Math.round(ist))} von {zahl(max)}</small></div>
        {/each}
      </div>
    </section>

    <section class="card box">
      <div class="ai-h"><h3>KI-Analyse: Kosten und Nutzen</h3>
        {#if auth.darf("akquise", true)}<button class="btn btn--s btn--primary" onclick={analyse} disabled={laeuft || daten.offen("analyse").length > 0}><Icon name="sparkles" size={14} />{laeuft ? "Analyse läuft …" : "KI-Analyse erstellen"}</button>{/if}
      </div>
      <small class="muted">{a ? `Stand ${datumZeit(a.erstellt)}` : "Noch keine Analyse"}</small>
      {#if laeuft}<p class="muted">Analyse läuft, dauert etwa ein bis zwei Minuten …</p>{/if}
      {#if a}<div class="md">{@html md(a.text)}</div>
      {:else if !laeuft}<p class="muted">Per Knopfdruck wertet Claude Tokens, Bilder, Google-Anfragen und Laufzeiten aus und schlägt vor, wo sich sparen lässt, ohne dass die Demos schlechter werden.</p>{/if}
    </section>
  </div>

  <section class="card tw">
    <table class="table">
      <thead><tr><th>Dienst · Zweck</th><th>Menge</th><th class="r">Kosten</th></tr></thead>
      <tbody>
        {#each v.posten ?? [] as p}
          <tr><td><i class="tl" style="background:{TCOL[p.tool] ?? '#7BAFFF'}"></i>{TOOL_NAME[p.tool] ?? p.tool}<small class="muted"> · {p.zweck}</small></td><td class="muted">{menge(p)}</td><td class="r num">{eurFein.format(p.eur ?? 0)}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
{:else}
  <div class="card empty"><b>Noch keine Kostendaten</b><p>Sie kommen mit dem nächsten Abgleich des Agenten.</p></div>
{/if}

<style>
  .kz { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; max-width: 820px; }
  .kz .card { padding: 14px 16px; display: grid; gap: 4px; }
  .kz small { color: var(--steel); font-size: .8rem; }
  .kz b { color: var(--text); font-size: 1.6rem; font-weight: 600; }
  .kz span { font-size: .8rem; }
  @media (max-width: 560px) { .kz { grid-template-columns: minmax(0, 1fr); } }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; margin-bottom: 14px; align-items: start; }
  .box { padding: 16px 20px 20px; display: grid; gap: 10px; }
  .sek { margin-top: 10px; }
  .tools { display: grid; gap: 10px; }
  .tool { display: grid; grid-template-columns: minmax(120px, 1fr) 1.4fr auto; gap: 12px; align-items: center; font-size: .88rem; color: var(--text-2); }
  .tool .bar { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .06); overflow: hidden; }
  .tool .bar i { display: block; height: 100%; border-radius: inherit; }
  .tool b { color: var(--text); font-weight: 600; }
  .ai-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .md { font-size: .92rem; line-height: 1.55; color: var(--text-2); }
  .md :global(h4) { color: var(--text); margin: 12px 0 4px; }
  .md :global(p) { margin: 0 0 8px; }
  .md :global(ul) { margin: 0 0 8px; padding-left: 18px; }
  .md :global(b) { color: var(--text); }
  .md :global(code) { font: .84em ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 5px; border-radius: 4px; background: rgba(255, 255, 255, .07); }
  .tw { overflow-x: auto; }
  .r { text-align: right; }
  .tl { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
</style>
