<script lang="ts">
  // Suchgebiete festlegen (wie im Cockpit) und die Einstellungen des Agenten im Überblick
  import Icon from "./Icon.svelte";
  import { agent } from "../lib/agent.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { befehl } from "../lib/befehl";

  const c = $derived(agent.c);
  const e = $derived(c.einstellungen);
  let eigene = $state<{ ort: string; umkreis_km: number }[] | null>(null);
  const liste = $derived(eigene ?? c.suchgebiete ?? []);
  let ort = $state(""), km = $state(10);
  const darf = $derived(auth.darf("akquise", true));
  const wartet = $derived(daten.offen("suchgebiete").length > 0);

  async function speichern(neu: { ort: string; umkreis_km: number }[], was: string) {
    const vorher = eigene; eigene = neu;
    const ok = await befehl("suchgebiete", { liste: neu }, undefined,
      neu.length ? `Gespeichert. Der nächste Lauf sucht in: ${neu.map((a) => a.ort).join(", ")}.` : "Zurück zum Standard-Suchgebiet.");
    if (!ok) eigene = vorher; else void was;
  }
  function hinzu(ev: Event) {
    ev.preventDefault();
    const o = ort.trim(); if (!o) return;
    if (liste.some((a) => a.ort.toLowerCase() === o.toLowerCase())) { daten.melden(`${o} ist schon eingetragen.`); return; }
    speichern([...liste, { ort: o, umkreis_km: Number(km) }], "+ " + o); ort = "";
  }
  const ADRESSE: Record<string, string> = { aktiv: "aktiv", zertifikat: "Zertifikat wird ausgestellt", dns_fehlt: "DNS-Eintrag fehlt noch", aus: "aus" };
</script>

<div class="cols">
  <section class="card box">
    <h3>Suchgebiete</h3>
    <p class="muted klein">Jeder Ort in Deutschland: ganze Stadt oder Umkreis. Der Agent teilt die Fläche in Suchfelder und sucht sie reihum ab. Gilt ab dem nächsten Lauf.</p>
    <div class="chips">
      {#each liste as a, i (a.ort)}
        <span class="chip">{a.ort} · {a.umkreis_km ? `${a.umkreis_km} km` : "ganze Stadt"}{#if darf}<button aria-label="{a.ort} entfernen" onclick={() => speichern(liste.filter((_, j) => j !== i), "- " + a.ort)}><Icon name="x" size={13} /></button>{/if}</span>
      {:else}
        <span class="muted klein">Standard: Hamburg und Umland ({e?.gebiete ?? "–"} Gebiete)</span>
      {/each}
    </div>
    {#if wartet}<p class="muted klein">Wird an den Agenten übergeben …</p>{/if}
    {#if darf}
      <form class="neu" onsubmit={hinzu}>
        <input class="input" bind:value={ort} placeholder="z. B. München, Köln-Ehrenfeld oder 21147 Hamburg" maxlength="80" aria-label="Ort" required>
        <select class="input" bind:value={km} aria-label="Umkreis"><option value={0}>Ganze Stadt</option><option value={3}>3 km Umkreis</option><option value={5}>5 km Umkreis</option><option value={10}>10 km Umkreis</option><option value={20}>20 km Umkreis</option></select>
        <button class="btn btn--primary" type="submit"><Icon name="plus" size={15} />Hinzufügen</button>
      </form>
    {/if}
  </section>

  <section class="card box">
    <h3>Einstellungen im Überblick</h3>
    {#if e}
      <div class="gross"><b class="num">{e.demos_pro_woche}</b><span class="muted">neue Demos pro Woche, höchstens</span></div>
      <dl>
        <dt>Suchgebiete</dt><dd>{e.gebiete}</dd>
        <dt>Google-Suchen pro Lauf</dt><dd>max. {e.google_budget}</dd>
        <dt>Mindestbewertung</dt><dd>{String(e.mindestbewertung).replace(".", ",")} ★, {e.mindestanzahl} Bewertungen</dd>
        <dt>Demos löschen nach</dt><dd>{e.loeschen_nach} Tagen</dd>
        <dt>Briefversand</dt><dd>{e.briefe_aktiv ? (e.briefmodus === "live" ? "an" : "an (Testmodus)") : "aus"}</dd>
        <dt>Anruf nach dem Brief</dt><dd>nach {e.nachfass_tage ?? 6} Tagen</dd>
        <dt>KI-Modell</dt><dd>{e.modell}</dd>
        {#if e.demo_adresse?.name}<dt>Demo-Adresse</dt><dd>{e.demo_adresse.name} · {ADRESSE[e.demo_adresse.status ?? ""] ?? "wird geprüft"}</dd>{/if}
      </dl>
      <p class="muted klein">Ändern lassen sich diese Werte in der Datei config.yaml des Agenten.</p>
      {#if c.links}
        <div class="links">
          <a class="btn btn--s" href={c.links.einstellungen} target="_blank" rel="noopener"><Icon name="external" size={14} />config.yaml</a>
          <a class="btn btn--s btn--quiet" href={c.links.berichte} target="_blank" rel="noopener">Berichte</a>
          <a class="btn btn--s btn--quiet" href={c.links.wochenlauf} target="_blank" rel="noopener">Läufe bei GitHub</a>
        </div>
      {/if}
    {:else}<p class="muted">Kommt mit dem nächsten Abgleich des Agenten.</p>{/if}
  </section>
</div>

<style>
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 14px; margin-bottom: 14px; align-items: start; }
  .box { padding: 16px 20px 20px; display: grid; gap: 10px; }
  .klein { font-size: .84rem; line-height: 1.45; margin: 0; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 6px 0 12px; border-radius: 999px; background: var(--panel-2); color: var(--text); font-size: .86rem; }
  .chip button { display: grid; place-items: center; width: 22px; height: 22px; border: 0; border-radius: 50%; background: transparent; color: var(--steel); cursor: pointer; }
  .neu { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; }
  .neu select { width: auto; }
  @media (max-width: 560px) { .neu { grid-template-columns: minmax(0, 1fr); } }
  .gross { display: flex; align-items: baseline; gap: 10px; }
  .gross b { font-size: 2rem; color: var(--text); font-weight: 600; }
  dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: .9rem; }
  dt { color: var(--steel); }
  dd { margin: 0; color: var(--text); text-align: right; }
  .links { display: flex; gap: 6px; flex-wrap: wrap; }
</style>
