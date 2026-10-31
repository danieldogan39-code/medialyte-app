<script lang="ts">
  // Bibliothek: alle Creatives an einem Ort, durchsuchbar, mit Favoriten und eigenen Uploads.
  // Die Nummern sind die Posting-Reihenfolge über alle Plattformen.
  import Icon from "./Icon.svelte";
  import CreativeAnsicht from "./CreativeAnsicht.svelte";
  import AnsichtSchalter from "./AnsichtSchalter.svelte";
  import { auth } from "../lib/auth.svelte";
  import { social, suchtext, type Creative } from "../lib/social.svelte";

  let { hochladen }: { hochladen: () => void } = $props();
  const schreiben = $derived(auth.darf("social", true));
  const FILTER: [string, string, (c: Creative) => boolean][] = [
    ["alle", "Alle", (c) => c.status !== "verworfen"],
    ["favoriten", "Favoriten", (c) => !!c.favorit],
    ["eigene", "Eigene", (c) => !!c.eigen],
    ["bild", "Bilder", (c) => c.art === "bild" && c.status !== "verworfen"],
    ["karussell", "Karussells", (c) => c.art === "karussell" && c.status !== "verworfen"],
    ["video", "Videos", (c) => c.art === "video" && c.status !== "verworfen"],
    ["gepostet", "Gepostet", (c) => c.status === "gepostet"],
    ["verworfen", "Verworfen", (c) => c.status === "verworfen"],
  ];
  let filter = $state(lies()), suche = $state("");
  function lies() { try { return sessionStorage.getItem("social:bib") || "alle"; } catch { return "alle"; } }
  $effect(() => { try { sessionStorage.setItem("social:bib", filter); } catch { /* egal */ } });

  const zahl = (k: string) => social.liste.filter(FILTER.find((f) => f[0] === k)![2]).length;
  const liste = $derived.by(() => {
    const f = FILTER.find((x) => x[0] === filter)?.[2] ?? FILTER[0][2];
    const w = suche.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return social.sortiert().filter((c) => f(c) && w.every((x) => suchtext(c).includes(x)));
  });
</script>

<div class="leiste">
  <label class="suche"><Icon name="search" size={16} /><input class="input" type="search" placeholder="Titel, Text, Hashtag …" bind:value={suche} aria-label="Creatives durchsuchen"></label>
  <span class="as-oben"><AnsichtSchalter /></span>
  {#if schreiben}<button class="btn btn--primary hoch" onclick={hochladen} aria-label="Hochladen"><Icon name="upload" size={16} /><span>Hochladen</span></button>{/if}
</div>
<div class="leiste2">
  <div class="chips" role="group" aria-label="Filter">
    {#each FILTER as [k, t] (k)}
      {@const n = zahl(k)}
      {#if n || k === "alle" || k === "favoriten" || filter === k}
        <button class="chip" class:on={filter === k} aria-pressed={filter === k} onclick={() => (filter = k)}>{#if k === "favoriten"}<Icon name="star" size={13} fill={filter === k} />{/if}{t}<span class="n num">{n}</span></button>
      {/if}
    {/each}
  </div>
  <span class="as-unten"><AnsichtSchalter /></span>
</div>


{#if liste.length}
  {#key filter}<CreativeAnsicht {liste} {schreiben} global sortierbar={!suche.trim()} />{/key}
{:else if filter === "favoriten" && !suche.trim()}
  <div class="card empty"><Icon name="star" size={26} /><b>Noch keine Favoriten</b><p>Tipp bei einem Creative auf den Stern, dann findest du es hier wieder.</p></div>
{:else if filter === "eigene" && !suche.trim()}
  <div class="card empty"><Icon name="upload" size={26} /><b>Noch nichts hochgeladen</b><p>Lade eigene Bilder oder Videos hoch. Sie bekommen Plattformen, Text und einen Platz in der Reihenfolge wie alle anderen.</p>
    {#if schreiben}<button class="btn" onclick={hochladen}><Icon name="upload" size={16} />Hochladen</button>{/if}</div>
{:else}
  <div class="card empty"><Icon name="search" size={26} /><b>Nichts gefunden</b><p>Ändere die Suche oder den Filter.</p></div>
{/if}

<style>
  .leiste { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
  .suche { flex: 1; position: relative; display: flex; align-items: center; }
  .suche :global(svg) { position: absolute; left: 12px; color: var(--steel); pointer-events: none; }
  .suche input { padding-left: 36px; width: 100%; }
  .as-oben { display: none; }
  @media (max-width: 520px) { .as-oben { display: contents; } }
  .leiste2 { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .chips { flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent); }
  .chips::-webkit-scrollbar { display: none; }
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent;
    color: var(--text-2); cursor: pointer; font-size: .86rem; white-space: nowrap; flex: none; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .chip .n { font-size: .76rem; opacity: .6; }
  .empty { display: grid; justify-items: center; gap: 8px; text-align: center; }
  .empty .btn { margin-top: 4px; }
  @media (max-width: 520px) {
    .leiste { gap: 8px; }
    .hoch { width: 44px; padding: 0; justify-content: center; flex: none; }
    .hoch span { display: none; }
    .chips { margin-right: -16px; padding-right: 16px; }
    .as-unten { display: none; }
  }
</style>
