// Lernbereich des Organizers: Kurse → Kapitel → Lektionen (Erklärung + Abfrage).
// Inhalte liegen als Module in ./kurse und werden erst beim Öffnen geladen.

/** Text mit leichtem Markdown: **fett**, *kursiv*, `$Formel$` (KaTeX), Listen mit „- “ und „1. “ */
export type Md = string;

export type Grafik =
  // f, g: Rechenausdruck in x, z. B. "0.5*x^2 - 3*x + 4" (siehe ausdruck.ts)
  | { art: "graph"; titel?: string; x: [number, number]; y: [number, number]; kurven: { f: string; name: string; farbe?: string; von?: number; bis?: number; gestrichelt?: boolean }[]; punkte?: { x: number; y: number; name?: string }[]; flaeche?: { f: string; g?: string; von: number; bis: number }; xName?: string; yName?: string }
  | { art: "bilanz"; titel?: string; aktiva: [string, number | string][]; passiva: [string, number | string][]; einheit?: string; markiert?: string[] }
  | { art: "tkonto"; konten: { name: string; soll: [string, number][]; haben: [string, number][]; saldo?: "soll" | "haben" }[] }
  | { art: "fluss"; titel?: string; schritte: { t: string; d?: string }[]; richtung?: "quer" | "hoch" }
  | { art: "matrix"; titel?: string; x: [string, string]; y: [string, string]; xName?: string; yName?: string; felder: [string, string, string, string] } // oben links, oben rechts, unten links, unten rechts
  | { art: "balken"; titel?: string; werte: { name: string; wert: number; farbe?: string }[]; einheit?: string }
  | { art: "zeitstrahl"; titel?: string; punkte: { wann: string; t: string; d?: string }[] }
  | { art: "baum"; titel?: string; wurzel: string; aeste: { t: string; blaetter?: string[] }[] }
  | { art: "zyklus"; titel?: string; phasen: { t: string; d?: string }[]; kurve?: number[] };

/** Markierung aus dem Skript: wie der Dozent einen Inhalt für die Klausur gekennzeichnet hat.
 *  stern = besonders klausurrelevant (IM: grüner Stern oben rechts), gelb/orange/grau = farbige Folien (IM: Übung, Rechnen, Aktuelles),
 *  exkurs = als Exkurs überschrieben, uebersicht = laut Skript nur Überblick. Die Bedeutung je Kurs steht in Kurs.marken. */
export type Marke = "stern" | "gelb" | "orange" | "grau" | "exkurs" | "uebersicht";
export type MarkenInfo = { name: string; kurz: string; text: Md; ton: "gruen" | "gelb" | "orange" | "grau" | "blass" };
/** marke/folien trägt marken/anwenden.py beim Bauen ein (nicht von Hand pflegen) */
export type Baustein = BausteinArt & { marke?: Marke[]; folien?: number[] };
type BausteinArt =
  | { t: "text"; md: Md }
  | { t: "merke"; md: Md; titel?: string }
  | { t: "formel"; tex: string; name?: string; legende?: [string, string][] }
  | { t: "beispiel"; titel: string; aufgabe?: Md; schritte: Md[]; ergebnis?: Md }
  | { t: "fehler"; md: Md }
  | { t: "klausur"; md: Md }
  | { t: "tabelle"; kopf: string[]; zeilen: (string | number)[][]; titel?: string }
  | { t: "grafik"; g: Grafik; unter?: Md }
  | { t: "begriffe"; liste: [string, Md][] }
  | { t: "quelle"; md: Md }
  // Interaktiv: mit Reglern Größen verändern und live sehen, was passiert (Werte, Graph, Balken).
  // Ausdrücke wie bei Generatoren (ausdruck.ts); Regler-IDs und hilfs-Namen sind darin als Variablen nutzbar, im Graph zusätzlich x.
  | { t: "regler"; titel: string; md?: Md; regler: Regler[]; hilfs?: [string, string][];
      werte?: { name: string; f: string; stellen?: number; einheit?: string; hervor?: boolean }[];
      graph?: { x: [number, number]; y: [number, number]; kurven: { f: string; name: string; farbe?: string; gestrichelt?: boolean; von?: number; bis?: number }[];
        punkte?: { x: string; y: string; name?: string }[]; flaeche?: { f: string; g?: string; von: string; bis: string }; xName?: string; yName?: string };
      balken?: { name: string; f: string; farbe?: string }[]; einheit?: string; unter?: Md }
  // Erst selbst überlegen, dann aufdecken (Denkanstoß mitten in der Erklärung)
  | { t: "aufdecken"; frage: Md; antwort: Md }
  // Aktueller Stand: wenn eine Angabe im Skript veraltet ist (Kennzahl, Grenzwert, Rang, Mitgliederzahl …).
  // skript = was im Skript steht (gilt für die Klausur, solange der Dozent nichts anderes sagt), aktuell = heutiger Stand, quelle = Beleg mit Datum
  | { t: "aktuell"; titel?: string; skript: Md; aktuell: Md; quelle: Md; stand: string };
export type Regler = { id: string; name: string; von: number; bis: number; schritt?: number; start: number; einheit?: string };

/** stufe: 1 leicht (wiedererkennen), 2 mittel (selbst anwenden), 3 schwer (Klausurniveau, mehrere Schritte) */
type Basis = { id: string; erkl?: Md; tipp?: Md; punkte?: number; marke?: Marke[]; stufe?: 1 | 2 | 3 };
/** Zelle einer Tabelle zum Selbstausfüllen:
 *  Text            = vorgegeben
 *  { z: 1200 }     = Zahl eintippen (tol: erlaubte Abweichung, sonst wie bei Rechenaufgaben)
 *  { w: "Kasse" }  = Begriff aus dem Vorrat unter der Tabelle einsetzen
 *  { e: ["Aktivtausch"] } = Begriff eintippen (alle gültigen Schreibweisen; Groß-/Kleinschreibung und Satzzeichen egal) */
export type Zelle = string | { z: number; tol?: number } | { w: string } | { e: string[] };
export type Frage = Basis & (
  | { typ: "mc"; frage: Md; optionen: Md[]; richtig: number[] }          // eine oder mehrere richtige
  | { typ: "wahr"; frage: Md; wahr: boolean }
  | { typ: "zahl"; frage: Md; antwort: number; toleranz?: number; einheit?: string }
  | { typ: "buchung"; frage: Md; konten: string[]; soll: [string, number][]; haben: [string, number][] }
  | { typ: "zuordnen"; frage: Md; gruppen: string[]; elemente: [string, number][] }
  | { typ: "reihe"; frage: Md; elemente: string[] }                      // richtige Reihenfolge
  // Tabelle selbst ausfüllen (T-Konto, Bilanz, Schema …). vorrat: zusätzliche falsche Begriffe für den Vorrat. Jede Zelle zählt einzeln.
  | { typ: "tabelle"; frage: Md; kopf: string[]; zeilen: Zelle[][]; vorrat?: string[]; unter?: Md }
  | { typ: "karte"; frage: Md; antwort: Md }                              // selbst bewerten
  | { typ: "frei"; frage: Md; antwort: Md; punkte?: number }              // Musterlösung, selbst bewerten
);

/** Erzeugt unbegrenzt neue Rechenaufgaben einer Sorte (Zahlen zufällig, Lösung wird ausgerechnet).
 *  vars: Name → { von, bis, schritt? } (Schritt Standard 1) oder Liste erlaubter Werte [2, 5, 10]
 *  hilfs: weitere Größen, der Reihe nach berechnet (Ausdrücke)
 *  bedingung: Ausdruck, der wahr (≠ 0) sein muss, sonst wird neu gewürfelt
 *  frage/erkl/tipp: Text mit Platzhaltern [[a]], [[a:2]], [[a:+]], [[=Ausdruck:2]]
 *  antwort: Ausdruck für die richtige Zahl */
export type Generator = {
  id: string; titel: string;
  vars: Record<string, { von: number; bis: number; schritt?: number } | number[]>;
  hilfs?: [string, string][];
  bedingung?: string;
  frage: Md; antwort: string; einheit?: string; toleranz?: number; erkl?: Md; tipp?: Md;
};

export type Lektion = {
  id: string;            // z. B. „m1-2“, eindeutig im Kurs
  titel: string;
  dauer_min: number;
  ziel: Md;              // was du danach kannst
  quelle?: string;       // Skriptstelle
  inhalt: Baustein[];
  fragen: Frage[];
  generatoren?: Generator[];
  /** „lerncheck“: Selbstkontrolle am Kapitelende mit den Kontrollfragen aus dem Skript */
  art?: "lerncheck";
  /** markierte Folien im Seitenbereich der Lektion, z. B. { stern: [19, 21, 22], gelb: [25] } */
  marken?: Partial<Record<Marke, number[]>>;
};
export type Kapitel = { id: string; titel: string; lektionen: Lektion[] };
export type Kurs = {
  id: KursId;
  titel: string;
  fach: string[];        // Namen/Kürzel, über die das Organizer-Fach gefunden wird
  farbe: string;
  klausur: string;       // ISO-Datum der Klausur (Fallback, wenn kein Klausurtermin verknüpft ist)
  format: Md;            // Aufbau der Klausur
  quelle: string;        // Grundlage der Inhalte
  stand: string;         // Zeitpunkt der Fassung (neue Fassung → App lädt neu)
  /** Legende der Skript-Markierungen (fehlt, wenn das Skript nichts markiert) und ein Satz dazu, was im Skript zur Klausurrelevanz steht */
  marken?: Partial<Record<Marke, MarkenInfo>>;
  markenText?: Md;
  skripte?: { titel: string; datei: string }[];   // Originale im eigenen Speicher (organizer/<user>/skripte/<datei>); das erste ist das Hauptskript
  kapitel: Kapitel[];
};
export type KursId = "mathe" | "rewe" | "im" | "bwl";

export type KursKopf = Pick<Kurs, "id" | "titel" | "fach" | "farbe" | "klausur">;
export const KURSE: KursKopf[] = [
  { id: "im", titel: "Internationales Management", fach: ["Int. Management", "Internationales Management"], farbe: "#4FC7D4", klausur: "2026-12-15T14:30:00+01:00" },
  { id: "bwl", titel: "Allgemeine BWL", fach: ["BWL", "Betriebswirtschaftslehre"], farbe: "#E7B94A", klausur: "2026-12-16T14:00:00+01:00" },
  { id: "rewe", titel: "Externes Rechnungswesen", fach: ["Rechnungswesen", "Externes Rechnungswesen"], farbe: "#F2995A", klausur: "2026-12-18T11:30:00+01:00" },
  { id: "mathe", titel: "Wirtschaftsmathematik", fach: ["Mathe", "Wirtschaftsmathematik"], farbe: "#6FA8F0", klausur: "2026-12-21T11:30:00+01:00" },
];

/** Lernstand einer Frage (Leitner-Kasten 0–5) */
export type Stand = { schluessel: string; box: number; faellig: string | null; richtig: number; falsch: number; zuletzt: string | null };
