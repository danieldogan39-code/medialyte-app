// Fenster (Blätter) der Rechnungen: übereinander gestapelt, wie in der Rechnungs-App
import type { Component } from "svelte";
import { R } from "./daten.svelte";
import { daten } from "../daten.svelte";

type Eintrag = { id: number; komp: Component<any>; props: Record<string, unknown> };
class Blaetter {
  liste = $state<Eintrag[]>([]);
  #n = 0;
  auf<P extends Record<string, unknown>>(komp: Component<any>, props: P = {} as P) { this.liste.push({ id: ++this.#n, komp, props }); R.offeneBlaetter = this.liste.length; }
  zu(id: number) { this.liste = this.liste.filter((b) => b.id !== id); R.offeneBlaetter = this.liste.length; }
  /** nach dem Schließen ein anderes Blatt öffnen (kurz warten, damit die Animation fertig ist) */
  danach(id: number, fn: () => void) { this.zu(id); setTimeout(fn, 180); }
}
export const B = new Blaetter();

/** Aktion mit Fehlermeldung als Hinweis (wie run() in der Rechnungs-App) */
export async function versuche(fn: () => Promise<unknown> | unknown) {
  try { await fn(); } catch (e: any) { console.error(e); daten.melden(e?.message || String(e)); }
}
