// Alle Arten von Benachrichtigungen, die Medialyte verschickt – je Gerät einzeln an- und abschaltbar.
// Die Schlüssel müssen zu ARTEN im Benachrichtigungs-Dienst passen (website-agent/agent/zaehler.js).
export type Art = { key: string; name: string; text: string; dringend?: boolean };
export type Gruppe = { key: string; name: string; icon: string; arten: Art[] };

export const GRUPPEN: Gruppe[] = [
  { key: "akquise", name: "Akquise", icon: "phone", arten: [
    { key: "demo", name: "Demo geöffnet", text: "Ein Betrieb öffnet seine Demo über den Link im Brief.", dringend: true },
    { key: "angebot", name: "Angebot angesehen", text: "Ein Betrieb schaut sich sein Angebot an.", dringend: true },
    { key: "rueckruf", name: "Rückruf gewünscht", text: "Jemand bittet auf der Angebotsseite um einen Anruf.", dringend: true },
    { key: "nachfass", name: "Heute anrufen", text: "Morgens die Liste, wen du heute nachfassen solltest." },
  ] },
  { key: "briefe", name: "Briefe", icon: "letter", arten: [
    { key: "brief_vorschau", name: "Briefvorschau fertig", text: "Ein Brief (auch ein Probebrief) ist zum Ansehen bereit." },
    { key: "brief_verschickt", name: "Brief verschickt", text: "Ein Brief geht in Druck und Versand." },
    { key: "brief_fehler", name: "Brief nicht verschickt", text: "Beim Versand ist etwas schiefgegangen.", dringend: true },
  ] },
  { key: "agent", name: "Neue Demos", icon: "sparkles", arten: [
    { key: "demos_neu", name: "Neue Demos online", text: "Ein Lauf ist fertig: neue Demos oder Neubauten." },
    { key: "lauf_fehler", name: "Lauf fehlgeschlagen", text: "Ein Lauf hat nicht geklappt oder das Guthaben ist aufgebraucht.", dringend: true },
    { key: "lernen", name: "Design-Gedächtnis gelernt", text: "Deine Bewertungen wurden verarbeitet." },
  ] },
  { key: "kunden", name: "Kunden-Websites", icon: "globe", arten: [
    { key: "kunde_vorschau", name: "Vorschau fertig", text: "Die Vorschau einer übernommenen Website steht." },
    { key: "kunde_live", name: "Website ist live", text: "Eine Kunden-Website ist unter ihrer Adresse erreichbar." },
    { key: "kunde_aufgabe", name: "Aufgabe für dich", text: "Zum Beispiel Nameserver eintragen oder eine Übernahme, die nicht geklappt hat.", dringend: true },
    { key: "agent_wunsch", name: "Kundenwunsch für dich", text: "Der Website-Agent gibt einen Wunsch eines Kunden an dich weiter.", dringend: true },
    { key: "agent_geaendert", name: "Website geändert", text: "Der Website-Agent hat eine Änderung veröffentlicht oder zurückgenommen." },
    { key: "agent_fehler", name: "Website-Agent hat ein Problem", text: "Ein Auftrag hängt, startet nicht oder ist fehlgeschlagen.", dringend: true },
  ] },
];
export const ALLE = GRUPPEN.flatMap((g) => g.arten);
export const RUHE_STANDARD = { an: false, von: "22:00", bis: "07:00", dringend: true };
