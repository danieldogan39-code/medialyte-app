<script lang="ts">
  import Head from "../components/Head.svelte";
  import Icon from "../components/Icon.svelte";
  import { auth } from "../lib/auth.svelte";
  import { daten } from "../lib/daten.svelte";
  import { sb, fehler } from "../lib/supabase";
  import { BEREICHE, ROLLEN } from "../lib/status";

  let rechte = $state<any[]>([]), einladen = $state(false), name = $state(""), email = $state(""), rolle = $state("marketing");
  let link = $state(""), linkFuer = $state(""), laeuft = $state(false);
  const darf = $derived(auth.darf("team", true));

  async function laden() { rechte = (await sb.from("rechte").select("*")).data ?? []; await daten.laden(); }
  $effect(() => { laden(); });

  async function team(body: any) {
    laeuft = true;
    const { data, error } = await sb.functions.invoke("team", { body });
    laeuft = false;
    if (error || !data?.ok) {
      let m = data?.error;
      try { m = m ?? (await (error as any)?.context?.json())?.error; } catch { /* egal */ }
      daten.melden(m ?? fehler(error)); return null;
    }
    return data;
  }
  async function einladenSenden(e: SubmitEvent) {
    e.preventDefault();
    const r = await team({ aktion: "einladen", name, email, rolle });
    if (r) { link = r.link; linkFuer = name; einladen = false; name = ""; email = ""; laden(); }
  }
  async function neuerLink(m: any) { const r = await team({ aktion: "neuer_link", user_id: m.user_id }); if (r) { link = r.link; linkFuer = m.name; } }
  async function zweifaktor(m: any) {
    if (!confirm(`Zwei-Faktor für ${m.name} zurücksetzen? Beim nächsten Anmelden muss ${m.name} sie neu einrichten.`)) return;
    if (await team({ aktion: "zweifaktor_zuruecksetzen", user_id: m.user_id })) daten.melden("Zurückgesetzt");
  }
  async function sperren(m: any) {
    if (m.aktiv && !confirm(`Zugang von ${m.name} sperren?`)) return;
    if (await team({ aktion: m.aktiv ? "sperren" : "entsperren", user_id: m.user_id })) { daten.melden(m.aktiv ? "Gesperrt" : "Entsperrt"); laden(); }
  }
  async function rolleAendern(m: any, r: string) {
    const { error } = await sb.from("mitglieder").update({ rolle: r }).eq("user_id", m.user_id);
    if (error) daten.melden(fehler(error)); else { daten.melden("Rolle geändert"); laden(); }
  }
  const stufe = (r: string, b: string) => { const x = rechte.find((y) => y.rolle === r && y.bereich === b); return x?.schreiben ? "schreiben" : x?.lesen ? "lesen" : "kein"; };
  async function rechtSetzen(r: string, b: string, v: string) {
    const { error } = await sb.from("rechte").upsert({ rolle: r, bereich: b, lesen: v !== "kein", schreiben: v === "schreiben" });
    if (error) daten.melden(fehler(error)); else laden();
  }
  async function kopieren() { try { await navigator.clipboard.writeText(link); daten.melden("Link kopiert"); } catch { daten.melden("Bitte von Hand kopieren"); } }
</script>

<Head titel="Team & Rechte" text="Jedes Mitglied hat ein eigenes Konto mit Zwei-Faktor-Anmeldung. Die Rolle bestimmt, was es sehen und ändern darf.">
  {#if darf}<button class="btn btn--primary" onclick={() => (einladen = !einladen)}><Icon name="plus" size={16} />Mitglied einladen</button>{/if}
</Head>

{#if einladen}
  <form class="card inv" onsubmit={einladenSenden}>
    <label class="field"><span>Vorname</span><input class="input" bind:value={name} required></label>
    <label class="field"><span>E-Mail</span><input class="input" type="email" bind:value={email} required></label>
    <label class="field"><span>Rolle</span><select class="input" bind:value={rolle}>{#each Object.entries(ROLLEN) as [k, v]}<option value={k}>{v}</option>{/each}</select></label>
    <div class="inv__a"><button class="btn btn--quiet" type="button" onclick={() => (einladen = false)}>Abbrechen</button><button class="btn btn--primary" type="submit" disabled={laeuft}>Einladungslink erzeugen</button></div>
  </form>
{/if}

{#if link}
  <div class="card linkbox">
    <div><b>Persönlicher Link für {linkFuer}</b><p class="muted">Nur einmal gültig und nach 24 Stunden abgelaufen. Damit legt {linkFuer} das Passwort fest und richtet die Zwei-Faktor-Anmeldung ein. Bitte nur direkt an {linkFuer} schicken.</p></div>
    <code>{link}</code>
    <div class="linkbox__a">
      <button class="btn btn--s" onclick={kopieren}><Icon name="copy" size={15} />Kopieren</button>
      <a class="btn btn--s" href="https://wa.me/?text={encodeURIComponent(`Hallo ${linkFuer}, hier ist dein Zugang zur Medialyte-App: ${link}`)}" target="_blank" rel="noopener"><Icon name="whatsapp" size={15} />Per WhatsApp</a>
      <button class="btn btn--s btn--quiet" onclick={() => (link = "")}>Schließen</button>
    </div>
  </div>
{/if}

<div class="card tw"><table class="table">
  <thead><tr><th>Name</th><th class="h-m">E-Mail</th><th>Rolle</th><th>Zugang</th>{#if darf}<th></th>{/if}</tr></thead>
  <tbody>
    {#each daten.team as m (m.user_id)}
      <tr class="nohover">
        <td><b>{m.name}</b>{#if m.user_id === auth.ich?.user_id} <small class="muted">(du)</small>{/if}</td>
        <td class="h-m">{m.email}</td>
        <td>{#if darf && m.user_id !== auth.ich?.user_id}<select class="input sm" value={m.rolle} onchange={(e) => rolleAendern(m, (e.target as HTMLSelectElement).value)}>{#each Object.entries(ROLLEN) as [k, v]}<option value={k}>{v}</option>{/each}</select>{:else}{ROLLEN[m.rolle]}{/if}</td>
        <td><span class="pill pill--{m.aktiv ? 'gruen' : 'grau'}">{m.aktiv ? "Aktiv" : "Gesperrt"}</span></td>
        {#if darf}<td class="acts">{#if m.user_id !== auth.ich?.user_id}
          <button class="btn btn--s btn--quiet" onclick={() => neuerLink(m)} title="Neuer Link zum Passwort setzen"><Icon name="key" size={15} /><span class="h-m">Neuer Link</span></button>
          <button class="btn btn--s btn--quiet" onclick={() => zweifaktor(m)} title="Zwei-Faktor zurücksetzen"><Icon name="shield" size={15} /><span class="h-m">2FA zurücksetzen</span></button>
          <button class="btn btn--s btn--quiet" onclick={() => sperren(m)} title={m.aktiv ? "Zugang sperren" : "Zugang entsperren"}><Icon name={m.aktiv ? "x" : "check"} size={15} /><span class="h-m">{m.aktiv ? "Sperren" : "Entsperren"}</span></button>
        {/if}</td>{/if}
      </tr>
    {/each}
  </tbody>
</table></div>

<h2 class="sec">Rechte je Rolle</h2>
<p class="muted lead">„Lesen“ zeigt den Bereich an, „Schreiben“ erlaubt Änderungen. Briefe verschicken kostet Porto und ist deshalb ein eigenes Recht.</p>
<div class="card tw"><table class="table matrix">
  <thead><tr><th>Bereich</th>{#each Object.entries(ROLLEN) as [, v]}<th>{v}</th>{/each}</tr></thead>
  <tbody>
    {#each Object.entries(BEREICHE) as [b, bn]}
      <tr class="nohover"><td>{bn}</td>
        {#each Object.keys(ROLLEN) as r}
          <td>{#if darf && r !== "inhaber"}<select class="input sm" value={stufe(r, b)} onchange={(e) => rechtSetzen(r, b, (e.target as HTMLSelectElement).value)}>
              <option value="kein">–</option><option value="lesen">Lesen</option><option value="schreiben">Schreiben</option></select>
          {:else}<span class="muted">{({ kein: "–", lesen: "Lesen", schreiben: "Schreiben" } as any)[stufe(r, b)]}</span>{/if}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table></div>

<style>
  .inv { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; padding: 20px; margin-bottom: 16px; align-items: end; }
  .inv__a { display: flex; gap: 8px; justify-content: flex-end; grid-column: 1 / -1; }
  .linkbox { display: grid; gap: 12px; padding: 20px; margin-bottom: 16px; border-color: rgba(76, 195, 138, .35); }
  .linkbox b { color: var(--text); }
  .linkbox code { padding: 10px 12px; border-radius: 8px; background: var(--bg-2); color: var(--text-2); font-size: .8rem; overflow-wrap: anywhere; }
  .linkbox__a { display: flex; gap: 8px; flex-wrap: wrap; }
  .nohover { cursor: default !important; }
  .acts { display: flex; gap: 4px; justify-content: flex-end; flex-wrap: wrap; }
  .sm { min-height: 32px; padding: 4px 30px 4px 10px; width: auto; }
  .sec { margin: 36px 0 6px; }
  .lead { margin-bottom: 14px; }
  .tw { overflow-x: auto; }
  .matrix td:first-child { white-space: nowrap; color: var(--text); }
  @media (max-width: 700px) { .h-m { display: none; } .acts { flex-wrap: nowrap; } }
</style>
