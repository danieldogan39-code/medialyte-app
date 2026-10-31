<script lang="ts">
  // Einstellungen: Benachrichtigungen auf diesem Gerät, „Sofort bauen“, Apps zum Herunterladen, Links zum Agenten
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import Schalter from "../components/Schalter.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { agent, sofort } from "../lib/agent.svelte";
  import { istProgramm, kannPush, pushAktiv, pushAn, pushAus, pushInfo, pushProbe } from "../lib/push";
  import { vor } from "../lib/format";
  import { appUpdate, APP_VERSION, istAndroidApp, istDesktop } from "../lib/appupdate.svelte";

  let push = $state(false), geraete = $state<number | null>(null), arbeitet = $state(false), probe = $state(false);
  $effect(() => {
    if (!auth.darf("akquise")) return;
    pushAktiv().then((a) => (push = a));
    pushInfo().then((i) => (geraete = i.geraete)).catch(() => {});
  });
  async function umschalten(an: boolean) {
    arbeitet = true;
    try {
      if (an) { const f = await pushAn(); if (f) daten.melden(f); else { push = true; daten.melden("Benachrichtigungen sind an. " + (await pushProbe().catch(() => ""))); } }
      else { await pushAus(); push = false; daten.melden("Benachrichtigungen auf diesem Gerät sind aus."); }
    } catch { daten.melden("Benachrichtigungen ließen sich nicht umschalten. Bitte gleich nochmal versuchen."); }
    arbeitet = false;
    pushInfo().then((i) => (geraete = i.geraete)).catch(() => {});
  }
  // Apps: neueste Versionen direkt hier laden (Android installiert sich aus der App heraus)
  const android = istAndroidApp(), desktop = istDesktop();
  $effect(() => { appUpdate.laden().catch(() => {}); if (android) appUpdate.pruefen(); });
  const st = $derived(appUpdate.stand);
  const aktuell = $derived(android ? !!st.android && appUpdate.meinBuild >= st.android.build : desktop ? !!st.programm && st.programm.v === APP_VERSION : true);
  async function holen() { const f = await appUpdate.installieren().catch((e) => String(e?.message || e)); if (f) daten.melden(f); }
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
      {#if push}<button class="btn btn--s" disabled={probe} onclick={async () => { probe = true; daten.melden(await pushProbe().catch((e) => "Probe ließ sich nicht senden: " + (e?.message || e))); probe = false; pushInfo().then((i) => (geraete = i.geraete)).catch(() => {}); }}>{probe ? "Probe läuft …" : "Probe senden"}</button>{/if}
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
    <small class="muted">Dieselbe App für alle Geräte. Die neueste Version holst du direkt hier.</small>
    {#if android || desktop}
      <div class="zeile">
        <span><b>Diese App</b><small class="muted">{android ? `Android · Version ${appUpdate.meinBuild ? "1.0." + appUpdate.meinBuild : "…"}` : `${/Mac/i.test(navigator.userAgent) ? "Mac" : "Windows"} · Version ${APP_VERSION}`}{aktuell ? " · aktuell" : ""}</small></span>
        <button class="btn btn--s {aktuell ? '' : 'btn--primary'}" disabled={appUpdate.fortschritt != null} onclick={holen}>
          {appUpdate.fortschritt != null ? `Lädt … ${Math.round(appUpdate.fortschritt * 100)} %` : aktuell ? "Neu installieren" : `Version ${android ? st.android?.v : st.programm?.v} installieren`}</button>
      </div>
      {#if appUpdate.fortschritt != null}<div class="balken"><i style="transform: scaleX({appUpdate.fortschritt})"></i></div>{/if}
    {/if}
    <div class="links">
      {#if st.android && !android}<a class="btn btn--s" href={st.android.apk} download><Icon name="download" size={14} />Android {st.android.v}</a>{/if}
      {#if st.programm?.mac && !desktop}<a class="btn btn--s" href={st.programm.mac} download><Icon name="download" size={14} />Mac {st.programm.v}</a>{/if}
      {#if st.programm?.win && !desktop}<a class="btn btn--s" href={st.programm.win} download><Icon name="download" size={14} />Windows {st.programm.v}</a>{/if}
      {#if android || desktop}<a class="btn btn--s btn--quiet" href="https://app.medialyte.de/" target="_blank" rel="noopener">Im Browser öffnen</a>{/if}
    </div>
    {#if android}<small class="muted">Beim ersten Mal fragt Android, ob Medialyte Apps installieren darf. Einmal erlauben, danach geht jedes Update mit einem Tipp.</small>{/if}
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
  .balken { height: 4px; border-radius: 2px; background: var(--panel-2); overflow: hidden; }
  .balken i { display: block; height: 100%; background: var(--bereich, var(--text)); transform-origin: left; transition: transform .25s var(--feder-schnell, ease-out); }
</style>
