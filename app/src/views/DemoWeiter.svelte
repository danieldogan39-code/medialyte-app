<script lang="ts">
  // Verweis auf eine Demo (z. B. aus einer Benachrichtigung „X hat die Demo geöffnet“): zum Betrieb weiterleiten
  import { sb } from "../lib/supabase";
  let { slug }: { slug: string } = $props();
  let fehlt = $state(false);
  $effect(() => {
    sb.from("demos").select("betrieb_id").eq("slug", slug).maybeSingle().then(({ data }) => {
      if (data?.betrieb_id) location.replace("#/akquise/betrieb/" + data.betrieb_id); else fehlt = true;
    });
  });
</script>
{#if fehlt}<div class="card empty"><b>Demo nicht gefunden</b><a class="btn" href="#/nachfassen">Zum Nachfassen</a></div>{/if}
