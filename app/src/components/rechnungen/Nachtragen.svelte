<script lang="ts">
  // Abo-Start in der Vergangenheit: vergangene Zeiträume nachtragen (bezahlt/offen) oder überspringen
  import Blatt from "./Blatt.svelte";
  import { fmtDate } from "../../lib/rechnungen/kern";
  let { zu, n, naechste, wahl }: { zu: () => void; n: number; naechste: string; wahl: (m: string) => void } = $props();
  const w = (m: string) => { zu(); wahl(m); };
</script>

<Blatt titel="Startdatum liegt in der Vergangenheit" {zu}>
  <p>Bis heute fallen <b>{n} {n === 1 ? "Abrechnungszeitraum" : "Abrechnungszeiträume"}</b> an. Wie sollen sie erfasst werden? <span class="muted">Es geht dabei keine E-Mail an den Kunden.</span></p>
  <div class="wahl">
    <button class="btn btn--primary" onclick={() => w("paid")}>{n} Rechnungen als bezahlt nachtragen</button>
    <button class="btn" onclick={() => w("open")}>{n} Rechnungen als offen nachtragen</button>
    <button class="btn" onclick={() => w("skip")}>Nichts nachtragen – erste Rechnung am {fmtDate(naechste)}</button>
  </div>
  <p class="muted klein">Nachgetragene Rechnungen bekommen jeweils den ersten Werktag ihres Zeitraums als Rechnungsdatum.</p>
</Blatt>

<style>p { margin: 0; line-height: 1.5; } .wahl { display: grid; gap: 8px; } .klein { font-size: .84rem; }</style>
