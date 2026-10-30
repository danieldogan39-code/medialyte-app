// Zähler-Dienst (Cloudflare) für die App: wer hat Demo oder Angebot geöffnet, wer möchte zurückgerufen werden.
// Der Leseschlüssel liegt nur auf dem Server (Tabelle geheim, vom Agenten eingetragen), nie im Gerät.
//   {aktion: "stand"}                      → {aufrufe: {kurzcode: [{z, g, s}]}, anfragen: {slug: [{...}]}}
//   {aktion: "anfrage_entfernen", slug, zeit} → Rückrufwunsch, der nur ein Test war, entfernen
//   {aktion: "tischbuecher"}               → {lokale: {slug: Lage}, heute}  (Recht Kunden)
//   {aktion: "tischbuch", slug}            → {lokal, anfragen, heute}      (Recht Kunden, Gästedaten nur durchgereicht)
import { admin, alsNutzer, cors, json } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });
  let e: Record<string, any> = {};
  try { e = await req.json(); } catch { /* leer */ }

  const nutzer = alsNutzer(req);
  const schreiben = e.aktion === "anfrage_entfernen", tb = e.aktion === "tischbuecher" || e.aktion === "tischbuch";
  const { data: darf } = await nutzer.rpc("darf", { p_bereich: tb ? "kunden" : "akquise", p_schreiben: schreiben });
  if (darf !== true) return json(403, { ok: false, error: "Dafür fehlt dir das Recht." });

  const { data: g } = await admin().from("geheim").select("wert").eq("name", "zaehler").maybeSingle();
  const z = g?.wert as { url?: string; schluessel?: string } | undefined;
  if (!z?.url || !z?.schluessel) return json(200, { ok: true, aufrufe: {}, anfragen: {}, lokale: null, hinweis: "Zähler-Dienst noch nicht verbunden" });
  const basis = z.url.replace(/\/$/, ""), h = { Authorization: `Bearer ${z.schluessel}`, "Content-Type": "application/json" };

  if (tb) {
    if (e.aktion === "tischbuch" && !/^[a-z0-9-]{3,80}$/.test(String(e.slug ?? ""))) return json(400, { ok: false, error: "Restaurant fehlt" });
    const r = await fetch(e.aktion === "tischbuch" ? `${basis}/t/einsicht?l=${encodeURIComponent(e.slug)}` : `${basis}/t/lokale`, { headers: h });
    if (!r.ok) return json(r.status === 404 ? 404 : 502, { ok: false, error: r.status === 404 ? "Dieses Tischbuch gibt es nicht (mehr)." : "Der Dienst ist gerade nicht erreichbar." });
    return json(200, { ok: true, ...(await r.json()) });
  }

  if (schreiben) {
    const r = await fetch(`${basis}/anfragen`, { method: "DELETE", headers: h, body: JSON.stringify({ slug: e.slug, zeit: e.zeit }) });
    return json(r.ok ? 200 : 502, { ok: r.ok });
  }
  const [l, a] = await Promise.all([fetch(`${basis}/liste`, { headers: h }), fetch(`${basis}/anfragen`, { headers: h })]);
  const aufrufe: Record<string, any[]> = {}, anfragen: Record<string, any[]> = {};
  if (l.ok) for (const x of (await l.json()).aufrufe ?? []) if (x.k && x.z) (aufrufe[x.k] ??= []).push({ z: x.z, g: x.g, s: x.s });
  if (a.ok) for (const x of (await a.json()).anfragen ?? []) if (x.slug && x.zeit) (anfragen[x.slug] ??= []).push(x);
  for (const k in aufrufe) aufrufe[k].sort((p, q) => (p.z < q.z ? 1 : -1));
  for (const k in anfragen) anfragen[k].sort((p, q) => (p.zeit < q.zeit ? 1 : -1));
  return json(200, { ok: true, aufrufe, anfragen });
});
