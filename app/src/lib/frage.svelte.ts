// Eigene Rückfrage statt window.confirm: Im Mac-Programm (WebKit) gibt confirm() ohne Dialog sofort „Nein“ zurück.
type Frage = { titel: string; text: string; ok: string; gefahr: boolean; tippen?: string; antwort: (ja: boolean) => void };

class Rueckfrage {
  offen = $state<Frage | null>(null);
  stellen(titel: string, text: string, ok = "Bestätigen", gefahr = false, tippen?: string): Promise<boolean> {
    return new Promise((res) => {
      this.offen?.antwort(false);
      this.offen = { titel, text, ok, gefahr, tippen, antwort: (ja) => { this.offen = null; res(ja); } };
    });
  }
}
export const rueckfrage = new Rueckfrage();
export const frage = (titel: string, text: string, ok?: string, gefahr?: boolean, tippen?: string) => rueckfrage.stellen(titel, text, ok, gefahr, tippen);
