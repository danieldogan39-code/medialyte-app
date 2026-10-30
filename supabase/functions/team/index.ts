// Team verwalten: Mitglied einladen, Zugangslink neu erzeugen, Zwei-Faktor zurücksetzen, Zugang sperren.
// Nur für Mitglieder mit Schreibrecht im Bereich „team“ (und bestätigter Zwei-Faktor-Anmeldung).
// Einladungen kommen als Link zurück, den der Inhaber selbst weitergibt (WhatsApp, E-Mail) – so hängt nichts an einem Mailserver.
import { admin, alsNutzer, cors, json } from "../_shared/util.ts";

const ROLLEN = ["inhaber", "entwicklung", "design", "marketing", "buchhaltung"];
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.medialyte.de";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });

  const nutzer = alsNutzer(req);
  const { data: darf } = await nutzer.rpc("darf", { p_bereich: "team", p_schreiben: true });
  if (darf !== true) return json(403, { ok: false, error: "Dafür fehlt dir das Recht (oder die Zwei-Faktor-Anmeldung)." });

  let e: Record<string, any>;
  try { e = await req.json(); } catch { return json(400, { ok: false }); }
  const db = admin();

  if (e.aktion === "einladen") {
    const email = String(e.email ?? "").trim().toLowerCase();
    const name = String(e.name ?? "").trim().slice(0, 80);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || !ROLLEN.includes(e.rolle)) {
      return json(422, { ok: false, error: "Bitte Name, E-Mail und Rolle angeben." });
    }
    const { data, error } = await db.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: `${APP_URL}/` } });
    if (error || !data?.user) return json(400, { ok: false, error: error?.message ?? "Einladung fehlgeschlagen" });
    const { error: e2 } = await db.from("mitglieder").upsert({ user_id: data.user.id, name, email, rolle: e.rolle, aktiv: true });
    if (e2) return json(500, { ok: false, error: e2.message });
    return json(200, { ok: true, link: data.properties.action_link });
  }

  const id = String(e.user_id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return json(422, { ok: false, error: "Mitglied fehlt." });
  const { data: m } = await db.from("mitglieder").select("email").eq("user_id", id).maybeSingle();
  if (!m) return json(404, { ok: false, error: "Mitglied nicht gefunden." });

  if (e.aktion === "neuer_link") {
    // Passwort vergessen: neuer Link zum Setzen des Passworts
    const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: m.email, options: { redirectTo: `${APP_URL}/` } });
    if (error) return json(400, { ok: false, error: error.message });
    return json(200, { ok: true, link: data.properties.action_link });
  }

  if (e.aktion === "zweifaktor_zuruecksetzen") {
    // Handy verloren: alle Faktoren löschen, beim nächsten Anmelden richtet das Mitglied 2FA neu ein
    const { data, error } = await db.auth.admin.mfa.listFactors({ userId: id });
    if (error) return json(400, { ok: false, error: error.message });
    for (const f of data?.factors ?? []) await db.auth.admin.mfa.deleteFactor({ userId: id, id: f.id });
    return json(200, { ok: true });
  }

  if (e.aktion === "sperren" || e.aktion === "entsperren") {
    const sperren = e.aktion === "sperren";
    const { error } = await db.from("mitglieder").update({ aktiv: !sperren }).eq("user_id", id);
    if (error) return json(400, { ok: false, error: error.message });   // z. B. letzter Inhaber
    await db.auth.admin.updateUserById(id, { ban_duration: sperren ? "876000h" : "none" });
    return json(200, { ok: true });
  }

  return json(400, { ok: false, error: "Unbekannte Aktion." });
});
