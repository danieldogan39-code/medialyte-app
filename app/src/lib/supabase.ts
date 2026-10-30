import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

// Vor dem Anlegen merken: Einladungs- und „Passwort vergessen“-Links tragen type=invite/recovery im #-Teil,
// den Supabase gleich danach aus der Adresse entfernt
export const startHash = typeof location !== "undefined" ? location.hash + location.search : "";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "medialyte-app-auth" },
});

/** Fehlertext für Menschen */
export function fehler(e: unknown): string {
  const m = (e as any)?.message ?? String(e ?? "");
  if (/Invalid login credentials/i.test(m)) return "E-Mail oder Passwort stimmt nicht.";
  if (/Invalid TOTP code|invalid.*code/i.test(m)) return "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Keine Verbindung. Bitte Internet prüfen.";
  if (/row-level security|permission denied/i.test(m)) return "Dafür fehlt dir das Recht.";
  if (/rate limit/i.test(m)) return "Zu viele Versuche. Bitte kurz warten.";
  return m || "Unbekannter Fehler.";
}
