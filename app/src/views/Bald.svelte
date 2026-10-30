<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { RECHNUNGEN_URL } from "../lib/config";
  let { titel, text, link = false }: { titel: string; text: string; link?: boolean } = $props();
</script>
<Head {titel} />
<div class="card empty">
  <b>Wird gerade gebaut</b>
  <p>{text}</p>
  {#if link}<a class="btn" href={RECHNUNGEN_URL} target="_blank" rel="noopener"><Icon name="external" size={16} />Rechnungs-App öffnen</a>{/if}
</div>
