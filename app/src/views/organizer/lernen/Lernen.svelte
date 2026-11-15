<script lang="ts">
  // Lernbereich: Übersicht → Kurs (Lernpfad) → Lektion (Erklärung) → Abfrage / Prüfungssimulation
  import "katex/dist/katex.min.css";
  import { router } from "../../../lib/router.svelte";
  import { lernen } from "../../../lib/lernen/lernen.svelte";
  import { KURSE, type KursId } from "../../../lib/lernen/typen";
  import Uebersicht from "./Uebersicht.svelte";
  import KursSeite from "./KursSeite.svelte";
  import LektionSeite from "./LektionSeite.svelte";
  import Abfrage from "./Abfrage.svelte";
  import Pruefung from "./Pruefung.svelte";

  $effect(() => { lernen.laden(); lernen.alleLaden(); });
  const t = $derived(router.teile.slice(2));
  const istKurs = (x: string | undefined): x is KursId => KURSE.some((k) => k.id === x);
</script>

{#if t[0] === "abfrage"}
  {#key t.join("/")}<Abfrage art={t[1] ?? "faellig"} kurs={istKurs(t[2]) ? t[2] : null} lektion={t[3] ?? null} gen={t[4] ?? null} />{/key}
{:else if t[0] === "pruefung" && istKurs(t[1])}
  {#key t[1]}<Pruefung kurs={t[1]} />{/key}
{:else if istKurs(t[0]) && t[1]}
  {#key t[0] + t[1]}<LektionSeite kurs={t[0]} id={t[1]} />{/key}
{:else if istKurs(t[0])}
  {#key t[0]}<KursSeite kurs={t[0]} />{/key}
{:else}
  <Uebersicht />
{/if}
