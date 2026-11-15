// Seiten des Organizers mit eigener Farbe (wie die Bereiche der Medialyte-Seite)
export type OrgBereich = { pfad: string; name: string; kurz: string; icon: string; farbe: string };
export const ORG_FARBE = "#8E7CFF";   // Akzent des Organizers (Medialyte: Koralle)
export const ORG_BEREICHE: OrgBereich[] = [
  { pfad: "/o/heute", name: "Heute", kurz: "Heute", icon: "sun", farbe: "#8E7CFF" },
  { pfad: "/o/woche", name: "Woche", kurz: "Woche", icon: "calendar", farbe: "#6FA8F0" },
  { pfad: "/o/aufgaben", name: "Aufgaben", kurz: "Aufgaben", icon: "check", farbe: "#E7B94A" },
  { pfad: "/o/lernen", name: "Lernen", kurz: "Lernen", icon: "buch", farbe: "#B48CFF" },
  { pfad: "/o/arbeiten", name: "Hausarbeiten", kurz: "Arbeiten", icon: "stift", farbe: "#F0B860" },
  { pfad: "/o/faecher", name: "Fächer", kurz: "Fächer", icon: "note", farbe: "#4FC7D4" },
  { pfad: "/o/ziele", name: "Gewohnheiten", kurz: "Ziele", icon: "flame", farbe: "#4CC38A" },
  { pfad: "/o/pruefungen", name: "Prüfungen", kurz: "Prüfungen", icon: "target", farbe: "#F27A6A" },
  { pfad: "/o/einstellungen", name: "Einstellungen", kurz: "Mehr", icon: "settings", farbe: "#AEB9CA" },
];
export const orgBereich = (pfad: string) => ORG_BEREICHE.find((b) => pfad.startsWith(b.pfad)) ?? ORG_BEREICHE[0];
