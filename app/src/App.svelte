<script lang="ts">
  import { auth } from "./lib/auth.svelte";
  import Login from "./views/Login.svelte";
  import Zweifaktor from "./views/Zweifaktor.svelte";
  import Willkommen from "./views/Willkommen.svelte";
  import Shell from "./views/Shell.svelte";
  import Intro from "./components/Intro.svelte";
</script>

<div class="aura" aria-hidden="true"><i></i><i></i><i></i></div>
<Intro bereit={auth.bereit} />
{#if !auth.bereit}
  <div class="splash" aria-busy="true"><img src="./mono.svg" alt="" width="44" height="33"></div>
{:else if !auth.session}
  <Login />
{:else if auth.passwortSetzen && (auth.stufe === "aal2" || !auth.hatFaktor)}
  <Willkommen />
{:else if auth.stufe !== "aal2"}
  <Zweifaktor />
{:else if !auth.ich || !auth.ich.aktiv}
  <div class="gate">
    <div class="gate__box card">
      <h1>Kein Zugang</h1>
      <p class="muted">Dieses Konto gehört nicht (mehr) zum Medialyte-Team. Bitte wende dich an Daniel.</p>
      <button class="btn" onclick={() => auth.abmelden()}>Abmelden</button>
    </div>
  </div>
{:else}
  <Shell />
{/if}

<style>
  .splash { min-height: 100dvh; display: grid; place-items: center; }
  .splash img { animation: puls 1.4s ease-in-out infinite; }
  @keyframes puls { 50% { opacity: .4; } }
  :global(.gate) { min-height: 100dvh; display: grid; place-items: center; padding: 24px; }
  :global(.gate__box) { width: min(420px, 100%); padding: 32px; display: grid; gap: 16px; }
</style>
