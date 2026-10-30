// Ansicht der Rechnungen: Reiter, Filter, Suche, aufgeklappte Kundengruppen (Reiter und Angebots-Ansicht bleiben gespeichert)
const lies = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
class Ansicht {
  #tab = $state(lies("medialyte-rechnungen-tab", "invoices"));
  #qview = $state(lies("medialyte-rechnungen-qview", "standard"));
  filter = $state("all"); qfilter = $state("all"); query = $state("");
  gruppen = $state<Record<string, string>>({});
  get tab() { return this.#tab; }
  set tab(v: string) { this.#tab = v; try { localStorage.setItem("medialyte-rechnungen-tab", v); } catch { /* egal */ } }
  get qview() { return this.#qview; }
  set qview(v: string) { this.#qview = v; try { localStorage.setItem("medialyte-rechnungen-qview", v); } catch { /* egal */ } }
}
export const rechnungenAnsicht = new Ansicht();
