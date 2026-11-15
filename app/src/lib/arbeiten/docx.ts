// Word-Datei (.docx) lesen: Absätze mit wirksamer Formatierung (Formatvorlagen aufgelöst), Fußnoten, Seitenränder, Fußzeilen.
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
export type Absatz = {
  i: number; text: string; stil: string; stilName: string;
  ebene: number | null;           // Überschriftenebene 1–9 (aus Gliederungsebene der Vorlage)
  schrift: string | null; pt: number | null; zeile: number | null; nachPt: number | null; ausrichtung: string | null; einzugLinksCm: number;
  fussnoten: string[];            // IDs der Fußnoten in diesem Absatz
  inTabelle: boolean; bild: boolean; feld: string;   // feld: Feldbefehle (z. B. TOC, PAGE)
  direktSchrift: Set<string>; direktPt: Set<number>;
};
export type Fussnote = { id: string; text: string; schrift: string | null; pt: number | null; zeile: number | null };
export type Dokument = {
  absaetze: Absatz[]; fussnoten: Map<string, Fussnote>;
  raender: { oben: number; unten: number; links: number; rechts: number } | null;   // cm
  fusszeileSeitenzahl: boolean; woerterWord: number | null; seitenWord: number | null;
};

type Stil = { id: string; name: string; basis: string | null; schrift: string | null; pt: number | null; zeile: number | null; nachPt: number | null; jc: string | null; ebene: number | null; einzug: number | null };

const el = (n: Element, name: string) => n.getElementsByTagNameNS(W, name);
const kind = (n: Element | null | undefined, name: string): Element | null => { if (!n) return null; for (const c of Array.from(n.children)) if (c.localName === name) return c; return null; };
const wv = (n: Element | null, a = "val") => n?.getAttributeNS(W, a) ?? n?.getAttribute("w:" + a) ?? null;
const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

function zeileVon(sp: Element | null): number | null {
  if (!sp) return null;
  const line = wv(sp, "line"), rule = wv(sp, "lineRule");
  if (!line) return null;
  if (!rule || rule === "auto") return Math.round((Number(line) / 240) * 100) / 100;
  return null;   // exakte Zeilenhöhe – nicht als Faktor vergleichbar
}
function stileLesen(doc: Document | null): { stile: Map<string, Stil>; standard: Stil } {
  const stile = new Map<string, Stil>();
  const leer: Stil = { id: "", name: "", basis: null, schrift: null, pt: null, zeile: null, nachPt: null, jc: null, ebene: null, einzug: null };
  if (!doc) return { stile, standard: leer };
  const def = el(doc.documentElement, "docDefaults")[0];
  const defR = def ? el(def, "rPr")[0] : null, defP = def ? el(def, "pPr")[0] : null;
  const standard: Stil = { ...leer, schrift: wv(kind(defR, "rFonts"), "ascii"), pt: kind(defR, "sz") ? Number(wv(kind(defR, "sz"))) / 2 : null,
    zeile: zeileVon(kind(defP, "spacing")), nachPt: kind(defP, "spacing") && wv(kind(defP, "spacing"), "after") != null ? Number(wv(kind(defP, "spacing"), "after")) / 20 : null };
  let vorgabe = "";
  for (const s of Array.from(el(doc.documentElement, "style"))) {
    if (wv(s, "type") !== "paragraph" && wv(s, "type") !== "character") continue;
    const id = wv(s, "styleId") ?? "", pPr = kind(s, "pPr"), rPr = kind(s, "rPr"), sp = kind(pPr, "spacing");
    const ol = kind(pPr, "outlineLvl");
    const name = wv(kind(s, "name")) ?? id;
    const hm = name.match(/^heading (\d)$/i);
    {
      stile.set(id, {
        id, name, basis: wv(kind(s, "basedOn")),
        schrift: wv(kind(rPr, "rFonts"), "ascii"), pt: kind(rPr, "sz") ? Number(wv(kind(rPr, "sz"))) / 2 : null,
        zeile: zeileVon(sp), nachPt: sp && wv(sp, "after") != null ? Number(wv(sp, "after")) / 20 : null,
        jc: wv(kind(pPr, "jc")), ebene: ol ? Number(wv(ol)) + 1 : hm ? Number(hm[1]) : null,
        einzug: kind(pPr, "ind") && wv(kind(pPr, "ind"), "left") != null ? Number(wv(kind(pPr, "ind"), "left")) / 567 : null,
      });
    }
    if (wv(s, "default") === "1" && wv(s, "type") === "paragraph") vorgabe = id;
  }
  stile.set("", stile.get(vorgabe) ?? leer);
  return { stile, standard };
}
/** Eigenschaft entlang der Vorlagen-Kette auflösen (Absatzvorlage → Basis → … → Standard) */
function aufloesen<K extends keyof Stil>(stile: Map<string, Stil>, standard: Stil, id: string, k: K): Stil[K] | null {
  const gesehen = new Set<string>();
  let s = stile.get(id) ?? stile.get("");
  while (s && !gesehen.has(s.id)) { gesehen.add(s.id); if (s[k] != null) return s[k]; s = s.basis != null ? stile.get(s.basis) : s.id !== (stile.get("")?.id ?? "") ? stile.get("") : undefined; }
  return (standard[k] ?? null) as Stil[K] | null;
}

function textVon(p: Element): string {
  let t = "";
  const lauf = (n: Element) => {
    for (const c of Array.from(n.children)) {
      if (c.localName === "t") t += c.textContent ?? "";
      else if (c.localName === "tab") t += "\t";
      else if (c.localName === "br" || c.localName === "cr") t += "\n";
      else if (c.localName === "noBreakHyphen") t += "-";
      else if (c.localName === "delText" || c.localName === "instrText" || c.localName === "footnoteReference" || c.localName === "endnoteReference") continue;
      else if (c.localName === "del") continue;   // gelöschte Änderungen nicht mitzählen
      else lauf(c);
    }
  };
  lauf(p); return t;
}

export function lesen(bytes: Uint8Array): Dokument {
  const z = unzipSync(bytes);
  const datei = (n: string) => (z[n] ? strFromU8(z[n]) : null);
  const docXml = datei("word/document.xml"); if (!docXml) throw new Error("Keine Word-Datei (word/document.xml fehlt)");
  const doc = xml(docXml), stylesXml = datei("word/styles.xml");
  const { stile, standard } = stileLesen(stylesXml ? xml(stylesXml) : null);
  const body = el(doc.documentElement, "body")[0];
  const absaetze: Absatz[] = [];
  for (const p of Array.from(el(body, "p"))) {
    const pPr = kind(p, "pPr"), stil = wv(kind(pPr, "pStyle")) ?? "", sp = kind(pPr, "spacing"), ind = kind(pPr, "ind");
    const direktSchrift = new Set<string>(), direktPt = new Set<number>();
    let schriftLauf: string | null = null, ptLauf: number | null = null;
    for (const r of Array.from(el(p, "r"))) {
      const rPr = kind(r, "rPr"); if (!kind(r, "t")) continue;
      const f = wv(kind(rPr, "rFonts"), "ascii"), sz = kind(rPr, "sz");
      const rs = wv(kind(rPr, "rStyle"));
      if (f) { direktSchrift.add(f); schriftLauf ??= f; }
      else if (rs && stile.get(rs)?.schrift) { direktSchrift.add(stile.get(rs)!.schrift!); schriftLauf ??= stile.get(rs)!.schrift; }
      if (sz) { const v = Number(wv(sz)) / 2; direktPt.add(v); ptLauf ??= v; }
    }
    const feld = Array.from(el(p, "instrText")).map((x) => x.textContent ?? "").join(" ") + " " + Array.from(el(p, "fldSimple")).map((x) => wv(x, "instr") ?? "").join(" ");
    const ebene = kind(pPr, "outlineLvl") ? Number(wv(kind(pPr, "outlineLvl"))) + 1 : aufloesen(stile, standard, stil, "ebene");
    absaetze.push({
      i: absaetze.length, text: textVon(p).replace(/ /g, " "), stil, stilName: stile.get(stil)?.name ?? stil,
      ebene: ebene && ebene <= 9 ? ebene : null,
      schrift: schriftLauf ?? aufloesen(stile, standard, stil, "schrift"),
      pt: ptLauf ?? aufloesen(stile, standard, stil, "pt"),
      zeile: zeileVon(sp) ?? aufloesen(stile, standard, stil, "zeile"),
      nachPt: sp && wv(sp, "after") != null ? Number(wv(sp, "after")) / 20 : aufloesen(stile, standard, stil, "nachPt"),
      ausrichtung: wv(kind(pPr, "jc")) ?? aufloesen(stile, standard, stil, "jc"),
      einzugLinksCm: ind && wv(ind, "left") != null ? Number(wv(ind, "left")) / 567 : (aufloesen(stile, standard, stil, "einzug") ?? 0),
      fussnoten: Array.from(el(p, "footnoteReference")).map((f) => wv(f, "id") ?? ""),
      inTabelle: (() => { let n: Element | null = p.parentElement; while (n) { if (n.localName === "tbl") return true; n = n.parentElement; } return false; })(),
      bild: el(p, "drawing").length > 0 || el(p, "pict").length > 0,
      feld, direktSchrift, direktPt,
    });
  }
  // Fußnoten
  const fussnoten = new Map<string, Fussnote>();
  const fnXml = datei("word/footnotes.xml");
  if (fnXml) for (const f of Array.from(el(xml(fnXml).documentElement, "footnote"))) {
    const id = wv(f, "id") ?? "", typ = wv(f, "type"); if (typ === "separator" || typ === "continuationSeparator" || typ === "continuationNotice") continue;
    const p = el(f, "p")[0], pPr = kind(p, "pPr"), stil = wv(kind(pPr, "pStyle")) ?? "";
    const r = Array.from(el(f, "r")).find((x) => kind(x, "t")), rPr = kind(r, "rPr");
    fussnoten.set(id, {
      id, text: Array.from(el(f, "p")).map(textVon).join(" ").trim(),
      schrift: wv(kind(rPr, "rFonts"), "ascii") ?? aufloesen(stile, standard, stil, "schrift"),
      pt: kind(rPr, "sz") ? Number(wv(kind(rPr, "sz"))) / 2 : aufloesen(stile, standard, stil, "pt"),
      zeile: zeileVon(kind(pPr, "spacing")) ?? aufloesen(stile, standard, stil, "zeile"),
    });
  }
  // Seitenränder (größter Abschnitt = Textteil)
  const mars = Array.from(el(body, "pgMar"));
  const m = mars[mars.length - 1];
  const cm = (a: string) => Math.round((Number(wv(m, a) ?? 0) / 567) * 100) / 100;
  const raender = m ? { oben: cm("top"), unten: cm("bottom"), links: cm("left"), rechts: cm("right") } : null;
  const fusszeileSeitenzahl = Object.keys(z).filter((n) => /^word\/footer\d*\.xml$/.test(n)).some((n) => /PAGE/.test(strFromU8(z[n])));
  const app = datei("docProps/app.xml");
  const zahl = (t: string) => { const mm = app?.match(new RegExp(`<${t}>(\\d+)</${t}>`)); return mm ? Number(mm[1]) : null; };
  return { absaetze, fussnoten, raender, fusszeileSeitenzahl, woerterWord: zahl("Words"), seitenWord: zahl("Pages") };
}

/** Wörter zählen wie Word: Folgen ohne Leerraum */
export const woerter = (t: string) => (t.match(/\S+/g) ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// ---------- Formatierung korrigieren (Schrift, Größe, Zeilenabstand, Absatzabstand, Blocksatz, Ränder, Fußnoten)
export type Korrektur = { schrift: string; pt: number; zeile: number; nachPt: number; fussnotePt: number; fussnoteZeile: number; raender: { oben: number; unten: number; links: number; rechts: number }; blocksatz: boolean };
export function formatieren(bytes: Uint8Array, k: Korrektur): { bytes: Uint8Array; schritte: string[] } {
  const z = unzipSync(bytes), schritte: string[] = [];
  const ser = (d: Document) => new XMLSerializer().serializeToString(d);
  const neu = (d: Document, name: string) => d.createElementNS(W, "w:" + name);
  const setze = (d: Document, eltern: Element, name: string, attrs: Record<string, string>, vorn = false) => {
    let e = kind(eltern, name);
    if (!e) { e = neu(d, name); if (vorn && eltern.firstChild) eltern.insertBefore(e, eltern.firstChild); else eltern.appendChild(e); }
    for (const [a, v] of Object.entries(attrs)) e.setAttributeNS(W, "w:" + a, v);
    return e;
  };
  const sicher = (d: Document, eltern: Element, name: string, vorn = true) => kind(eltern, name) ?? (() => { const e = neu(d, name); if (vorn && eltern.firstChild) eltern.insertBefore(e, eltern.firstChild); else eltern.appendChild(e); return e; })();
  const halb = String(Math.round(k.pt * 2)), zeile = String(Math.round(k.zeile * 240)), nach = String(Math.round(k.nachPt * 20));
  // Formatvorlagen
  let fnStil: string | null = null;
  if (z["word/styles.xml"]) {
    const d = xml(strFromU8(z["word/styles.xml"]));
    for (const s of Array.from(el(d.documentElement, "style"))) {
      if (wv(s, "type") !== "paragraph") continue;
      const name = (wv(kind(s, "name")) ?? "").toLowerCase(), standard = wv(s, "default") === "1";
      const fussnote = name === "footnote text";
      if (!standard && !fussnote && !/^heading \d$/.test(name)) continue;
      const rPr = sicher(d, s, "rPr", false), pPr = sicher(d, s, "pPr", false);
      setze(d, rPr, "rFonts", { ascii: k.schrift, hAnsi: k.schrift, cs: k.schrift });
      if (standard) {
        setze(d, rPr, "sz", { val: halb }); setze(d, rPr, "szCs", { val: halb });
        setze(d, pPr, "spacing", { line: zeile, lineRule: "auto", after: nach });
        if (k.blocksatz) setze(d, pPr, "jc", { val: "both" });
        schritte.push(`Formatvorlage „Standard“: ${k.schrift} ${k.pt} pt, Zeilenabstand ${String(k.zeile).replace(".", ",")}, ${k.nachPt} pt nach dem Absatz${k.blocksatz ? ", Blocksatz" : ""}`);
      }
      if (fussnote) {
        fnStil = s.getAttributeNS(W, "styleId") || s.getAttribute("w:styleId");
        setze(d, rPr, "sz", { val: String(k.fussnotePt * 2) }); setze(d, rPr, "szCs", { val: String(k.fussnotePt * 2) });
        setze(d, pPr, "spacing", { line: String(Math.round(k.fussnoteZeile * 240)), lineRule: "auto", after: "0" });
        schritte.push(`Formatvorlage „Fußnotentext“: ${k.fussnotePt} pt, Zeilenabstand ${String(k.fussnoteZeile).replace(".", ",")}`);
      }
    }
    z["word/styles.xml"] = strToU8(ser(d));
  }
  // Text: direkte Schrift/Größe/Zeilenabstand in normalen Absätzen entfernen (Überschriften, Tabellen, Beschriftungen bleiben)
  const d = xml(strFromU8(z["word/document.xml"]));
  let entfernt = 0;
  for (const p of Array.from(el(d.documentElement, "p"))) {
    const pPr = kind(p, "pPr"), stil = wv(kind(pPr, "pStyle"));
    let n: Element | null = p.parentElement, tab = false; while (n) { if (n.localName === "tbl") tab = true; n = n.parentElement; }
    if (stil || tab) continue;
    const sp = kind(pPr, "spacing"); if (sp && (sp.hasAttributeNS(W, "line") || sp.hasAttributeNS(W, "after"))) { sp.removeAttributeNS(W, "line"); sp.removeAttributeNS(W, "lineRule"); sp.removeAttributeNS(W, "after"); entfernt++; }
    for (const r of Array.from(el(p, "r"))) {
      const rPr = kind(r, "rPr"); if (!rPr) continue;
      for (const name of ["rFonts", "sz", "szCs"]) { const e = kind(rPr, name); if (e) { rPr.removeChild(e); entfernt++; } }
    }
  }
  if (entfernt) schritte.push(`${entfernt} abweichende Einzelformatierungen im Fließtext entfernt (Text übernimmt jetzt die Vorlage)`);
  // Fußnoten: Vorlage „Fußnotentext“ zuweisen, abweichende Einzelformatierung entfernen
  if (z["word/footnotes.xml"]) {
    const f = xml(strFromU8(z["word/footnotes.xml"]));
    let n = 0;
    for (const fn of Array.from(el(f.documentElement, "footnote"))) {
      if (wv(fn, "type") === "separator" || wv(fn, "type") === "continuationSeparator") continue;
      for (const p of Array.from(el(fn, "p"))) {
        const pPr = sicher(f, p, "pPr");
        if (fnStil) setze(f, pPr, "pStyle", { val: fnStil }, true);
        const sp = kind(pPr, "spacing");
        if (fnStil) { if (sp) pPr.removeChild(sp); } else setze(f, pPr, "spacing", { line: String(Math.round(k.fussnoteZeile * 240)), lineRule: "auto", after: "0" });
        for (const r of Array.from(el(p, "r"))) {
          const rPr = kind(r, "rPr"); if (rPr && kind(rPr, "rStyle")) continue;   // Fußnotenzeichen behalten
          const rp = rPr ?? sicher(f, r, "rPr");
          for (const name of ["rFonts", "sz", "szCs"]) { const e = kind(rp, name); if (e) rp.removeChild(e); }
          if (!fnStil) { setze(f, rp, "rFonts", { ascii: k.schrift, hAnsi: k.schrift, cs: k.schrift }); setze(f, rp, "sz", { val: String(k.fussnotePt * 2) }); }
        }
        n++;
      }
    }
    z["word/footnotes.xml"] = strToU8(ser(f));
    if (n) schritte.push(`${n} Fußnoten auf ${k.fussnotePt} pt und Zeilenabstand ${String(k.fussnoteZeile).replace(".", ",")} gesetzt`);
  }
  // Ränder
  const tw = (c: number) => String(Math.round(c * 567));
  let r = 0;
  for (const m of Array.from(el(d.documentElement, "pgMar"))) { m.setAttributeNS(W, "w:top", tw(k.raender.oben)); m.setAttributeNS(W, "w:bottom", tw(k.raender.unten)); m.setAttributeNS(W, "w:left", tw(k.raender.links)); m.setAttributeNS(W, "w:right", tw(k.raender.rechts)); r++; }
  if (r) schritte.push(`Seitenränder: oben ${k.raender.oben} cm, unten ${k.raender.unten} cm, links ${k.raender.links} cm, rechts ${k.raender.rechts} cm`);
  z["word/document.xml"] = strToU8(ser(d));
  return { bytes: zipSync(z, { level: 6 }), schritte };
}
