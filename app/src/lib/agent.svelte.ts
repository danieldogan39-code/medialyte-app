// Stand des Akquise-Agenten über Demos und Läufe hinaus (wie im alten Cockpit): Kosten, Suchgebiete, Einstellungen,
// Zahlen. Kommt als Zeile „cockpit“ in agent_daten (vom Agenten geschrieben) und aktualisiert sich live.
import { sb } from "./supabase";
import { auth } from "./auth.svelte";
import { lies, merk } from "./speicher";

export type Gebiet = { name: string; index: number; zuletzt?: string; restaurants?: number; ohne_website?: number; durchlaeufe?: number };
export type Cockpit = {
  erstellt?: string; naechster_lauf?: string;
  einstellungen?: { gebiete: number; demos_pro_woche: number; google_budget: number; briefe_aktiv: boolean; briefmodus: string; loeschen_nach: number;
    modell: string; mindestbewertung: number; mindestanzahl: number; demo_adresse?: { name?: string; status?: string }; nachfass_tage?: number; absender?: string; firma?: string };
  links?: { repo: string; actions: string; wochenlauf: string; berichte: string; einstellungen: string };
  gebiet_index?: number; gebiete?: Gebiet[]; suchgebiete?: { ort: string; umkreis_km: number }[];
  status_zahlen?: Record<string, number>; demos_jemals?: number;
  verbrauch?: { tage: number; ab?: string | null; gesamt_eur: number; pro_demo_eur: number | null; demos: number; laeufe: number; tools: { tool: string; eur: number }[];
    posten: any[]; freikontingente: Record<string, [number, number]>; stimme_konto?: any };
  kostenanalyse?: { erstellt: string; text: string } | null;
  /** alte Kostenanalyse: Text und Zahlen bis zum Neuanfang der Kostenrechnung */
  kostenanalyse_alt?: { erstellt?: string; text: string; archiviert: string; zeitraum?: [string | null, string | null];
    verbrauch?: { gesamt_eur: number; pro_demo_eur: number | null; demos: number; laeufe: number; tools: { tool: string; eur: number }[] } } | null;
  neubau?: { erledigt: Record<string, string>; fehler: Record<string, string> };
  briefe?: { erledigt: Record<string, any>; protokoll: any[] };
  zaehler_status?: any; app?: any;
};

class Agent {
  c = $state<Cockpit>(lies("cockpit", {}));
  geladen = $state(Object.keys(lies("cockpit", {})).length > 0);
  #kanal: ReturnType<typeof sb.channel> | null = null;

  async laden() {
    if (!auth.darf("akquise")) return;
    const { data } = await sb.from("agent_daten").select("daten").eq("name", "cockpit").maybeSingle();
    this.c = merk("cockpit", (data?.daten as Cockpit) ?? {}); this.geladen = true;
    if (!this.#kanal) this.#kanal = sb.channel("agent-daten")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_daten" }, (p: any) => { if (p.new?.name === "cockpit") this.c = merk("cockpit", p.new.daten ?? {}); })
      .subscribe();
  }
}
export const agent = new Agent();

// „Sofort bauen“: voller Preis statt Sparmodus (halber Preis, dauert etwas länger). Gilt für dieses Gerät, wie im Cockpit.
const SOFORT = "medialyte-sofort";
class Sofort {
  an = $state(lesen());
  setzen(v: boolean) { this.an = v; try { localStorage.setItem(SOFORT, v ? "1" : "0"); } catch { /* egal */ } }
}
function lesen() { try { return localStorage.getItem(SOFORT) === "1"; } catch { return false; } }
export const sofort = new Sofort();
export const sparHinweis = () => (sofort.an ? "" : " Sparmodus: halber Preis, dauert etwas länger.");

export const TOOL_NAME: Record<string, string> = { anthropic: "Claude (KI)", recraft: "Recraft (Bilder)", google: "Google Places", elevenlabs: "ElevenLabs (Stimme)", github: "GitHub Actions", letterxpress: "LetterXpress (Briefe)", openai: "OpenAI" };
export const LAUF_STATUS: Record<string, { name: string; ton: string; zeichen: string }> = {
  ok: { name: "Erfolgreich", ton: "gruen", zeichen: "✓" }, leer: { name: "Keine neuen", ton: "grau", zeichen: "–" }, wartet: { name: "Wartet", ton: "gelb", zeichen: "…" },
  fehler: { name: "Fehler", ton: "rot", zeichen: "!" }, laeuft: { name: "Läuft", ton: "blau", zeichen: "◌" },
};
