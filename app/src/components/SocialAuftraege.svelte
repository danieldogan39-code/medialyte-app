<script lang="ts">
  // Aufträge an Claude für einen Kunden: was gerade läuft, was geliefert wurde. Abbrechen, erneut anstoßen, entfernen.
  import Icon from "./Icon.svelte";
  import PlattformLogo from "./PlattformLogo.svelte";
  import { social, AUFTRAG, AUFTRAGSART, type Auftrag, type SocialKunde } from "../lib/social.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { frage } from "../lib/frage.svelte";
  import { vor } from "../lib/format";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { federKurve, ruhig } from "../lib/bewegung";

  let { kunde, alle = false }: { kunde: SocialKunde; alle?: boolean } = $props();
  const fk = federKurve(0.45, 0.04);
  const schreiben = $derived(auth.darf("social", true));
  const liste = $derived(social.auftraegeVon(kunde.id));
  const laufend = $derived(liste.filter((a) => a.status === "offen" || a.status === "in_arbeit"));
  let mehr = $state(false);
  const zeigen = $derived(alle || mehr ? liste : [...laufend, ...liste.filter((a) => !laufend.includes(a)).slice(0, Math.max(0, 3 - laufend.length))]);
  const st = (a: Auftrag) => AUFTRAG[a.status] ?? AUFTRAG.offen;
  const kanal = (id: string) => social.kanaele.find((k) => k.id === id);
  const titel = (a: Auftrag) => a.art === "anlernen" ? "Stil anlernen" : `${a.anzahl} ${a.anzahl === 1 ? AUFTRAGSART[a.art].name : AUFTRAGSART[a.art].mehr}`;

  async function los(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); daten.melden(ok); } catch (e: any) { daten.melden("Hat nicht geklappt: " + (e?.message || e)); }
  }
  async function abbrechen(a: Auftrag) {
    if (!(await frage(`${titel(a)} abbrechen?`, "Claude fängt damit nicht mehr an. Was schon geliefert wurde, bleibt.", "Abbrechen", true))) return;
    los(() => social.auftragSetzen(a, "abgebrochen"), "Auftrag abgebrochen");
  }
</script>

{#if liste.length}
  <section class="auf" aria-labelledby="auf-t">
    <div class="auf__k"><h3 id="auf-t">Aufträge an Claude</h3>
      {#if !alle && liste.length > zeigen.length}<button class="lnk" onclick={() => (mehr = true)}>Alle {liste.length}</button>{/if}</div>
    <ul>
      {#each zeigen as a (a.id)}
        <li class="card a" class:laeuft={a.status === "offen" || a.status === "in_arbeit"} animate:flip={{ duration: ruhig() ? 0 : 260 }}
          in:fly={{ y: ruhig() ? 0 : 10, duration: ruhig() ? 0 : fk.ms, easing: fk.easing, opacity: 0 }}>
          <span class="ic"><Icon name={AUFTRAGSART[a.art].icon} size={17} /></span>
          <span class="t">
            <b>{titel(a)}{#each a.kanaele ?? [] as id (id)}{@const k = kanal(id)}{#if k}<span class="pl"><PlattformLogo name={k.plattform} size={15} rund={0.3} /></span>{/if}{/each}</b>
            <small class="muted">{a.art === "anlernen" ? (a.hinweise || "Kanäle ansehen und den Stil aufschreiben") : a.thema || "Thema wählt Claude nach dem Stil"}</small>
            {#if a.ergebnis}<small class="erg">{a.ergebnis}</small>{/if}
          </span>
          <span class="r">
            <span class="pill pill--plain pill--{st(a).ton}">{st(a).name}{#if a.art !== "anlernen" && a.geliefert && a.status !== "fertig"} · {a.geliefert}/{a.anzahl}{/if}</span>
            <small class="muted">{vor(a.erledigt ?? a.erstellt)}</small>
          </span>
          {#if schreiben}
            <span class="akt">
              {#if a.status === "offen" || a.status === "in_arbeit"}<button class="lnk" onclick={() => abbrechen(a)}>Abbrechen</button>
              {:else}
                {#if a.status !== "fertig"}<button class="lnk" onclick={() => los(() => social.auftragSetzen(a, "offen"), "Neu angestoßen")}>Erneut versuchen</button>{/if}
                <button class="lnk" onclick={() => los(() => social.auftragWeg(a), "Entfernt")}>Entfernen</button>
              {/if}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .lnk { border: 0; background: none; color: var(--steel); text-decoration: underline; cursor: pointer; font: inherit; font-size: .84rem; padding: 0; }
  .auf { display: grid; gap: 10px; margin-bottom: 26px; }
  .auf__k { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .auf__k h3 { font-size: 1rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .a { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 14px; align-items: center; padding: 12px 16px; }
  .a.laeuft { border-color: color-mix(in srgb, #8AB0FF 40%, var(--line)); }
  .ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--panel-2); color: var(--bereich); }
  .laeuft .ic { color: #8AB0FF; }
  .t { display: grid; gap: 2px; min-width: 0; }
  .t b { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: .95rem; }
  .t small { font-size: .84rem; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .erg { color: var(--text-2); }
  .pl { display: inline-flex; }
  .r { display: grid; justify-items: end; gap: 4px; text-align: right; }
  .r small { font-size: .78rem; }
  .akt { grid-column: 2 / -1; display: flex; gap: 16px; justify-content: flex-end; font-size: .84rem; }
  @media (max-width: 520px) {
    .a { grid-template-columns: auto minmax(0, 1fr); }
    .r { grid-column: 2; justify-items: start; text-align: left; grid-auto-flow: column; align-items: center; justify-content: start; gap: 10px; }
    .akt { justify-content: flex-start; }
  }
</style>
