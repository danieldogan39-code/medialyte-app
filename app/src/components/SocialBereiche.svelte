<script lang="ts">
  // Bereiche im Social Media: Medialyte selbst und jeder Kunde mit der Kategorie „Social Media“.
  // „Kunde“ legt einen neuen Kunden gleich mit dieser Kategorie an (dafür braucht es das Recht für Rechnungen).
  import Icon from "./Icon.svelte";
  import { social } from "../lib/social.svelte";
  import { auth } from "../lib/auth.svelte";
  import { R } from "../lib/rechnungen/daten.svelte";
  import { oeffneKunde } from "../lib/rechnungen/oeffnen";
  import { daten } from "../lib/daten.svelte";

  const anlegen = $derived(auth.darf("rechnungen", true) && !!R.socialKategorie);
  function neu() {
    oeffneKunde(null, (c) => { if (c?.name) daten.melden(`${c.name} hat jetzt einen Bereich unter Social Media`); }, { kategorienVorab: [R.socialKategorie!.id] });
  }
  const kurz = (n: string) => n.replace(/^(https?:\/\/)?(www\.)?/, "").trim().slice(0, 2).toUpperCase();
  let leiste: HTMLElement | undefined = $state();
  // aktiven Bereich sichtbar halten (auf dem Handy scrollt die Leiste)
  $effect(() => { social.kunde; leiste?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "nearest" }); });
</script>

{#if social.aktiveKunden.length || anlegen || social.kunde}
  <nav class="bereiche" aria-label="Bereiche" bind:this={leiste}>
    <a class="bk" href="#/social" aria-current={!social.kunde ? "page" : undefined}>
      <span class="av av--m" aria-hidden="true">M</span><span class="n">Medialyte</span>
      {#if social.freigabeVon(null)}<span class="z num" title="zur Freigabe">{social.freigabeVon(null)}</span>{/if}
    </a>
    {#each social.aktiveKunden as k (k.id)}
      <a class="bk" href="#/social/kunde/{k.id}" aria-current={social.kunde === k.id ? "page" : undefined} style="--k: {k.farbe}">
        <span class="av" aria-hidden="true">{kurz(k.name)}</span><span class="n">{k.name}</span>
        {#if social.freigabeVon(k.id)}<span class="z num" title="zur Freigabe">{social.freigabeVon(k.id)}</span>{/if}
        {#if social.auftraegeVon(k.id).some((a) => a.status === "offen" || a.status === "in_arbeit")}<span class="arbeit" title="Claude arbeitet daran"></span>{/if}
      </a>
    {/each}
    {#if anlegen}<button class="bk bk--neu" onclick={neu}><Icon name="plus" size={15} />Kunde</button>{/if}
  </nav>
{/if}

<style>
  .bereiche { display: flex; gap: 6px; margin: -4px 0 18px; overflow-x: auto; scrollbar-width: none; padding: 2px; scroll-padding-inline: 16px; }
  .bereiche::-webkit-scrollbar { display: none; }
  .bk { position: relative; flex: none; display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px 0 5px; border-radius: 999px;
    border: 1px solid var(--line); background: var(--panel); color: var(--text-2); font: inherit; font-size: .88rem; cursor: pointer;
    transition: border-color .16s ease, color .16s ease, transform .12s ease; }
  .bk:active { transform: scale(.97); }
  @media (hover: hover) { .bk:hover { border-color: var(--line-2); color: var(--text); } }
  .bk[aria-current="page"] { border-color: var(--k, var(--bereich)); color: var(--text); background: color-mix(in srgb, var(--k, var(--bereich)) 12%, var(--panel)); }
  .av { width: 28px; height: 28px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: .7rem; font-weight: 700; letter-spacing: .02em;
    background: var(--k, var(--bereich)); color: #0A1220; }
  .av--m { background: var(--panel-2); color: var(--text); border: 1px solid var(--line-2); }
  .n { max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .z { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #EBC56B; color: #0A1220; font-size: .72rem; font-weight: 700; display: grid; place-items: center; }
  .arbeit { width: 7px; height: 7px; border-radius: 50%; background: #8AB0FF; box-shadow: 0 0 0 3px color-mix(in srgb, #8AB0FF 25%, transparent); animation: puls 1.6s ease-in-out infinite; }
  @keyframes puls { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .arbeit { animation: none; } }
  .bk--neu { padding: 0 14px 0 10px; border-style: dashed; gap: 6px; }
</style>
