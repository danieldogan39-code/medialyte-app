<script lang="ts">
  // Einstellungen: Benachrichtigungen auf diesem Gerät, „Sofort bauen“, Apps zum Herunterladen, Links zum Agenten
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Schalter from "../components/Schalter.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { agent, sofort } from "../lib/agent.svelte";
  import { istProgramm, kannPush, pushAktiv, pushAn, pushAus, pushInfo, pushTest } from "../lib/push";
  import { vor } from "../lib/format";

  let push = $state(false), geraete = $state<number | null>(null), arbeitet = $state(false);
  $effect(() => {
    if (!auth.darf("akquise")) return;
    pushAktiv().then((a) => (push = a));
    pushInfo().then((i) => (geraete = i.geraete)).catch(() => {});
  });
  async function umschalten(an: boolean) {
    arbeitet = true;
    try {
      if (an) { const f = await pushAn(); if (f) daten.melden(f); else { push = true; daten.melden("Benachrichtigungen sind an. Eine Probe ist unterwegs."); } }
      else { await pushAus(); push = false; daten.melden("Benachrichtigungen auf diesem Gerät sind aus."); }
    } catch { daten.melden("Benachrichtigungen ließen sich nicht umschalten. Bitte gleich nochmal versuchen."); }
    arbeitet = false;
    pushInfo().then((i) => (geraete = i.geraete)).catch(() => {});
  }
  const REL = "https://github.com/danieldogan39-code/medialyte-app/releases/latest";
</script>

<Head titel="Einstellungen" text="Was nur dieses Gerät betrifft, und die Apps für deine anderen Geräte." />

<div class="grid">
  {#if auth.darf("akquise")}
    <section class="card box">
      <div class="zeile">
        <span><b>Benachrichtigungen</b><small class="muted">Sofort Bescheid, wenn jemand seine Demo öffnet, um Rückruf bittet, Demos fertig sind oder ein Gast im Tischbuch wartet.</small></span>
        <Schalter an={push} label="Benachrichtigungen" disabled={arbeitet || !kannPush()} onchange={umschalten} />
      </div>
      {#if !kannPush()}
        <p class="hinweis">{istProgramm ? "Am Mac und unter Windows kommen Benachrichtigungen über die Android-App oder den Browser. Schalte sie in der Android-App ein – dort sind es echte App-Nachrichten." : "Dieser Browser kann keine Benachrichtigungen empfangen."}</p>
      {/if}
      {#if geraete != null}<small class="muted">Angemeldete Geräte insgesamt: {geraete}</small>{/if}
      {#if push}<button class="btn btn--s" onclick={() => pushTest().then(() => daten.melden("Probe ist unterwegs.")).catch(() => daten.melden("Probe ließ sich nicht senden."))}>Probe senden</button>{/if}
    </section>

    <section class="card box">
      <div class="zeile">
        <span><b>Sofort bauen</b><small class="muted">Aus: Demos werden im Sparmodus gebaut, zum halben Preis, dauert etwas länger. An: sofort, zum vollen Preis. Gilt für dieses Gerät.</small></span>
        <Schalter an={sofort.an} label="Sofort bauen" onchange={(v: boolean) => { sofort.setzen(v); daten.melden(v ? "Sofort bauen ist an: voller Preis, keine Wartezeit." : "Sparmodus: halber Preis, dauert etwas länger."); }} />
      </div>
    </section>
  {/if}

  <section class="card box">
    <b>Apps</b>
    <small class="muted">Dieselbe App für alle Geräte. Die neueste Version gibt es immer hier.</small>
    <div class="links">
      <a class="btn btn--s" href={REL} target="_blank" rel="noopener"><Icon name="external" size={14} />Mac, Windows und Android</a>
      <a class="btn btn--s btn--quiet" href="https://app.medialyte.de/" target="_blank" rel="noopener">Im Browser öffnen</a>
    </div>
  </section>

  {#if auth.darf("akquise") && agent.c.links}
    <section class="card box">
      <b>Agent</b>
      <small class="muted">{agent.c.erstellt ? `Stand der Daten: ${vor(agent.c.erstellt)}` : ""}</small>
      <div class="links">
        <a class="btn btn--s" href="#/kosten"><Icon name="receipt" size={14} />Kosten & Verbrauch</a>
        <a class="btn btn--s btn--quiet" href={agent.c.links.berichte} target="_blank" rel="noopener">Berichte</a>
        <a class="btn btn--s btn--quiet" href={agent.c.links.einstellungen} target="_blank" rel="noopener">Weitere Einstellungen (config.yaml)</a>
      </div>
    </section>
  {/if}
</div>

<style>
  .grid { display: grid; gap: 14px; max-width: 760px; }
  .box { padding: 18px 20px; display: grid; gap: 10px; }
  .box > b { color: var(--text); }
  .zeile { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; }
  .zeile span { display: grid; gap: 4px; }
  .zeile b { color: var(--text); font-weight: 600; }
  .zeile small { font-size: .86rem; line-height: 1.45; }
  .hinweis { margin: 0; font-size: .86rem; padding: 10px 12px; border-radius: var(--radius-s); background: rgba(231, 185, 74, .1); color: #EBC56B; line-height: 1.45; }
  .links { display: flex; gap: 6px; flex-wrap: wrap; }
</style>
