// GoBD-Export für den Betriebsprüfer (Datenträgerüberlassung, § 147 Abs. 6 AO)
// Ein ZIP mit den Rechnungsdaten als CSV, einer Beschreibung im GDPdU-Format (index.xml, für IDEA & Co.),
// dem Änderungsprotokoll und den Original-PDFs. Enthält alle ausgestellten Rechnungen des Zeitraums – auch ausgeblendete.

// deno-lint-ignore no-explicit-any
type Any = any;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const d = (v: unknown) => (v ? String(v).slice(0, 10).split("-").reverse().join(".") : "");
const zeit = (v: unknown) => {
  if (!v) return "";
  const t = new Date(String(v));
  const f = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return f.format(t).replace(",", "");
};
const zahl = (v: unknown, stellen = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(stellen).replace(".", ",") : "";
};
const feld = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Spalte = { name: string; typ: "text" | "zahl" | "datum"; stellen?: number; schluessel?: boolean };
type Tabelle = { datei: string; name: string; beschreibung: string; spalten: Spalte[]; zeilen: unknown[][] };

function csv(t: Tabelle) {
  const kopf = t.spalten.map((s) => feld(s.name)).join(";");
  return [kopf, ...t.zeilen.map((z) => z.map(feld).join(";"))].join("\r\n") + "\r\n";
}

function indexXml(tabellen: Tabelle[], firma: string, ort: string, von: string, bis: string) {
  const spalte = (s: Spalte) => {
    const typ = s.typ === "zahl" ? `<Numeric><Accuracy>${s.stellen ?? 2}</Accuracy></Numeric>`
      : s.typ === "datum" ? "<Date><Format>DD.MM.YYYY</Format></Date>" : "<AlphaNumeric/>";
    const tag = s.schluessel ? "VariablePrimaryKey" : "VariableColumn";
    return `        <${tag}><Name>${xml(s.name)}</Name>${typ}</${tag}>`;
  };
  const tab = (t: Tabelle) => {
    // Primärschlüssel müssen vor den übrigen Spalten stehen (DTD)
    const sp = [...t.spalten.filter((s) => s.schluessel), ...t.spalten.filter((s) => !s.schluessel)];
    return `    <Table>
      <URL>${xml(t.datei)}</URL>
      <Name>${xml(t.name)}</Name>
      <Description>${xml(t.beschreibung)}</Description>
      <Validity><Range><From>${d(von)}</From><To>${d(bis)}</To></Range><Format>DD.MM.YYYY</Format></Validity>
      <UTF8/>
      <DecimalSymbol>,</DecimalSymbol>
      <DigitGroupingSymbol>.</DigitGroupingSymbol>
      <Range><From>2</From></Range>
      <VariableLength>
        <ColumnDelimiter>;</ColumnDelimiter>
        <RecordDelimiter>&#13;&#10;</RecordDelimiter>
        <TextEncapsulator>"</TextEncapsulator>
${sp.map(spalte).join("\n")}
      </VariableLength>
    </Table>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">
<DataSet>
  <Version>1.0</Version>
  <DataSupplier>
    <Name>${xml(firma || "Unbekannt")}</Name>
    <Location>${xml(ort || "-")}</Location>
    <Comment>GoBD-Export aus der Medialyte-App, erstellt am ${xml(zeit(new Date().toISOString()))}</Comment>
  </DataSupplier>
  <Media>
    <Name>GoBD-Export ${xml(d(von))} bis ${xml(d(bis))}</Name>
${tabellen.map(tab).join("\n")}
  </Media>
</DataSet>
`;
}

// Spaltenreihenfolge in den CSV-Zeilen = Reihenfolge in index.xml: Schlüssel zuerst
function sortiert(t: Tabelle): Tabelle {
  const idx = t.spalten.map((s, i) => ({ s, i }));
  const ord = [...idx.filter((x) => x.s.schluessel), ...idx.filter((x) => !x.s.schluessel)];
  return { ...t, spalten: ord.map((x) => x.s), zeilen: t.zeilen.map((z) => ord.map((x) => z[x.i])) };
}

const ART: Record<string, string> = { invoice: "Rechnung", storno: "Stornorechnung" };
const STATUS: Record<string, string> = { open: "offen", paid: "bezahlt", cancelled: "storniert", draft: "Entwurf" };

export async function gobdExport(o: {
  db: Any; uid: string; von?: string; bis?: string;
  settings: Any;
  belegPdf: (inv: Any) => Promise<{ bytes: Uint8Array; filename: string }>;
  zipSync: (f: Record<string, Uint8Array>, o?: Any) => Uint8Array;
  strToU8: (s: string) => Uint8Array;
}) {
  const jahr = new Date().getFullYear();
  const von = o.von && ISO.test(o.von) ? o.von : `${jahr}-01-01`;
  const bis = o.bis && ISO.test(o.bis) ? o.bis : `${jahr}-12-31`;
  if (bis < von) throw new Error("Der Zeitraum ist ungültig.");

  const { data: rech, error } = await o.db.from("invoices").select("*").eq("user_id", o.uid).neq("status", "draft")
    .gte("issue_date", von).lte("issue_date", bis).order("issue_date").order("number");
  if (error) throw error;
  const liste: Any[] = rech ?? [];
  const nummern = new Map<string, string>();
  for (const r of liste) nummern.set(r.id, r.number);
  const fehlend = liste.map((r) => r.ref_invoice_id).filter((id) => id && !nummern.has(id));
  if (fehlend.length) {
    const { data } = await o.db.from("invoices").select("id,number").in("id", [...new Set(fehlend)]);
    for (const r of data ?? []) nummern.set(r.id, r.number);
  }

  const dateien: Record<string, Uint8Array> = {};
  const pdfName = new Map<string, string>();
  for (const r of liste) {
    const { bytes } = await o.belegPdf(r);
    const name = `belege/${String(r.issue_date ?? "").slice(0, 4)}/${String(r.number).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
    dateien[name] = bytes;
    pdfName.set(r.id, name);
  }

  const rechnungen: Tabelle = {
    datei: "rechnungen.csv", name: "Rechnungen", beschreibung: "Ausgangsrechnungen und Stornorechnungen (Kopfdaten)",
    spalten: [
      { name: "Rechnungsnummer", typ: "text", schluessel: true }, { name: "Art", typ: "text" }, { name: "Status", typ: "text" },
      { name: "Rechnungsdatum", typ: "datum" }, { name: "Leistungszeitraum", typ: "text" }, { name: "Faellig_am", typ: "datum" },
      { name: "Kundennummer", typ: "text" }, { name: "Kunde", typ: "text" }, { name: "Kunde_Anschrift", typ: "text" }, { name: "Kunde_USt_IdNr", typ: "text" },
      { name: "Netto", typ: "zahl" }, { name: "Umsatzsteuer", typ: "zahl" }, { name: "Brutto", typ: "zahl" }, { name: "Waehrung", typ: "text" },
      { name: "Bezahlt_am", typ: "datum" }, { name: "Versendet_am", typ: "datum" }, { name: "Bezug_auf_Rechnung", typ: "text" },
      { name: "Uebernommen_aus_Altsystem", typ: "text" }, { name: "Ausgeblendet_am", typ: "datum" }, { name: "Ausblendgrund", typ: "text" },
      { name: "Beleg_Datei", typ: "text" }, { name: "Beleg_SHA256", typ: "text" }, { name: "Beleg_abgelegt_am", typ: "text" },
      { name: "Beleg_nachtraeglich_abgelegt", typ: "text" }, { name: "Angelegt_am", typ: "text" },
    ],
    zeilen: liste.map((r) => {
      const c = r.customer ?? {};
      return [
        r.number, ART[r.kind] ?? r.kind, STATUS[r.status] ?? r.status, d(r.issue_date), r.service_text ?? "", d(r.due_date),
        c.number ?? "", c.name ?? "", [c.street, [c.zip, c.city].filter(Boolean).join(" "), c.country].filter(Boolean).join(", "), c.vat_id ?? "",
        zahl(r.net), zahl(r.vat), zahl(r.gross), "EUR",
        d(r.paid_at), d(r.sent_at), r.ref_invoice_id ? nummern.get(r.ref_invoice_id) ?? "" : "",
        r.imported ? "ja" : "nein", d(r.ausgeblendet_am), r.ausgeblendet_grund ?? "",
        pdfName.get(r.id) ?? "", r.beleg_sha256 ?? "", zeit(r.beleg_am), r.beleg_nachtraeglich ? "ja" : "nein", zeit(r.created_at),
      ];
    }),
  };

  const posZeilen: unknown[][] = [];
  for (const r of liste) {
    (Array.isArray(r.items) ? r.items : []).forEach((it: Any, i: number) => {
      const rabatt = it?.type === "discount";
      posZeilen.push([
        r.number, i + 1, rabatt ? "Rabatt" : "Position", it?.description ?? it?.label ?? "",
        rabatt ? "" : zahl(it?.quantity, 3), rabatt ? "" : it?.unit ?? "", rabatt ? "" : zahl(it?.price),
        rabatt ? "" : zahl(it?.vat), rabatt ? (it?.mode === "percent" ? `${zahl(it?.value)} %` : zahl(it?.value)) : zahl(it?.discount),
      ]);
    });
  }
  const positionen: Tabelle = {
    datei: "positionen.csv", name: "Rechnungspositionen", beschreibung: "Positionen der Rechnungen, wie ausgestellt",
    spalten: [
      { name: "Rechnungsnummer", typ: "text", schluessel: true }, { name: "Position", typ: "zahl", stellen: 0, schluessel: true },
      { name: "Art", typ: "text" }, { name: "Beschreibung", typ: "text" }, { name: "Menge", typ: "zahl", stellen: 3 }, { name: "Einheit", typ: "text" },
      { name: "Einzelpreis_netto", typ: "zahl" }, { name: "Steuersatz_Prozent", typ: "zahl" }, { name: "Rabatt", typ: "text" },
    ],
    zeilen: posZeilen.map((z) => { z[1] = String(z[1]); return z; }),
  };

  const { data: kund } = await o.db.from("customers").select("*").eq("user_id", o.uid).order("number");
  const kunden: Tabelle = {
    datei: "kunden.csv", name: "Kunden", beschreibung: "Kundenstamm (aktueller Stand; der Stand zum Rechnungszeitpunkt steht in rechnungen.csv)",
    spalten: [
      { name: "Kundennummer", typ: "text", schluessel: true }, { name: "Name", typ: "text" }, { name: "Ansprechpartner", typ: "text" },
      { name: "E_Mail", typ: "text" }, { name: "Strasse", typ: "text" }, { name: "PLZ", typ: "text" }, { name: "Ort", typ: "text" },
      { name: "Land", typ: "text" }, { name: "USt_IdNr", typ: "text" },
    ],
    zeilen: (kund ?? []).map((c: Any) => [c.number ?? "", c.name ?? "", c.contact ?? "", c.email ?? "", c.street ?? "", c.zip ?? "", c.city ?? "", c.country ?? "", c.vat_id ?? ""]),
  };

  const { data: prot } = await o.db.from("beleg_protokoll").select("*").eq("firma", o.uid)
    .gte("zeit", `${von}T00:00:00+00:00`).lte("zeit", `${bis}T23:59:59+00:00`).order("id").limit(50000);
  const protokoll: Tabelle = {
    datei: "protokoll.csv", name: "Aenderungsprotokoll", beschreibung: "Unveränderliches Protokoll aller Anlagen, Änderungen und Löschungen (Rechnungen, Angebote, Kunden, Firmendaten)",
    spalten: [
      { name: "Lfd_Nr", typ: "zahl", stellen: 0, schluessel: true }, { name: "Zeitpunkt", typ: "text" }, { name: "Bereich", typ: "text" },
      { name: "Datensatz", typ: "text" }, { name: "Nummer", typ: "text" }, { name: "Aktion", typ: "text" }, { name: "Benutzer", typ: "text" },
      { name: "Aenderungen", typ: "text" },
    ],
    zeilen: (prot ?? []).map((p: Any) => [String(p.id), zeit(p.zeit), p.tabelle, p.datensatz ?? "", p.nummer ?? "", p.aktion, p.wer ?? "System", JSON.stringify(p.aenderungen ?? {})]),
  };

  const tabellen = [rechnungen, positionen, kunden, protokoll].map(sortiert);
  for (const t of tabellen) dateien[t.datei] = o.strToU8("﻿" + csv(t));
  // die BOM gehört nicht zu den Daten: index.xml zählt ab Zeile 2, IDEA erkennt UTF-8 an <UTF8/>
  const s = o.settings ?? {};
  dateien["index.xml"] = o.strToU8(indexXml(tabellen, s.name ?? "", [s.zip, s.city].filter(Boolean).join(" "), von, bis));
  dateien["LIESMICH.txt"] = o.strToU8([
    `GoBD-Export ${d(von)} bis ${d(bis)}`,
    `${s.name ?? ""}`,
    `Erstellt am ${zeit(new Date().toISOString())} mit der Medialyte-App.`,
    "",
    "Inhalt",
    "  index.xml          Beschreibung der Tabellen im GDPdU-Format (Einlesen z. B. mit IDEA)",
    "  rechnungen.csv     alle ausgestellten Rechnungen und Stornorechnungen des Zeitraums, auch ausgeblendete",
    "  positionen.csv     die Positionen dieser Rechnungen",
    "  kunden.csv         Kundenstamm",
    "  protokoll.csv      Änderungsprotokoll (wer hat wann was angelegt oder geändert)",
    "  belege/            die Rechnungen als PDF, so wie sie ausgestellt wurden",
    "",
    "Format: UTF-8, Trennzeichen Semikolon, Dezimalkomma, Datum TT.MM.JJJJ, erste Zeile Spaltennamen.",
    "Jede abgelegte PDF-Datei lässt sich über ihre SHA-256-Prüfsumme (rechnungen.csv) auf Unverändertheit prüfen.",
    "Mit „nachträglich abgelegt“ gekennzeichnete Belege wurden vor Einführung der Ablage ausgestellt und",
    "später aus den unveränderten Rechnungsdaten erzeugt; übernommene Rechnungen stammen aus dem Altsystem.",
    "",
  ].join("\r\n"));

  return o.zipSync(dateien, { level: 6 });
}
