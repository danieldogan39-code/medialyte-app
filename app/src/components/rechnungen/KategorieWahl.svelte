<script lang="ts">
  // Kategorien eines Kunden an- und abwählen (Tippen schaltet um), „Bearbeiten“ öffnet die Liste der Kategorien
  import Icon from "../Icon.svelte";
  import KategorienEditor from "./KategorienEditor.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { B } from "../../lib/rechnungen/blatt.svelte";

  let { ausgewaehlt = [], onchange, darf = true, auto = [] }: { ausgewaehlt?: string[]; onchange?: (ids: string[]) => void; darf?: boolean; auto?: string[] } = $props();
  const liste = $derived([...R.kategorien].sort((a, b) => a.sortierung - b.sortierung || a.name.localeCompare(b.name, "de")));
  const an = (id: string) => ausgewaehlt.includes(id) || auto.includes(id);
  const umschalten = (id: string) => { if (!darf || auto.includes(id)) return; onchange?.(an(id) ? ausgewaehlt.filter((x) => x !== id) : [...ausgewaehlt, id]); };
</script>

<div class="wahl" role="group" aria-label="Kategorien">
  {#each liste as k (k.id)}
    <button type="button" class="kc" class:an={an(k.id)} style="--k: {k.farbe}" aria-pressed={an(k.id)} disabled={!darf || auto.includes(k.id)}
      title={auto.includes(k.id) ? "Automatisch: Website vom Agenten" : an(k.id) ? "Kategorie entfernen" : "Kategorie zuordnen"} onclick={() => umschalten(k.id)}>
      <i></i>{k.name}{#if an(k.id)}<span class="haken" aria-hidden="true">✓</span>{/if}
    </button>
  {/each}
  {#if darf}<button type="button" class="kc kc--rand" onclick={() => B.auf(KategorienEditor)}><Icon name="settings" size={13} />{liste.length ? "Bearbeiten" : "Kategorien anlegen"}</button>{/if}
</div>

<style>
  .wahl { display: flex; flex-wrap: wrap; gap: 6px; }
  .kc { display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2);
    cursor: pointer; font: inherit; font-size: .84rem; white-space: nowrap;
    transition: background-color .3s ease, border-color .3s ease, color .3s ease, transform .45s var(--feder-schnell); }
  .kc i { width: 8px; height: 8px; border-radius: 50%; background: var(--k); transition: transform .5s var(--feder); }
  .kc.an { background: color-mix(in srgb, var(--k) 18%, transparent); border-color: color-mix(in srgb, var(--k) 55%, transparent); color: var(--text); }
  .kc.an i { transform: scale(1.25); }
  .kc:active:not(:disabled) { transform: scale(.94); transition-duration: .3s, .3s, .3s, .08s; }
  .kc:disabled { cursor: default; }
  .haken { font-size: .78rem; opacity: .9; animation: rein .45s var(--feder); }
  @keyframes rein { from { opacity: 0; transform: scale(.4); } }
  .kc--rand { border-style: dashed; color: var(--steel); }
  @media (hover: hover) and (pointer: fine) { .kc:not(:disabled):hover { border-color: color-mix(in srgb, var(--k, #8B98AD) 60%, transparent); } }
</style>
