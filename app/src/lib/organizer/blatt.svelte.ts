// Offene Fenster des Organizers (Aufgabe, Termin, Gewohnheit, Schnelleingabe, Fokus) – immer höchstens eins
import type { Aufgabe, Gewohnheit, Termin } from "./typen";

type Offen =
  | { art: "aufgabe"; a?: Partial<Aufgabe> }
  | { art: "termin"; t?: Partial<Termin> }
  | { art: "gewohnheit"; g?: Partial<Gewohnheit> }
  | { art: "schnell"; text?: string }
  | { art: "fokus"; a: Aufgabe };

class Blatt {
  offen = $state<Offen | null>(null);
  nr = $state(0);
  auf(o: Offen) { this.offen = o; this.nr++; }
  zu() { this.offen = null; }
}
export const blatt = new Blatt();
