// Nimmt Terminanfragen von medialyte.de entgegen (signiert mit HMAC-SHA256) und legt sie in der App ab.
// Aufruf: POST, Kopfzeile X-Medialyte-Signature: sha256=<hex>, Inhalt: Buchung wie in api/termin.php gespeichert.
// Auch eine Liste von Buchungen ist erlaubt (einmalige Übernahme der bisherigen Anfragen).
import { admin, gleich, hmacHex, json } from "../_shared/util.ts";

type Buchung = Record<string, any>;

function zeile(b: Buchung) {
  const t = b.termin && b.termin.start ? b.termin : null;
  return {
    extern_id: String(b.id ?? "").slice(0, 80) || null,
    eingang: b.erstellt ?? new Date().toISOString(),
    quelle: "website",
    art: t ? "termin" : b.rueckruf ? "rueckruf" : "nachricht",
    pruefen: !!b.pruefen,
    name: b.name ?? null,
    firma: b.firma ?? null,
    branche: b.branche ?? null,
    website: b.website ?? null,
    ort: b.ort ?? null,
    groesse: b.groesse ?? null,
    email: b.email ?? null,
    telefon: b.telefon ?? null,
    whatsapp_ok: !!b.whatsapp_ok,
    anliegen: Array.isArray(b.anliegen_text) && b.anliegen_text.length ? b.anliegen_text : (b.anliegen ?? []),
    nachricht: b.nachricht ?? null,
    format: b.format ?? null,
    termin: t ? t.start : null,
    dauer_min: t ? Number(t.dauer_min) || 30 : null,
    rueckruf: b.rueckruf?.zeitfenster ?? null,
    daten: { quelle: b.quelle ?? {}, anliegen_codes: b.anliegen ?? [], einwilligung: !!b.einwilligung },
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false });
  const secret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  const body = await req.text();
  if (!secret || body.length > 2_000_000) return json(400, { ok: false });
  const sig = (req.headers.get("X-Medialyte-Signature") ?? "").replace(/^sha256=/, "");
  if (!gleich(sig, await hmacHex(secret, body))) return json(401, { ok: false, error: "Signatur ungültig" });

  let daten: unknown;
  try { daten = JSON.parse(body); } catch { return json(400, { ok: false }); }
  const liste = (Array.isArray(daten) ? daten : [daten]).filter((b) => b && typeof b === "object") as Buchung[];
  const zeilen = liste.map(zeile).filter((z) => z.extern_id);
  if (!zeilen.length) return json(200, { ok: true, neu: 0 });

  const db = admin();
  // Kategorie aus der Branche raten (in der Datenbank, damit es überall gleich ist)
  for (const z of zeilen) {
    const { data } = await db.rpc("kategorie_raten", { p: [z.branche, z.firma].filter(Boolean).join(" ") });
    (z as any).kategorie = data ?? null;
  }
  // Vorhandene nicht überschreiben (Status, Zuweisung bleiben, was das Team eingestellt hat)
  const { data, error } = await db.from("anfragen").upsert(zeilen, { onConflict: "extern_id", ignoreDuplicates: true }).select("id");
  if (error) return json(500, { ok: false, error: error.message });
  return json(200, { ok: true, neu: data?.length ?? 0 });
});
