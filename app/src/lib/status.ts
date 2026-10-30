// Bezeichnungen und Farben der Status (Betriebe im Akquise-Ablauf, Anfragen im Verkauf)
export const BETRIEB_STATUS: Record<string, { name: string; ton: string }> = {
  gefunden: { name: "Gefunden", ton: "grau" },
  demo: { name: "Demo online", ton: "blau" },
  wartet_auf_freigabe: { name: "Wartet auf Freigabe", ton: "gelb" },
  verschickt: { name: "Brief verschickt", ton: "lila" },
  interesse: { name: "Interesse", ton: "gruen" },
  kunde: { name: "Kunde", ton: "gruen" },
  behalten: { name: "Behalten", ton: "blau" },
  abgelehnt: { name: "Abgelehnt", ton: "rot" },
  uebersprungen: { name: "Übersprungen", ton: "grau" },
};
export const ANFRAGE_STATUS: Record<string, { name: string; ton: string }> = {
  neu: { name: "Neu", ton: "rot" },
  in_arbeit: { name: "In Arbeit", ton: "gelb" },
  termin: { name: "Termin vereinbart", ton: "blau" },
  angebot: { name: "Angebot verschickt", ton: "lila" },
  gewonnen: { name: "Gewonnen", ton: "gruen" },
  verloren: { name: "Verloren", ton: "grau" },
  spam: { name: "Spam", ton: "grau" },
};
export const ROLLEN: Record<string, string> = {
  inhaber: "Inhaber", entwicklung: "Entwicklung", design: "Design", marketing: "Marketing", buchhaltung: "Buchhaltung",
};
export const BEREICHE: Record<string, string> = {
  akquise: "Akquise (Kategorien, Betriebe, Demos)", briefe: "Briefe verschicken", anfragen: "Anfragen",
  kunden: "Kunden", rechnungen: "Rechnungen & Angebote", team: "Team & Rechte", einstellungen: "Einstellungen",
};
export const FORMATE: Record<string, string> = { video: "Video-Call", telefon: "Telefon", "vor-ort": "Vor Ort" };
