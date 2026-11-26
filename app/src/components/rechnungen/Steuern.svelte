<script lang="ts">
  // Steuern: alles fürs Finanzamt auf einer Seite – Umsatzsteuer je Zeitraum (mit ELSTER-Kennzahlen), Gewinn, Einkommen- und
  // Gewerbesteuer als Schätzung, Rücklage, Fristen. Gerechnet wird in lib/rechnungen/steuer.ts aus Rechnungen und Ausgaben.
  import Icon from "../Icon.svelte";
  import Zahl from "../Zahl.svelte";
  import AusgabeEditor from "./AusgabeEditor.svelte";
  import SteuerEinrichten from "./SteuerEinrichten.svelte";
  import { R } from "../../lib/rechnungen/daten.svelte";
  import { B, versuche } from "../../lib/rechnungen/blatt.svelte";
  import { rechnungenAnsicht as A } from "../../lib/rechnungen/ansicht.svelte";
  import { eur, fmtDate, todayISO } from "../../lib/rechnungen/kern";
  import { GEWST_FREIBETRAG, RHYTHMUS, euer, fristen, hochrechnung, privatSet, rhythmusAus, schaetzung, steuerSet, tageBis, tarifJahr, umsaetze, ust, zeitraeume, type UstErgebnis } from "../../lib/rechnungen/steuer";
  import { auth } from "../../lib/auth.svelte";
  import { daten } from "../../lib/daten.svelte";
  import { slide } from "svelte/transition";
  import { ruhig } from "../../lib/bewegung";

  const darf = $derived(auth.darf("rechnungen", true));
  const heute = todayISO(), cy = +heute.slice(0, 4);
  const set = $derived(steuerSet(R.settings)), privat = $derived(privatSet(R.steuerPrivat));
  const klein = $derived(R.small);
  let jahr = $state(cy), offen = $state<string | null>(null), mitAusgeblendet = $state(false);
  const laufend = $derived(jahr === cy);

  // Ausgeblendete Rechnungen sind rechtlich weiter ausgestellt – standardmäßig draußen, auf Wunsch mitgerechnet
  const versteckt = $derived(R.ausgeblendet.filter((i) => i.status !== "draft" && (i.kind === "invoice" || i.kind === "storno")));
  const rechnungen = $derived(mitAusgeblendet ? R.alleRechnungen : R.invoices);
  const jahre = $derived([...new Set([cy, ...R.alleRechnungen.map((i) => +String(i.issue_date || "").slice(0, 4)), ...R.ausgaben.map((a) => +String(a.datum).slice(0, 4))])].filter((y) => y >= 2024 && y <= cy).sort((a, b) => b - a));

  // ---------- Umsatzsteuer
  const ums = $derived(umsaetze(rechnungen, set.art));
  type Periode = UstErgebnis & { status: "kommt" | "laeuft" | "faellig" | "ueberfaellig" | "erledigt"; erledigtAm?: string };
  // Solange nichts eingerichtet ist, gilt alles mit abgelaufener Frist als abgegeben – sonst stünde die ganze Vergangenheit als überfällig da
  const erledigt = (key: string, frist: string) => set.erledigt[key] || (!set.eingerichtet && frist < heute ? "vorher" : "");
  const statusVon = (e: UstErgebnis): Periode => {
    const z = e.z, am = erledigt(z.key, z.frist);
    if (z.von > heute) return { ...e, status: "kommt" };
    if (z.bis >= heute) return { ...e, status: "laeuft" };
    if (am) return { ...e, status: "erledigt", erledigtAm: am };
    return { ...e, status: z.frist < heute ? "ueberfaellig" : "faellig" };
  };
  const perioden = $derived(zeitraeume(jahr, klein ? "jahr" : set.zeitraum, set.dauerfrist).map((z) => statusVon(ust(z, ums, R.ausgaben, klein))));
  const ustJahr = $derived(perioden.filter((p) => p.status !== "kommt").reduce((s, p) => s + p.zahllast, 0));
  const aktuell = $derived(perioden.find((p) => p.status === "laeuft") ?? null);
  // noch nicht abgegeben (über alle Jahre): das Geld gehört schon dem Finanzamt
  const ustOffen = $derived.by(() => {
    if (klein || set.zeitraum === "jahr") return perioden.filter((p) => p.status !== "kommt" && p.status !== "erledigt").reduce((s, p) => s + p.zahllast, 0);
    let s = 0;
    for (let j = 2024; j <= cy; j++) for (const z of zeitraeume(j, set.zeitraum, set.dauerfrist)) if (z.von <= heute && !(z.bis < heute && erledigt(z.key, z.frist))) s += ust(z, ums, R.ausgaben, klein).zahllast;
    return s;
  });
  const umsatzJahr = $derived(umsaetze(rechnungen, "soll").filter((u) => u.datum.startsWith(jahr + "-")).reduce((s, u) => s + u.netto, 0));
  const markieren = (p: Periode, an: boolean) => versuche(async () => {
    const e = { ...set.erledigt }; if (an) e[p.z.key] = heute; else delete e[p.z.key];
    await R.saveSteuer({ ...set, erledigt: e }); daten.melden(an ? `${p.z.name} als abgegeben markiert` : "Markierung entfernt");
  });
  const STATUS: Record<Periode["status"], [string, string]> = { kommt: ["kommt noch", "grau"], laeuft: ["läuft", "blau"], faellig: ["jetzt abgeben", "gelb"], ueberfaellig: ["überfällig", "rot"], erledigt: ["abgegeben", "gruen"] };

  // ---------- Gewinn und Steuern darauf
  const e = $derived(euer(rechnungen, R.ausgaben, jahr, klein));
  const hr = $derived(hochrechnung(e.gewinn, jahr, heute));
  const sch = $derived(schaetzung(hr.jahr, jahr, set, privat));
  const bisHeute = $derived(Math.max(sch.gesamt / hr.faktor, 0));
  const ruecklage = $derived(Math.max(ustOffen, 0) + (laufend ? bisHeute : 0));
  const maxKat = $derived(Math.max(1, ...e.kategorien.map((k) => k.summe)));

  // ---------- Fristen
  const alleFristen = $derived(fristen(heute, set, klein));
  const kommende = $derived(alleFristen.filter((f) => f.datum >= heute && !(f.key && set.erledigt[f.key])).slice(0, 6));
  const verpasst = $derived(alleFristen.filter((f) => f.art === "ust" && f.datum < heute && f.key && !erledigt(f.key, f.datum) && f.datum >= `${cy - 1}-01-01`));
  // Kachel oben: zuerst Verpasstes, sonst der nächste feste Termin (Vorauszahlungen gibt es nur, wenn das Finanzamt sie festgesetzt hat)
  const naechste = $derived(verpasst[0] ?? kommende.find((f) => f.art !== "vorauszahlung") ?? null);
  const inTagen = (d: string) => { const t = tageBis(heute, d); return t === 0 ? "heute" : t === 1 ? "morgen" : `in ${t} Tagen`; };

  // ---------- Grenzen
  const ustHoch = $derived(hochrechnung(ustJahr, jahr, heute).jahr);
  const rhythmusNeu = $derived(rhythmusAus(ustHoch));
  const ganz = (n: number) => `${Math.round(n).toLocaleString("de-DE")}\u00a0€`;
  const kz = (k: { wert: number; euro?: boolean }) => (k.euro ? ganz(k.wert) : eur(k.wert));
  const einrichten = () => B.auf(SteuerEinrichten);
</script>

<div class="seite-h"><h1>Steuern</h1><p class="muted">Alles fürs Finanzamt, automatisch gerechnet aus deinen Rechnungen und Ausgaben.</p></div>

{#if !set.eingerichtet}
  <div class="card start"><span><b>Einmal einrichten, dann stimmen die Zahlen</b><small class="muted">Drei kurze Angaben: wann deine Umsatzsteuer fällig wird, wie oft du sie meldest und was du sonst verdienst. Bis dahin rechnet die App mit dem Normalfall.</small></span>
    <button class="btn btn--primary" onclick={einrichten}>Einrichten</button></div>
{/if}
{#if !R.ausgabenBereit}<div class="note">Die Datenbank wird gerade für die Ausgaben vorbereitet. Bis dahin fehlen hier Vorsteuer und Kosten – in ein paar Minuten oben auf Aktualisieren tippen.</div>{/if}

<div class="bar">
  <div class="chips">{#each jahre as y (y)}<button class="chip" class:on={jahr === y} onclick={() => { jahr = y; offen = null; }}>{y}</button>{/each}</div>
  <span class="sp"></span>
  <button class="btn btn--s" onclick={einrichten}><Icon name="settings" size={14} />Einstellungen</button>
</div>

<div class="stats">
  {#if laufend}
    <div class="card ton ton-lila"><small>Zurücklegen</small><b class="num"><Zahl wert={ruecklage} format={eur} /></b>
      <span class="muted">{klein ? "Einkommen- und Gewerbesteuer bis heute" : `${eur(Math.max(ustOffen, 0))} Umsatzsteuer + ${eur(bisHeute)} auf den Gewinn`}</span></div>
  {/if}
  {#if !klein}
    <div class="card ton ton-gelb"><small>Umsatzsteuer {laufend && aktuell ? aktuell.z.name : jahr}</small><b class="num"><Zahl wert={laufend && aktuell ? aktuell.zahllast : ustJahr} format={eur} /></b>
      <span class="muted">{laufend && aktuell ? `bisher · abgeben bis ${fmtDate(aktuell.z.frist)}` : "ans Finanzamt im ganzen Jahr"}</span></div>
  {/if}
  <div class="card ton ton-gruen"><small>Gewinn {jahr}{laufend ? " bisher" : ""}</small><b class="num"><Zahl wert={e.gewinn} format={eur} /></b>
    <span class="muted">{eur(e.einnahmen)} Einnahmen − {eur(e.ausgaben)} Ausgaben</span></div>
  {#if laufend && naechste}
    <div class="card ton ton-rot" class:rot={naechste.datum < heute}><small>{naechste.datum < heute ? "Frist verpasst" : "Nächste Frist"}</small><b class="num">{fmtDate(naechste.datum)}</b><span class="muted">{naechste.titel}{naechste.datum < heute ? " · noch nicht als abgegeben markiert" : " · " + inTagen(naechste.datum)}</span></div>
  {/if}
</div>

{#if versteckt.length}
  <label class="check versteckt"><input type="checkbox" bind:checked={mitAusgeblendet}><span>{versteckt.length} ausgeblendete {versteckt.length === 1 ? "Rechnung" : "Rechnungen"} mitrechnen <small class="muted">· ausgestellte Rechnungen zählen fürs Finanzamt, auch wenn du sie ausgeblendet hast – es sei denn, sie sind storniert</small></span></label>
{/if}

<div class="raster">
  <!-- Umsatzsteuer -->
  <section class="card breit">
    <header><h3>Umsatzsteuer {jahr}</h3>
      {#if klein}<span class="pill pill--plain">Kleinunternehmer</span>
      {:else}<span class="pill pill--plain">{set.art === "ist" ? "Ist-Versteuerung" : "Soll-Versteuerung"}</span><span class="pill pill--plain">{set.zeitraum === "jahr" ? "ohne Voranmeldung" : RHYTHMUS[set.zeitraum]}</span>{/if}</header>
    {#if klein}
      <p class="hint">Als Kleinunternehmer weist du keine Umsatzsteuer aus und gibst keine Voranmeldung ab. Die Regelung gilt, solange dein Umsatz im Vorjahr höchstens 25.000 € war und im laufenden Jahr 100.000 € nicht übersteigt.</p>
      <div class="grenze"><span>Umsatz {jahr}</span><span class="balken"><i style="width:{Math.min(100, (umsatzJahr / 25000) * 100)}%" class:warn={umsatzJahr > 20000} class:rot={umsatzJahr > 25000}></i></span><b class="num">{eur(umsatzJahr)} von 25.000 €</b></div>
      {#if perioden[0]?.zahllast}<p class="hint">Achtung: Für Rechnungen ausländischer Anbieter schuldest du trotzdem {eur(perioden[0].zahllast)} Umsatzsteuer nach § 13b (anzugeben in der Umsatzsteuererklärung).</p>{/if}
    {:else}
      <div class="perioden">
        {#each perioden as p (p.z.key)}
          {@const auf = offen === p.z.key}
          <div class="periode" class:auf class:leise={p.status === "kommt"}>
            <button class="pk" onclick={() => (offen = auf ? null : p.z.key)} aria-expanded={auf} disabled={p.status === "kommt"}>
              <span class="h"><b>{p.z.name}</b><small class="muted">{p.status === "kommt" ? `ab ${fmtDate(p.z.von)}` : `${p.rechnungen} ${p.rechnungen === 1 ? "Rechnung" : "Rechnungen"} · ${p.belege} ${p.belege === 1 ? "Ausgabe" : "Ausgaben"} · Frist ${fmtDate(p.z.frist)}`}</small></span>
              <span class="r">{#if p.status !== "kommt"}<b class="num" class:minus={p.zahllast < 0}>{eur(p.zahllast)}</b>{/if}<span class="pill pill--plain pill--{STATUS[p.status][1]}">{STATUS[p.status][0]}</span></span>
              {#if p.status !== "kommt"}<svg class="pf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>{/if}
            </button>
            {#if auf}
              <div class="pb" transition:slide={{ duration: ruhig() ? 0 : 380 }}>
                <div class="rechnung">
                  <div><span>Umsatzsteuer aus deinen Rechnungen <small class="muted">auf {eur(p.basis19 + p.basis7 + p.andere.reduce((s, a) => s + a.basis, 0))} netto</small></span><b class="num">{eur(p.steuerAus)}</b></div>
                  {#if p.vorsteuer13b}<div><span>Umsatzsteuer für Rechnungen aus dem Ausland <small class="muted">§ 13b, auf {eur(p.euBasis + p.drittBasis)}</small></span><b class="num">{eur(p.euSteuer + p.drittSteuer)}</b></div>
                    <div><span>dieselbe Steuer als Vorsteuer zurück</span><b class="num">− {eur(p.vorsteuer13b)}</b></div>{/if}
                  <div><span>Vorsteuer aus deinen Ausgaben</span><b class="num">− {eur(p.vorsteuer)}</b></div>
                  <div class="summe"><span>{p.zahllast < 0 ? "Bekommst du vom Finanzamt zurück" : "Zahlst du ans Finanzamt"}</span><b class="num">{eur(Math.abs(p.zahllast))}</b></div>
                </div>
                {#if p.basis0}<p class="hint">Dazu {eur(p.basis0)} Umsatz ohne Umsatzsteuer (0 %). Der steht nicht in den Kennzahlen unten – je nach Grund gehört er in eine eigene Zeile.</p>{/if}
                <h4>Zum Abtippen in ELSTER</h4>
                <div class="kzs">
                  {#each p.kz as k (k.nr + k.name)}<div class="kz"><span class="nr num">{k.nr}</span><span>{k.name}</span><b class="num">{kz(k)}</b></div>{/each}
                </div>
                <p class="hint">Die Beträge in den Zeilen 81 und 86 rundet ELSTER auf volle Euro ab und rechnet die Steuer selbst. Deshalb kann die Summe um ein paar Cent von deinen Rechnungen abweichen.</p>
                {#if darf && p.z.bis < heute}
                  {#if p.status === "erledigt"}<div class="bar0"><span class="muted klein">{p.erledigtAm && /^\d{4}-/.test(p.erledigtAm) ? `Abgegeben am ${fmtDate(p.erledigtAm)}` : "Als abgegeben markiert"}</span><button class="btn btn--s" onclick={() => markieren(p, false)}>Markierung entfernen</button></div>
                  {:else}<div class="bar0"><button class="btn btn--s btn--primary" onclick={() => markieren(p, true)}><Icon name="check" size={14} />Als abgegeben markieren</button></div>{/if}
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <div class="jahr"><span>{laufend ? `${jahr} bisher` : `Ganzes Jahr ${jahr}`}</span><b class="num">{eur(ustJahr)}</b></div>
    {/if}
  </section>

  <!-- Gewinn -->
  <section class="card">
    <header><h3>Gewinn {jahr}</h3><span class="pill pill--plain">nach Geldeingang</span></header>
    <div class="rechnung">
      <div><span>Einnahmen <small class="muted">{e.anzahl} bezahlte {e.anzahl === 1 ? "Rechnung" : "Rechnungen"}{klein ? "" : ", netto"}</small></span><b class="num">{eur(e.einnahmen)}</b></div>
      <div><span>Ausgaben{klein ? "" : " netto"}</span><b class="num">− {eur(e.ausgaben)}</b></div>
      <div class="summe"><span>{e.gewinn < 0 ? "Verlust" : "Gewinn"}{laufend ? " bisher" : ""}</span><b class="num" class:minus={e.gewinn < 0}>{eur(e.gewinn)}</b></div>
      {#if laufend && hr.faktor > 1}<div class="leise"><span>Hochgerechnet aufs ganze Jahr</span><b class="num">{eur(hr.jahr)}</b></div>{/if}
    </div>
    {#if e.kategorien.length}
      <div class="kats">
        {#each e.kategorien as k (k.key)}<div class="kat"><span>{k.name}</span><span class="balken"><i style="width:{Math.max(2, (k.summe / maxKat) * 100)}%"></i></span><b class="num">{eur(k.summe)}</b></div>{/each}
      </div>
      {#if e.nichtAbziehbar}<p class="hint">Von der Bewirtung zählen nur 70 %: {eur(e.nichtAbziehbar)} mindern den Gewinn nicht.</p>{/if}
    {:else}<p class="hint">Noch keine Ausgaben in {jahr}. Ohne Ausgaben rechnet die App mit zu viel Gewinn und zu wenig Vorsteuer – trag sie ein, das senkt deine Steuer.</p>{/if}
    <div class="bar0">{#if darf}<button class="btn btn--s" onclick={() => B.auf(AusgabeEditor, { a: null })}><Icon name="plus" size={14} />Ausgabe eintragen</button>{/if}<button class="btn btn--s btn--quiet" onclick={() => { A.tab = "expenses"; scrollTo(0, 0); }}>Alle Ausgaben ›</button></div>
  </section>

  <!-- Einkommensteuer und Gewerbesteuer -->
  <section class="card">
    <header><h3>Steuern auf den Gewinn {jahr}</h3><span class="pill pill--plain pill--gelb">Schätzung</span></header>
    <div class="rechnung">
      <div><span>Gewinn{laufend && hr.faktor > 1 ? ", hochgerechnet aufs Jahr" : ""}</span><b class="num">{eur(sch.gewinn)}</b></div>
      {#if privat.andere}<div><span>Dein übriges Einkommen</span><b class="num">+ {eur(privat.andere)}</b></div>{/if}
      {#if privat.abzuege}<div><span>Abzüge</span><b class="num">− {eur(privat.abzuege)}</b></div>{/if}
      <div class="zw"><span>Zu versteuern</span><b class="num">{eur(sch.zveMit)}</b></div>
      <div><span>Einkommensteuer darauf</span><b class="num">{eur(sch.estMit)}</b></div>
      {#if sch.estOhne}<div><span>davon fällt auch ohne Medialyte an</span><b class="num">− {eur(sch.estOhne)}</b></div>{/if}
      {#if set.gewerbe}
        <div><span>Gewerbesteuer <small class="muted">{sch.gewerbe.ertrag ? `auf ${ganz(sch.gewerbe.ertrag)} über dem Freibetrag, Hebesatz ${set.hebesatz} %` : `Gewinn unter dem Freibetrag von ${ganz(GEWST_FREIBETRAG)}`}</small></span><b class="num">{sch.gewerbe.steuer ? "+ " : ""}{eur(sch.gewerbe.steuer)}</b></div>
        {#if sch.anrechnung}<div><span>wird auf die Einkommensteuer angerechnet</span><b class="num">− {eur(sch.anrechnung)}</b></div>{/if}
      {/if}
      {#if sch.soliMehr}<div><span>Solidaritätszuschlag</span><b class="num">+ {eur(sch.soliMehr)}</b></div>{/if}
      {#if sch.kircheMehr}<div><span>Kirchensteuer</span><b class="num">+ {eur(sch.kircheMehr)}</b></div>{/if}
      <div class="summe"><span>{sch.gesamt < 0 ? "Medialyte senkt deine Steuer um" : "Steuer durch Medialyte"}{sch.gesamt > 0 && sch.grenzsatz ? ` · ${sch.grenzsatz.toLocaleString("de-DE")} % vom Gewinn` : ""}</span><b class="num">{eur(Math.abs(sch.gesamt))}</b></div>
      {#if laufend && hr.faktor > 1 && sch.gesamt > 0}<div class="leise"><span>Davon bis heute angefallen</span><b class="num">{eur(bisHeute)}</b></div>{/if}
    </div>
    <p class="hint">{privat.andere || privat.abzuege ? "Gerechnet mit deinen persönlichen Angaben." : "Gerechnet, als wäre Medialyte dein einziges Einkommen. Verdienst du noch woanders, wird es mehr – trag es in den Einstellungen ein."}
      {#if tarifJahr(jahr) !== jahr} Für {jahr} ist noch kein neuer Steuertarif beschlossen, die App rechnet mit dem von {tarifJahr(jahr)}.{/if}</p>
    <div class="bar0"><button class="btn btn--s" onclick={einrichten}>Angaben ändern</button></div>
  </section>

  <!-- Fristen -->
  <section class="card">
    <header><h3>Fristen</h3></header>
    {#if verpasst.length}
      <div class="fristen">{#each verpasst as f (f.datum + f.titel)}<div class="frist rot"><span class="tag num">{fmtDate(f.datum)}</span><span class="h"><b>{f.titel}</b><small>Frist vorbei und nicht als abgegeben markiert</small></span></div>{/each}</div>
    {/if}
    <div class="fristen">
      {#each kommende as f (f.datum + f.titel)}
        <div class="frist" class:bald={tageBis(heute, f.datum) <= 14}><span class="tag num">{fmtDate(f.datum)}</span><span class="h"><b>{f.titel}</b><small class="muted">{inTagen(f.datum)} · {f.text}</small></span></div>
      {/each}
    </div>
    <p class="hint">Fällt ein Termin auf ein Wochenende oder einen Feiertag in Hamburg, steht hier schon der nächste Werktag.</p>
  </section>

  <!-- Grenzen -->
  <section class="card">
    <header><h3>Im Blick behalten</h3></header>
    {#if set.gewerbe}
      <div class="grenze"><span>Gewerbesteuer-Freibetrag</span><span class="balken"><i style="width:{Math.min(100, Math.max(0, (hr.jahr / GEWST_FREIBETRAG) * 100))}%" class:warn={hr.jahr > GEWST_FREIBETRAG * 0.8} class:rot={hr.jahr > GEWST_FREIBETRAG}></i></span><b class="num">{ganz(Math.max(hr.jahr, 0))} von {ganz(GEWST_FREIBETRAG)}</b></div>
      <p class="hint">{hr.jahr > GEWST_FREIBETRAG ? "Dein Gewinn liegt über dem Freibetrag: Gewerbesteuer fällt an. Der größte Teil wird auf die Einkommensteuer angerechnet." : "Solange dein Jahresgewinn darunter bleibt, zahlst du keine Gewerbesteuer."}</p>
    {/if}
    {#if !klein}
      <div class="zeile2"><span>Voranmeldung im nächsten Jahr</span><b>{RHYTHMUS[rhythmusNeu]}</b></div>
      <p class="hint">Richtet sich nach der Umsatzsteuer dieses Jahres ({ganz(ustHoch)}{laufend ? " hochgerechnet" : ""}): über 9.000&nbsp;€ monatlich, bis 2.000&nbsp;€ kann das Finanzamt dich befreien, dazwischen vierteljährlich. Das Finanzamt teilt dir einen Wechsel mit.</p>
      <div class="zeile2"><span>Umsatz {jahr}, netto</span><b class="num">{eur(umsatzJahr)}</b></div>
      <p class="hint">{umsatzJahr <= 25000 ? "Unter 25.000 € im Jahr könntest du im Folgejahr Kleinunternehmer sein: keine Umsatzsteuer auf Rechnungen, aber auch keine Vorsteuer zurück. Lohnt sich vor allem bei Privatkunden." : "Über 25.000 €: die Kleinunternehmerregelung kommt für das nächste Jahr nicht in Frage."}</p>
    {/if}
    {#if e.gewinn > 60000 || umsatzJahr > 600000}<p class="hint">Ab 80.000 € Gewinn oder 800.000 € Umsatz im Jahr kann das Finanzamt eine Bilanz statt der einfachen Gewinnrechnung verlangen.</p>{/if}
  </section>
</div>

<p class="muted klein fuss">Das ist eine Schätzung aus den Zahlen in dieser App, keine Steuerberatung und kein Bescheid. Verbindlich ist, was du über ELSTER abgibst und was das Finanzamt festsetzt.
  Nicht berücksichtigt sind unter anderem Abschreibungen über mehrere Jahre, private Nutzung, Fahrtkosten-Pauschalen, Verlustvorträge und Vorauszahlungen, die du schon geleistet hast. Rechtsstand November 2026.</p>

<style>
  .seite-h { margin: 4px 0 16px; display: grid; gap: 4px; }
  .seite-h h1 { font-size: 1.7rem; }
  .start { display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 16px 18px; margin-bottom: 14px; background: linear-gradient(160deg, var(--panel-2), var(--panel)); border-color: var(--line-2); }
  .start span { display: grid; gap: 3px; flex: 1 1 320px; }
  .start b { color: var(--text); }
  .start small { font-size: .88rem; line-height: 1.5; }
  .note { padding: 10px 14px; border-radius: var(--radius-s); background: rgba(111, 168, 240, .1); color: #A9C9F5; font-size: .9rem; margin-bottom: 12px; }
  .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
  .sp { flex: 1; }
  .chips { display: flex; gap: 6px; overflow-x: auto; }
  .chip { height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--text-2); cursor: pointer; font-size: .86rem; white-space: nowrap; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .stats .card { padding: 14px 16px; display: grid; gap: 4px; align-content: start; }
  .stats small { color: var(--steel); font-size: .8rem; }
  .stats .rot { border-color: rgba(242, 74, 74, .5); } .stats .rot b { color: #FF8080; }
  .stats b { color: var(--text); font-size: 1.45rem; font-weight: 600; }
  .stats span.muted { font-size: .8rem; line-height: 1.4; }
  @media (max-width: 520px) { .stats { grid-template-columns: 1fr 1fr; gap: 6px; } .stats .card { padding: 11px 12px; } .stats b { font-size: 1.1rem; } }
  .check { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; line-height: 1.45; color: var(--text-2); }
  .check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--coral); flex: none; }
  .versteckt { margin: 0 2px 14px; font-size: .9rem; }
  .raster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
  @media (max-width: 860px) { .raster { grid-template-columns: minmax(0, 1fr); } }
  section { padding: 18px; display: grid; gap: 12px; align-content: start; }
  section.breit { grid-column: 1 / -1; }
  section header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  section header h3 { font-size: 1.05rem; margin-right: auto; }
  h4 { font-size: .9rem; margin-top: 4px; }
  .hint { margin: 0; color: var(--steel); font-size: .84rem; line-height: 1.5; }
  .klein { font-size: .84rem; }
  .perioden { display: grid; gap: 6px; }
  .periode { border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--bg-2); overflow: hidden; }
  .periode.auf { border-color: var(--line-2); }
  .periode.leise { opacity: .55; }
  .pk { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 12px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .pk:disabled { cursor: default; }
  .h { display: grid; gap: 2px; min-width: 0; flex: 1; }
  .h b { color: var(--text); font-weight: 600; }
  .h small { font-size: .8rem; }
  .r { display: flex; align-items: center; gap: 10px; flex: none; }
  .r b { color: var(--text); font-weight: 600; }
  .minus { color: #6FD3A2 !important; }
  .pf { width: 18px; height: 18px; color: var(--steel); transition: transform .5s var(--feder); flex: none; }
  .auf .pf { transform: rotate(180deg); }
  @media (max-width: 520px) { .r { flex-direction: column; align-items: flex-end; gap: 4px; } }
  .pb { display: grid; gap: 12px; padding: 14px 12px 14px; border-top: 1px solid var(--line); }
  .rechnung { display: grid; }
  .rechnung > div { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; padding: 7px 0; border-bottom: 1px solid var(--line); }
  .rechnung > div:last-child { border-bottom: 0; }
  .rechnung span { min-width: 0; }
  .rechnung small { font-size: .8rem; }
  .rechnung b { color: var(--text); font-weight: 500; white-space: nowrap; }
  .rechnung .summe { border-top: 1px solid var(--line-2); border-bottom: 0; padding-top: 10px; }
  .rechnung .summe span { color: var(--text); font-weight: 600; }
  .rechnung .summe b { font-weight: 700; font-size: 1.08rem; }
  .rechnung .zw span, .rechnung .zw b { color: var(--text); font-weight: 600; }
  .rechnung .leise { border-top: 1px dashed var(--line); color: var(--steel); font-size: .9rem; }
  .rechnung .leise b { color: var(--text-2); }
  .kzs { display: grid; gap: 4px; }
  .kz { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 10px; border-radius: 8px; background: var(--panel); font-size: .9rem; }
  .kz .nr { display: inline-grid; place-items: center; height: 24px; border-radius: 6px; background: rgba(167, 139, 250, .16); color: #BBA6FB; font-weight: 600; font-size: .82rem; }
  .kz b { color: var(--text); font-weight: 600; white-space: nowrap; }
  .kz:last-child { background: rgba(231, 185, 74, .1); }
  .bar0 { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .jahr { display: flex; justify-content: space-between; gap: 12px; padding: 4px 12px 0; color: var(--text-2); }
  .jahr b { color: var(--text); font-weight: 600; }
  .kats { display: grid; gap: 8px; }
  .kat, .grenze { display: grid; grid-template-columns: minmax(110px, 1fr) 1.2fr auto; gap: 12px; align-items: center; font-size: .88rem; }
  .kat b, .grenze b { color: var(--text); font-weight: 500; white-space: nowrap; }
  .balken { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .06); overflow: hidden; }
  .balken i { display: block; height: 100%; border-radius: inherit; background: #4FC7D4; }
  .grenze .balken i { background: var(--ok); } .balken i.warn { background: var(--warn); } .balken i.rot { background: var(--coral); }
  @media (max-width: 520px) { .kat, .grenze { grid-template-columns: minmax(0, 1fr) auto; } .kat .balken, .grenze .balken { grid-column: 1 / -1; grid-row: 2; } }
  .zeile2 { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; padding-top: 6px; border-top: 1px solid var(--line); }
  .zeile2 b { color: var(--text); font-weight: 600; }
  .fristen { display: grid; gap: 6px; }
  .frist { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 12px; align-items: start; padding: 9px 12px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--bg-2); }
  .frist .tag { color: var(--text); font-weight: 600; }
  .frist small { line-height: 1.4; }
  .frist.bald { border-color: rgba(231, 185, 74, .45); }
  .frist.rot { border-color: rgba(242, 74, 74, .5); } .frist.rot small { color: #FF9C9C; }
  .fuss { margin: 18px 2px 0; line-height: 1.55; max-width: 900px; }
</style>
