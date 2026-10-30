// Gemeinsam genutzte Daten: Kategorien, Team, Zähler für die Navigation (mit Live-Aktualisierung)
import { sb } from "./supabase";
import { auth } from "./auth.svelte";

export type Kategorie = { slug: string; name: string; beschreibung: string | null; icon: string; farbe: string; sortierung: number; aktiv: boolean; suche: any };
export type Agent = { schluessel: string; name: string; beschreibung: string | null; rhythmus: string | null; icon: string; sortierung: number; aktiv: boolean; geaendert: string; geaendert_von: string | null };
export type Mitglied = { user_id: string; name: string; email: string; rolle: string; aktiv: boolean };

class Daten {
  kategorien = $state<Kategorie[]>([]);
  team = $state<Mitglied[]>([]);
  agenten = $state<Agent[]>([]);
  neueAnfragen = $state(0);
  toast = $state("");
  #kanal: ReturnType<typeof sb.channel> | null = null;
  #t = 0;

  async laden() {
    const [k, t, a] = await Promise.all([
      sb.from("kategorien").select("*").order("sortierung"),
      sb.from("mitglieder").select("user_id,name,email,rolle,aktiv").order("name"),
      sb.from("agenten").select("*").order("sortierung"),
    ]);
    this.kategorien = (k.data as Kategorie[]) ?? [];
    this.agenten = (a.data as Agent[]) ?? [];
    this.team = (t.data as Mitglied[]) ?? [];
    await this.zaehlen();
    if (!this.#kanal && auth.darf("anfragen")) {
      this.#kanal = sb.channel("anfragen-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "anfragen" }, (p) => {
          if (p.eventType === "INSERT") this.melden("Neue Anfrage eingegangen");
          this.zaehlen();
          dispatchEvent(new CustomEvent("ml:anfragen"));
        })
        .subscribe();
    }
  }
  async zaehlen() {
    if (!auth.darf("anfragen")) return;
    const { count } = await sb.from("anfragen").select("id", { count: "exact", head: true }).eq("status", "neu");
    this.neueAnfragen = count ?? 0;
  }
  /** Agent oder Kategorie (Akquise) an- und ausschalten; sofort sichtbar, bei Fehler zurück */
  async schalten(art: "agent" | "kategorie", id: string, an: boolean): Promise<boolean> {
    const liste: any[] = art === "agent" ? this.agenten : this.kategorien;
    const x = liste.find((y) => (art === "agent" ? y.schluessel : y.slug) === id);
    if (!x) return false;
    const vorher = x.aktiv; x.aktiv = an;
    const { error } = art === "agent"
      ? await sb.from("agenten").update({ aktiv: an }).eq("schluessel", id).select("schluessel").single()
      : await sb.from("kategorien").update({ aktiv: an }).eq("slug", id).select("slug").single();
    if (error) { x.aktiv = vorher; this.melden("Nicht gespeichert: " + (error.message.includes("0 rows") || error.code === "PGRST116" ? "Dafür fehlt dir das Recht." : error.message)); return false; }
    this.melden(`${art === "agent" ? x.name : "Akquise " + x.name} ${an ? "eingeschaltet" : "ausgeschaltet"}`);
    return true;
  }
  kat(slug?: string | null) { return this.kategorien.find((k) => k.slug === slug); }
  name(uid?: string | null) { return this.team.find((m) => m.user_id === uid)?.name ?? ""; }
  melden(text: string) {
    this.toast = text; clearTimeout(this.#t);
    this.#t = setTimeout(() => (this.toast = ""), 3200) as unknown as number;
  }
}
export const daten = new Daten();
