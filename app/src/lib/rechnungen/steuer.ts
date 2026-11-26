// Steuern: Rechenkern für den Reiter „Steuern“. Reine Funktionen ohne Oberfläche, damit sie sich nachrechnen lassen
// (app/scripts/steuer-pruefen.ts). Alles hier ist eine Schätzung aus den Rechnungen und Ausgaben der App, kein Bescheid.
//
// Quellen der Werte (Stand November 2026):
// - Einkommensteuertarif § 32a EStG: 2024, 2025, 2026 (Steuerfortentwicklungsgesetz). Für 2027 liegt nur ein
//   Regierungsentwurf vor (Einkommensteuerreformgesetz 2027, Kabinett 02.09.2026) – bis er Gesetz ist, rechnet die App mit 2026.
// - Solidaritätszuschlag: 5,5 %, Freigrenze 18.130 € (2024), 19.950 € (2025), 20.350 € (2026), Milderungszone 11,9 %.
// - Gewerbesteuer: Freibetrag 24.500 € (§ 11 GewStG), Messzahl 3,5 %, Hebesatz Hamburg 470 %, Anrechnung § 35 EStG: 4,0-facher Messbetrag.
// - Umsatzsteuer-Voranmeldung § 18 UStG: Abgabe bis zum 10. nach Ablauf des Zeitraums; Vorjahres-Zahllast über 9.000 € monatlich,
//   bis 2.000 € Befreiung möglich, sonst vierteljährlich. Kennzahlen nach Vordruck USt 1 A 2026.
// - Kleinunternehmer § 19 UStG (seit 2025): Vorjahr bis 25.000 €, laufendes Jahr bis 100.000 € (netto).
import { addDaysISO, MONTHS_LONG, r2, totals, type Posten } from "./kern";

// ---------- Einstellungen
export type SteuerSet = {
  eingerichtet: boolean;
  art: "soll" | "ist";                      // Soll: Umsatzsteuer entsteht mit der Rechnung; Ist: erst mit dem Geldeingang (§ 20 UStG, auf Antrag)
  zeitraum: "monat" | "quartal" | "jahr";   // Voranmeldungszeitraum; „jahr“ = von der Voranmeldung befreit, nur Jahreserklärung
  dauerfrist: boolean;                      // Dauerfristverlängerung: einen Monat mehr Zeit
  gewerbe: boolean;                         // Gewerbebetrieb (Gewerbesteuer) oder freier Beruf
  hebesatz: number;                         // Gewerbesteuer-Hebesatz der Gemeinde in Prozent
  erledigt: Record<string, string>;         // abgegebene Voranmeldungen: Zeitraum → Tag der Abgabe
};
export const STEUER_STANDARD: SteuerSet = { eingerichtet: false, art: "soll", zeitraum: "quartal", dauerfrist: false, gewerbe: true, hebesatz: 470, erledigt: {} };
export const steuerSet = (settings: Record<string, any> | null | undefined): SteuerSet => {
  const s = { ...STEUER_STANDARD, ...((settings?.steuer as Partial<SteuerSet>) || {}) };
  return { ...s, hebesatz: Math.min(Math.max(+s.hebesatz || 0, 200), 900), erledigt: { ...(s.erledigt || {}) } };
};
/** Persönliche Angaben für die Einkommensteuer-Schätzung (je Konto, sieht sonst niemand im Team) */
export type Privat = { andere: number; abzuege: number; kirche: boolean; kirchensatz: number };
export const PRIVAT_STANDARD: Privat = { andere: 0, abzuege: 0, kirche: false, kirchensatz: 9 };
export const privatSet = (d: any): Privat => ({ ...PRIVAT_STANDARD, ...(d || {}), andere: Math.max(+d?.andere || 0, 0), abzuege: Math.max(+d?.abzuege || 0, 0), kirche: !!d?.kirche, kirchensatz: +d?.kirchensatz === 8 ? 8 : 9 });

// ---------- Ausgaben
export type AusgabeArt = "inland" | "eu" | "drittland" | "ohne";
export type Ausgabe = { id: string; datum: string; bezahlt_am?: string | null; lieferant: string; beschreibung?: string | null; kategorie: string;
  art: AusgabeArt; netto: number; ust_satz: number; ust: number; brutto: number; notiz?: string | null; created_at?: string };
/** Kategorien der Ausgaben; anteil = wie viel davon den Gewinn mindert (Bewirtung nur zu 70 %, § 4 Abs. 5 Nr. 2 EStG) */
export const KATEGORIEN: { key: string; name: string; anteil: number }[] = [
  { key: "software", name: "Software & Abos", anteil: 1 },
  { key: "fremdleistung", name: "Fremdleistungen", anteil: 1 },
  { key: "werbung", name: "Werbung & Marketing", anteil: 1 },
  { key: "hardware", name: "Geräte & Hardware", anteil: 1 },
  { key: "buero", name: "Büro & Material", anteil: 1 },
  { key: "telefon", name: "Telefon & Internet", anteil: 1 },
  { key: "porto", name: "Porto & Versand", anteil: 1 },
  { key: "reise", name: "Fahrt & Reise", anteil: 1 },
  { key: "fortbildung", name: "Fortbildung", anteil: 1 },
  { key: "versicherung", name: "Versicherungen & Beiträge", anteil: 1 },
  { key: "beratung", name: "Steuerberatung & Recht", anteil: 1 },
  { key: "bank", name: "Bank & Gebühren", anteil: 1 },
  { key: "bewirtung", name: "Bewirtung (70 % abziehbar)", anteil: 0.7 },
  { key: "sonstiges", name: "Sonstiges", anteil: 1 },
];
export const kategorie = (key?: string | null) => KATEGORIEN.find((k) => k.key === key) ?? KATEGORIEN[KATEGORIEN.length - 1];
export const ARTEN: { key: AusgabeArt; name: string; kurz: string; hinweis: string }[] = [
  { key: "inland", name: "Deutschland, mit Umsatzsteuer", kurz: "Inland", hinweis: "Normale Rechnung aus Deutschland. Die ausgewiesene Umsatzsteuer bekommst du als Vorsteuer zurück." },
  { key: "eu", name: "Anbieter in der EU, ohne Umsatzsteuer (Reverse Charge)", kurz: "EU · Reverse Charge", hinweis: "Rechnung ohne Umsatzsteuer von einer Firma aus einem anderen EU-Land. Du meldest die 19 % selbst an und ziehst sie gleichzeitig wieder ab – kostet nichts, muss aber in die Voranmeldung." },
  { key: "drittland", name: "Anbieter außerhalb der EU, ohne Umsatzsteuer (Reverse Charge)", kurz: "Nicht-EU · Reverse Charge", hinweis: "Rechnung ohne Umsatzsteuer z. B. aus den USA. Du meldest die 19 % selbst an und ziehst sie gleichzeitig wieder ab – kostet nichts, muss aber in die Voranmeldung." },
  { key: "ohne", name: "Ohne Vorsteuer", kurz: "ohne Vorsteuer", hinweis: "Keine Umsatzsteuer auf der Rechnung, z. B. Versicherung, Gebühren oder Rechnung eines Kleinunternehmers." },
];
/** Beträge einer Ausgabe aus dem gezahlten Betrag: Inland = Brutto; Reverse Charge = Rechnungsbetrag ohne Steuer, die 19 % kommen rechnerisch dazu */
export function ausgabeBetraege(betrag: number, satz: number, art: AusgabeArt) {
  const b = r2(+betrag || 0), s = Math.max(+satz || 0, 0);
  if (art === "inland") { const netto = r2(b / (1 + s / 100)); return { netto, ust: r2(b - netto), brutto: b, ust_satz: s }; }
  if (art === "eu" || art === "drittland") return { netto: b, ust: r2(b * s / 100), brutto: b, ust_satz: s };
  return { netto: b, ust: 0, brutto: b, ust_satz: 0 };
}

// ---------- Kalender: Zeiträume, Fristen, Werktage
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const wochentag = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();   // 0 = Sonntag
const letzterTag = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Ostersonntag (Gregorianischer Kalender, Butcher/Meeus) */
export function ostern(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mon = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, mon, tag);
}
/** Gesetzliche Feiertage in Hamburg (bundesweite plus Reformationstag) */
export function feiertage(y: number): Set<string> {
  const o = ostern(y);
  return new Set([iso(y, 1, 1), addDaysISO(o, -2), addDaysISO(o, 1), iso(y, 5, 1), addDaysISO(o, 39), addDaysISO(o, 50), iso(y, 10, 3), iso(y, 10, 31), iso(y, 12, 25), iso(y, 12, 26)]);
}
/** Fällt eine Frist auf Samstag, Sonntag oder Feiertag, endet sie am nächsten Werktag (§ 108 Abs. 3 AO) */
export function naechsterWerktag(d: string): string {
  let t = d;
  while (wochentag(t) === 0 || wochentag(t) === 6 || feiertage(+t.slice(0, 4)).has(t)) t = addDaysISO(t, 1);
  return t;
}
export type Zeitraum = { key: string; name: string; von: string; bis: string; frist: string; jahr: number };
/** Voranmeldungszeiträume eines Jahres mit Abgabefrist (10. nach Ablauf, mit Dauerfristverlängerung einen Monat später) */
export function zeitraeume(jahr: number, art: SteuerSet["zeitraum"], dauerfrist = false): Zeitraum[] {
  if (art === "jahr") return [{ key: String(jahr), name: `Jahr ${jahr}`, von: iso(jahr, 1, 1), bis: iso(jahr, 12, 31), frist: naechsterWerktag(iso(jahr + 1, 7, 31)), jahr }];
  const n = art === "monat" ? 12 : 4, len = art === "monat" ? 1 : 3, out: Zeitraum[] = [];
  for (let i = 0; i < n; i++) {
    const m1 = i * len + 1, m2 = m1 + len - 1;
    let fy = jahr, fm = m2 + 1 + (dauerfrist ? 1 : 0);
    while (fm > 12) { fm -= 12; fy++; }
    out.push({ key: art === "monat" ? `${jahr}-${pad(m1)}` : `${jahr}-Q${i + 1}`, name: art === "monat" ? `${MONTHS_LONG[m1 - 1]} ${jahr}` : `${i + 1}. Quartal ${jahr}`,
      von: iso(jahr, m1, 1), bis: iso(jahr, m2, letzterTag(jahr, m2)), frist: naechsterWerktag(iso(fy, fm, 10)), jahr });
  }
  return out;
}

// ---------- Umsatzsteuer
export type SatzZeile = { satz: number; basis: number; steuer: number };
/** Netto und Steuer einer Rechnung je Steuersatz. Maßgeblich sind die gespeicherten Summen; die Positionen verteilen sie nur auf die Sätze. */
export function nachSatz(inv: { net?: number; vat?: number; items?: Posten[] }): SatzZeile[] {
  const net = r2(+(inv.net ?? 0) || 0), vat = r2(+(inv.vat ?? 0) || 0);
  if (!vat) return net ? [{ satz: 0, basis: net, steuer: 0 }] : [];
  const t = totals(inv.items ?? []);
  if (t.vatLines.length && Math.abs(t.vat - vat) <= 0.02 && Math.abs(t.net - net) <= 0.02) {
    const out = t.vatLines.map((v) => ({ satz: v.rate, basis: v.base, steuer: v.amount }));
    const rest = r2(net - out.reduce((a, v) => a + v.basis, 0));
    if (Math.abs(rest) > 0.02) out.push({ satz: 0, basis: rest, steuer: 0 });
    return out;
  }
  // Positionen passen nicht zu den Summen (z. B. übernommene Rechnung): ein Satz aus dem Verhältnis
  const roh = net ? (vat / net) * 100 : 19, satz = [19, 7, 16, 5].find((s) => Math.abs(s - roh) < 0.6) ?? Math.round(roh * 10) / 10;
  return [{ satz, basis: net, steuer: vat }];
}
export type Umsatz = { id: string; nummer: string; datum: string; netto: number; steuer: number; saetze: SatzZeile[]; storno: boolean };
/** Umsätze, für die Umsatzsteuer entstanden ist: Soll = alles Ausgestellte am Rechnungsdatum (Stornos negativ), Ist = Bezahltes am Zahltag */
export function umsaetze(invoices: any[], art: SteuerSet["art"]): Umsatz[] {
  const out: Umsatz[] = [];
  for (const i of invoices) {
    if (!i || i.status === "draft") continue;
    let datum = "";
    if (art === "ist") { if (i.kind !== "invoice" || i.status !== "paid") continue; datum = String(i.paid_at || i.issue_date || "").slice(0, 10); }
    else { if (i.kind !== "invoice" && i.kind !== "storno") continue; datum = String(i.issue_date || "").slice(0, 10); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;
    out.push({ id: i.id, nummer: i.number || "", datum, netto: r2(+i.net || 0), steuer: r2(+i.vat || 0), saetze: nachSatz(i), storno: i.kind === "storno" });
  }
  return out;
}
export type UstErgebnis = {
  z: Zeitraum; rechnungen: number; belege: number;
  basis19: number; basis7: number; basis0: number; andere: SatzZeile[];   // Ausgangsumsätze netto je Satz
  steuerAus: number;                                                      // Umsatzsteuer aus deinen Rechnungen
  euBasis: number; euSteuer: number; drittBasis: number; drittSteuer: number;   // § 13b: Leistungen aus dem Ausland
  vorsteuer: number; vorsteuer13b: number;
  zahllast: number;                                                       // > 0 ans Finanzamt, < 0 Erstattung
  kz: { nr: string; name: string; wert: number; euro?: boolean }[];       // Kennzahlen wie im ELSTER-Formular
};
const abgerundet = (n: number) => (n < 0 ? Math.ceil(n) : Math.floor(n));   // Bemessungsgrundlagen in vollen Euro
/** Umsatzsteuer eines Zeitraums. klein = Kleinunternehmer: keine Umsatzsteuer, kein Vorsteuerabzug, § 13b wird trotzdem geschuldet. */
export function ust(z: Zeitraum, ums: Umsatz[], ausgaben: Ausgabe[], klein = false): UstErgebnis {
  const drin = (d: string) => d >= z.von && d <= z.bis;
  let basis19 = 0, basis7 = 0, basis0 = 0, steuerRoh = 0, rechnungen = 0; const andere: Record<string, SatzZeile> = {};
  for (const u of ums) {
    if (!drin(u.datum)) continue; rechnungen++;
    for (const s of u.saetze) {
      steuerRoh += s.steuer;
      if (s.satz === 19) basis19 += s.basis; else if (s.satz === 7) basis7 += s.basis; else if (!s.satz) basis0 += s.basis;
      else { const a = (andere[s.satz] ||= { satz: s.satz, basis: 0, steuer: 0 }); a.basis += s.basis; a.steuer += s.steuer; }
    }
  }
  let vorsteuer = 0, euBasis = 0, euSteuer = 0, drittBasis = 0, drittSteuer = 0, belege = 0;
  for (const a of ausgaben) {
    if (!drin(String(a.datum).slice(0, 10))) continue; belege++;
    if (a.art === "inland") vorsteuer += +a.ust || 0;
    else if (a.art === "eu") { euBasis += +a.netto || 0; euSteuer += +a.ust || 0; }
    else if (a.art === "drittland") { drittBasis += +a.netto || 0; drittSteuer += +a.ust || 0; }
  }
  [basis19, basis7, basis0, vorsteuer, euBasis, euSteuer, drittBasis, drittSteuer] = [basis19, basis7, basis0, vorsteuer, euBasis, euSteuer, drittBasis, drittSteuer].map(r2);
  const and = Object.values(andere).map((a) => ({ satz: a.satz, basis: r2(a.basis), steuer: r2(a.steuer) }));
  // wie ELSTER: Steuer aus der auf volle Euro abgerundeten Bemessungsgrundlage
  const st19 = r2(abgerundet(basis19) * 0.19), st7 = r2(abgerundet(basis7) * 0.07), stAnd = r2(and.reduce((s, a) => s + a.steuer, 0));
  const steuerAus = klein ? 0 : r2(st19 + st7 + stAnd);
  const vst = klein ? 0 : vorsteuer, vst13 = klein ? 0 : r2(euSteuer + drittSteuer);
  const zahllast = r2(steuerAus + euSteuer + drittSteuer - vst - vst13);
  const kz: UstErgebnis["kz"] = [];
  if (!klein) {
    if (basis19) kz.push({ nr: "81", name: "Umsätze zu 19 % (netto)", wert: abgerundet(basis19), euro: true });
    if (basis7) kz.push({ nr: "86", name: "Umsätze zu 7 % (netto)", wert: abgerundet(basis7), euro: true });
    for (const a of and) kz.push({ nr: "35", name: `Umsätze zu ${a.satz} % (netto)`, wert: abgerundet(a.basis), euro: true }, { nr: "36", name: `Steuer zu ${a.satz} %`, wert: a.steuer });
  }
  if (euBasis) kz.push({ nr: "46", name: "Leistungen von EU-Firmen, § 13b (netto)", wert: abgerundet(euBasis), euro: true }, { nr: "47", name: "Steuer darauf", wert: euSteuer });
  if (drittBasis) kz.push({ nr: "84", name: "Leistungen von Firmen außerhalb der EU, § 13b (netto)", wert: abgerundet(drittBasis), euro: true }, { nr: "85", name: "Steuer darauf", wert: drittSteuer });
  if (vst) kz.push({ nr: "66", name: "Vorsteuer aus Rechnungen", wert: vst });
  if (vst13) kz.push({ nr: "67", name: "Vorsteuer aus § 13b", wert: vst13 });
  kz.push({ nr: "83", name: zahllast < 0 ? "Erstattung" : "Zu zahlen", wert: zahllast });
  return { z, rechnungen, belege, basis19, basis7, basis0, andere: and, steuerAus, euBasis, euSteuer, drittBasis, drittSteuer, vorsteuer: vst, vorsteuer13b: vst13, zahllast, kz };
}
/** Welcher Voranmeldungs-Rhythmus aus der Zahllast eines Jahres fürs Folgejahr folgt (§ 18 Abs. 2 UStG) */
export const rhythmusAus = (zahllastJahr: number): SteuerSet["zeitraum"] => (zahllastJahr > 9000 ? "monat" : zahllastJahr > 2000 ? "quartal" : "jahr");
export const RHYTHMUS: Record<SteuerSet["zeitraum"], string> = { monat: "monatlich", quartal: "vierteljährlich", jahr: "nur die Jahreserklärung" };

// ---------- Gewinn (Einnahmen-Überschuss-Rechnung, nach Geldfluss)
export type Euer = { jahr: number; einnahmen: number; anzahl: number; ausgaben: number; nichtAbziehbar: number; gewinn: number;
  kategorien: { key: string; name: string; summe: number; abziehbar: number; anzahl: number }[]; monate: { ein: number; aus: number }[] };
/** Gewinn eines Jahres: bezahlte Rechnungen (netto, am Zahltag) minus bezahlte Ausgaben (netto, am Zahltag). Kleinunternehmer rechnen brutto. */
export function euer(invoices: any[], ausgaben: Ausgabe[], jahr: number, klein = false): Euer {
  const y = jahr + "-", monate = Array.from({ length: 12 }, () => ({ ein: 0, aus: 0 }));
  let einnahmen = 0, anzahl = 0;
  for (const i of invoices) {
    if (!i || i.kind !== "invoice" || i.status !== "paid") continue;
    const d = String(i.paid_at || i.issue_date || "").slice(0, 10); if (!d.startsWith(y)) continue;
    const b = klein ? +i.gross || 0 : +i.net || 0; einnahmen += b; anzahl++; monate[+d.slice(5, 7) - 1].ein += b;
  }
  const kat: Record<string, Euer["kategorien"][number]> = {}; let aus = 0, nicht = 0;
  for (const a of ausgaben) {
    const d = String(a.bezahlt_am || a.datum || "").slice(0, 10); if (!d.startsWith(y)) continue;
    // Kleinunternehmer: gezahlte Umsatzsteuer und die selbst geschuldete § 13b-Steuer sind Kosten
    const kosten = klein ? (a.art === "inland" ? +a.brutto || 0 : (+a.netto || 0) + (a.art === "ohne" ? 0 : +a.ust || 0)) : +a.netto || 0;
    const k = kategorie(a.kategorie), ab = kosten * k.anteil;
    const e = (kat[k.key] ||= { key: k.key, name: k.name, summe: 0, abziehbar: 0, anzahl: 0 });
    e.summe += kosten; e.abziehbar += ab; e.anzahl++; aus += ab; nicht += kosten - ab; monate[+d.slice(5, 7) - 1].aus += ab;
  }
  const kategorien = Object.values(kat).map((k) => ({ ...k, summe: r2(k.summe), abziehbar: r2(k.abziehbar) })).sort((a, b) => b.summe - a.summe);
  return { jahr, einnahmen: r2(einnahmen), anzahl, ausgaben: r2(aus), nichtAbziehbar: r2(nicht), gewinn: r2(einnahmen - aus), kategorien, monate: monate.map((m) => ({ ein: r2(m.ein), aus: r2(m.aus) })) };
}

// ---------- Einkommensteuer, Solidaritätszuschlag, Gewerbesteuer
type Tarif = { frei: number; a: number; z2: number; b: number; c: number; z3: number; d: number; z4: number; e: number; soliFrei: number };
const TARIFE: Record<number, Tarif> = {
  2024: { frei: 11784, a: 954.8, z2: 17005, b: 181.19, c: 991.21, z3: 66760, d: 10636.31, z4: 277825, e: 18971.06, soliFrei: 18130 },
  2025: { frei: 12096, a: 932.3, z2: 17443, b: 176.64, c: 1015.13, z3: 68480, d: 10911.92, z4: 277825, e: 19246.67, soliFrei: 19950 },
  2026: { frei: 12348, a: 914.51, z2: 17799, b: 173.1, c: 1034.87, z3: 69878, d: 11135.63, z4: 277825, e: 19470.38, soliFrei: 20350 },
};
/** Jahr, dessen Tarif für ein Steuerjahr gilt (ab 2027 vorerst 2026, bis ein neuer Tarif Gesetz ist) */
export const tarifJahr = (jahr: number) => Math.min(Math.max(jahr, 2024), 2026);
/** Einkommensteuer nach Grundtarif (§ 32a EStG) auf das zu versteuernde Einkommen */
export function est(zve: number, jahr: number): number {
  const t = TARIFE[tarifJahr(jahr)], x = Math.floor(Math.max(+zve || 0, 0));
  if (x <= t.frei) return 0;
  if (x <= t.z2) { const y = (x - t.frei) / 10000; return Math.floor((t.a * y + 1400) * y); }
  if (x <= t.z3) { const z = (x - t.z2) / 10000; return Math.floor((t.b * z + 2397) * z + t.c); }
  if (x <= t.z4) return Math.floor(0.42 * x - t.d);
  return Math.floor(0.45 * x - t.e);
}
/** Solidaritätszuschlag: 5,5 % der Einkommensteuer, über der Freigrenze höchstens 11,9 % des Mehrbetrags */
export function soli(steuer: number, jahr: number): number {
  const frei = TARIFE[tarifJahr(jahr)].soliFrei;
  return steuer <= frei ? 0 : Math.floor(Math.min(steuer * 0.055, (steuer - frei) * 0.119) * 100) / 100;
}
export const GEWST_FREIBETRAG = 24500;
/** Gewerbesteuer für Einzelunternehmen: Gewinn auf volle 100 € abgerundet, minus Freibetrag, mal 3,5 %, mal Hebesatz */
export function gewst(gewinn: number, hebesatz: number) {
  const ertrag = Math.max(Math.floor(Math.max(gewinn, 0) / 100) * 100 - GEWST_FREIBETRAG, 0);
  const messbetrag = Math.floor(ertrag * 0.035);
  return { ertrag, messbetrag, steuer: r2(messbetrag * hebesatz / 100) };
}
export type Schaetzung = {
  gewinn: number; zveOhne: number; zveMit: number;
  estOhne: number; estMit: number; anrechnung: number; estNach: number;
  soliOhne: number; soliMit: number; kircheOhne: number; kircheMit: number;
  gewerbe: ReturnType<typeof gewst>;
  estMehr: number; soliMehr: number; kircheMehr: number;   // was dein Unternehmen an Einkommensteuer usw. zusätzlich auslöst
  gesamt: number;                                          // alles zusammen: zusätzliche ESt + Soli + Kirche + Gewerbesteuer
  grenzsatz: number;                                       // Anteil am Gewinn in Prozent
};
/** Was der Gewinn an Einkommen- und Gewerbesteuer auslöst – zusätzlich zu dem, was auf die übrigen Einkünfte ohnehin anfällt */
export function schaetzung(gewinn: number, jahr: number, set: Pick<SteuerSet, "gewerbe" | "hebesatz">, p: Privat): Schaetzung {
  const zveOhne = Math.max(p.andere - p.abzuege, 0), zveMit = Math.max(p.andere + gewinn - p.abzuege, 0);
  const estOhne = est(zveOhne, jahr), estMit = est(zveMit, jahr);
  const g = set.gewerbe ? gewst(gewinn, set.hebesatz) : { ertrag: 0, messbetrag: 0, steuer: 0 };
  // § 35 EStG: höchstens der 4,0-fache Messbetrag, höchstens die gezahlte Gewerbesteuer, höchstens die auf den Gewerbegewinn entfallende Einkommensteuer
  const anteil = gewinn > 0 ? gewinn / (gewinn + Math.max(p.andere, 0)) : 0;
  const anrechnung = g.steuer > 0 ? Math.floor(Math.min(4.0 * g.messbetrag, g.steuer, estMit * anteil)) : 0;
  const estNach = estMit - anrechnung;
  const soliOhne = soli(estOhne, jahr), soliMit = soli(estNach, jahr);
  const ks = p.kirche ? p.kirchensatz / 100 : 0, kircheOhne = r2(estOhne * ks), kircheMit = r2(estMit * ks);   // Kirchensteuer ohne § 35 (§ 51a Abs. 2 EStG)
  const estMehr = estNach - estOhne, soliMehr = r2(soliMit - soliOhne), kircheMehr = r2(kircheMit - kircheOhne);
  const gesamt = r2(estMehr + soliMehr + kircheMehr + g.steuer);
  return { gewinn, zveOhne, zveMit, estOhne, estMit, anrechnung, estNach, soliOhne, soliMit, kircheOhne, kircheMit, gewerbe: g, estMehr, soliMehr, kircheMehr, gesamt,
    grenzsatz: gewinn > 0 ? Math.round((gesamt / gewinn) * 1000) / 10 : 0 };
}
/** Hochrechnung des laufenden Jahres: bisheriger Wert auf das ganze Jahr (erst ab 30 Tagen, davor ist es Kaffeesatz) */
export function hochrechnung(bisher: number, jahr: number, heute: string): { jahr: number; faktor: number } {
  if (+heute.slice(0, 4) !== jahr) return { jahr: bisher, faktor: 1 };
  const tage = Math.round((Date.parse(heute + "T00:00:00Z") - Date.parse(`${jahr}-01-01T00:00:00Z`)) / 86400000) + 1;
  const gesamt = letzterTag(jahr, 2) === 29 ? 366 : 365;
  if (tage < 30) return { jahr: bisher, faktor: 1 };
  const faktor = gesamt / tage;
  return { jahr: r2(bisher * faktor), faktor };
}

// ---------- Fristen
export type Frist = { datum: string; titel: string; text: string; art: "ust" | "erklaerung" | "vorauszahlung"; key?: string };
/** Alle Steuertermine rund um ein Datum (Vorjahr bis Folgejahr), aufsteigend */
export function fristen(heute: string, set: SteuerSet, klein = false): Frist[] {
  const y = +heute.slice(0, 4), out: Frist[] = [];
  for (const j of [y - 1, y, y + 1]) {
    if (!klein && set.zeitraum !== "jahr") for (const z of zeitraeume(j, set.zeitraum, set.dauerfrist))
      out.push({ datum: z.frist, titel: `Umsatzsteuer-Voranmeldung ${z.name}`, text: "Über ELSTER abgeben und zahlen", art: "ust", key: z.key });
    out.push({ datum: naechsterWerktag(iso(j + 1, 7, 31)), titel: `Steuererklärungen ${j}`,
      text: `Einkommensteuer mit Anlage EÜR${klein ? "" : ", Umsatzsteuer"}${set.gewerbe ? ", Gewerbesteuer" : ""}. Mit Steuerberater später.`, art: "erklaerung" });
    for (const m of [3, 6, 9, 12]) out.push({ datum: naechsterWerktag(iso(j, m, 10)), titel: "Einkommensteuer-Vorauszahlung", text: "Nur wenn das Finanzamt Vorauszahlungen festgesetzt hat", art: "vorauszahlung" });
    if (set.gewerbe) for (const m of [2, 5, 8, 11]) out.push({ datum: naechsterWerktag(iso(j, m, 15)), titel: "Gewerbesteuer-Vorauszahlung", text: "Nur wenn Vorauszahlungen festgesetzt sind", art: "vorauszahlung" });
  }
  return out.sort((a, b) => a.datum.localeCompare(b.datum) || a.titel.localeCompare(b.titel));
}
export const tageBis = (heute: string, datum: string) => Math.round((Date.parse(datum + "T00:00:00Z") - Date.parse(heute + "T00:00:00Z")) / 86400000);
