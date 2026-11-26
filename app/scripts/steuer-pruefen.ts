// Rechnet den Steuer-Rechenkern gegen von Hand gerechnete Fälle nach.  Aufruf: cd app && npx tsx scripts/steuer-pruefen.ts
import { ausgabeBetraege, est, euer, fristen, gewst, hochrechnung, nachSatz, naechsterWerktag, ostern, rhythmusAus, schaetzung, soli, steuerSet, umsaetze, ust, zeitraeume, PRIVAT_STANDARD, type Ausgabe } from "../src/lib/rechnungen/steuer";

let fehler = 0, n = 0;
const gleich = (was: string, ist: unknown, soll: unknown) => {
  n++; const ok = typeof soll === "number" && typeof ist === "number" ? Math.abs(ist - soll) < 0.005 : JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) { fehler++; console.error(`FEHLER ${was}: ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`); }
};

// ---------- Einkommensteuertarif: Stützstellen und Übergänge zwischen den Zonen (falsche Koeffizienten machen dort Sprünge)
gleich("ESt 2026 Grundfreibetrag", est(12348, 2026), 0);
gleich("ESt 2026 15.000", est(15000, 2026), 435);
gleich("ESt 2026 40.000", est(40000, 2026), 7209);
gleich("ESt 2026 100.000", est(100000, 2026), 30864);
gleich("ESt 2025 Grundfreibetrag", est(12096, 2025), 0);
gleich("ESt 2025 40.000", est(40000, 2025), 7320);
gleich("ESt 2024 Grundfreibetrag", est(11784, 2024), 0);
gleich("ESt 2027 rechnet vorerst mit 2026", est(40000, 2027), est(40000, 2026));
for (const [j, grenzen] of [[2024, [11784, 17005, 66760, 277825]], [2025, [12096, 17443, 68480, 277825]], [2026, [12348, 17799, 69878, 277825]]] as [number, number[]][])
  for (const g of grenzen) { const d = est(g + 1, j) - est(g, j); n++; if (d < 0 || d > 1) { fehler++; console.error(`FEHLER Sprung im Tarif ${j} bei ${g}: ${d}`); } }
for (const j of [2024, 2025, 2026]) { let v = 0; for (let x = 0; x <= 300000; x += 137) { const e = est(x, j); if (e < v) { fehler++; console.error(`FEHLER Tarif ${j} fällt bei ${x}`); break; } v = e; } n++; }

// ---------- Soli
gleich("Soli unter Freigrenze", soli(20350, 2026), 0);
gleich("Soli Milderungszone", soli(30864, 2026), 1251.16);   // (30.864 − 20.350) × 11,9 % = 1.251,166
gleich("Soli voll", soli(100000, 2026), 5500);
gleich("Soli 2025 Freigrenze", soli(19950, 2025), 0);

// ---------- Gewerbesteuer
gleich("GewSt unter Freibetrag", gewst(24599, 470).steuer, 0);
gleich("GewSt 60.050 Messbetrag", gewst(60050, 470).messbetrag, 1242);   // 60.000 − 24.500 = 35.500 × 3,5 % = 1.242,50
gleich("GewSt 60.050 Hamburg", gewst(60050, 470).steuer, 5837.4);
gleich("GewSt Verlust", gewst(-5000, 470).steuer, 0);

// ---------- Schätzung: 30.000 € Gewinn, keine anderen Einkünfte, Hamburg
const s1 = schaetzung(30000, 2026, { gewerbe: true, hebesatz: 470 }, PRIVAT_STANDARD);
gleich("Schätzung ESt", s1.estMit, 4217);
gleich("Schätzung GewSt", s1.gewerbe.steuer, 902.4);            // 5.500 × 3,5 % = 192 × 470 %
gleich("Schätzung Anrechnung § 35", s1.anrechnung, 768);        // 4,0 × 192
gleich("Schätzung gesamt", s1.gesamt, 4351.4);                  // 4.217 − 768 + 902,40
// mit Gehalt: nur der Mehrbetrag zählt
const s2 = schaetzung(10000, 2026, { gewerbe: true, hebesatz: 470 }, { ...PRIVAT_STANDARD, andere: 30000 });
gleich("Schätzung mit Gehalt: Mehrbetrag", s2.estMehr, est(40000, 2026) - est(30000, 2026));
gleich("Schätzung mit Gehalt: keine GewSt", s2.gewerbe.steuer, 0);
gleich("Schätzung freier Beruf: keine GewSt", schaetzung(60000, 2026, { gewerbe: false, hebesatz: 470 }, PRIVAT_STANDARD).gewerbe.steuer, 0);
const s3 = schaetzung(30000, 2026, { gewerbe: true, hebesatz: 470 }, { ...PRIVAT_STANDARD, kirche: true });
gleich("Kirchensteuer auf ESt ohne § 35", s3.kircheMit, 379.53);   // 9 % von 4.217
gleich("Verlust mindert die Steuer", schaetzung(-5000, 2026, { gewerbe: true, hebesatz: 470 }, { ...PRIVAT_STANDARD, andere: 30000 }).estMehr, est(25000, 2026) - est(30000, 2026));

// ---------- Ausgaben-Beträge
gleich("Inland 119 brutto", ausgabeBetraege(119, 19, "inland"), { netto: 100, ust: 19, brutto: 119, ust_satz: 19 });
gleich("Inland 7 %", ausgabeBetraege(10.7, 7, "inland"), { netto: 10, ust: 0.7, brutto: 10.7, ust_satz: 7 });
gleich("Reverse Charge 20", ausgabeBetraege(20, 19, "drittland"), { netto: 20, ust: 3.8, brutto: 20, ust_satz: 19 });
gleich("Ohne Vorsteuer", ausgabeBetraege(50, 19, "ohne"), { netto: 50, ust: 0, brutto: 50, ust_satz: 0 });

// ---------- Kalender
gleich("Ostern 2026", ostern(2026), "2026-04-05");
gleich("Ostern 2027", ostern(2027), "2027-03-28");
gleich("Frist am Samstag", naechsterWerktag("2026-10-10"), "2026-10-12");
gleich("Frist am Ostermontag", naechsterWerktag("2023-04-10"), "2023-04-11");
gleich("Frist am Reformationstag (Samstag)", naechsterWerktag("2026-10-31"), "2026-11-02");
gleich("Quartale 2026", zeitraeume(2026, "quartal").map((z) => [z.key, z.von, z.bis, z.frist]),
  [["2026-Q1", "2026-01-01", "2026-03-31", "2026-04-10"], ["2026-Q2", "2026-04-01", "2026-06-30", "2026-07-10"], ["2026-Q3", "2026-07-01", "2026-09-30", "2026-10-12"], ["2026-Q4", "2026-10-01", "2026-12-31", "2027-01-11"]]);
gleich("Monat Februar Schaltjahr", zeitraeume(2028, "monat")[1].bis, "2028-02-29");
gleich("Monat mit Dauerfrist", zeitraeume(2026, "monat", true)[10].frist, "2027-01-11");   // November → 10.01.2027 (Sonntag)
gleich("Dezember mit Dauerfrist", zeitraeume(2026, "monat", true)[11].frist, "2027-02-10");
gleich("Jahreserklärung 2026", zeitraeume(2026, "jahr")[0].frist, "2027-08-02");   // 31.07.2027 ist ein Samstag

// ---------- Umsatzsteuer: drei Rechnungen, vier Ausgaben
const pos = (netto: number, vat = 19) => [{ description: "x", quantity: 1, price: netto, vat }];
const re = [
  { id: "a", number: "RE-1", kind: "invoice", status: "paid", issue_date: "2026-07-15", paid_at: "2026-08-02T12:00:00.000Z", net: 1000, vat: 190, gross: 1190, items: pos(1000) },
  { id: "b", number: "RE-2", kind: "invoice", status: "open", issue_date: "2026-09-20", net: 500, vat: 95, gross: 595, items: pos(500) },
  { id: "c", number: "RE-3", kind: "invoice", status: "cancelled", issue_date: "2026-08-10", net: 200, vat: 38, gross: 238, items: pos(200) },
  { id: "d", number: "RE-4", kind: "storno", status: "cancelled", issue_date: "2026-10-05", net: -200, vat: -38, gross: -238, items: [{ description: "x", quantity: -1, price: 200, vat: 19 }] },
  { id: "e", kind: "invoice", status: "draft", net: 999, vat: 189.81, gross: 1188.81, items: pos(999) },
  { id: "f", number: "RE-5", kind: "invoice", status: "paid", issue_date: "2026-06-30", paid_at: "2026-07-03T12:00:00.000Z", net: 300, vat: 21, gross: 321, items: pos(300, 7) },
];
const aus: Ausgabe[] = [
  { id: "1", datum: "2026-08-01", lieferant: "Hoster", kategorie: "software", art: "inland", ...ausgabeBetraege(119, 19, "inland") },
  { id: "2", datum: "2026-08-03", lieferant: "Anthropic", kategorie: "software", art: "drittland", ...ausgabeBetraege(20, 19, "drittland") },
  { id: "3", datum: "2026-09-01", lieferant: "EU-Tool", kategorie: "software", art: "eu", ...ausgabeBetraege(50, 19, "eu") },
  { id: "4", datum: "2026-09-12", lieferant: "Restaurant", kategorie: "bewirtung", art: "inland", ...ausgabeBetraege(119, 19, "inland") },
];
const q = zeitraeume(2026, "quartal");
const soll = ust(q[2], umsaetze(re, "soll"), aus);
gleich("Soll Q3 Basis 19 %", soll.basis19, 1700);              // 1.000 + 500 + 200 (Storno erst im 4. Quartal)
gleich("Soll Q3 Vorsteuer", soll.vorsteuer, 38);               // 19 + 19
gleich("Soll Q3 § 13b", [soll.euBasis, soll.euSteuer, soll.drittBasis, soll.drittSteuer, soll.vorsteuer13b], [50, 9.5, 20, 3.8, 13.3]);
gleich("Soll Q3 Zahllast", soll.zahllast, 285);                // 323 − 38, § 13b hebt sich auf
gleich("Soll Q3 Kennzahlen", soll.kz.map((k) => [k.nr, k.wert]), [["81", 1700], ["46", 50], ["47", 9.5], ["84", 20], ["85", 3.8], ["66", 38], ["67", 13.3], ["83", 285]]);
gleich("Soll Q4 Storno mindert", ust(q[3], umsaetze(re, "soll"), aus).zahllast, -38);
gleich("Soll Q2 mit 7 %", [ust(q[1], umsaetze(re, "soll"), aus).basis7, ust(q[1], umsaetze(re, "soll"), aus).zahllast], [300, 21]);
const ist = ust(q[2], umsaetze(re, "ist"), aus);
gleich("Ist Q3 Basis", [ist.basis19, ist.basis7], [1000, 300]);   // nur was im Quartal bezahlt wurde
gleich("Ist Q3 Zahllast", ist.zahllast, 173);                     // 190 + 21 − 38
gleich("Kleinunternehmer schuldet nur § 13b", ust(q[2], umsaetze(re, "soll"), aus, true).zahllast, 13.3);
gleich("Cent-Beträge wie ELSTER", ust(q[2], umsaetze([{ id: "x", kind: "invoice", status: "open", issue_date: "2026-07-01", net: 99.99, vat: 19, gross: 118.99, items: pos(99.99) }], "soll"), []).steuerAus, 18.81);   // 99 × 19 %
gleich("Sätze aus Summen, wenn Positionen fehlen", nachSatz({ net: 100, vat: 19, items: [] }), [{ satz: 19, basis: 100, steuer: 19 }]);
gleich("Gemischte Rechnung", nachSatz({ net: 300, vat: 45, gross: 345, items: [...pos(200), ...pos(100, 7)] } as any), [{ satz: 19, basis: 200, steuer: 38 }, { satz: 7, basis: 100, steuer: 7 }]);
gleich("Rechnung ohne Steuer", nachSatz({ net: 80, vat: 0, items: pos(80, 0) }), [{ satz: 0, basis: 80, steuer: 0 }]);
gleich("Rhythmus", [rhythmusAus(9000.01), rhythmusAus(9000), rhythmusAus(2000.01), rhythmusAus(2000)], ["monat", "quartal", "quartal", "jahr"]);

// ---------- Gewinn
const e = euer(re, aus, 2026);
gleich("EÜR Einnahmen", e.einnahmen, 1300);                    // bezahlt: 1.000 + 300
gleich("EÜR Ausgaben", e.ausgaben, 240);                       // 100 + 20 + 50 + 70 % von 100
gleich("EÜR nicht abziehbar", e.nichtAbziehbar, 30);
gleich("EÜR Gewinn", e.gewinn, 1060);
gleich("EÜR Kleinunternehmer brutto", euer(re, aus, 2026, true).ausgaben, 119 + 23.8 + 59.5 + 83.3);
gleich("EÜR nach Zahltag", euer([{ kind: "invoice", status: "paid", issue_date: "2025-12-20", paid_at: "2026-01-05T12:00:00Z", net: 100, vat: 19, gross: 119 }], [], 2025).einnahmen, 0);
gleich("Hochrechnung halbes Jahr", hochrechnung(1000, 2026, "2026-07-02").jahr, 1994.54);   // 183 von 365 Tagen
gleich("Hochrechnung Vorjahr unverändert", hochrechnung(1000, 2025, "2026-07-02").jahr, 1000);
gleich("Hochrechnung im Januar nicht", hochrechnung(1000, 2026, "2026-01-20").jahr, 1000);

// ---------- Fristen
const f = fristen("2026-11-26", steuerSet({ steuer: { zeitraum: "quartal" } }));
gleich("Nächste USt-Frist", f.find((x) => x.art === "ust" && x.datum >= "2026-11-26")?.datum, "2027-01-11");
gleich("Nächste Erklärung", f.find((x) => x.art === "erklaerung" && x.datum >= "2026-11-26")?.datum, "2027-08-02");
gleich("Nächste Vorauszahlung", f.find((x) => x.art === "vorauszahlung" && x.datum >= "2026-11-26")?.datum, "2026-12-10");
gleich("Ohne Voranmeldung keine USt-Fristen", fristen("2026-11-26", steuerSet({ steuer: { zeitraum: "jahr" } })).some((x) => x.art === "ust"), false);

console.log(fehler ? `${fehler} von ${n} Prüfungen fehlgeschlagen` : `OK ${n} Prüfungen`);
process.exit(fehler ? 1 : 0);
