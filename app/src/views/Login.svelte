<script lang="ts">
  import AuthFrame from "../components/AuthFrame.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { APP_URL } from "../lib/config";
  let email = $state(""), passwort = $state(""), laeuft = $state(false), meldung = $state(""), info = $state("");

  async function anmelden(e: SubmitEvent) {
    e.preventDefault(); meldung = ""; laeuft = true;
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: passwort });
    laeuft = false;
    if (error) meldung = fehler(error);
  }
  async function vergessen() {
    meldung = ""; info = "";
    if (!email.trim()) { meldung = "Bitte zuerst deine E-Mail-Adresse eingeben."; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${APP_URL}/` });
    if (error) meldung = fehler(error);
    else info = "Falls die Adresse zum Team gehört, kommt gleich eine E-Mail. Alternativ kann Daniel dir unter Team einen neuen Link erzeugen.";
  }
</script>

<AuthFrame titel="Anmelden" text="Medialyte – Akquise, Anfragen, Kunden und Rechnungen.">
  <form class="f" onsubmit={anmelden}>
    <label class="field"><span>E-Mail</span><input class="input" type="email" autocomplete="username" bind:value={email} required></label>
    <label class="field"><span>Passwort</span><input class="input" type="password" autocomplete="current-password" bind:value={passwort} required></label>
    {#if meldung}<p class="err" role="alert">{meldung}</p>{/if}
    {#if info}<p class="muted">{info}</p>{/if}
    <button class="btn btn--primary" type="submit" disabled={laeuft}>{laeuft ? "Anmelden …" : "Anmelden"}</button>
    <button class="btn btn--quiet btn--s" type="button" onclick={vergessen}>Passwort vergessen?</button>
  </form>
</AuthFrame>

<style>
  .f { display: grid; gap: 14px; }
  .err { color: #FF8080; font-size: .9rem; }
</style>
