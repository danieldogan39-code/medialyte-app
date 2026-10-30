<script lang="ts">
  // Kunde ohne Website (nur Rechnungen): Akte mit Rechnungen, Angebote und Abos; auf Wunsch mit einer Website verknüpfen.
  // Hat der Kunde eine Website, geht es zu seiner gemeinsamen Seite (#/kunden/<slug>).
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import KundeAkte from "../components/KundeAkte.svelte";
  import { R } from "../lib/rechnungen/daten.svelte";
  import { versuche } from "../lib/rechnungen/blatt.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb } from "../lib/supabase";

  let { id }: { id: string } = $props();
  const c = $derived(R.customer(id) ?? null);
  let websites = $state<{ slug: string; name: string }[]>([]), wahl = $state("");
  $effect(() => { if (c?.kunde_slug && auth.darf("kunden")) location.replace("#/kunden/" + c.kunde_slug); });
  $effect(() => {
    if (!auth.darf("kunden") || !auth.darf("rechnungen", true)) return;
    sb.from("kunden").select("slug,name").order("name").then(({ data }) => (websites = (data ?? []) as any[]));
  });
  const frei = $derived(websites.filter((w) => !R.customers.some((x) => x.kunde_slug === w.slug)));
  const verknuepfen = (slug: string) => versuche(async () => {
    const { error } = await R.write("customers", "update", { kunde_slug: slug }, [["id", id]]); if (error) throw error;
    daten.melden("Mit der Website verknüpft"); location.hash = "#/kunden/" + slug;
  });
</script>

{#if !R.loaded}<p class="muted">Lade …</p>
{:else if !c}
  <Head titel="Kunde nicht gefunden" zurueck="#/kunden" />
  <div class="card empty"><b>Diesen Kunden gibt es nicht (mehr).</b></div>
{:else}
  <Head titel={c.name} text={[c.contact, c.city].filter(Boolean).join(" · ") || "Rechnungskunde"} zurueck="#/kunden" />
  <KundeAkte {c} />
  {#if frei.length}
    <section class="card web">
      <span class="ic"><Icon name="globe" size={18} /></span>
      <span class="t"><h3>Website</h3><p class="muted">Hat dieser Kunde eine Website von dir? Dann verknüpfe sie – Rechnungen, Website und Tischbuch stehen danach auf einer Seite.</p></span>
      <label><span class="vh">Website verknüpfen</span>
        <select class="input" bind:value={wahl} onchange={() => { if (wahl) verknuepfen(wahl); }}>
          <option value="">Website wählen …</option>
          {#each frei as w (w.slug)}<option value={w.slug}>{w.name}</option>{/each}
        </select></label>
    </section>
  {/if}
{/if}

<style>
  .web { padding: 18px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .web .t { flex: 1; min-width: 220px; }
  .web h3 { margin: 0; font-size: 1.05rem; }
  .web p { margin: 2px 0 0; font-size: .88rem; }
  .ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: rgba(111, 168, 240, .12); color: #A9C9F5; flex: none; }
  .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
