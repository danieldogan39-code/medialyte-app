// Zähler-Dienst (Cloudflare) für die App: wer hat Demo oder Angebot geöffnet, wer möchte zurückgerufen werden.
// Der Leseschlüssel liegt nur auf dem Server (Tabelle geheim, vom Agenten eingetragen), nie im Gerät.
//   {aktion: "stand"}                      → {aufrufe: {kurzcode: [{z, g, s}]}, anfragen: {slug: [{...}]}}
//   {aktion: "anfrage_entfernen", slug, zeit} → Rückrufwunsch, der nur ein Test war, entfernen
//   {aktion: "tischbuecher"}               → {lokale: {slug: Lage}, heute}  (Recht Kunden)
//   {aktion: "tischbuch", slug}            → {lokal, anfragen, heute}      (Recht Kunden, Gästedaten nur durchgereicht)
//   {aktion: "push_info"}                  → {vapid, geraete}               Benachrichtigungen (Recht Akquise)
//   {aktion: "push_an", abo, geraet} / {aktion: "push_aus", endpoint} / {aktion: "push_test"}
//   {aktion: "zugang"}                     → {url, schluessel}  nur mit Schreibrecht Kunden: für die Tischbuch-Live-Ansicht
//   {aktion: "agent_demo", slug, name}     → Demo-Tischbuch „demo-<slug>“ anlegen (Website-Agent ausprobieren)
import { admin, alsNutzer, cors, json } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });
  let e: Record<string, any> = {};
  try { e = await req.json(); } catch { /* leer */ }

  const nutzer = alsNutzer(req);
  const voll = e.aktion === "zugang" || e.aktion === "agent_demo";
  const schreiben = e.aktion === "anfrage_entfernen" || voll, tb = e.aktion === "tischbuecher" || e.aktion === "tischbuch" || voll;
  const { data: darf } = await nutzer.rpc("darf", { p_bereich: tb ? "kunden" : "akquise", p_schreiben: schreiben });
  if (darf !== true) return json(403, { ok: false, error: "Dafür fehlt dir das Recht." });

  const { data: g } = await admin().from("geheim").select("wert").eq("name", "zaehler").maybeSingle();
  const z = g?.wert as { url?: string; schluessel?: string } | undefined;
  if (!z?.url || !z?.schluessel) return json(200, { ok: true, aufrufe: {}, anfragen: {}, lokale: null, hinweis: "Zähler-Dienst noch nicht verbunden" });
  const basis = z.url.replace(/\/$/, ""), h = { Authorization: `Bearer ${z.schluessel}`, "Content-Type": "application/json" };

  if (e.aktion === "zugang") return json(200, { ok: true, url: basis, schluessel: z.schluessel });
  if (e.aktion === "agent_demo") {
    if (!/^[a-z0-9-]{3,75}$/.test(String(e.slug ?? ""))) return json(400, { ok: false, error: "Demo fehlt" });
    const r = await fetch(`${basis}/t/lokale`, { method: "POST", headers: h,
      body: JSON.stringify({ lokale: { [`demo-${e.slug}`]: { name: String(e.name ?? e.slug).slice(0, 80), demo: true } } }) });
    return json(r.ok ? 200 : 502, { ok: r.ok, lokal: `demo-${e.slug}` });
  }
  if (e.aktion?.startsWith?.("push_")) {
    const vapid = (z as any).vapid ?? null;
    if (e.aktion === "push_info") {
      const r = await fetch(`${basis}/abo`, { headers: h });
      const j = r.ok ? await r.json() : null;
      return json(200, { ok: true, vapid, fcm: j ? !!j.fcm : null, geraete: j ? j.geraete ?? 0 : null });
    }
    if (e.aktion === "push_an") {
      const ziel = typeof e.fcm === "string" ? { fcm: e.fcm } : { abo: e.abo };
      const r = await fetch(`${basis}/abo`, { method: "POST", headers: h, body: JSON.stringify({ ...ziel, geraet: String(e.geraet ?? "").slice(0, 60) }) });
      return json(r.ok ? 200 : 502, { ok: r.ok });
    }
    if (e.aktion === "push_aus") {
      const r = await fetch(`${basis}/abo`, { method: "DELETE", headers: h, body: JSON.stringify(typeof e.fcm === "string" ? { fcm: e.fcm } : { abo: { endpoint: e.endpoint } }) });
      return json(r.ok ? 200 : 502, { ok: r.ok });
    }
    if (e.aktion === "push_test") {
      const r = await fetch(`${basis}/melden`, { method: "POST", headers: h, body: JSON.stringify({ titel: "Benachrichtigungen sind an",
        text: "Du erfährst jetzt sofort, wenn jemand seine Demo öffnet, um Rückruf bittet oder ein Gast im Tischbuch wartet.", url: "./", tag: "probe" }) });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      return json(r.ok ? 200 : 502, { ok: r.ok, gesendet: j.gesendet ?? null, geraete: j.geraete ?? null, fehler: j.fehler ?? [], error: r.ok ? undefined : "Zähler-Dienst nicht erreichbar" });
    }
    return json(400, { ok: false });
  }

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
