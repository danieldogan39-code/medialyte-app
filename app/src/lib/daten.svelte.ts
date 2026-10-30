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
  nachfassHeute = $state(0);      // wird von der Nachfass-Seite gesetzt
  befehle = $state<any[]>([]);      // offene/laufende Aufträge an den Agenten
  laufend = $state<Record<string, any>>({});   // laufender Lauf je Kategorie (Live-Stand)
  toast = $state("");
  toastAktion = $state<{ label: string; fn: () => void } | null>(null);
  #kanal: ReturnType<typeof sb.channel> | null = null;
  #kanal2: ReturnType<typeof sb.channel> | null = null;
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
    await this.agentStand();
    if (!this.#kanal2 && auth.darf("akquise")) {
      this.#kanal2 = sb.channel("agent-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "befehle" }, () => this.agentStand())
        .on("postgres_changes", { event: "*", schema: "public", table: "laeufe" }, () => { this.agentStand(); dispatchEvent(new CustomEvent("ml:laeufe")); })
        .subscribe();
    }
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
  /** Offene Befehle und laufende Läufe (für Anzeige und Sperren) */
  async agentStand() {
    if (!auth.darf("akquise")) return;
    const seit = new Date(Date.now() - 6 * 3600e3).toISOString();
    const [b, l] = await Promise.all([
      sb.from("befehle").select("id,art,ziel,daten,status,ergebnis,erstellt,erledigt").gte("erstellt", seit).order("erstellt", { ascending: false }).limit(30),
      sb.from("laeufe").select("id,kategorie,art,start,status,live").eq("status", "laeuft").gte("start", new Date(Date.now() - 8 * 3600e3).toISOString()),
    ]);
    this.befehle = b.data ?? [];
    const lf: Record<string, any> = {};
    for (const x of l.data ?? []) lf[x.kategorie ?? "gastronomie"] = x;
    this.laufend = lf;
  }
  offen(art?: string, ziel?: string) {
    return this.befehle.filter((b) => (b.status === "offen" || b.status === "laeuft") && (!art || b.art === art) && (!ziel || b.ziel === ziel));
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
  melden(text: string, aktion?: { label: string; fn: () => void }) {
    this.toast = text; this.toastAktion = aktion ?? null; clearTimeout(this.#t);
    this.#t = setTimeout(() => { this.toast = ""; this.toastAktion = null; }, aktion ? 10000 : 3200) as unknown as number;
  }
}
export const daten = new Daten();
