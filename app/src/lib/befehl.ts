// Befehle an den Agenten: in der Datenbank anlegen (Zugriffsregeln prüfen Recht und Art),
// danach die Cloud-Funktion „befehl“ anstoßen, die den Agenten bei GitHub startet.
import { sb, fehler } from "./supabase";
import { daten } from "./daten.svelte";

export type BefehlArt = "lauf" | "bauen" | "abbrechen" | "entscheidung" | "demo_loeschen" | "brief_senden" | "brief_vorschau"
  | "bewertung" | "neubau" | "neubau_zurueck" | "regel_verwerfen" | "regel_zurueck";

export async function befehl(art: BefehlArt, d: Record<string, unknown> = {}, ziel?: string, meldung?: string): Promise<boolean> {
  const { data: u } = await sb.auth.getUser();
  const { error } = await sb.from("befehle").insert({ art, daten: d, ziel: ziel ?? null, erstellt_von: u.user?.id });
  if (error) { daten.melden(fehler(error)); return false; }
  const { data, error: e2 } = await sb.functions.invoke("befehl", { body: {} });
  if (e2 || !data?.ok) {
    let m = data?.error as string | undefined;
    try { m = m ?? (await (e2 as any)?.context?.json())?.error; } catch { /* egal */ }
    daten.melden(m ? `Gespeichert, aber noch nicht übergeben: ${m}` : "Gespeichert – wird übergeben, sobald der Agent erreichbar ist.");
    return true;
  }
  if (meldung) daten.melden(meldung);
  return true;
}
