<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import SocialPlan from "../components/SocialPlan.svelte";
  import SocialUebersicht from "../components/SocialUebersicht.svelte";
  import SocialKanal from "../components/SocialKanal.svelte";
  import SocialBibliothek from "../components/SocialBibliothek.svelte";
  import SocialBereiche from "../components/SocialBereiche.svelte";
  import SocialAuftraege from "../components/SocialAuftraege.svelte";
  import SocialStil from "../components/SocialStil.svelte";
  import SocialBeauftragen from "../components/SocialBeauftragen.svelte";
  import CreativeHochladen from "../components/CreativeHochladen.svelte";
  import { auth } from "../lib/auth.svelte";
  import { social, plattform } from "../lib/social.svelte";
  import { gleiter } from "../lib/bewegung";

  // /social · /social/bibliothek · /social/plan · /social/k/<plattform>[/<typ>]
  // Kunden: /social/kunde/<id> · …/bibliothek · …/plan · …/stil · …/k/<plattform>[/<typ>]
  let { tab = "creatives", kanal = "", typ = "", kunde = "" }: { tab?: string; kanal?: string; typ?: string; kunde?: string } = $props();
  social.kunde = kunde || null;
  $effect.pre(() => { social.kunde = kunde || null; });
  $effect(() => { social.laden(); return social.live(); });
  $effect(() => { tab; kanal; typ; kunde; social.zuletzt = location.hash; });
  let hoch = $state(false), auftrag = $state(false);
  const schreiben = $derived(auth.darf("social", true));
  const k = $derived(kunde ? social.kunden.find((x) => x.id === kunde) ?? null : null);
  const kanaele = $derived(k ? social.kanaeleVon(k.id) : []);
  const wo = $derived(kanaele.map((x) => x.name || plattform(x.plattform)?.name).filter(Boolean).join(" · "));
  const b = $derived(social.basis);
</script>

<SocialBereiche />

{#if kunde && !k}
  {#if social.laedt}<div class="skelett" aria-label="Lade …"><i></i><i></i><i></i></div>
  {:else}<div class="card empty"><b>Diesen Kunden gibt es hier nicht (mehr).</b><p>Er braucht in den Kunden die Kategorie „Social Media“.</p><a class="btn" href="#/social">Zu Medialyte</a></div>{/if}
{:else if kanal}
  <SocialKanal {kanal} {typ} />
{:else}
  <div class="sm-kopf">
  <Head titel={k ? k.name : "Social Media"} text={k ? (wo || "Noch keine Kanäle eingetragen.") : "Creatives nach Plattform, deine Bibliothek mit Reihenfolge zum Posten und der Plan dahinter."}>
    {#if social.freigabeHier}<a class="pill pill--gelb" href="{b}/k/freigabe">{social.freigabeHier} zur Freigabe</a>{/if}
    {#if schreiben && tab === "creatives"}<button class="btn btn--s" onclick={() => (hoch = true)}><Icon name="upload" size={15} />Hochladen</button>{/if}
    {#if k && schreiben}<button class="btn btn--s btn--primary" onclick={() => (auftrag = true)}><Icon name="sparkles" size={15} />Claude beauftragen</button>{/if}
  </Head>
  </div>
  {#if k && !k.aktiv}<p class="ruht card"><Icon name="clock" size={16} />Dieser Bereich ruht: {k.name} hat in den Kunden nicht mehr die Kategorie „Social Media“. Alles bleibt erhalten.</p>{/if}

  <div class="reiter" class:vier={!!k} role="tablist" aria-label="Ansicht" use:gleiter>
    <a role="tab" class="chip" href={b} aria-selected={tab === "creatives"} class:on={tab === "creatives"}><Icon name="image" size={14} />Creatives</a>
    <a role="tab" class="chip" href="{b}/bibliothek" aria-selected={tab === "bibliothek"} class:on={tab === "bibliothek"}><Icon name="stapel" size={14} />Bibliothek</a>
    <a role="tab" class="chip" href="{b}/plan" aria-selected={tab === "plan"} class:on={tab === "plan"}><Icon name="calendar" size={14} /><span class="lang">Plan &amp; Kalender</span><span class="kurz">Plan</span></a>
    {#if k}<a role="tab" class="chip" href="{b}/stil" aria-selected={tab === "stil"} class:on={tab === "stil"}><Icon name="sparkles" size={14} /><span class="lang">Stil &amp; Kanäle</span><span class="kurz">Stil</span></a>{/if}
  </div>

  {#if tab === "stil" && k}
    <SocialStil kunde={k} />
  {:else if tab === "plan"}
    <SocialPlan />
  {:else if social.laedt && !social.alle.length}<div class="skelett" aria-label="Lade …"><i></i><i></i><i></i></div>
  {:else if social.fehler && !social.alle.length}<div class="card empty"><b>Creatives nicht geladen</b><p>{social.fehler}</p></div>
  {:else if tab === "bibliothek"}
    <SocialBibliothek hochladen={() => (hoch = true)} />
  {:else}
    {#if k}
      {#if !kanaele.length || !k.angelernt}
        <section class="start card" aria-labelledby="st-t">
          <h3 id="st-t">So kommen {k.name}s Creatives zustande</h3>
          <ol>
            <li class:fertig={kanaele.length > 0}><span class="nr num">{kanaele.length ? "✓" : 1}</span><span><b>Kanäle eintragen</b><small class="muted">{kanaele.length ? wo : "Wo postet der Kunde? Name und Link reichen."}</small></span>
              {#if !kanaele.length}<a class="btn btn--s" href="{b}/stil">Kanäle eintragen</a>{/if}</li>
            <li class:fertig={!!k.angelernt}><span class="nr num">{k.angelernt ? "✓" : 2}</span><span><b>Stil anlernen</b><small class="muted">Claude sieht sich die Kanäle an und schreibt auf, wie die Creatives gebaut sind: Format, Aufbau, Figuren, Stimme, Musik.</small></span>
              {#if kanaele.length && !k.angelernt}<a class="btn btn--s" href="{b}/stil">Stil anlernen</a>{/if}</li>
            <li><span class="nr num">3</span><span><b>Beauftragen</b><small class="muted">Danach baut Claude auf Zuruf neue Videos, Karussells oder Bilder im selben Stil. Sie landen hier zur Freigabe.</small></span></li>
          </ol>
        </section>
      {/if}
      <SocialAuftraege kunde={k} />
    {/if}
    <SocialUebersicht />
  {/if}
{/if}
{#if hoch}<CreativeHochladen onclose={() => (hoch = false)} />{/if}
{#if auftrag && k}<SocialBeauftragen kunde={k} onclose={() => (auftrag = false)} />{/if}

<style>
  .reiter { display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 20px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); max-width: 100%; }
  .reiter .chip { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; color: var(--text-2); font-size: .9rem; white-space: nowrap; }
  .kurz { display: none; }
  @media (max-width: 520px) { .sm-kopf :global(.head__t p) { display: none; } .sm-kopf :global(.head) { margin-bottom: 16px; } }
  @media (max-width: 520px) {
    .reiter { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; margin-bottom: 16px; }
    .reiter.vier { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .reiter .chip { padding: 0 8px; font-size: .86rem; gap: 6px; }
    .reiter.vier .chip :global(svg) { display: none; }
    .lang { display: none; }
    .kurz { display: inline; }
  }
  .reiter .chip.on { color: #0A1220; background: transparent; }
  .reiter :global(.gleiter) { background: var(--bereich) !important; }
  .ruht { display: flex; gap: 10px; align-items: center; padding: 12px 16px; margin-bottom: 16px; font-size: .9rem; color: var(--text-2); }
  .start { padding: 18px 20px; margin-bottom: 22px; display: grid; gap: 12px; }
  .start h3 { font-size: 1rem; }
  .start ol { list-style: none; display: grid; gap: 10px; padding: 0; margin: 0; }
  .start li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; }
  .start li > span:nth-child(2) { display: grid; gap: 2px; }
  .start li small { font-size: .84rem; }
  .nr { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: .85rem; font-weight: 600; border: 1px solid var(--line-2); color: var(--text-2); }
  .fertig .nr { background: var(--bereich); border-color: var(--bereich); color: #0A1220; }
  .fertig b { color: var(--text-2); }
  @media (max-width: 520px) { .start li { grid-template-columns: auto minmax(0, 1fr); } .start li .btn { grid-column: 2; justify-self: start; } }
</style>
