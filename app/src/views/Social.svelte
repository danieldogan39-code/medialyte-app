<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import SocialPlan from "../components/SocialPlan.svelte";
  import SocialUebersicht from "../components/SocialUebersicht.svelte";
  import SocialKanal from "../components/SocialKanal.svelte";
  import SocialBibliothek from "../components/SocialBibliothek.svelte";
  import CreativeHochladen from "../components/CreativeHochladen.svelte";
  import { auth } from "../lib/auth.svelte";
  import { social } from "../lib/social.svelte";
  import { gleiter } from "../lib/bewegung";

  // /social · /social/bibliothek · /social/plan · /social/k/<plattform>[/<typ>]
  let { tab = "creatives", kanal = "", typ = "" }: { tab?: string; kanal?: string; typ?: string } = $props();
  $effect(() => { social.laden(); return social.live(); });
  let hoch = $state(false);
  const schreiben = $derived(auth.darf("social", true));
</script>

{#if kanal}
  <SocialKanal {kanal} {typ} />
{:else}
  <div class="sm-kopf">
  <Head titel="Social Media" text="Creatives nach Plattform, deine Bibliothek mit Reihenfolge zum Posten und der Plan dahinter.">
    {#if social.zurFreigabe}<a class="pill pill--gelb" href="#/social/k/freigabe">{social.zurFreigabe} zur Freigabe</a>{/if}
    {#if schreiben && tab === "creatives"}<button class="btn btn--s" onclick={() => (hoch = true)}><Icon name="upload" size={15} />Hochladen</button>{/if}
  </Head>
  </div>

  <div class="reiter" role="tablist" aria-label="Ansicht" use:gleiter>
    <a role="tab" class="chip" href="#/social" aria-selected={tab === "creatives"} class:on={tab === "creatives"}><Icon name="image" size={14} />Creatives</a>
    <a role="tab" class="chip" href="#/social/bibliothek" aria-selected={tab === "bibliothek"} class:on={tab === "bibliothek"}><Icon name="stapel" size={14} />Bibliothek</a>
    <a role="tab" class="chip" href="#/social/plan" aria-selected={tab === "plan"} class:on={tab === "plan"}><Icon name="calendar" size={14} /><span class="lang">Plan &amp; Kalender</span><span class="kurz">Plan</span></a>
  </div>

  {#if tab === "plan"}
    <SocialPlan />
  {:else if social.laedt && !social.liste.length}<div class="skelett" aria-label="Lade …"><i></i><i></i><i></i></div>
  {:else if social.fehler && !social.liste.length}<div class="card empty"><b>Creatives nicht geladen</b><p>{social.fehler}</p></div>
  {:else if tab === "bibliothek"}
    <SocialBibliothek hochladen={() => (hoch = true)} />
  {:else}
    <SocialUebersicht />
  {/if}
{/if}
{#if hoch}<CreativeHochladen onclose={() => (hoch = false)} />{/if}

<style>
  .reiter { display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 20px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); }
  .reiter .chip { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; color: var(--text-2); font-size: .9rem; white-space: nowrap; }
  .kurz { display: none; }
  @media (max-width: 520px) { .sm-kopf :global(.head__t p) { display: none; } .sm-kopf :global(.head) { margin-bottom: 16px; } }
  @media (max-width: 520px) {
    .reiter { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; margin-bottom: 16px; }
    .reiter .chip { padding: 0 8px; font-size: .86rem; gap: 6px; }
    .lang { display: none; }
    .kurz { display: inline; }
  }
  .reiter .chip.on { color: #0A1220; background: transparent; }
  .reiter :global(.gleiter) { background: var(--bereich) !important; }
</style>
