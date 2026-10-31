<script lang="ts">
  // Je Gerät festlegen, welche Benachrichtigungen ankommen: jede Art einzeln, dazu eine Ruhezeit.
  // Auch von einem anderen Gerät aus änderbar (z. B. am Mac fürs Handy einstellen).
  import Icon from "./Icon.svelte";
  import Schalter from "./Schalter.svelte";
  import { daten } from "../lib/daten.svelte";
  import { haptik } from "../lib/haptik";
  import { geraeteLaden, geraetEinstellen, geraetAbmelden, meineGeraeteId, type Geraet, type Ruhe } from "../lib/push";
  import { GRUPPEN, ALLE, RUHE_STANDARD } from "../lib/benachrichtigungen";
  import { frage } from "../lib/frage.svelte";
  import { slide } from "svelte/transition";
  import { ruhig } from "../lib/bewegung";

  let { neu = 0 }: { neu?: number } = $props();   // ändert sich, wenn dieses Gerät an- oder abgemeldet wurde
  let liste = $state<Geraet[]>([]), meine = $state<string | null>(null), laedt = $state(true), fehler = $state(""), veraltet = $state(false);
  let offen = $state<Record<string, boolean>>({}), gespeichert = $state<Record<string, string>>({});

  async function laden() {
    laedt = true; fehler = "";
    try {
      const [r, id] = await Promise.all([geraeteLaden(), meineGeraeteId().catch(() => null)]);
      veraltet = !!r.veraltet; meine = id;
      liste = [...(r.geraete ?? [])].sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : String(a.geraet).localeCompare(String(b.geraet))));
      if (id && liste.some((g) => g.id === id) && offen[id] === undefined) offen[id] = true;
      if (!id && liste.length === 1) offen[liste[0].id] = true;
    } catch (e: any) { fehler = e?.message || String(e); }
    laedt = false;
  }
  $effect(() => { neu; laden(); });

  const an = (g: Geraet, k: string) => g.themen?.[k] !== false;
  const ruhe = (g: Geraet): Ruhe => ({ ...RUHE_STANDARD, ...(g.ruhe ?? {}) });
  const zahlAn = (g: Geraet) => ALLE.filter((a) => an(g, a.key)).length;
  const zusammenfassung = (g: Geraet) => {
    const n = zahlAn(g), r = ruhe(g);
    const teil = n === ALLE.length ? "Alles an" : n === 0 ? "Alles aus" : `${n} von ${ALLE.length} an`;
    return r.an ? `${teil} · Ruhe ${r.von.replace(/^0/, "")}–${r.bis.replace(/^0/, "")} Uhr` : teil;
  };

  const timer: Record<string, ReturnType<typeof setTimeout>> = {};
  function speichern(g: Geraet) {
    clearTimeout(timer[g.id]);
    gespeichert[g.id] = "…";
    timer[g.id] = setTimeout(async () => {
      try { await geraetEinstellen(g.id, { themen: { ...g.themen }, ruhe: ruhe(g) }); gespeichert[g.id] = "Gespeichert"; setTimeout(() => { if (gespeichert[g.id] === "Gespeichert") gespeichert[g.id] = ""; }, 1800); }
      catch (e: any) { gespeichert[g.id] = ""; daten.melden("Nicht gespeichert: " + (e?.message || e)); laden(); }
    }, 450);
  }
  function setzen(g: Geraet, k: string, v: boolean) {
    const t = { ...(g.themen ?? {}) };
    if (v) delete t[k]; else t[k] = false;
    g.themen = t; haptik("auswahl"); speichern(g);
  }
  function gruppeSetzen(g: Geraet, keys: string[], v: boolean) {
    const t = { ...(g.themen ?? {}) };
    for (const k of keys) { if (v) delete t[k]; else t[k] = false; }
    g.themen = t; haptik("auswahl"); speichern(g);
  }
  function ruheSetzen(g: Geraet, teil: Partial<Ruhe>) { g.ruhe = { ...ruhe(g), ...teil }; speichern(g); }
  async function abmelden(g: Geraet) {
    if (!(await frage(`„${g.geraet || "Gerät"}“ abmelden?`, "Dieses Gerät bekommt keine Benachrichtigungen mehr. Auf dem Gerät selbst kannst du sie jederzeit wieder einschalten.", "Abmelden", true))) return;
    try { await geraetAbmelden(g.id); liste = liste.filter((x) => x.id !== g.id); daten.melden("Gerät abgemeldet"); }
    catch (e: any) { daten.melden("Nicht abgemeldet: " + (e?.message || e)); }
  }
  const symbol = (g: Geraet) => (g.typ === "android" || /Android|iPhone/i.test(g.geraet) ? "phone" : "globe");
  const name = (g: Geraet) => g.geraet || (g.typ === "android" ? "Android" : "Browser");
</script>

<div class="bg">
  <div class="bg__k"><b>Was auf welches Gerät kommt</b><small class="muted">Jede Art einzeln an- oder abschalten, dazu eine Ruhezeit. Gilt sofort.</small></div>
  {#if laedt && !liste.length}<p class="muted klein">Lade Geräte …</p>
  {:else if fehler}<p class="hinweis">Geräte konnten nicht geladen werden: {fehler} <button class="lnk" onclick={laden}>Nochmal</button></p>
  {:else if veraltet}<p class="hinweis">Die Einstellungen je Gerät werden gerade beim Benachrichtigungs-Dienst eingerichtet. In ein paar Minuten nochmal öffnen.</p>
  {:else if !liste.length}<p class="muted klein">Noch kein Gerät angemeldet. Schalte oben die Benachrichtigungen auf dem Gerät ein, das sie bekommen soll.</p>
  {:else}
    {#each liste as g (g.id)}
      <div class="ge" class:offen={offen[g.id]}>
        <button class="ge__k" aria-expanded={!!offen[g.id]} onclick={() => (offen[g.id] = !offen[g.id])}>
          <span class="ge__i"><Icon name={symbol(g)} size={17} /></span>
          <span class="ge__t"><b>{name(g)}{#if g.id === meine}<span class="dies">dieses Gerät</span>{/if}</b><small class="muted">{zusammenfassung(g)}</small></span>
          {#if gespeichert[g.id]}<span class="gs muted">{gespeichert[g.id]}</span>{/if}
          <Icon name="down" size={18} />
        </button>
        {#if offen[g.id]}
          <div class="ge__inhalt" transition:slide={{ duration: ruhig() ? 0 : 260 }}>
            {#each GRUPPEN as gr (gr.key)}
              {@const keys = gr.arten.map((a) => a.key)}
              {@const alle = keys.every((k) => an(g, k))}
              <div class="gr">
                <div class="gr__k"><span><Icon name={gr.icon} size={14} />{gr.name}</span>
                  <button class="lnk" onclick={() => gruppeSetzen(g, keys, !alle)}>{alle ? "Alle aus" : "Alle an"}</button></div>
                {#each gr.arten as a (a.key)}
                  <div class="art">
                    <span class="art__t"><b>{a.name}{#if a.dringend}<span class="dr" title="Gilt als dringend: kann auch in der Ruhezeit kommen">dringend</span>{/if}</b><small class="muted">{a.text}</small></span>
                    <Schalter an={an(g, a.key)} label={a.name} onchange={(v: boolean) => setzen(g, a.key, v)} />
                  </div>
                {/each}
              </div>
            {/each}
            <div class="gr">
              <div class="gr__k"><span><Icon name="clock" size={14} />Ruhezeit</span></div>
              <div class="art">
                <span class="art__t"><b>Ruhezeit</b><small class="muted">In dieser Zeit kommt nichts auf dieses Gerät (Uhrzeit in Deutschland).</small></span>
                <Schalter an={ruhe(g).an} label="Ruhezeit" onchange={(v: boolean) => ruheSetzen(g, { an: v })} />
              </div>
              {#if ruhe(g).an}
                <div class="zeiten" transition:slide={{ duration: ruhig() ? 0 : 200 }}>
                  <label class="field"><span>Von</span><input class="input" type="time" value={ruhe(g).von} onchange={(e) => ruheSetzen(g, { von: e.currentTarget.value || "22:00" })}></label>
                  <label class="field"><span>Bis</span><input class="input" type="time" value={ruhe(g).bis} onchange={(e) => ruheSetzen(g, { bis: e.currentTarget.value || "07:00" })}></label>
                </div>
                <div class="art">
                  <span class="art__t"><b>Dringendes trotzdem</b><small class="muted">Rückrufwünsche, geöffnete Demos und Probleme kommen auch in der Ruhezeit.</small></span>
                  <Schalter an={ruhe(g).dringend} label="Dringendes trotzdem" onchange={(v: boolean) => ruheSetzen(g, { dringend: v })} />
                </div>
              {/if}
            </div>
            {#if g.id !== meine}<button class="btn btn--quiet btn--s weg" onclick={() => abmelden(g)}><Icon name="trash" size={14} />Gerät abmelden</button>{/if}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .bg { display: grid; gap: 10px; padding-top: 6px; border-top: 1px solid var(--line); }
  .bg__k { display: grid; gap: 3px; margin-top: 8px; }
  .bg__k b { color: var(--text); font-weight: 600; }
  .bg__k small { font-size: .84rem; }
  .klein { margin: 0; font-size: .86rem; }
  .hinweis { margin: 0; font-size: .86rem; padding: 10px 12px; border-radius: var(--radius-s); background: rgba(231, 185, 74, .1); color: #EBC56B; line-height: 1.45; }
  .ge { border: 1px solid var(--line); border-radius: 14px; background: var(--bg-2); overflow: hidden; }
  .ge.offen { border-color: var(--line-2); }
  .ge__k { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .ge__k > :global(svg:last-child) { color: var(--steel); transition: transform .3s cubic-bezier(.32, .72, 0, 1); flex: none; }
  .ge.offen .ge__k > :global(svg:last-child) { transform: rotate(180deg); }
  .ge__i { width: 34px; height: 34px; flex: none; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--bereich, var(--text)) 14%, transparent); color: var(--bereich, var(--text)); }
  .ge__t { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .ge__t b { color: var(--text); font-weight: 600; font-size: .94rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ge__t small { font-size: .8rem; }
  .dies { font-size: .7rem; font-weight: 500; padding: 2px 8px; border-radius: 999px; background: rgba(76, 195, 138, .16); color: #6FD3A2; }
  .gs { font-size: .76rem; flex: none; }
  .ge__inhalt { display: grid; gap: 4px; padding: 0 14px 14px; }
  .gr { display: grid; border-top: 1px solid var(--line); padding-top: 10px; margin-top: 6px; }
  .gr__k { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
  .gr__k span { display: inline-flex; align-items: center; gap: 7px; font-size: .78rem; font-weight: 600; color: var(--steel); letter-spacing: .01em; }
  .art { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 0; }
  .art__t { display: grid; gap: 2px; min-width: 0; }
  .art__t b { font-weight: 500; font-size: .9rem; color: var(--text); display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .art__t small { font-size: .78rem; line-height: 1.4; }
  .dr { font-size: .66rem; font-weight: 500; padding: 1px 6px; border-radius: 999px; background: rgba(255, 87, 87, .14); color: #FF8A8A; }
  .zeiten { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 2px 0 6px; }
  .lnk { border: 0; background: none; padding: 4px 0; font: inherit; font-size: .8rem; color: var(--text-2); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .weg { justify-self: start; color: #FF8080; margin-top: 8px; }
  @media (hover: hover) and (pointer: fine) { .ge__k:hover b { color: var(--text); } .ge:not(.offen):hover { border-color: var(--line-2); } }
</style>
