// Kalender-Abos des Organizers abgleichen: iCal-Adressen (ISM-Stundenplan, „Geheime Adresse“ aus Google Kalender …)
// abrufen und die Termine der nächsten Monate in org_termine schreiben. Immer nur die eigenen Abos des Aufrufers.
//   {aktion: "abgleichen", id?}  → {ok, kalender: [{id, name, anzahl, fehler}]}
// Die Adressen sind privat (wer sie kennt, sieht den Kalender) und bleiben auf dem Server bzw. in der eigenen Zeile.
import { admin, alsNutzer, cors, json } from "../_shared/util.ts";
import { lesen } from "./ics.ts";

const VORHER_TAGE = 21, NACHHER_TAGE = 200, MAX_BYTES = 6_000_000;

// Nur öffentliche Adressen abrufen (kein Zugriff auf interne Dienste über einen präparierten Link)
function erlaubt(u: URL): boolean {
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".supabase.co") || h === "metadata.google.internal") return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":") || h.startsWith("[")) return false;   // keine IP-Adressen
  return true;
}

async function holen(adresse: string): Promise<string> {
  const u = new URL(adresse.replace(/^webcal:/i, "https:"));
  if (!erlaubt(u)) throw new Error("Nur https-Adressen mit Domainnamen sind erlaubt.");
  const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "User-Agent": "Medialyte-Organizer/1.0" } });
  if (!erlaubt(new URL(r.url || u.href))) throw new Error("Die Adresse leitet auf eine nicht erlaubte Adresse weiter.");
  if (r.status === 404) throw new Error("Kalender nicht gefunden (404). Stimmt die Adresse noch?");
  if (r.status === 401 || r.status === 403) throw new Error("Kein Zugriff auf den Kalender. Bei Google die „Geheime Adresse im iCal-Format“ nehmen.");
  if (!r.ok) throw new Error(`Kalender nicht erreichbar (HTTP ${r.status}).`);
  const len = Number(r.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("Kalender-Datei ist zu groß.");
  const t = await r.text();
  if (t.length > MAX_BYTES) throw new Error("Kalender-Datei ist zu groß.");
  if (!/BEGIN:VCALENDAR/i.test(t)) throw new Error("Unter der Adresse liegt kein Kalender (keine .ics-Datei). Bitte den Abo- bzw. iCal-Link nehmen, nicht die normale Webseite.");
  return t;
}

// Fach im Titel? (enthalten, oder jedes Wort des Fachs beginnt ein Wort im Titel: „wiss arbeiten“ ↔ „wissenschaftliches arbeiten“)
const KUERZEL: Record<string, string> = { bwl: "betriebswirtschaft", vwl: "volkswirtschaft", rewe: "rechnungswesen", wiar: "wissenschaftliches arbeiten", kalk: "kalkulation" };
function passt(fach: string, titel: string): boolean {
  if (titel.includes(fach)) return true;
  if (KUERZEL[fach] && titel.includes(KUERZEL[fach])) return true;
  const worte = titel.split(" "), fw = fach.split(" ").filter(Boolean);
  return fw.length > 0 && fw.every((x) => x.length >= 2 && worte.some((w) => w.startsWith(x)));
}
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function artVon(titel: string, kalenderArt: string, notiz: string | null): string {
  const art = norm((notiz ?? "").split("\n")[0]);   // ISM: erste Zeile der Beschreibung ist die Art
  if (/^(prufung|klausur|exam)/.test(art)) return "klausur";
  if (/^(abgabe|deadline)/.test(art)) return "abgabe";
  if (/^(vorlesung|seminar|ubung|tutorium|lecture)/.test(art)) return "vorlesung";
  if (/^sonstige/.test(art)) return "termin";
  const t = norm(titel);
  if (/\b(klausur|prufung|exam|nachschreib)/.test(t)) return "klausur";
  if (/\b(abgabe|deadline|einreichung)/.test(t)) return "abgabe";
  return kalenderArt === "ism" ? "vorlesung" : "termin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });
  let e: Record<string, any> = {};
  try { e = await req.json(); } catch { /* leer */ }
  if (e.aktion !== "abgleichen") return json(400, { ok: false, error: "Unbekannte Aktion" });

  // Im Namen des Aufrufers lesen: die Zugriffsregeln liefern nur eigene Abos (mit Recht und Zwei-Faktor)
  const nutzer = alsNutzer(req);
  let q = nutzer.from("org_kalender").select("id,user_id,name,url,art,fach_id");
  if (typeof e.id === "string") q = q.eq("id", e.id);
  const { data: abos, error } = await q;
  if (error) return json(403, { ok: false, error: "Dafür fehlt dir das Recht." });
  if (!abos?.length) return json(200, { ok: true, kalender: [] });

  const db = admin();
  const user = abos[0].user_id as string;
  const { data: faecher } = await db.from("org_faecher").select("id,name").eq("user_id", user).eq("archiviert", false);
  const fachListe = (faecher ?? []).map((f) => ({ id: f.id as string, n: norm(f.name as string) })).filter((f) => f.n.length >= 3);
  const von = new Date(Date.now() - VORHER_TAGE * 864e5), bis = new Date(Date.now() + NACHHER_TAGE * 864e5);

  const ergebnis: { id: string; name: string; anzahl: number; fehler: string | null }[] = [];
  for (const k of abos) {
    try {
      const ereignisse = lesen(await holen(k.url), von, bis).slice(0, 3000);
      // Von Hand zugeordnete Fächer behalten (Abgleich ersetzt die Termine)
      const { data: alt } = await db.from("org_termine").select("extern_uid,fach_id").eq("kalender_id", k.id).not("fach_id", "is", null).limit(5000);
      const handFach = new Map((alt ?? []).map((x) => [x.extern_uid as string, x.fach_id as string]));
      const gesehen = new Set<string>();
      const zeilen = ereignisse.filter((x) => !gesehen.has(x.uid) && !!gesehen.add(x.uid)).map((x) => {
        const n = norm(x.titel);
        const fach = handFach.get(x.uid.slice(0, 500)) ?? k.fach_id ?? fachListe.find((f) => passt(f.n, n))?.id ?? null;
        return { user_id: user, kalender_id: k.id, extern_uid: x.uid.slice(0, 500), titel: x.titel.slice(0, 200), start: x.start.toISOString(), ende: x.ende.toISOString(),
          ganztag: x.ganztag, ort: x.ort?.slice(0, 200) ?? null, notiz: x.notiz, art: artVon(x.titel, k.art, x.notiz), fach_id: fach };
      });
      // Bestand im Zeitfenster ersetzen (ältere Termine bleiben als Verlauf stehen)
      const { error: delErr } = await db.from("org_termine").delete().eq("kalender_id", k.id).gte("ende", von.toISOString());
      if (delErr) throw new Error(delErr.message);
      for (let i = 0; i < zeilen.length; i += 500) {
        const { error: insErr } = await db.from("org_termine").upsert(zeilen.slice(i, i + 500), { onConflict: "kalender_id,extern_uid" });
        if (insErr) throw new Error(insErr.message);
      }
      // Gleiche Vorlesung/Prüfung schon von Hand (z. B. aus dem Lernplan) eingetragen? Dann gilt die aus dem Kalender.
      const feste = zeilen.filter((z) => z.art === "vorlesung" || z.art === "klausur").map((z) => z.start);
      for (let i = 0; i < feste.length; i += 100)
        await db.from("org_termine").delete().eq("user_id", user).is("kalender_id", null).in("art", ["vorlesung", "klausur"]).in("start", feste.slice(i, i + 100));
      await db.from("org_kalender").update({ zuletzt: new Date().toISOString(), fehler: null }).eq("id", k.id);
      ergebnis.push({ id: k.id, name: k.name, anzahl: zeilen.length, fehler: null });
    } catch (err) {
      const f = String((err as Error)?.message ?? err).slice(0, 300);
      await db.from("org_kalender").update({ fehler: f, zuletzt: new Date().toISOString() }).eq("id", k.id);
      ergebnis.push({ id: k.id, name: k.name, anzahl: 0, fehler: f });
    }
  }
  return json(200, { ok: true, kalender: ergebnis });
});
