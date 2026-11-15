// Hausarbeiten im Organizer: Arbeiten, Material, Quellen, KI-Nachweis und der automatische Prüfer.
// Das Regelwerk der Hochschule (aus Skript und Moodle) liegt privat im Speicher (organizer/<user>/arbeiten/regelwerk.json).

export type Arbeit = {
  id: string; titel: string; thema: string | null; frage: string | null; fach_id: string | null;
  art: "hausarbeit" | "baustein" | "praesentation" | "thesis" | "sonstiges";
  abgabe: string | null; woerter_ziel: number | null; toleranz: number; min_quellen: number | null; max_zitate: number | null;
  sprache: "de" | "en"; zitierweise: "fussnoten" | "harvard"; status: "idee" | "recherche" | "schreiben" | "korrektur" | "abgegeben";
  aufgabe: string | null;   // Aufgabenstellung (Moodle) als Text
  haken: Record<string, boolean> | null;   // abgehakte manuelle Regeln
  notiz: string | null; erstellt: string;
};
export type Datei = { id: string; arbeit_id: string; kategorie: "vorgabe" | "quelle" | "material" | "entwurf" | "abgabe"; name: string; pfad: string; groesse: number; typ: string | null; notiz: string | null; erstellt: string };
export type QuellenTyp = "buch" | "sammelwerk" | "zeitschrift" | "internet" | "statistik" | "gesetz" | "sonstiges";
export type Quelle = {
  id: string; arbeit_id: string; typ: QuellenTyp; datei_id: string | null; notiz: string | null; erstellt: string;
  daten: {
    autoren?: string[];          // „Nachname, Vorname“ – Institutionen als ein Eintrag
    hrsg?: string[];             // Herausgeber (Sammelwerk)
    jahr?: string; titel?: string; untertitel?: string; auflage?: string; ort?: string; verlag?: string;
    sammelwerk?: string;         // Titel des Sammelwerks (Beitrag in …)
    zeitschrift?: string; jahrgang?: string; heft?: string; seiten?: string;
    url?: string; abruf?: string; doi?: string;
  };
};
export type KiNutzung = { id: string; arbeit_id: string; datum: string; tool: string; zweck: string; prompt: string; ergebnis: string | null; textstelle: string | null; erstellt: string };

/** Regelwerk der ISM für schriftliche Arbeiten (Formalvorschriften, Richtlinie, WiAr-Skript, Moodle) */
export type Regel = {
  id: string;                    // z. B. „schrift“, „zeilenabstand“
  gruppe: "Umfang" | "Layout" | "Aufbau" | "Zitieren" | "Quellen" | "Sprache" | "Abgabe" | "KI" | "Inhalt";
  text: string;                  // die Regel in einem Satz (Markdown)
  pruefung: "auto" | "teil" | "manuell";   // auto: der Prüfer prüft sie vollständig
  quelle: string;                // Fundstelle, z. B. „Formalvorschriften S. 6 (2.2)“
};
export type Regelwerk = {
  stand: string;
  dokumente?: string[];          // Dokumente, aus denen das Regelwerk stammt
  layout: {
    schriften: { name: string; pt: number }[];   // erlaubte Schrift + Größe im Text
    fussnote_pt: number; beschriftung_pt: number;
    zeilenabstand: number; zeilenabstand_fussnote: number; absatz_nach_pt: number;
    raender_cm: { oben: number; unten: number; links: number; rechts: number };
    blocksatz: boolean; silbentrennung: boolean;
    seitenzahl: string;            // Beschreibung (Position, ab welcher Seite, Zählweise)
  };
  umfang: {
    zaehlt: string;                // was zur Wortzahl zählt (Text)
    zaehlt_fussnoten: boolean;
    nicht: string[];               // Teile, die nicht zählen (Überschriften dieser Teile)
    toleranz_prozent: number;      // erlaubte Abweichung
  };
  aufbau: { teil: string; erkennung: string[]; pflicht: "immer" | "bedingt" | "nein"; bedingung?: string; quelle: string }[];   // Reihenfolge = Soll-Reihenfolge; erkennung: Überschriften-Muster (RegExp, ohne / /, Groß/klein egal)
  zitieren: {
    weise: "fussnoten" | "harvard";
    indirekt_praefix: string;      // z. B. „Vgl.“
    beispiele: { art: string; muster: string }[];   // Kurzbeleg-Beispiele (Fußnote) je Quellenart
    lv_muster: { typ: string; muster: string; beispiel: string }[];   // Literaturverzeichnis je Quellenart
    direkt_max_woerter_inline: number | null;   // ab wie vielen Wörtern Blockzitat
    direkt_max_anzahl: number | null;            // höchstens so viele direkte Zitate (null = keine Grenze)
    ebd_erlaubt: boolean | null; ff_erlaubt: boolean | null;
    seitenangabe_pflicht: boolean;
  };
  quellen: {
    min_je_1000_woerter: number | null;          // Richtwert
    verboten: { muster: string; name: string; grund: string; quelle: string }[];  // muster: RegExp auf Literaturangabe/URL
  };
  sprache: { verboten: { muster: string; hinweis: string; quelle: string }[] };    // z. B. „man“, Ich-Form – nur, wenn es die Vorgaben so sagen
  ki: { pflicht: string; angaben: string[]; quelle: string };
  regeln: Regel[];                  // vollständige Liste aller Vorgaben als Checkliste
  arbeiten: { id: string; titel: string; art: Arbeit["art"]; modul: string; abgabe: string | null; woerter_ziel: number | null; toleranz: number; min_quellen: number | null; max_zitate: number | null; aufgabe: string; quelle: string }[];   // konkrete Arbeiten aus Moodle (Bausteine, Praxisreflexion)
};

/** Ergebnis des Prüfers */
export type Befund = { id: string; regel?: string; gruppe: Regel["gruppe"]; status: "ok" | "hinweis" | "fehler"; titel: string; detail?: string; stellen?: string[]; tipp?: string };
