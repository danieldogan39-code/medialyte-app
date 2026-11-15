// Datentypen des Organizers (entsprechen den Tabellen org_* in Supabase)
export type Fach = { id: string; name: string; farbe: string; position: number; archiviert: boolean;
  name_lang?: string | null; dozent?: string | null; pruefung?: string | null; link?: string | null; notiz?: string | null; niveau?: number };
export type TerminArt = "termin" | "vorlesung" | "klausur" | "abgabe" | "privat";
export type Termin = {
  id: string; titel: string; start: string; ende: string; ganztag: boolean; ort: string | null; art: TerminArt;
  fach_id: string | null; notiz: string | null; kalender_id: string | null; fahrt?: boolean | null;
};
export type Aufgabe = {
  id: string; titel: string; notiz: string | null; fach_id: string | null; dauer_min: number; frist: string | null;
  prio: 1 | 2 | 3; geplant: string | null; fixiert: boolean; erledigt: string | null; position: number; erstellt: string; ab?: string | null;
};
export type Gewohnheit = {
  id: string; name: string; icon: string; farbe: string; pro_woche: number; dauer_min: number; uhrzeit: string | null;
  tage: number[]; aktiv: boolean; position: number;
};
export type Log = { gewohnheit_id: string; tag: string };
export type Kalender = { id: string; name: string; url: string; art: "ism" | "google" | "sonstige"; farbe: string; fach_id: string | null; zuletzt: string | null; fehler: string | null };
export type Einstellungen = { tag_start: string; tag_ende: string; puffer_min: number; tag_max_min: number; wochenende: boolean; fahrzeit_min: number; fahrt_regeln: { muster: string; min: number }[] };
export type Routine = { id: string; titel: string; start: string; dauer_min: number; tage: number[]; art: "block" | "fix" | "flex"; niveau: number | null; aktiv: boolean };
export const NIVEAU: Record<number, string> = { 1: "höchstes Niveau", 2: "mittleres Niveau", 3: "niedriges Niveau" };

export const EINST_STANDARD: Einstellungen = { tag_start: "09:00", tag_ende: "18:00", puffer_min: 15, tag_max_min: 360, wochenende: true, fahrzeit_min: 45, fahrt_regeln: [] };

export const TERMIN_ART: Record<TerminArt, { name: string; icon: string }> = {
  termin: { name: "Termin", icon: "calendar" }, vorlesung: { name: "Vorlesung", icon: "briefcase" }, klausur: { name: "Klausur", icon: "star" },
  abgabe: { name: "Abgabe", icon: "upload" }, privat: { name: "Privat", icon: "home" },
};

// Farben für Fächer (wie die Bereichsfarben der App): ruhig auf Nachtblau, gut unterscheidbar
export const FARBEN = ["#6FA8F0", "#FB923C", "#4FC7D4", "#A78BFA", "#E7B94A", "#4CC38A", "#F08FC0", "#F24A4A", "#8B98AD", "#9AD46B"];

/** Ein Eintrag auf der Zeitleiste: Termin, geplante Aufgabe oder Gewohnheit */
export type Block = {
  art: "termin" | "aufgabe" | "gewohnheit" | "fahrt" | "routine";
  id: string; titel: string; start: Date; ende: Date; farbe: string; ganztag?: boolean;
  erledigt?: boolean; unter?: string; termin?: Termin; aufgabe?: Aufgabe; gewohnheit?: Gewohnheit; routine?: Routine; leer?: boolean;
};
