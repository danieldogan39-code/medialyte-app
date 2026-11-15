// Automatischer Prüfer: liest eine Hausarbeit (.docx) und prüft sie gegen das Regelwerk der ISM.
// Jeder Befund nennt die Regel (mit Fundstelle im Regelwerk), die Stellen im Dokument und wie man es behebt.
import type { Absatz, Dokument } from "./docx";
import { woerter } from "./docx";
import type { Arbeit, Befund, Regelwerk } from "./typen";

export type Statistik = { woerter: number; woerterWord: number | null; seiten: number | null; fussnoten: number; quellen: number; zitate: number; abbildungen: number; tabellen: number; kapitel: number };
export type Ergebnis = { befunde: Befund[]; stat: Statistik; teile: { teil: string; i: number }[] };

const kurz = (t: string, n = 70) => (t.length > n ? t.slice(0, n - 1).trim() + "…" : t).replace(/\s+/g, " ");
const zahl = (n: number) => n.toLocaleString("de-DE");
const re = (m: string) => { try { return new RegExp(m, "i"); } catch { return null; } };
const istVerzeichnisEintrag = (a: Absatz) => /^(toc|verzeichnis|inhaltsverzeichnis)\s*\d/i.test(a.stilName) || /^toc \d/i.test(a.stilName);
const istBeschriftung = (a: Absatz) => /caption|beschriftung/i.test(a.stilName) || /^(abbildung|abb\.|tabelle|tab\.)\s*\d+\s*:/i.test(a.text.trim());
const istQuellenzeile = (a: Absatz) => /^quelle\s*:/i.test(a.text.trim());

export function pruefen(dok: Dokument, rw: Regelwerk, arbeit: Pick<Arbeit, "woerter_ziel" | "toleranz" | "min_quellen" | "max_zitate" | "zitierweise">, kiEintraege: number): Ergebnis {
  const B: Befund[] = [];
  const add = (b: Befund) => B.push(b);
  // Prüfer-IDs → Regel-IDs im Regelwerk (für die Fundstelle)
  const ALIAS: Record<string, string> = { schrift: "schriftart", absatz: "absatzabstand", seitenzahl: "seitenzahl-position", fussnote: "fussnote-groesse", vgl: "vgl-indirekt", ebd: "kein-ebd", "zitate-max": "direkt-max", "quellen-verboten": "verbot-wikipedia", "lv-format": "lv-oj", "lv-alphabet": "lv-sortierung", abgleich: "lv-vollstaendig", "eid-wortzahl": "erklaerung-eid", ki: "erklaerung-ki", vorlage: "erklaerung-vorlagen", umfang: "umfang-toleranz", gliederung: "gliederung-paare", sprache: "keine-ich-wir-man" };
  const regelQuelle = (id: string) => rw.regeln.find((r) => r.id === (ALIAS[id] ?? id))?.quelle;
  const A = dok.absaetze;

  // ---------- Teile der Arbeit finden (Überschriften bzw. Titelzeilen, keine Verzeichniseinträge)
  const titelKandidat = (a: Absatz) => a.text.trim().length > 0 && a.text.trim().length < 90 && !a.inTabelle && !istVerzeichnisEintrag(a) && (a.ebene != null || (a.pt ?? 0) >= 12 || /^[A-ZÄÖÜ]/.test(a.text.trim()));
  const teile: { teil: string; i: number }[] = [];
  const ohneNr = (t: string) => t.trim().replace(/^[\dIVX]+(\.\d+)*\.?\s+/, "");
  for (const t of rw.aufbau) {
    let m: RegExp | null = null; try { m = new RegExp("^\\s*(?:" + t.erkennung.join("|") + ")", "i"); } catch { m = null; }
    if (!m) continue;
    // Am Zeilenanfang (sicher) – bei echten Überschriften/Titelvorlagen auch mitten im Titel („Erklärung zur Plagiatsprüfung …“)
    const frei = new RegExp("(?:" + t.erkennung.join("|") + ")", "i");
    const titelVorlage = (a: Absatz) => a.ebene != null || (!!a.stilName && !/^(normal|standard|list|listenabsatz|body|textk)/i.test(a.stilName));
    const treffer = A.find((a) => titelKandidat(a) && ohneNr(a.text).length < 80 && m!.test(ohneNr(a.text))) ?? A.find((a) => titelKandidat(a) && titelVorlage(a) && a.text.trim().length < 90 && frei.test(a.text));
    if (treffer) teile.push({ teil: t.teil, i: treffer.i });
  }
  // Hauptteil: Kapitel der 1. Ebene zwischen Einleitung und Schluss (Nummern vergibt Word oft automatisch)
  const hpt = rw.aufbau.find((t) => /hauptteil/i.test(t.teil));
  if (hpt && !teile.some((t) => t.teil === hpt.teil)) {
    const ein = teile.find((t) => /einleitung/i.test(t.teil))?.i ?? -1, sch = teile.find((t) => /schluss|fazit/i.test(t.teil))?.i ?? A.length;
    const k = A.find((a) => a.i > ein && a.i < sch && a.ebene === 1 && a.text.trim() && !istVerzeichnisEintrag(a) && !a.inTabelle && ein >= 0);
    if (k) teile.push({ teil: hpt.teil, i: k.i });
  }
  const pos = (name: RegExp) => teile.find((t) => name.test(t.teil))?.i ?? -1;
  const ivz = pos(/inhaltsverzeichnis/i), lvz = pos(/literatur|quellenverzeichnis/i);
  const ueberschriften = A.filter((a) => a.ebene != null && a.text.trim() && !istVerzeichnisEintrag(a) && !a.inTabelle);
  // Textteil: erste Kapitelüberschrift nach dem Inhaltsverzeichnis bis zum Literaturverzeichnis
  const verzeichnisTitel = new Set(teile.filter((t) => !/einleitung|hauptteil|schluss|fazit/i.test(t.teil)).map((t) => t.i));
  const ersteKapitel = ueberschriften.find((a) => a.i > Math.max(ivz, -1) && !verzeichnisTitel.has(a.i) && a.ebene === 1);
  const einl = pos(/einleitung/i);
  const start = einl > ivz ? einl : ersteKapitel?.i ?? Math.max(ivz + 1, 0);
  const ende = lvz > start ? lvz : (teile.filter((t) => t.i > start).sort((x, y) => x.i - y.i)[0]?.i ?? A.length);
  const textteil = A.slice(start, ende);
  const fliess = textteil.filter((a) => a.text.trim() && a.ebene == null && !a.inTabelle && !istBeschriftung(a) && !istQuellenzeile(a) && !istVerzeichnisEintrag(a));

  // ---------- Umfang
  const fnImText = textteil.flatMap((a) => a.fussnoten).map((id) => dok.fussnoten.get(id)).filter(Boolean);
  const wText = textteil.filter((a) => a.text.trim() && !a.inTabelle && !istBeschriftung(a) && !istQuellenzeile(a)).reduce((n, a) => n + woerter(a.text), 0);
  const wFn = rw.umfang.zaehlt_fussnoten ? fnImText.reduce((n, f) => n + woerter(f!.text), 0) : 0;
  const w = wText + wFn;
  if (arbeit.woerter_ziel) {
    const tol = (arbeit.toleranz ?? rw.umfang.toleranz_prozent) / 100, min = Math.floor(arbeit.woerter_ziel * (1 - tol)), max = Math.ceil(arbeit.woerter_ziel * (1 + tol));
    const ok = w >= min && w <= max;
    add({ id: "umfang", regel: "umfang", gruppe: "Umfang", status: ok ? (w < min * 1.02 || w > max * 0.98 ? "hinweis" : "ok") : "fehler",
      titel: `${zahl(w)} Wörter${ok ? "" : w < min ? ` – ${zahl(min - w)} zu wenig` : ` – ${zahl(w - max)} zu viel`}`,
      detail: `Erlaubt: ${zahl(min)}–${zahl(max)} Wörter (${zahl(arbeit.woerter_ziel)} ± ${Math.round(tol * 100)} %). Gezählt: Textteil ${zahl(wText)}${rw.umfang.zaehlt_fussnoten ? ` + Fußnoten ${zahl(wFn)}` : ""}. ${rw.umfang.zaehlt}`,
      tipp: ok ? undefined : w < min ? "Argumentation vertiefen (Beispiele, Belege, Gegenpositionen) – nicht mit Füllwörtern strecken." : "Wiederholungen streichen, Beispiele kürzen, Nebenaspekte in den Anhang (zählt laut Vorgabe nicht) – nur, was die Forschungsfrage beantwortet." });
  }
  if (dok.woerterWord != null && Math.abs(dok.woerterWord - w) > 0) add({ id: "umfang-word", gruppe: "Umfang", status: "ok", titel: `Word zählt ${zahl(dok.woerterWord)} Wörter im ganzen Dokument`, detail: "Für die Vorgabe zählt nur der Textteil (siehe oben), nicht Deckblatt, Verzeichnisse und Erklärungen." });

  // ---------- Platzhalter / Hinweise aus der Vorlage
  const platzhalter = A.filter((a) => /_{4,}|\(Format(vorlage)?:|\bTEXT\b|\[…\]|…\s*Wörter|20_{2,}|O Erstversuch/.test(a.text) && !/^_{4,}$/.test(a.text.trim()));
  add({ id: "platzhalter", regel: "vorlage", gruppe: "Abgabe", status: platzhalter.length ? "fehler" : "ok", titel: platzhalter.length ? `${platzhalter.length} Platzhalter aus der Vorlage nicht ersetzt` : "Keine Platzhalter der Vorlage mehr im Text", stellen: platzhalter.slice(0, 8).map((a) => kurz(a.text)), tipp: "Deckblatt ausfüllen (Semester, Versuch ankreuzen), Hinweise wie „(Formatvorlage: Überschrift 1)“ löschen, in der Eidesstattlichen Erklärung die Wortzahl eintragen." });

  // ---------- Aufbau
  const bilder = A.filter((a) => a.bild).length, abbBeschr = A.filter((a) => /^(abbildung|abb\.)\s*\d+/i.test(a.text.trim())).length, tabBeschr = A.filter((a) => /^(tabelle|tab\.)\s*\d+/i.test(a.text.trim())).length;
  const abk = new Set((fliess.map((a) => a.text).join(" ").match(/\b[A-ZÄÖÜ]{2,6}\b/g) ?? []));
  for (const t of rw.aufbau) {
    const da = teile.some((x) => x.teil === t.teil);
    let noetig = t.pflicht === "immer";
    if (t.pflicht === "bedingt") {
      if (/abbildung/i.test(t.teil)) noetig = bilder + abbBeschr > 0;
      else if (/tabelle/i.test(t.teil)) noetig = tabBeschr > 0;
      else if (/abkürzung/i.test(t.teil)) noetig = abk.size >= 3;
      else if (/ki|künstliche/i.test(t.teil)) noetig = kiEintraege > 0;
      else noetig = false;
    }
    if (noetig && !da) add({ id: "teil-" + t.teil, gruppe: "Aufbau", status: t.pflicht === "immer" ? "fehler" : "hinweis", titel: `„${t.teil}“ fehlt`, detail: t.bedingung ? `Pflicht, ${t.bedingung}` : "Pflichtteil der Arbeit.", tipp: `Teil „${t.teil}“ mit genau dieser Überschrift ergänzen (Fundstelle: ${t.quelle}).` });
    else if (!noetig && da && t.pflicht === "bedingt" && /abbildung|tabelle/i.test(t.teil)) add({ id: "teil-leer-" + t.teil, gruppe: "Aufbau", status: "hinweis", titel: `„${t.teil}“ vorhanden, aber keine ${/abbildung/i.test(t.teil) ? "Abbildungen" : "Tabellen"} gefunden`, tipp: "Leeres Verzeichnis löschen oder Beschriftungen über Verweise → Beschriftung einfügen." });
  }
  // Reihenfolge
  const soll = rw.aufbau.map((t) => t.teil), ist = [...teile].sort((x, y) => x.i - y.i).map((t) => t.teil);
  const falsch = ist.filter((t, k) => k > 0 && soll.indexOf(t) < soll.indexOf(ist[k - 1]));
  add({ id: "reihenfolge", gruppe: "Aufbau", status: falsch.length ? "fehler" : "ok", titel: falsch.length ? "Teile in falscher Reihenfolge" : `Aufbau in richtiger Reihenfolge (${ist.length} Teile erkannt)`, detail: falsch.length ? `Soll: ${soll.filter((t) => ist.includes(t)).join(" → ")}` : ist.join(" → ") });

  // ---------- Gliederung (Nummerierung entsteht in Word automatisch; geprüft wird die Struktur)
  const kap = ueberschriften.filter((a) => a.i >= start && a.i < ende);
  const nummern: string[] = []; const zaehler = [0, 0, 0, 0, 0, 0];
  const einzeln: string[] = [];
  for (let k = 0; k < kap.length; k++) {
    const e = kap[k].ebene!; zaehler[e - 1]++; for (let j = e; j < 6; j++) zaehler[j] = 0;
    nummern.push(zaehler.slice(0, e).join("."));
  }
  for (let k = 0; k < kap.length; k++) {
    const e = kap[k].ebene!; let kinder = 0;
    for (let j = k + 1; j < kap.length && kap[j].ebene! > e; j++) if (kap[j].ebene === e + 1) kinder++;
    if (kinder === 1) einzeln.push(`${nummern[k]} ${kurz(ohneNr(kap[k].text), 50)}`);
  }
  add({ id: "gliederung-einzeln", regel: "gliederung", gruppe: "Aufbau", status: einzeln.length ? "fehler" : "ok", titel: einzeln.length ? `${einzeln.length} Kapitel mit nur einem Unterpunkt` : "Gliederung logisch (kein einzelner Unterpunkt)", stellen: einzeln, tipp: "Wer 2.1 sagt, muss auch 2.2 sagen: zweiten Unterpunkt ergänzen oder den einzelnen Unterpunkt ins Oberkapitel ziehen." });
  const tief = kap.filter((a) => a.ebene! > 3);
  if (tief.length) add({ id: "gliederung-tief", gruppe: "Aufbau", status: "hinweis", titel: `${tief.length} Überschriften tiefer als 3 Ebenen`, stellen: tief.slice(0, 5).map((a) => kurz(a.text)), tipp: "Bei 3.000 Wörtern reichen meist zwei, höchstens drei Ebenen." });
  const ohneText = kap.filter((a, k) => { const n = kap[k + 1]; const zwischen = A.slice(a.i + 1, n ? n.i : ende).filter((x) => x.text.trim() && x.ebene == null); return zwischen.length === 0 && (!n || n.ebene! <= a.ebene!); });
  if (ohneText.length) add({ id: "kapitel-leer", gruppe: "Aufbau", status: "hinweis", titel: `${ohneText.length} Kapitel ohne Text`, stellen: ohneText.map((a) => kurz(a.text)) });

  // ---------- Layout
  const L = rw.layout, norm = (s: string | null) => (s ?? "").toLowerCase().trim();
  const erlaubt = L.schriften.map((s) => ({ ...s, n: norm(s.name) }));
  const haupt = (() => { const c = new Map<string, number>(); for (const a of fliess) c.set(norm(a.schrift), (c.get(norm(a.schrift)) ?? 0) + 1); return [...c.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? ""; })();
  const hauptOk = erlaubt.some((s) => s.n === haupt);
  // falsch: nicht erlaubte Schrift ODER abweichend von der Hauptschrift (Vorgabe: einheitlich)
  const schriftFalsch = fliess.filter((a) => !hauptOk || norm(a.schrift) !== haupt || [...a.direktSchrift].some((f) => norm(f) !== haupt));
  const sollPt = erlaubt.find((s) => s.n === haupt)?.pt ?? erlaubt[0]?.pt;
  add({ id: "schrift", regel: "schrift", gruppe: "Layout", status: schriftFalsch.length ? "fehler" : "ok", titel: !hauptOk && fliess.length ? `Schrift ${fliess[0]?.schrift ?? "?"} ist nicht erlaubt` : schriftFalsch.length ? `${schriftFalsch.length} Absätze in abweichender Schrift` : `Schrift einheitlich: ${fliess[0]?.schrift ?? "–"}`, detail: `Erlaubt: ${L.schriften.map((s) => `${s.name} ${s.pt} pt`).join(" oder ")} – einheitlich in der ganzen Arbeit.`, stellen: schriftFalsch.slice(0, 6).map((a) => `${a.schrift ?? "?"}${a.direktSchrift.size ? ` (+ ${[...a.direktSchrift].join(", ")})` : ""}: ${kurz(a.text, 50)}`), tipp: "Alles markieren (Strg+A) → Schriftart wählen, oder unten „Formatierung automatisch korrigieren“." });
  const ptFalsch = fliess.filter((a) => (a.pt != null && a.pt !== sollPt) || [...a.direktPt].some((p) => p !== sollPt));
  add({ id: "groesse", regel: "schrift", gruppe: "Layout", status: ptFalsch.length ? "fehler" : "ok", titel: ptFalsch.length ? `${ptFalsch.length} Absätze nicht in ${sollPt} pt` : `Schriftgröße ${sollPt} pt im Fließtext`, stellen: ptFalsch.slice(0, 6).map((a) => `${a.pt ?? "?"} pt: ${kurz(a.text, 50)}`) });
  const block = fliess.filter((a) => a.einzugLinksCm >= 0.9);   // eingerückte Blockzitate
  const normal = fliess.filter((a) => a.einzugLinksCm < 0.9);
  const zeileFalsch = normal.filter((a) => a.zeile != null && Math.abs(a.zeile - L.zeilenabstand) > 0.05);
  add({ id: "zeilenabstand", regel: "zeilenabstand", gruppe: "Layout", status: zeileFalsch.length ? "fehler" : "ok", titel: zeileFalsch.length ? `${zeileFalsch.length} Absätze nicht mit Zeilenabstand ${String(L.zeilenabstand).replace(".", ",")}` : `Zeilenabstand ${String(L.zeilenabstand).replace(".", ",")} im Fließtext`, stellen: zeileFalsch.slice(0, 6).map((a) => `${String(a.zeile).replace(".", ",")}: ${kurz(a.text, 50)}`), tipp: "Absatz → Zeilenabstand → Mehrfach/1,5 Zeilen – oder automatisch korrigieren." });
  const nachFalsch = normal.filter((a) => a.nachPt != null && Math.abs(a.nachPt - L.absatz_nach_pt) > 0.5);
  if (L.absatz_nach_pt != null) add({ id: "absatz", regel: "absatz", gruppe: "Layout", status: nachFalsch.length ? "hinweis" : "ok", titel: nachFalsch.length ? `${nachFalsch.length} Absätze ohne ${L.absatz_nach_pt} pt Abstand danach` : `${L.absatz_nach_pt} pt Abstand nach Absätzen`, stellen: nachFalsch.slice(0, 5).map((a) => `${a.nachPt} pt: ${kurz(a.text, 50)}`) });
  if (L.blocksatz) { const nb = normal.filter((a) => a.ausrichtung && a.ausrichtung !== "both" && a.ausrichtung !== "distribute"); add({ id: "blocksatz", regel: "blocksatz", gruppe: "Layout", status: nb.length ? "fehler" : "ok", titel: nb.length ? `${nb.length} Absätze nicht im Blocksatz` : "Blocksatz im Fließtext", stellen: nb.slice(0, 5).map((a) => kurz(a.text, 60)) }); }
  const leer = (() => { let n = 0, max = 0; for (const a of textteil) { if (!a.text.trim() && !a.bild) { n++; max = Math.max(max, n); } else n = 0; } return max; })();
  if (leer >= 2) add({ id: "leerzeilen", gruppe: "Layout", status: "hinweis", titel: "Abstände mit leeren Absätzen gemacht", tipp: "Statt Leerzeilen den Absatzabstand der Formatvorlage nutzen (6 pt danach)." });
  if (dok.raender) {
    const r = dok.raender, s = L.raender_cm, ab = (x: number, y: number) => Math.abs(x - y) > 0.1;
    const f = ab(r.oben, s.oben) || ab(r.unten, s.unten) || ab(r.links, s.links) || ab(r.rechts, s.rechts);
    add({ id: "raender", regel: "raender", gruppe: "Layout", status: f ? "fehler" : "ok", titel: f ? "Seitenränder weichen ab" : "Seitenränder stimmen", detail: `Ist: oben ${r.oben}, unten ${r.unten}, links ${r.links}, rechts ${r.rechts} cm · Soll: oben ${s.oben}, unten ${s.unten}, links ${s.links}, rechts ${s.rechts} cm` });
  }
  add({ id: "seitenzahl", regel: "seitenzahl", gruppe: "Layout", status: dok.fusszeileSeitenzahl ? "ok" : "fehler", titel: dok.fusszeileSeitenzahl ? "Seitenzahlen vorhanden" : "Keine Seitenzahlen gefunden", detail: L.seitenzahl, tipp: dok.fusszeileSeitenzahl ? undefined : "Einfügen → Seitenzahl → Seitenende rechts." });

  // ---------- Fußnoten
  const fn = [...dok.fussnoten.values()];
  if (arbeit.zitierweise === "fussnoten") {
    const fnPt = fn.filter((f) => f.pt != null && f.pt !== L.fussnote_pt), fnZeile = fn.filter((f) => f.zeile != null && Math.abs(f.zeile - L.zeilenabstand_fussnote) > 0.05);
    add({ id: "fussnoten-format", regel: "fussnote", gruppe: "Layout", status: fnPt.length || fnZeile.length ? "fehler" : fn.length ? "ok" : "hinweis", titel: !fn.length ? "Keine Fußnoten – zitierst du mit Fußnoten?" : fnPt.length || fnZeile.length ? `${fnPt.length + fnZeile.length} Fußnoten falsch formatiert` : `${fn.length} Fußnoten in ${L.fussnote_pt} pt, Zeilenabstand ${String(L.zeilenabstand_fussnote).replace(".", ",")}`, stellen: [...fnPt, ...fnZeile].slice(0, 5).map((f) => `[${f.id}] ${f.pt} pt / ${f.zeile}: ${kurz(f.text, 40)}`) });
    const ohnePunkt = fn.filter((f) => f.text && !/[.!?]["“”»]?$/.test(f.text.trim()));
    if (ohnePunkt.length && (rw.zitieren as any).fussnote_punkt === true) add({ id: "fussnoten-punkt", regel: "fussnote-punkt", gruppe: "Zitieren", status: "fehler", titel: `${ohnePunkt.length} Fußnoten enden ohne Punkt`, stellen: ohnePunkt.slice(0, 6).map((f) => kurz(f.text, 60)), tipp: "Jede Fußnote ist ein Satz und endet mit einem Punkt." });
    const belege = fn.filter((f) => /\(?\d{4}[a-z]?\)?|o\. ?J\./.test(f.text));
    const ohneSeite = rw.zitieren.seitenangabe_pflicht ? belege.filter((f) => !/\d{4}[a-z]?\s*:\s*(\d|Position|[IVX]+\b)|\bS\.\s*\d|\bo\. ?S\.|\bAbs\.|§|\bpara\.|\bp\.\s*\d|https?:|www\.|\bINT\b/i.test(f.text)) : [];
    if (ohneSeite.length) add({ id: "fussnoten-seite", regel: "seitenangabe", gruppe: "Zitieren", status: "hinweis", titel: `${ohneSeite.length} Belege ohne Seitenangabe`, detail: "Bei Büchern und Aufsätzen ist die Seite Pflicht; nur bei Internetquellen ohne Seiten darf sie entfallen.", stellen: ohneSeite.slice(0, 6).map((f) => kurz(f.text, 60)), tipp: "ISM-Kurzbeleg mit Seite: „vgl. Müller 2023: 12“ (zwei Seiten: „23f.“, Bereich: „23–24“)." });
    if (rw.zitieren.indirekt_praefix) {
      const p = rw.zitieren.indirekt_praefix.replace(".", "\\.");
      const mitVgl = belege.filter((f) => new RegExp("^" + p, "i").test(f.text.trim())).length;
      add({ id: "fussnoten-vgl", regel: "vgl", gruppe: "Zitieren", status: belege.length && mitVgl === 0 ? "hinweis" : "ok", titel: `${mitVgl} von ${belege.length} Belegen mit „${rw.zitieren.indirekt_praefix}“`, detail: `Indirekte Zitate (sinngemäß) beginnen mit „${rw.zitieren.indirekt_praefix}“, direkte (wörtlich, in Anführungszeichen) ohne.`, tipp: belege.length && mitVgl === 0 ? "Fast jede Arbeit hat überwiegend indirekte Zitate – prüfe, ob „vgl.“ fehlt." : undefined });
    }
    const fremd = belege.filter((f) => /\(\s*\d{4}[a-z]?\s*\)|\d{4}[a-z]?\)?,\s*S\.\s*\d|^\s*Vgl\./.test(f.text.trim()));
    if (fremd.length && /vgl\./.test(rw.zitieren.indirekt_praefix ?? "")) add({ id: "kurzbeleg-format", regel: "kurzbeleg", gruppe: "Zitieren", status: "fehler", titel: `${fremd.length} Kurzbelege nicht im ISM-Format`, detail: "ISM-Kurzbeleg: „vgl. Müller 2023: 12“ – Jahr ohne Klammern, Doppelpunkt vor der Seite, ohne „S.“, „vgl.“ klein.", stellen: fremd.slice(0, 6).map((f) => kurz(f.text, 60)) });
    if (rw.zitieren.ebd_erlaubt === false) { const ebd = fn.filter((f) => /\bebd\.|\bebenda\b/i.test(f.text)); if (ebd.length) add({ id: "ebd", regel: "ebd", gruppe: "Zitieren", status: "fehler", titel: `„ebd.“ in ${ebd.length} Fußnoten – laut Vorgabe nicht verwenden`, stellen: ebd.slice(0, 5).map((f) => kurz(f.text, 60)) }); }
  }

  // ---------- Direkte Zitate
  const zit: { text: string; w: number; a: Absatz }[] = [];
  for (const a of fliess) for (const m of a.text.matchAll(/[„"“]([^„"“”]{2,}?)[“”"]/g)) zit.push({ text: m[1], w: woerter(m[1]), a });
  const blockZitate = block.filter((a) => woerter(a.text) > 10);
  const anzahl = zit.filter((z) => z.w >= 4).length + blockZitate.length;
  const maxZ = arbeit.max_zitate ?? rw.zitieren.direkt_max_anzahl;
  if (maxZ != null) add({ id: "zitate-anzahl", regel: "zitate-max", gruppe: "Zitieren", status: anzahl > maxZ ? "fehler" : "ok", titel: `${anzahl} direkte Zitate (höchstens ${maxZ})`, stellen: anzahl > maxZ ? zit.filter((z) => z.w >= 4).map((z) => `„${kurz(z.text, 60)}“`).slice(0, 8) : undefined, tipp: anzahl > maxZ ? "Überzählige wörtliche Zitate in eigene Worte fassen (indirekt, mit „vgl.“)." : undefined });
  const grenze = rw.zitieren.direkt_max_woerter_inline ?? 40;   // ISM: Blockzitat ab mehr als drei Zeilen (≈ 40 Wörter)
  if (grenze) { const lang = zit.filter((z) => z.w > grenze && z.a.einzugLinksCm < 0.9); if (lang.length) add({ id: "zitate-block", regel: "blockzitat", gruppe: "Zitieren", status: "fehler", titel: `${lang.length} lange Zitate nicht als Blockzitat`, detail: `Zitate über drei Zeilen (ca. ${grenze} Wörter) stehen als Blockzitat: einzeilig, 1 cm Einzug links und rechts.`, stellen: lang.map((z) => `${z.w} Wörter: „${kurz(z.text, 50)}“`) }); }
  const zitOhneFn = fliess.filter((a) => /[„"“][^„"“”]{8,}[“”"]/.test(a.text) && a.fussnoten.length === 0);
  if (arbeit.zitierweise === "fussnoten" && zitOhneFn.length) add({ id: "zitat-ohne-beleg", gruppe: "Zitieren", status: "fehler", titel: `${zitOhneFn.length} Absätze mit Zitat, aber ohne Fußnote`, stellen: zitOhneFn.slice(0, 5).map((a) => kurz(a.text, 70)), tipp: "Jedes Zitat braucht direkt danach eine Fußnote mit Kurzbeleg." });
  const ohneBeleg = fliess.filter((a) => woerter(a.text) > 80 && a.fussnoten.length === 0);
  if (arbeit.zitierweise === "fussnoten" && ohneBeleg.length) add({ id: "absatz-ohne-beleg", gruppe: "Zitieren", status: "hinweis", titel: `${ohneBeleg.length} längere Absätze ganz ohne Beleg`, stellen: ohneBeleg.slice(0, 5).map((a) => kurz(a.text, 70)), tipp: "Wissenschaftlich: Jede Aussage, die nicht von dir stammt, braucht eine Quelle. Eigene Schlussfolgerungen dürfen ohne Beleg stehen." });

  // ---------- Literaturverzeichnis
  const lvEnde = lvz >= 0 ? (teile.filter((t) => t.i > lvz).sort((x, y) => x.i - y.i)[0]?.i ?? A.length) : -1;
  const lv = lvz >= 0 ? A.slice(lvz + 1, lvEnde).filter((a) => a.text.trim().length > 15 && a.ebene == null && !a.inTabelle) : [];
  const verboten: string[] = [];
  for (const e of lv) for (const v of rw.quellen.verboten) { const m = re(v.muster); if (m && m.test(e.text)) verboten.push(`${v.name}: ${kurz(e.text, 60)} – ${v.grund}`); }
  add({ id: "quellen-verboten", regel: "quellen-verboten", gruppe: "Quellen", status: verboten.length ? "fehler" : "ok", titel: verboten.length ? `${verboten.length} nicht zitierfähige Quellen` : "Keine verbotenen Quellen im Literaturverzeichnis", stellen: verboten, tipp: verboten.length ? "Durch die Originalquelle ersetzen (z. B. statt Statista die dort genannte Primärquelle; statt Wikipedia Fachliteratur)." : undefined });
  const minQ = arbeit.min_quellen ?? (rw.quellen.min_je_1000_woerter && arbeit.woerter_ziel ? Math.round((rw.quellen.min_je_1000_woerter * arbeit.woerter_ziel) / 1000) : null);
  if (lvz >= 0) add({ id: "quellen-anzahl", regel: "quellen-anzahl", gruppe: "Quellen", status: minQ != null && lv.length < minQ ? "fehler" : "ok", titel: `${lv.length} Einträge im Literaturverzeichnis${minQ != null ? ` (Richtwert ${minQ})` : ""}` });
  const ohneJahr = lv.filter((e) => !/\(\s*(\d{4}[a-z]?|o\. ?J\.)\s*\)/.test(e.text));
  if (ohneJahr.length) add({ id: "lv-jahr", regel: "lv-format", gruppe: "Quellen", status: "fehler", titel: `${ohneJahr.length} Einträge ohne Jahr in Klammern`, detail: "Format laut Vorgabe: „Name, Vorname (Jahr): Titel …“", stellen: ohneJahr.slice(0, 6).map((e) => kurz(e.text, 70)) });
  const sortiert = [...lv].map((e) => e.text.trim()).sort((x, y) => x.localeCompare(y, "de", { sensitivity: "base" }));
  const unsortiert = lv.findIndex((e, k) => e.text.trim() !== sortiert[k]);
  if (lv.length > 1) add({ id: "lv-alphabet", regel: "lv-alphabet", gruppe: "Quellen", status: unsortiert >= 0 ? "fehler" : "ok", titel: unsortiert >= 0 ? "Literaturverzeichnis nicht alphabetisch" : "Literaturverzeichnis alphabetisch sortiert", stellen: unsortiert >= 0 ? [`ab: ${kurz(lv[unsortiert].text, 60)}`] : undefined, tipp: unsortiert >= 0 ? "Einträge markieren → Start → Sortieren (nach Absätzen, Text, aufsteigend)." : undefined });
  const internetOhneAbruf = lv.filter((e) => /https?:\/\/|www\./i.test(e.text) && !/abruf|zugriff|accessed|\d{1,2}\.\d{1,2}\.\d{4}/i.test(e.text));
  if (internetOhneAbruf.length) add({ id: "lv-abruf", regel: "lv-internet", gruppe: "Quellen", status: "fehler", titel: `${internetOhneAbruf.length} Internetquellen ohne Abrufdatum`, stellen: internetOhneAbruf.slice(0, 5).map((e) => kurz(e.text, 70)) });
  // Abgleich Fußnoten ↔ Literaturverzeichnis
  if (lv.length && fn.length) {
    const lvText = lv.map((e) => e.text.toLowerCase()).join("\n");
    const namen = new Map<string, string>();
    for (const f of fn) for (const teil of f.text.split(/;|,?\s*zitiert nach\s*/i)) {
      const m = teil.replace(/^\s*(vgl\.|siehe|s\.)\s*/i, "").match(/^([^\d(;,]{2,60}?)[\s,]*\(?(\d{4}[a-z]?|o\. ?J\.)/i);
      if (!m) continue;
      const erster = m[1].split(/\/| u\. ?a\.| et al\.|,| und /)[0].trim();
      if (erster.length >= 2 && !/^(ebd|ders|dies)/i.test(erster)) namen.set(erster.toLowerCase(), f.text);
    }
    const fehlt = [...namen.entries()].filter(([n]) => !lvText.includes(n)).map(([, t]) => kurz(t, 60));
    add({ id: "abgleich", regel: "abgleich", gruppe: "Quellen", status: fehlt.length ? "fehler" : "ok", titel: fehlt.length ? `${fehlt.length} zitierte Quellen fehlen im Literaturverzeichnis` : `Alle ${namen.size} zitierten Autoren stehen im Literaturverzeichnis`, stellen: fehlt.slice(0, 8), tipp: fehlt.length ? "Jede in einer Fußnote zitierte Quelle muss vollständig im Literaturverzeichnis stehen – und umgekehrt." : undefined });
    const fnText = fn.map((f) => f.text.toLowerCase()).join("\n");
    const unzitiert = lv.filter((e) => { const n = e.text.split(/[,(]/)[0].trim().toLowerCase(); return n.length >= 2 && !fnText.includes(n); });
    if (unzitiert.length) add({ id: "unzitiert", gruppe: "Quellen", status: "hinweis", titel: `${unzitiert.length} Einträge im Literaturverzeichnis werden nirgends zitiert`, stellen: unzitiert.slice(0, 6).map((e) => kurz(e.text, 60)), tipp: "Ins Literaturverzeichnis gehört nur, was du auch zitierst." });
  }

  // ---------- Sprache
  for (const v of rw.sprache.verboten) {
    const m = re(v.muster); if (!m) continue;
    const g = new RegExp(m.source, "gi"), treffer: string[] = [];
    for (const a of fliess) { const k = a.text.match(g); if (k) treffer.push(`${k.length}× „${k[0]}“: ${kurz(a.text, 50)}`); }
    if (treffer.length) add({ id: "sprache-" + v.muster, regel: "sprache", gruppe: "Sprache", status: "hinweis", titel: v.hinweis, stellen: treffer.slice(0, 6), detail: `Fundstelle: ${v.quelle}` });
  }

  // ---------- Erklärungen und KI
  const eid = teile.find((t) => /eidesstatt|ehrenwört/i.test(t.teil));
  if (eid) {
    const satz = A.slice(eid.i, eid.i + 6).map((a) => a.text).join(" ");
    const m = satz.match(/Umfang:\s*([\d.\s]+)\s*Wörter/i);
    const n = m ? Number(m[1].replace(/[.\s]/g, "")) : null;
    add({ id: "eid-woerter", regel: "eid-wortzahl", gruppe: "Abgabe", status: n == null ? "fehler" : Math.abs(n - w) / Math.max(1, w) > 0.02 ? "hinweis" : "ok", titel: n == null ? "Wortzahl in der Eidesstattlichen Erklärung fehlt" : `Erklärung nennt ${zahl(n)} Wörter (gezählt: ${zahl(w)})`, tipp: n == null ? `„(Umfang: ${zahl(w)} Wörter)“ eintragen – nach der letzten Änderung neu zählen.` : undefined });
  }
  const kiTeil = teile.find((t) => /\bKI\b|künstlich|hilfsmittel/i.test(t.teil));
  add({ id: "ki", regel: "ki", gruppe: "KI", status: kiEintraege > 0 && !kiTeil ? "fehler" : "ok", titel: kiTeil ? `Erklärung zum KI-Einsatz vorhanden${kiEintraege ? ` (${kiEintraege} ${kiEintraege === 1 ? "Eintrag" : "Einträge"} im KI-Nachweis)` : ""}` : kiEintraege ? `KI genutzt (${kiEintraege} ${kiEintraege === 1 ? "Eintrag" : "Einträge"}), aber keine KI-Erklärung im Dokument` : "Keine KI-Erklärung gefunden", detail: rw.ki.pflicht, tipp: kiTeil ? "Tabelle im Dokument mit dem KI-Nachweis dieser Arbeit abgleichen (Reiter KI-Nachweis → Tabelle kopieren)." : "Erklärung zum Einsatz generativer KI mit Tabelle aus der ISM-Vorlage einfügen." });

  const stat: Statistik = { woerter: w, woerterWord: dok.woerterWord, seiten: dok.seitenWord, fussnoten: fn.length, quellen: lv.length, zitate: anzahl, abbildungen: Math.max(bilder, abbBeschr), tabellen: tabBeschr, kapitel: kap.length };
  for (const b of B) if (b.regel && !b.detail?.includes("Fundstelle")) { const q = regelQuelle(b.regel); if (q) b.detail = (b.detail ? b.detail + " " : "") + `(${q})`; }
  const rang = { fehler: 0, hinweis: 1, ok: 2 } as const;
  B.sort((x, y) => rang[x.status] - rang[y.status]);
  return { befunde: B, stat, teile };
}
