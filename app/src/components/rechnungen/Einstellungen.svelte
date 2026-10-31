<script lang="ts">
  // Einstellungen der Rechnungen: Logo, Firma, Steuer, Bank, Nummern, Standard-Positionen, Rabattarten, Texte, Versand, Erinnerungen, E-Mail-Texte
  import Icon from "../Icon.svelte";
  import VorlageEditor from "./VorlageEditor.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { B, versuche } from "../../lib/rechnungen/blatt.svelte";
  import { BILL_SUFFIX, DEFAULTS, INTERVALS, billingOf, eur, fmtNum, isOn, num, todayISO } from "../../lib/rechnungen/kern";
  import { auth } from "../../lib/auth.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { frage } from "../../lib/frage.svelte";
  import { istProgramm } from "../../lib/push";

  const darf = $derived(auth.darf("rechnungen", true));
  // GoBD-Export (Datenträgerüberlassung): Zeitraum, Standard = Vorjahr
  const vj = Number(todayISO().slice(0, 4)) - 1;
  let exVon = $state(`${vj}-01-01`), exBis = $state(`${vj}-12-31`), exLaeuft = $state(false);
  const exJahre = $derived([...new Set([...R.alleRechnungen.map((i) => String(i.issue_date || "").slice(0, 4)).filter((y) => /^\d{4}$/.test(y)), todayISO().slice(0, 4)])].sort().reverse().slice(0, 9));
  const exportieren = () => { if (exLaeuft) return; exLaeuft = true; versuche(async () => { const n = await R.gobdExport(exVon, exBis); daten.melden(`${n} erstellt`); }).finally(() => (exLaeuft = false)); };
  const TEXT = ["name", "owner", "street", "zip", "city", "phone", "email", "website", "tax_number", "vat_id", "register", "account_holder", "bank", "iban", "bic",
    "prefix", "number_digits", "number_start", "quote_prefix", "quote_valid_days", "quote_intro", "quote_closing", "payment_days", "intro", "closing", "accent",
    "sender_name", "sender_email", "reply_to", "reminder_interval", "max_reminders",
    ...["invoice", "reminder", "correction", "cancel", "quote"].flatMap((k) => [`tpl_${k}_subject`, `tpl_${k}_body`])] as const;
  const CHECK = ["small_business", "number_per_customer", "number_year", "bcc_self", "reminders_enabled"] as const;
  const S0 = R.settings;
  let f = $state<Record<string, string>>(Object.fromEntries(TEXT.map((k) => [k, S0[k] == null ? "" : String(S0[k])])));
  let c = $state<Record<string, boolean>>(Object.fromEntries(CHECK.map((k) => [k, isOn(S0[k])])));
  if (!f.accent) f.accent = "#2454d6";
  let logo = $state<string>(S0.logo || "");
  let rabatte = $state(R.discTypes().map((t) => ({ name: t.name, mode: t.mode === "amount" ? "amount" : "percent", value: +t.value ? fmtNum(t.value, t.mode === "amount" ? 2 : 3) : "" })));

  const lesen = () => {
    const out: Record<string, any> = { ...R.settings };
    for (const k of TEXT) out[k] = f[k].trim();
    for (const k of CHECK) out[k] = c[k];
    for (const k of ["payment_days", "reminder_interval", "max_reminders", "quote_valid_days"]) out[k] = Math.max(0, parseInt(out[k], 10) || 0);
    out.number_digits = Math.min(Math.max(parseInt(out.number_digits, 10) || 4, 1), 8);
    out.number_start = Math.max(1, parseInt(out.number_start, 10) || 1);
    if (out.iban) out.iban = out.iban.replace(/\s+/g, "").toUpperCase();
    if (out.bic) out.bic = out.bic.replace(/\s+/g, "").toUpperCase();
    out.logo = logo || "";
    out.discount_types = rabatte.map((r) => ({ name: r.name.trim(), mode: r.mode, value: num(r.value) })).filter((t) => t.name);
    return out;
  };
  const vorschau = $derived.by(() => {
    const digits = Math.min(Math.max(parseInt(f.number_digits, 10) || 4, 1), 8), start = Math.max(1, parseInt(f.number_start, 10) || 1);
    const p = f.prefix.trim(), sep = p && !/[-_/]$/.test(p) ? "-" : "";
    if (c.number_per_customer) {
      const c0 = R.customers.find((x) => x.number) || { number: "10002", name: "" };
      return `${p}${sep}${c0.number}-${String(Math.max((+c0.invoice_counter || 0) + 1, +c0.invoice_start || 1)).padStart(digits, "0")} (Beispiel ${c0.name || "Kunde"})`;
    }
    const nr = String(start).padStart(digits, "0");
    return c.number_year ? `${p}${sep}${todayISO().slice(0, 4)}-${String(1).padStart(digits, "0")} (bzw. ab ${nr}, falls höher)` : `${p}${nr} (oder höher, falls schon weiter)`;
  });

  const speichern = async () => { await R.saveSettings(lesen()); };
  const alleSpeichern = () => versuche(async () => { await speichern(); daten.melden("Einstellungen gespeichert"); });
  const testMail = () => versuche(async () => {
    await speichern();
    if (navigator.onLine === false) throw new Error("Die Test-Mail braucht Internet. Bitte versuche es, sobald du wieder online bist.");
    const r = await R.fn("test_mail"); daten.melden(`Test-Mail an ${r.to} gesendet`);
  });
  const texteZurueck = async () => { if (!(await frage("Standardtexte?", "Alle E-Mail-Texte auf den Standard zurücksetzen?", "Zurücksetzen"))) return; for (const k of TEXT) if (k.startsWith("tpl_")) f[k] = DEFAULTS[k] ?? ""; daten.melden("Zurückgesetzt – zum Übernehmen speichern"); };

  const alsDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });
  // Eigenes Logo: leere bzw. weiße Ränder automatisch abschneiden, dann auf sinnvolle Größe bringen
  const logoWaehlen = (e: Event) => versuche(async () => {
    const inp = e.currentTarget as HTMLInputElement, file = inp.files?.[0]; inp.value = ""; if (!file) return;
    const url = await alsDataUrl(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Bild konnte nicht gelesen werden.")); i.src = url; });
    const src = document.createElement("canvas"); src.width = img.naturalWidth; src.height = img.naturalHeight;
    const sx = src.getContext("2d")!; sx.drawImage(img, 0, 0);
    const { data, width: w, height: h } = sx.getImageData(0, 0, src.width, src.height);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      const leer = data[i + 3] < 16 || (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244);
      if (!leer) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, sc = Math.min(1, 1600 / cw, 600 / ch);
    const cv = document.createElement("canvas"); cv.width = Math.round(cw * sc); cv.height = Math.round(ch * sc);
    const cx = cv.getContext("2d")!; cx.imageSmoothingQuality = "high"; cx.drawImage(src, x0, y0, cw, ch, 0, 0, cv.width, cv.height);
    let out = cv.toDataURL("image/png"); if (out.length > 900000) out = cv.toDataURL("image/jpeg", 0.92);
    logo = out; daten.melden("Logo übernommen – zum Speichern unten auf „Einstellungen speichern“ tippen");
  });
  const medialyteLogo = () => versuche(async () => {
    logo = await alsDataUrl(await (await fetch("brand/logo-rechnung.png")).blob());
    await speichern(); daten.melden("Medialyte-Logo übernommen und gespeichert");
  });

  const abmelden = async () => {
    const n = R.outbox.length;
    if (!(await frage("Abmelden?", n ? `Achtung: ${n} Änderungen sind noch nicht in der Cloud. Sie bleiben auf dem Gerät und werden nach der nächsten Anmeldung übertragen. Trotzdem abmelden?` : "Wirklich abmelden?", "Abmelden", !!n))) return;
    try { localStorage.removeItem("medialyte-rechnungen-cache-v1"); } catch {}
    await auth.abmelden();
  };
</script>

{#snippet feld(k: string, label: string, art = "text", ph = "", modus: "numeric" | "decimal" | undefined = undefined)}
  <label class="field"><span>{label}</span><input class="input" type={art} placeholder={ph} inputmode={modus} bind:value={f[k]} disabled={!darf}></label>
{/snippet}
{#snippet text(k: string, label: string, rows = 3)}
  <label class="field"><span>{label}</span><textarea class="input" {rows} bind:value={f[k]} disabled={!darf}></textarea></label>
{/snippet}
{#snippet haken(k: string, label: string)}
  <label class="check"><input type="checkbox" bind:checked={c[k]} disabled={!darf}><span>{label}</span></label>
{/snippet}
{#snippet vorlage(k: string, label: string)}
  <h4>{label}</h4>{@render feld(`tpl_${k}_subject`, "Betreff")}{@render text(`tpl_${k}_body`, "Text", 7)}
{/snippet}

<div class="seite-h"><h1>Einstellungen</h1><p class="muted">Deine Firma, deine Rechnungen, dein Versand</p></div>
{#if !darf}<div class="note">Du kannst die Einstellungen ansehen. Ändern darf sie nur, wer bei den Rechnungen Schreibrechte hat.</div>{/if}

<div class="raster">
  <section class="card">
    <h3>Logo</h3><p class="hint">Erscheint oben links auf jeder Rechnung. PNG oder JPG, am besten im Querformat.</p>
    <div class="logo">{#if logo}<img src={logo} alt="Logo">{:else}<span class="muted klein">Noch kein Logo – dann steht dort der Firmenname.</span>{/if}</div>
    {#if darf}<div class="bar">
      <button class="btn btn--s" onclick={medialyteLogo}>Medialyte-Logo verwenden</button>
      <label class="btn btn--s">Eigenes Bild wählen<input type="file" accept="image/png,image/jpeg" hidden onchange={logoWaehlen}></label>
      {#if logo}<button class="btn btn--s del" onclick={() => (logo = "")}>Entfernen</button>{/if}
    </div>{/if}
  </section>

  <section class="card">
    <h3>Deine Firma</h3><p class="hint">Diese Angaben stehen auf jeder Rechnung.</p>
    {@render feld("name", "Firmenname")}
    {@render feld("owner", "Inhaber / Geschäftsführung (Fußzeile)", "text", "z. B. Inhaber: Daniel Dogan")}
    {@render feld("street", "Straße und Hausnummer")}
    <div class="g3">{@render feld("zip", "PLZ", "text", "", "numeric")}{@render feld("city", "Ort")}</div>
    <div class="g2">{@render feld("phone", "Telefon", "tel")}{@render feld("email", "E-Mail", "email")}</div>
    {@render feld("website", "Website")}
  </section>

  <section class="card">
    <h3>Steuer</h3>
    {@render haken("small_business", "Kleinunternehmer nach § 19 UStG – keine Umsatzsteuer ausweisen")}
    <p class="hint">Wenn aktiv, steht auf jeder Rechnung „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet“. Steuernummer oder USt-IdNr. ist Pflicht.</p>
    <div class="g2">{@render feld("tax_number", "Steuernummer")}{@render feld("vat_id", "USt-IdNr.")}</div>
    {@render feld("register", "Handelsregister / Amtsgericht (falls vorhanden)", "text", "z. B. Amtsgericht Hamburg-Harburg")}
  </section>

  <section class="card">
    <h3>Bankverbindung</h3><p class="hint">Daraus entsteht auch der Überweisungs-QR-Code auf der Rechnung.</p>
    <div class="g2">{@render feld("account_holder", "Kontoinhaber", "text", "z. B. Daniel Dogan")}{@render feld("bank", "Bank")}</div>
    <div class="g2">{@render feld("iban", "IBAN")}{@render feld("bic", "BIC")}</div>
  </section>

  <section class="card">
    <h3>Rechnungsnummern</h3><p class="hint">Vorschau nächste Nummer: <b>{vorschau}</b></p>
    {@render haken("number_per_customer", "Eigener Nummernkreis pro Kunde (Kundennummer in der Rechnungsnummer)")}
    <div class="g2">{@render feld("prefix", "Präfix", "text", "RE")}{@render feld("number_digits", "Stellen", "text", "", "numeric")}</div>
    {#if c.number_per_customer}
      <p class="hint">Jeder Kunde zählt für sich. Wo ein Kunde weiterzählt, stellst du im Kunden unter „Rechnungen fortsetzen ab“ ein.</p>
    {:else}
      {@render feld("number_start", "Fortsetzen ab Nummer", "text", "z. B. 31, wenn deine letzte Rechnung RE0030 war", "numeric")}
      {@render haken("number_year", "Jahreszahl in die Nummer (z. B. RE-2026-0001), neu beginnend jedes Jahr")}
    {/if}
  </section>

  <section class="card">
    <h3>Standard-Positionen</h3><p class="hint">Oft genutzte Leistungen – beim Schreiben einfach über „Aus Vorlagen“ auswählen.</p>
    {#if R.products.length}
      <div class="liste">{#each R.products as p (p.id)}
        <button class="zeile" onclick={() => B.auf(VorlageEditor, { p })} disabled={!darf}><span class="h"><b>{p.name}</b>
          <small class="muted">{eur(p.price)}{BILL_SUFFIX[billingOf(p)]}{p.unit ? " · " + p.unit : ""}{billingOf(p) !== "once" ? " · Abo " + INTERVALS[billingOf(p)] : ""}{+p.discount ? ` · −${fmtNum(p.discount, 3)} %` : ""}{p.details ? " · " + p.details : ""}</small></span>
          {#if darf}<span class="muted klein">Bearbeiten</span>{/if}</button>{/each}</div>
    {:else}<p class="muted klein">Noch keine Standard-Positionen.</p>{/if}
    {#if darf}<button class="btn btn--s" onclick={() => B.auf(VorlageEditor, { p: null })}>+ Neue Standard-Position</button>{/if}
  </section>

  <section class="card">
    <h3>Rabattarten</h3><p class="hint">Eigene Rabatte mit Namen, z. B. „Bestandskundenrabatt“. Beim Schreiben wählst du sie bei einer Position (Rabatt %) oder als Gesamtrabatt einfach aus.</p>
    {#each rabatte as r, i}
      <div class="dt"><input class="input" placeholder="Name, z. B. Treuerabatt" aria-label="Name" bind:value={r.name} disabled={!darf}>
        <input class="input" inputmode="decimal" placeholder="0" aria-label="Wert" bind:value={r.value} disabled={!darf}>
        <select class="input" aria-label="Prozent oder Betrag" bind:value={r.mode} disabled={!darf}><option value="percent">%</option><option value="amount">€</option></select>
        {#if darf}<button class="btn btn--quiet btn--icon" aria-label="Rabattart löschen" onclick={() => rabatte.splice(i, 1)}><Icon name="x" size={16} /></button>{/if}</div>
    {/each}
    {#if darf}<button class="btn btn--s" onclick={() => rabatte.push({ name: "", mode: "percent", value: "" })}>+ Neue Rabattart</button>{/if}
  </section>

  <section class="card">
    <h3>Angebote</h3>
    <div class="g2">{@render feld("quote_prefix", "Nummern-Präfix", "text", "AN")}{@render feld("quote_valid_days", "Gültig für Tage", "text", "", "numeric")}</div>
    {@render text("quote_intro", "Standard-Einleitung", 2)}{@render text("quote_closing", "Schlusssatz", 2)}
  </section>

  <section class="card">
    <h3>Rechnungstexte</h3>
    {@render feld("payment_days", "Zahlungsziel in Tagen", "text", "", "numeric")}
    {@render text("intro", "Standard-Einleitung", 2)}{@render text("closing", "Schlusssatz", 2)}
    <label class="field"><span>Akzentfarbe im PDF</span><input class="input farbe" type="color" bind:value={f.accent} disabled={!darf}></label>
  </section>

  <section class="card">
    <h3>E-Mail-Versand</h3><p class="hint">Die Absenderadresse muss bei deinem Mail-Dienst bestätigt sein.</p>
    <div class="g2">{@render feld("sender_name", "Absendername")}{@render feld("sender_email", "Absender-E-Mail", "email", "rechnung@medialyte.de")}</div>
    {@render feld("reply_to", "Antworten gehen an", "email")}
    {@render haken("bcc_self", "Kopie jeder E-Mail an mich")}
    {#if darf}<button class="btn btn--s" onclick={testMail}>Test-Mail an mich senden</button>{/if}
  </section>

  <section class="card">
    <h3>Zahlungserinnerungen</h3>
    {@render haken("reminders_enabled", "Automatisch an überfällige Rechnungen erinnern")}
    <div class="g2">{@render feld("reminder_interval", "Tage zwischen Erinnerungen", "text", "", "numeric")}{@render feld("max_reminders", "Höchstens so viele Erinnerungen", "text", "", "numeric")}</div>
    <p class="hint">Die erste Erinnerung geht raus, wenn eine Rechnung so viele Tage überfällig ist.</p>
  </section>

  <section class="card breit">
    <h3>E-Mail-Texte</h3><p class="hint">Platzhalter: {"{anrede} {nummer} {alte_nummer} {kunde} {betrag} {datum} {faellig} {gueltig} {leistung} {firma}"}</p>
    <div class="tpl">
      <div>{@render vorlage("invoice", "Neue Rechnung")}</div><div>{@render vorlage("reminder", "Zahlungserinnerung")}</div>
      <div>{@render vorlage("correction", "Korrigierte Rechnung")}</div><div>{@render vorlage("cancel", "Stornierung")}</div>
      <div>{@render vorlage("quote", "Angebot")}</div>
    </div>
    {#if darf}<button class="btn btn--s" onclick={texteZurueck}>Texte auf Standard zurücksetzen</button>{/if}
  </section>

  <section class="card">
    <h3>Aufbewahrung &amp; Betriebsprüfung</h3>
    <p class="hint">Ausgestellte Rechnungen sind unveränderbar und werden mit dem Original-PDF 8 Jahre aufbewahrt. Jede Änderung steht im Protokoll. Für eine Prüfung bekommst du hier alles als ein Paket: Daten im Prüferformat (GDPdU), Änderungsprotokoll und alle Rechnungs-PDFs.</p>
    <div class="g2">
      <label class="field"><span>Von</span><input class="input" type="date" bind:value={exVon} max={exBis}></label>
      <label class="field"><span>Bis</span><input class="input" type="date" bind:value={exBis} min={exVon}></label>
    </div>
    <div class="jahre">{#each exJahre as y (y)}<button class="chip" class:on={exVon === `${y}-01-01` && exBis === `${y}-12-31`} onclick={() => { exVon = `${y}-01-01`; exBis = `${y}-12-31`; }}>{y}</button>{/each}</div>
    <button class="btn btn--s" onclick={exportieren} disabled={exLaeuft || !exVon || !exBis || exBis < exVon}>{exLaeuft ? "Paket wird erstellt …" : "GoBD-Export herunterladen"}</button>
  </section>

  <section class="card">
    <h3>App</h3>
    <p class="hint">{istProgramm ? "Du nutzt die Medialyte-App. Alles, was du ohne Internet machst, wird auf dem Gerät gespeichert und automatisch abgeglichen." : "Die Rechnungen gibt es auch in der Medialyte-App für Mac, Windows und Android – mit Offline-Modus und automatischem Abgleich."}</p>
    {#if !istProgramm}<a class="btn btn--s" href="#/einstellungen">App herunterladen</a>{/if}
    <p class="muted klein">Angemeldet als {auth.ich?.email || auth.session?.user?.email || "–"}</p>
  </section>
</div>

<div class="fuss">
  {#if darf}<button class="btn btn--primary" onclick={alleSpeichern}>Einstellungen speichern</button>{/if}
  <button class="btn" onclick={abmelden}>Abmelden</button>
</div>

<style>
  .seite-h { margin: 4px 0 16px; display: grid; gap: 4px; }
  .seite-h h1 { font-size: 1.7rem; }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr)); gap: 12px; align-items: start; }
  section { padding: 18px; display: grid; gap: 10px; }
  section.breit { grid-column: 1 / -1; }
  h3 { margin: 0; font-size: 1.05rem; }
  h4 { margin: 6px 0 0; font-size: .95rem; color: var(--text); }
  .hint { margin: 0; color: var(--steel); font-size: .86rem; line-height: 1.5; }
  .hint b { color: var(--text); font-weight: 600; }
  .jahre { display: flex; flex-wrap: wrap; gap: 6px; }
  .jahre .chip { height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .84rem; }
  .jahre .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .klein { font-size: .86rem; margin: 0; }
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .g3 { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; }
  @media (max-width: 520px) { .g2 { grid-template-columns: 1fr; } }
  .check { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; line-height: 1.45; color: var(--text-2); }
  .check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--coral); flex: none; }
  .logo { min-height: 64px; display: flex; align-items: center; }
  .logo img { max-height: 64px; max-width: 260px; background: #fff; border-radius: 10px; padding: 8px 12px; }
  .bar { display: flex; gap: 8px; flex-wrap: wrap; }
  .bar label { cursor: pointer; }
  .del { color: #FF8080; }
  .liste { display: grid; gap: 6px; }
  .zeile { display: flex; justify-content: space-between; gap: 12px; align-items: center; width: 100%; text-align: left; padding: 10px 12px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--bg-2); color: inherit; cursor: pointer; font: inherit; }
  .zeile:disabled { cursor: default; }
  @media (hover: hover) and (pointer: fine) { .zeile:not(:disabled):hover { border-color: var(--line-2); } }
  .h { display: grid; gap: 2px; min-width: 0; }
  .h b { color: var(--text); font-weight: 600; }
  .h small { font-size: .8rem; }
  .dt { display: grid; grid-template-columns: minmax(0, 1fr) 90px 70px auto; gap: 6px; align-items: center; }
  .farbe { height: 44px; padding: 4px; max-width: 120px; }
  .tpl { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 6px 18px; }
  .tpl > div { display: grid; gap: 8px; align-content: start; }
  .note { padding: 10px 14px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; margin-bottom: 12px; }
  .fuss { position: sticky; bottom: 0; display: flex; gap: 10px; padding: 14px 0 calc(14px + env(safe-area-inset-bottom)); margin-top: 6px; background: linear-gradient(to top, var(--bg) 70%, transparent); }
  .fuss .btn--primary { flex: 1; max-width: 420px; }
</style>
