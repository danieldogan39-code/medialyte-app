<script lang="ts">
  import AuthFrame from "../components/AuthFrame.svelte";
  import { auth } from "../lib/auth.svelte";
  import { sb, fehler } from "../lib/supabase";

  let qr = $state(""), secret = $state(""), factorId = $state(""), code = $state(""), meldung = $state(""), laeuft = $state(false);
  let einrichten = $derived(!auth.hatFaktor);

  async function vorbereiten() {
    meldung = "";
    const { data: liste } = await sb.auth.mfa.listFactors();
    if (auth.hatFaktor) { factorId = liste?.totp?.[0]?.id ?? ""; return; }
    // halb eingerichtete Faktoren aus früheren Versuchen entfernen
    for (const f of liste?.all ?? []) if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Medialyte " + new Date().toISOString().slice(0, 16) });
    if (error) { meldung = fehler(error); return; }
    factorId = data.id; qr = data.totp.qr_code; secret = data.totp.secret;
  }
  $effect(() => { vorbereiten(); });

  async function pruefen(e: SubmitEvent) {
    e.preventDefault(); meldung = ""; laeuft = true;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    laeuft = false;
    if (error) { meldung = fehler(error); code = ""; return; }
    const { data } = await sb.auth.getSession();
    await auth.uebernehmen(data.session);
  }
</script>

<AuthFrame titel={einrichten ? "Zwei-Faktor einrichten" : "Bestätigungscode"}
  text={einrichten ? "Einmalig: Scanne den Code mit einer Authenticator-App (z. B. Google Authenticator, 1Password, Apple Passwörter) und gib die 6 Ziffern ein." : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."}>
  <form class="f" onsubmit={pruefen}>
    {#if einrichten}
      <div class="qr">{#if qr}<img src={qr} alt="QR-Code für die Authenticator-App" width="180" height="180">{:else}<span class="muted">Wird vorbereitet …</span>{/if}</div>
      {#if secret}<details class="key"><summary>Code lässt sich nicht scannen?</summary><p>Diesen Schlüssel von Hand eingeben:</p><code>{secret}</code></details>{/if}
    {/if}
    <label class="field"><span>Code</span>
      <input class="input code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]*" bind:value={code} required>
    </label>
    {#if meldung}<p class="err" role="alert">{meldung}</p>{/if}
    <button class="btn btn--primary" type="submit" disabled={laeuft || !factorId}>{laeuft ? "Prüfe …" : "Bestätigen"}</button>
    <button class="btn btn--quiet btn--s" type="button" onclick={() => auth.abmelden()}>Abmelden</button>
  </form>
</AuthFrame>

<style>
  .f { display: grid; gap: 14px; }
  .qr { display: grid; place-items: center; min-height: 196px; padding: 8px; border-radius: var(--radius-s); background: #fff; }
  .key { font-size: .86rem; color: var(--steel); }
  .key summary { cursor: pointer; }
  .key code { display: block; margin-top: 6px; padding: 8px 10px; border-radius: 6px; background: var(--bg-2); color: var(--text); word-break: break-all; font-size: .85rem; letter-spacing: .04em; }
  .code { font-size: 1.3rem; letter-spacing: .3em; text-align: center; font-variant-numeric: tabular-nums; }
  .err { color: #FF8080; font-size: .9rem; }
</style>
