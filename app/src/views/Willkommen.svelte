<script lang="ts">
  import AuthFrame from "../components/AuthFrame.svelte";
  import { auth } from "../lib/auth.svelte";
  import { sb, fehler } from "../lib/supabase";
  let p1 = $state(""), p2 = $state(""), meldung = $state(""), laeuft = $state(false);

  async function speichern(e: SubmitEvent) {
    e.preventDefault(); meldung = "";
    if (p1.length < 12) { meldung = "Bitte mindestens 12 Zeichen."; return; }
    if (p1 !== p2) { meldung = "Die beiden Passwörter stimmen nicht überein."; return; }
    laeuft = true;
    const { error } = await sb.auth.updateUser({ password: p1 });
    laeuft = false;
    if (error) { meldung = fehler(error); return; }
    auth.fertigGesetzt();
    history.replaceState(null, "", location.pathname + "#/");
  }
</script>

<AuthFrame titel="Passwort festlegen" text="Wähle ein eigenes Passwort mit mindestens 12 Zeichen. Danach richtest du die Zwei-Faktor-Anmeldung ein.">
  <form class="f" onsubmit={speichern}>
    <label class="field"><span>Neues Passwort</span><input class="input" type="password" autocomplete="new-password" bind:value={p1} required minlength="12"></label>
    <label class="field"><span>Wiederholen</span><input class="input" type="password" autocomplete="new-password" bind:value={p2} required></label>
    {#if meldung}<p class="err" role="alert">{meldung}</p>{/if}
    <button class="btn btn--primary" type="submit" disabled={laeuft}>Speichern</button>
  </form>
</AuthFrame>

<style>
  .f { display: grid; gap: 14px; }
  .err { color: #FF8080; font-size: .9rem; }
</style>
