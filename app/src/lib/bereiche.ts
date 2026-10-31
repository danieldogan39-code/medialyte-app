// Jeder Bereich der App hat seine eigene Farbe (wie die Symbole in den iOS-Einstellungen):
// im Menü, im Seitenkopf und als Akzent der Seite. So erkennt man auf einen Blick, wo man ist.
export type Bereich = { pfad: string; name: string; icon: string; farbe: string };

export const BEREICHE: Bereich[] = [
  { pfad: "/", name: "Übersicht", icon: "home", farbe: "#8B98AD" },
  { pfad: "/anfragen", name: "Anfragen", icon: "inbox", farbe: "#F24A4A" },
  { pfad: "/akquise", name: "Akquise", icon: "layers", farbe: "#6FA8F0" },
  { pfad: "/nachfassen", name: "Nachfassen", icon: "phone", farbe: "#E7B94A" },
  { pfad: "/kunden", name: "Kunden", icon: "users", farbe: "#4CC38A" },
  { pfad: "/rechnungen", name: "Rechnungen", icon: "receipt", farbe: "#A78BFA" },
  { pfad: "/social", name: "Social Media", icon: "image", farbe: "#FB923C" },
  { pfad: "/kosten", name: "Kosten", icon: "scale", farbe: "#4FC7D4" },
  { pfad: "/team", name: "Team & Rechte", icon: "shield", farbe: "#F08FC0" },
  { pfad: "/einstellungen", name: "Einstellungen", icon: "settings", farbe: "#AEB9CA" },
];

export function bereichVon(pfad: string): Bereich {
  return BEREICHE.filter((b) => b.pfad !== "/").find((b) => pfad.startsWith(b.pfad)) ?? BEREICHE[0];
}
