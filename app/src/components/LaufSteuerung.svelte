<script lang="ts">
  // Lauf des Akquise-Agenten einer Kategorie: Stand, „Lauf starten“, „Abbrechen“, Live-Anzeige mit Protokoll
  import Icon from "./Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten, type Kategorie } from "../lib/daten.svelte";
  import { befehl } from "../lib/befehl";
  import { frage } from "../lib/frage.svelte";
  import { vor, datumZeit } from "../lib/format";
  import { agent, sofort, sparHinweis } from "../lib/agent.svelte";
  import { sb } from "../lib/supabase";
  import Schalter from "./Schalter.svelte";

  let { kat }: { kat: Kategorie } = $props();
  const lauf = $derived(daten.laufend[kat.slug]);
  const live = $derived(lauf?.live ?? null);
  const wartet = $derived(daten.offen("lauf").length + daten.offen("bauen").length > 0);
  const bereit = $derived(!!kat.suche?.bereit);
  const darf = $derived(auth.darf("akquise", true));

  // Nächster automatischer Lauf: Montag 05:47 UTC (wie im Wochenlauf), mit laufendem Countdown
  function naechster(): Date {
    const d = new Date(); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 5, 47));
    t.setUTCDate(t.getUTCDate() + ((8 - t.getUTCDay()) % 7)); if (t <= d) t.setUTCDate(t.getUTCDate() + 7); return t;
  }
  let jetzt = $state(Date.now());
  $effect(() => { const t = setInterval(() => (jetzt = Date.now()), 30000); return () => clearInterval(t); });
  const ziel = $derived(agent.c.naechster_lauf && Date.parse(agent.c.naechster_lauf) > jetzt ? new Date(agent.c.naechster_lauf) : naechster());
  const naechsterText = $derived(ziel.toLocaleString("de-DE", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }));
  const countdown = $derived.by(() => {
    const m = Math.max(0, Math.round((ziel.getTime() - jetzt) / 60000)), t = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return t ? `in ${t} ${t === 1 ? "Tag" : "Tagen"}, ${h} Std.` : h ? `in ${h} Std. ${m % 60} Min.` : `in ${m} Min.`;
  });

  // Zustand des letzten Laufs (wie der Punkt oben im Cockpit)
  let letzter = $state<any>(null);
  async function letzterLaden() {
    const { data } = await sb.from("laeufe").select("id,start,ende,status,daten").eq("kategorie", kat.slug).neq("status", "laeuft").order("start", { ascending: false }).limit(5);
    letzter = (data ?? []).find((r: any) => !r.daten?.probe) ?? (data ?? [])[0] ?? null;
  }
  $effect(() => { kat.slug; letzterLaden(); });
  $effect(() => { const f = () => letzterLaden(); addEventListener("ml:laeufe", f); return () => removeEventListener("ml:laeufe", f); });
  const zustand = $derived.by((): { text: string; ton: string; titel?: string } | null => {
    if (!letzter) return { text: "Noch kein Lauf", ton: "gelb" };
    if (letzter.daten?.ki_ausfall) return { text: `${letzter.daten.ki_ausfall.grund} · nichts gebaut`, ton: "rot", titel: "Aufträge bleiben offen und kommen im nächsten Lauf dran. " + (letzter.daten.ki_ausfall.fehler ?? "") };
    if (letzter.status === "fehler") return { text: "Letzter Lauf fehlgeschlagen", ton: "rot", titel: letzter.daten?.fehler ?? "" };
    if (letzter.status === "wartet") return { text: "Wartet auf Freigabe", ton: "gelb" };
    if (letzter.status === "leer") return { text: "Letzter Lauf ohne neue Demos", ton: "gelb" };
    return { text: "Agent bereit", ton: "gruen" };
  });

  async function starten() {
    if (!(await frage("Lauf jetzt starten?", "Der Agent sucht neue Betriebe, baut Demos für die besten und bereitet Briefe vor. Das kostet etwas KI- und Google-Guthaben.", "Lauf starten"))) return;
    await befehl("lauf", { sofort: sofort.an }, kat.slug, "Lauf wird gestartet …" + sparHinweis());
  }
  async function abbrechen() {
    if (!(await frage("Lauf abbrechen?", "Bereits gebaute Demos bleiben erhalten. Der Rest wird beim nächsten Lauf nachgeholt.", "Abbrechen", true))) return;
    await befehl("abbrechen", {}, kat.slug, "Lauf wird abgebrochen …");
  }
  let logEl: HTMLElement | undefined = $state();
  $effect(() => { live?.log?.length; if (logEl) logEl.scrollTop = logEl.scrollHeight; });
  const pct = $derived(live?.ziel ? Math.min(100, Math.round((live.demos / live.ziel) * 100)) : null);
</script>

<section class="ls card" class:is-live={!!lauf}>
  <div class="ls__h">
    <span class="ls__dot" aria-hidden="true"></span>
    <div class="ls__t">
      {#if lauf}
        <b>Lauf läuft · {live?.phase ?? "startet"}</b>
        <small class="muted">seit {vor(lauf.start)}{live?.ziel ? ` · ${live.demos} von ${live.ziel} Demos` : ""}{live?.in_arbeit?.length ? ` · baut: ${live.in_arbeit.join(", ")}` : ""}</small>
      {:else if wartet}
        <b>Auftrag ist beim Agenten</b><small class="muted">startet in wenigen Augenblicken</small>
      {:else if !bereit}
        <b>Noch keine Branchen-Vorlage</b><small class="muted">Suche und Demos für {kat.name} kommen mit Etappe 3</small>
      {:else if !kat.aktiv}
        <b>Automatik aus</b><small class="muted">Kein Lauf von selbst – von Hand starten geht.</small>
      {:else}
        <b>Bereit</b><small class="muted" title={naechsterText}>Nächster automatischer Lauf {countdown} · {naechsterText}</small>
      {/if}
    </div>
    {#if darf && bereit}
      <div class="ls__a">
        <label class="sof" title="Aus: Bauen im Sparmodus zum halben Preis, dauert etwas länger. An: sofort, zum vollen Preis."><Schalter an={sofort.an} label="Sofort bauen" onchange={(v: boolean) => sofort.setzen(v)} /><span>Sofort bauen</span></label>
        {#if lauf}<button class="btn btn--s" onclick={abbrechen}><Icon name="x" size={15} />Abbrechen</button>
        {:else}<button class="btn btn--s btn--primary" onclick={starten} disabled={wartet}><Icon name="play" size={14} />Lauf starten</button>{/if}
      </div>
    {/if}
  </div>
  {#if !lauf && zustand && bereit}
    <div class="ls__z ls__z--{zustand.ton}" title={zustand.titel}><span></span>{zustand.text}{#if letzter?.start}<small class="muted"> · {datumZeit(letzter.ende ?? letzter.start)}</small>{/if}{#if agent.c.erstellt}<small class="muted"> · Stand {vor(agent.c.erstellt)}</small>{/if}</div>
  {/if}
  {#if lauf}
    {#if pct !== null}<div class="ls__bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style="width:{pct}%"></i></div>{/if}
    {#if lauf.live?.log?.length}<pre class="ls__log" bind:this={logEl}>{lauf.live.log.slice(-14).join("\n")}</pre>{/if}
  {/if}
</section>

<style>
  .ls { padding: 14px 16px; margin-bottom: 18px; display: grid; gap: 12px; }
  .ls__h { display: flex; align-items: center; gap: 12px; }
  .ls__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--steel); flex: none; }
  .is-live .ls__dot { background: var(--ok); box-shadow: 0 0 0 0 rgba(76, 195, 138, .6); animation: puls 1.8s ease-out infinite; }
  @keyframes puls { to { box-shadow: 0 0 0 10px rgba(76, 195, 138, 0); } }
  .ls__t { display: grid; flex: 1; min-width: 0; }
  .ls__t b { color: var(--text); font-weight: 600; }
  .ls__t small { font-size: .84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ls__a { display: flex; gap: 8px; flex: none; }
  .ls__a { align-items: center; }
  .sof { display: inline-flex; align-items: center; gap: 8px; font-size: .84rem; color: var(--text-2); cursor: pointer; margin-right: 6px; }
  @media (max-width: 640px) { .sof span { display: none; } }
  .ls__z { display: flex; align-items: center; gap: 8px; font-size: .84rem; color: var(--text-2); flex-wrap: wrap; }
  .ls__z > span { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); }
  .ls__z--rot { color: #FF9C9C; } .ls__z--rot > span { background: #F24A4A; }
  .ls__z--gelb > span { background: var(--warn); }
  .ls__bar { height: 6px; border-radius: 999px; background: rgba(255, 255, 255, .06); overflow: hidden; }
  .ls__bar i { display: block; height: 100%; background: var(--ok); border-radius: inherit; transition: width .6s var(--ease); }
  .ls__log { margin: 0; max-height: 220px; overflow: auto; padding: 12px 14px; border-radius: 8px; background: #060B14; color: #9FB0C8;
    font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
  @media (prefers-reduced-motion: reduce) { .is-live .ls__dot { animation: none; } }
</style>
