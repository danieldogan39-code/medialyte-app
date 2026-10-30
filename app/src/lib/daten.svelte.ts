// Gemeinsam genutzte Daten: Kategorien, Team, Zähler für die Navigation (mit Live-Aktualisierung)
import { sb } from "./supabase";
import { auth } from "./auth.svelte";

export type Kategorie = { slug: string; name: string; beschreibung: string | null; icon: string; farbe: string; sortierung: number; aktiv: boolean; suche: any };
export type Mitglied = { user_id: string; name: string; email: string; rolle: string; aktiv: boolean };

class Daten {
  kategorien = $state<Kategorie[]>([]);
  team = $state<Mitglied[]>([]);
  neueAnfragen = $state(0);
  toast = $state("");
  #kanal: ReturnType<typeof sb.channel> | null = null;
  #t = 0;

  async laden() {
    const [k, t] = await Promise.all([
      sb.from("kategorien").select("*").order("sortierung"),
      sb.from("mitglieder").select("user_id,name,email,rolle,aktiv").order("name"),
    ]);
    this.kategorien = (k.data as Kategorie[]) ?? [];
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
  kat(slug?: string | null) { return this.kategorien.find((k) => k.slug === slug); }
  name(uid?: string | null) { return this.team.find((m) => m.user_id === uid)?.name ?? ""; }
  melden(text: string) {
    this.toast = text; clearTimeout(this.#t);
    this.#t = setTimeout(() => (this.toast = ""), 3200) as unknown as number;
  }
}
export const daten = new Daten();
