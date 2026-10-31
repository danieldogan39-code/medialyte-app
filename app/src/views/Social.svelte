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
  <Head titel="Social Media" text="Alle Creatives nach Plattform sortiert, mit Texten zum Herunterladen. Dazu deine Bibliothek, der Plan und der rote Faden.">
    {#if social.zurFreigabe}<a class="pill pill--gelb" href="#/social/k/freigabe">{social.zurFreigabe} zur Freigabe</a>{/if}
    {#if schreiben && tab === "creatives"}<button class="btn btn--s" onclick={() => (hoch = true)}><Icon name="upload" size={15} />Hochladen</button>{/if}
  </Head>

  <div class="reiter" role="tablist" aria-label="Ansicht" use:gleiter>
    <a role="tab" class="chip" href="#/social" aria-selected={tab === "creatives"} class:on={tab === "creatives"}><Icon name="image" size={14} />Creatives</a>
    <a role="tab" class="chip" href="#/social/bibliothek" aria-selected={tab === "bibliothek"} class:on={tab === "bibliothek"}><Icon name="stapel" size={14} />Bibliothek</a>
    <a role="tab" class="chip" href="#/social/plan" aria-selected={tab === "plan"} class:on={tab === "plan"}><Icon name="calendar" size={14} />Plan &amp; Kalender</a>
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
  .reiter .chip { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; color: var(--text-2); font-size: .9rem; }
  .reiter .chip.on { color: #0A1220; background: transparent; }
  .reiter :global(.gleiter) { background: var(--bereich) !important; }
</style>
