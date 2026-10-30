// Gibt offene Befehle aus der App an den Agenten weiter: startet im Repo website-agent den Workflow „App-Befehle“.
// Die App legt den Befehl selbst an (Zugriffsregeln prüfen Recht und Art) und ruft danach diese Funktion.
// Der GitHub-Schlüssel liegt nur hier auf dem Server (Secret AGENT_GITHUB_TOKEN), nie im Gerät.
import { admin, alsNutzer, cors, json } from "../_shared/util.ts";

const REPO = Deno.env.get("AGENT_REPO") ?? "danieldogan39-code/website-agent";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });

  const nutzer = alsNutzer(req);
  const [{ data: akquise }, { data: briefe }] = await Promise.all([
    nutzer.rpc("darf", { p_bereich: "akquise", p_schreiben: true }),
    nutzer.rpc("darf", { p_bereich: "briefe", p_schreiben: true }),
  ]);
  if (akquise !== true && briefe !== true) return json(403, { ok: false, error: "Dafür fehlt dir das Recht." });

  const token = Deno.env.get("AGENT_GITHUB_TOKEN");
  if (!token) return json(503, { ok: false, error: "Der Schlüssel für den Agenten fehlt noch (Secret AGENT_GITHUB_TOKEN)." });

  const db = admin();
  const { data: offen } = await db.from("befehle").select("id").eq("status", "offen").is("uebergeben", null);
  if (!offen?.length) return json(200, { ok: true, uebergeben: 0 });

  const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "medialyte-app", "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "app_befehle" }),
  });
  if (r.status !== 204) {
    const t = await r.text();
    return json(502, { ok: false, error: `GitHub hat abgelehnt (${r.status}): ${t.slice(0, 200)}` });
  }
  await db.from("befehle").update({ uebergeben: new Date().toISOString() }).in("id", offen.map((b) => b.id));
  return json(200, { ok: true, uebergeben: offen.length });
});
