// Welcher Teil der App ist offen: Medialyte (Agentur) oder der persönliche Organizer.
// Beim Öffnen der App kommt zuerst die Auswahl – außer man springt über einen Link (z. B. aus einer Benachrichtigung) direkt hinein.
import { startHash } from "./supabase";

const tief = /^#\/./.test(startHash.split("?")[0]);

class Modus {
  gewaehlt = $state(tief);
  /** Bereich öffnen */
  oeffnen(ziel: "medialyte" | "organizer") {
    // ersetzen statt anhängen: „Zurück“ springt nicht zwischen den beiden Welten hin und her
    location.replace(ziel === "organizer" ? "#/o/heute" : "#/");
    this.gewaehlt = true;
    scrollTo(0, 0);
  }
  /** Zurück zur Auswahl */
  auswahl() { this.gewaehlt = false; scrollTo(0, 0); }
}
export const modus = new Modus();
