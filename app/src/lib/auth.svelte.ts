// Anmeldezustand: Sitzung, Zwei-Faktor-Stufe und meine Rolle mit Rechten
import type { Session } from "@supabase/supabase-js";
import { sb, startHash } from "./supabase";

export type Recht = "lesen" | "schreiben";
export type Ich = { user_id: string; name: string; email: string; rolle: string; aktiv: boolean; rechte: Record<string, Recht> };

class Auth {
  bereit = $state(false);
  session = $state<Session | null>(null);
  stufe = $state<"aal1" | "aal2" | null>(null);      // aal2 = Zwei-Faktor bestätigt
  hatFaktor = $state(false);                          // Zwei-Faktor schon eingerichtet?
  ich = $state<Ich | null>(null);
  passwortSetzen = $state(false);                     // nach Einladung oder „Passwort vergessen“
  #gesetzt = false;
  fertigGesetzt() { this.#gesetzt = true; this.passwortSetzen = false; }

  async init() {
    const { data } = await sb.auth.getSession();
    await this.uebernehmen(data.session);
    sb.auth.onAuthStateChange((ev, s) => {
      if (ev === "PASSWORD_RECOVERY") this.passwortSetzen = true;
      // erst nach dem aktuellen Ereignis neu laden (Supabase empfiehlt keine Aufrufe direkt im Callback)
      setTimeout(() => this.uebernehmen(s), 0);
    });
    this.bereit = true;
  }

  async uebernehmen(s: Session | null) {
    this.session = s;
    if (!s) { this.stufe = null; this.ich = null; this.hatFaktor = false; return; }
    if (/type=(invite|recovery)/.test(startHash) && !this.#gesetzt) this.passwortSetzen = true;
    const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    this.stufe = (a?.currentLevel as any) ?? "aal1";
    this.hatFaktor = a?.nextLevel === "aal2";
    const { data: ich } = await sb.rpc("ich");
    this.ich = (ich as Ich) ?? null;
  }

  darf(bereich: string, schreiben = false): boolean {
    const r = this.ich?.rechte?.[bereich];
    return !!r && (!schreiben || r === "schreiben");
  }

  async abmelden() { try { localStorage.removeItem("medialyte-rechnungen-cache-v1"); } catch {} await sb.auth.signOut(); this.session = null; this.ich = null; this.stufe = null; }
}

export const auth = new Auth();
