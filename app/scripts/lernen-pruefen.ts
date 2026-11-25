// Prüft alle Lerninhalte auf Fehler: IDs, Antworten, Buchungssätze, Formeln (KaTeX), Grafiken, Rechengeneratoren.
// Aufruf: cd app && npx --yes tsx scripts/lernen-pruefen.ts <ordner mit kurs.json-Dateien> [kurs]
import katex from "katex";
import { readFileSync, existsSync } from "node:fs";
import { funktion, parse } from "../src/lib/lernen/ausdruck";
import { erzeuge } from "../src/lib/lernen/generator";
import type { Baustein, Frage, Grafik, Kurs } from "../src/lib/lernen/typen";
import { bewerten, loesungText, zahlLesen } from "../src/lib/lernen/pruefen";

const ordner = process.argv[2] ?? "."; const nur = process.argv[3];
const fehler: string[] = [], warnungen: string[] = [];
const F = (o: string, m: string) => fehler.push(`${o}: ${m}`);
const W = (o: string, m: string) => warnungen.push(`${o}: ${m}`);

function formeln(o: string, text: string | undefined) {
  if (!text) return;
  // Geldbeträge wie „5 $“ sind keine Formeln: nur Paare prüfen
  const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[1] ?? m[2];
    try { katex.renderToString(t, { throwOnError: true, displayMode: !!m[1], strict: "ignore" }); }
    catch (e: any) { F(o, `KaTeX-Fehler in „${t.slice(0, 60)}“: ${String(e.message).slice(0, 120)}`); }
  }
  const ohne = text.replace(re, "");
  if ((ohne.match(/\$/g) ?? []).length % 2) W(o, `einzelnes $ im Text: „${text.slice(0, 80)}“`);
  if (/\*\*[^*]*$/.test(text.replace(/\*\*[^*]*\*\*/g, ""))) W(o, `offenes ** in „${text.slice(0, 80)}“`);
}

function grafik(o: string, g: Grafik) {
  switch (g.art) {
    case "graph":
      if (!(g.x[0] < g.x[1] && g.y[0] < g.y[1])) F(o, "Achsenbereich ungültig");
      for (const k of g.kurven) {
        let ok = 0;
        try { parse(k.f); } catch (e: any) { F(o, `Kurve „${k.name}“: ${e.message}`); continue; }
        const f = funktion(k.f);
        for (let i = 0; i <= 50; i++) { const x = (k.von ?? g.x[0]) + (((k.bis ?? g.x[1]) - (k.von ?? g.x[0])) * i) / 50; const y = f(x); if (Number.isFinite(y) && y >= g.y[0] && y <= g.y[1]) ok++; }
        if (ok < 5) F(o, `Kurve „${k.name}“ liegt fast ganz außerhalb des Bildes`);
      }
      if (g.flaeche) for (const a of [g.flaeche.f, g.flaeche.g]) if (a) try { parse(a); } catch (e: any) { F(o, `Fläche: ${e.message}`); }
      for (const p of g.punkte ?? []) if (p.x < g.x[0] || p.x > g.x[1] || p.y < g.y[0] || p.y > g.y[1]) F(o, `Punkt ${p.name ?? ""} (${p.x}|${p.y}) außerhalb des Bildes`);
      break;
    case "bilanz": {
      const s = (l: [string, number | string][]) => l.reduce((n, [, v]) => n + (typeof v === "number" ? v : 0), 0);
      if (g.aktiva.every(([, v]) => typeof v === "number") && g.passiva.every(([, v]) => typeof v === "number") && Math.abs(s(g.aktiva) - s(g.passiva)) > 0.005) F(o, `Bilanz unausgeglichen: Aktiva ${s(g.aktiva)} ≠ Passiva ${s(g.passiva)}`);
      break;
    }
    case "tkonto":
      for (const k of g.konten) { const s = k.soll.reduce((n, [, v]) => n + v, 0), h = k.haben.reduce((n, [, v]) => n + v, 0); if (k.saldo === "soll" && s > h) F(o, `T-Konto ${k.name}: Saldo soll im Soll stehen, aber die Sollseite ist schon größer`); if (k.saldo === "haben" && h > s) F(o, `T-Konto ${k.name}: Saldo soll im Haben stehen, aber die Habenseite ist schon größer`); }
      break;
    case "matrix": if (g.felder.length !== 4) F(o, "Matrix braucht 4 Felder"); break;
  }
  const texte = JSON.stringify(g, (_, v) => (typeof v === "function" ? undefined : v));
  for (const m of texte.match(/"(?:[^"\\]|\\.)*"/g) ?? []) formeln(o, JSON.parse(m));
}

function baustein(o: string, b: Baustein) {
  switch (b.t) {
    case "text": case "merke": case "fehler": case "klausur": case "quelle": formeln(o, b.md); if (!b.md.trim()) F(o, "leerer Baustein"); break;
    case "formel": try { katex.renderToString(b.tex, { throwOnError: true, displayMode: true, strict: "ignore" }); } catch (e: any) { F(o, `Formel: ${String(e.message).slice(0, 140)}`); } for (const [a, c] of b.legende ?? []) { formeln(o, a); formeln(o, c); } break;
    case "beispiel": formeln(o, b.aufgabe); b.schritte.forEach((s) => formeln(o, s)); formeln(o, b.ergebnis); if (!b.schritte.length) F(o, "Beispiel ohne Schritte"); break;
    case "tabelle": b.zeilen.forEach((z, i) => { if (z.length !== b.kopf.length) F(o, `Tabelle Zeile ${i + 1}: ${z.length} statt ${b.kopf.length} Spalten`); z.forEach((c) => typeof c === "string" && formeln(o, c)); }); break;
    case "grafik": grafik(o, b.g); formeln(o, b.unter); break;
    case "begriffe": b.liste.forEach(([, e]) => formeln(o, e)); break;
    case "aufdecken": formeln(o, b.frage); formeln(o, b.antwort); if (!b.frage.trim() || !b.antwort.trim()) F(o, "aufdecken ohne Frage/Antwort"); break;
    case "regler": formeln(o, b.titel); formeln(o, b.md); formeln(o, b.unter); b.regler.forEach((r) => formeln(o, r.name)); (b.werte ?? []).forEach((w) => formeln(o, w.name)); break;
    case "aktuell": formeln(o, b.skript); formeln(o, b.aktuell); formeln(o, b.quelle); if (!b.skript.trim() || !b.aktuell.trim() || !b.quelle.trim() || !b.stand.trim()) F(o, "aktuell: skript, aktuell, quelle und stand sind Pflicht"); break;
    default: F(o, "unbekannter Baustein " + (b as any).t);
  }
}

function frage(o: string, f: Frage, generiert = false) {
  formeln(o, f.frage); formeln(o, f.erkl); formeln(o, f.tipp);
  if (!f.frage?.trim()) F(o, "Frage ohne Text");
  if (!generiert && !f.erkl && f.typ !== "karte" && f.typ !== "frei") W(o, "keine Erklärung");
  switch (f.typ) {
    case "mc":
      if (f.optionen.length < 2) F(o, "weniger als 2 Optionen");
      if (!f.richtig.length) F(o, "keine richtige Option");
      if (f.richtig.some((i) => i < 0 || i >= f.optionen.length || !Number.isInteger(i))) F(o, "richtig-Index ungültig");
      if (new Set(f.richtig).size !== f.richtig.length) F(o, "richtig doppelt");
      if (new Set(f.optionen.map((x) => x.trim())).size !== f.optionen.length) F(o, "doppelte Option");
      f.optionen.forEach((x) => formeln(o, x));
      if (f.richtig.length === f.optionen.length) W(o, "alle Optionen richtig");
      break;
    case "zahl":
      if (!Number.isFinite(f.antwort)) F(o, "Antwort keine Zahl");
      if (f.toleranz != null && !(f.toleranz >= 0)) F(o, "Toleranz ungültig");
      if (bewerten(f, { typ: "zahl", text: String(f.antwort).replace(".", ",") }) !== 1) F(o, "eigene Antwort wird nicht als richtig erkannt");
      break;
    case "buchung": {
      const k = new Set(f.konten);
      for (const [n] of [...f.soll, ...f.haben]) if (!k.has(n)) F(o, `Konto „${n}“ nicht in der Auswahl`);
      const s = f.soll.reduce((x, [, b]) => x + b, 0), h = f.haben.reduce((x, [, b]) => x + b, 0);
      if (Math.abs(s - h) > 0.005) F(o, `Buchung unausgeglichen: Soll ${s} ≠ Haben ${h}`);
      if (f.konten.length < 3) W(o, "sehr wenige Konten zur Auswahl");
      if (bewerten(f, { typ: "buchung", soll: f.soll.map(([a, b]) => [a, String(b)]), haben: f.haben.map(([a, b]) => [a, String(b)]) }) !== 1) F(o, "Musterbuchung wird nicht erkannt");
      break;
    }
    case "zuordnen":
      if (f.gruppen.length < 2) F(o, "weniger als 2 Gruppen");
      for (const [e, g] of f.elemente) { if (g < 0 || g >= f.gruppen.length) F(o, `Gruppe von „${e}“ ungültig`); formeln(o, e); }
      break;
    case "reihe": if (f.elemente.length < 2) F(o, "Reihe zu kurz"); f.elemente.forEach((x) => formeln(o, x)); break;
    case "karte": case "frei": formeln(o, f.antwort); if (!f.antwort.trim()) F(o, "keine Antwort"); break;
    case "wahr": break;
    default: F(o, `unbekannter Typ ${(f as any).typ}`);
  }
  loesungText(f);
}

const kurse = ["mathe", "rewe", "im", "bwl"].filter((k) => !nur || k === nur);
for (const id of kurse) {
  const datei = `${ordner}/${id}.json`;
  if (!existsSync(datei)) { console.log(`${id}: (keine Datei)`); continue; }
  const k: Kurs = JSON.parse(readFileSync(datei, "utf8"));
  if (!k.stand) F(id, "stand fehlt");
  if (k.id !== id) F(id, `id ist „${k.id}“`);
  formeln(id + "/format", k.format);
  // Skript-Markierungen: jede verwendete Markierung braucht einen Eintrag in der Legende des Kurses
  const MARKEN = ["stern", "gelb", "orange", "grau", "exkurs", "uebersicht"];
  const marken = (o: string, m: unknown) => { if (m === undefined) return; if (!Array.isArray(m) || !m.length) return F(o, "marke muss eine nicht leere Liste sein");
    for (const x of m) { if (!MARKEN.includes(x)) F(o, `unbekannte Markierung ${x}`); else if (!k.marken?.[x as keyof typeof k.marken]) F(o, `Markierung ${x} fehlt in der Legende des Kurses`); } };
  for (const [m, i] of Object.entries(k.marken ?? {})) { if (!MARKEN.includes(m)) F(id + "/marken", `unbekannte Markierung ${m}`); if (!i.name?.trim() || !i.kurz?.trim() || !i.text?.trim() || !i.ton) F(id + "/marken", `${m}: name, kurz, text und ton sind Pflicht`); }
  if (k.markenText !== undefined) formeln(id + "/markenText", k.markenText);
  const lids = new Set<string>(); let nf = 0, nl = 0, ng = 0, min = 0;
  const typen: Record<string, number> = {};
  for (const c of k.kapitel) {
    if (!c.lektionen.length) F(`${id}/${c.id}`, "Kapitel ohne Lektionen");
    for (const l of c.lektionen) {
      const o = `${id}/${l.id}`; nl++; min += l.dauer_min;
      if (!/^[a-z0-9-]{1,40}$/.test(l.id)) F(o, "Lektions-ID ungültig (a-z, 0-9, -; max. 40)");
      if (lids.has(l.id)) F(o, "Lektions-ID doppelt"); lids.add(l.id);
      formeln(o + "/ziel", l.ziel);
      if (!l.inhalt.length) F(o, "kein Inhalt");
      l.inhalt.forEach((b, i) => { baustein(`${o}/inhalt[${i}]`, b); marken(`${o}/inhalt[${i}]`, b.marke); });
      for (const m of Object.keys(l.marken ?? {})) marken(o + "/marken", [m]);
      const fids = new Set<string>();
      if (l.fragen.length < 4) W(o, `nur ${l.fragen.length} Fragen`);
      for (const f of l.fragen) {
        nf++; typen[f.typ] = (typen[f.typ] ?? 0) + 1;
        if (!/^[a-z0-9-]{1,40}$/.test(f.id)) F(`${o}/${f.id}`, "Fragen-ID ungültig");
        if (fids.has(f.id)) F(`${o}/${f.id}`, "Fragen-ID doppelt"); fids.add(f.id);
        frage(`${o}/${f.id}`, f); marken(`${o}/${f.id}`, f.marke);
      }
      for (const g of l.generatoren ?? []) {
        ng++;
        for (let s = 1; s <= 300; s++) {
          let f: Frage;
          try { f = erzeuge(g, s * 7919); } catch (e: any) { F(`${o}/${g.id}`, `Seed ${s}: ${e.message}`); break; }
          const n = fehler.length; frage(`${o}/${g.id}#${s}`, f, true);
          if (f.typ === "zahl" && (Math.abs(f.antwort) > 1e9 || Number.isNaN(f.antwort))) F(`${o}/${g.id}#${s}`, `unplausible Antwort ${f.antwort}`);
          if (fehler.length > n) break;
        }
      }
    }
  }
  console.log(`${id}: ${k.kapitel.length} Kapitel, ${nl} Lektionen (${Math.round(min / 60)} Std.), ${nf} Fragen ${JSON.stringify(typen)}, ${ng} Generatoren`);
}
void zahlLesen;
if (warnungen.length) { console.log(`\n${warnungen.length} Hinweise:`); for (const w of warnungen.slice(0, 80)) console.log("  · " + w); }
if (fehler.length) { console.log(`\n${fehler.length} FEHLER:`); for (const f of fehler) console.log("  ✗ " + f); process.exit(1); }
console.log("\nKeine Fehler.");
