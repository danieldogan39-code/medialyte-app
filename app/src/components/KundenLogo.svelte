<script lang="ts">
  // Logo eines Kunden: eigenes Logo, sonst das Logo seiner Demo, sonst seine Anfangsbuchstaben
  import { kuerzel, farbeVon } from "../lib/logo";
  let { logo = null, name = "", demo = null, size = 40 }: { logo?: string | null; name?: string; demo?: string | null; size?: number } = $props();
  let kaputt = $state("");
  const quelle = $derived(logo || (demo ? `https://entwurf.medialyte.de/${encodeURIComponent(demo)}/logo.svg` : ""));
</script>
{#if quelle && kaputt !== quelle}
  <span class="kl kl--bild" style="--s: {size}px"><img src={quelle} alt="Logo {name}" loading="lazy" decoding="async" onerror={() => (kaputt = quelle)}></span>
{:else}
  <span class="kl kl--text" style="--s: {size}px; --f: {farbeVon(name)}" aria-hidden="true">{kuerzel(name)}</span>
{/if}
<style>
  .kl { width: var(--s); height: var(--s); flex: none; display: grid; place-items: center; border-radius: calc(var(--s) * .26); overflow: hidden; }
  .kl--bild { background: #fff; box-shadow: inset 0 0 0 1px rgba(10, 18, 32, .08), 0 6px 16px -10px rgba(0, 0, 0, .6); padding: calc(var(--s) * .12); }
  .kl--bild img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .kl--text { background: var(--f); color: #fff; font-weight: 650; font-size: calc(var(--s) * .38); letter-spacing: .02em;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .25); }
</style>
