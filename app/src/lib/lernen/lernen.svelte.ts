// Lernstand: was du schon kannst, was heute fällig ist, wie weit jeder Kurs ist.
// Inhalte (Kurse) werden erst beim Öffnen geladen; der Lernstand liegt in org_lernstand.
import { sb } from "../supabase";
import { auth } from "../auth.svelte";
import { daten } from "../daten.svelte";
import { lies, merk } from "../speicher";
import { org } from "../organizer/org.svelte";
import { tagBeginn, tagKey, plusTage } from "../organizer/zeit";
import { norm } from "../organizer/schnell";
import { beherrschung, weiter } from "./pruefen";
import { istDesktop } from "../appupdate.svelte";
import { KURSE, type Frage, type Kurs, type KursId, type KursKopf, type Lektion, type Stand } from "./typen";

// Die Inhalte liegen privat im eigenen Speicher (organizer/<user>/lernen/<kurs>.json), nicht im öffentlichen Code.
// Erst die gemerkte Fassung (sofort, auch offline), dann im Hintergrund die neueste.
const CACHE = "lernen-v1";
async function ausCache(id: KursId): Promise<Kurs | null> {
  try { const c = await caches.open(CACHE); const r = await c.match(`/lernen/${id}.json`); return r ? await r.json() : null; } catch { return null; }
}
async function inCache(id: KursId, text: string) {
  try { const c = await caches.open(CACHE); await c.put(`/lernen/${id}.json`, new Response(text, { headers: { "content-type": "application/json" } })); } catch { /* ohne Cache weiter */ }
}
async function ausSpeicher(id: KursId): Promise<{ kurs: Kurs; text: string } | null> {
  const uid = auth.session?.user.id; if (!uid) return null;
  const r = await sb.storage.from("organizer").download(`${uid}/lernen/${id}.json`);
  if (r.error || !r.data) return null;
  const text = await r.data.text();
  try { return { kurs: JSON.parse(text), text }; } catch { return null; }
}

/** Zeit für eine Lektion im Plan: Lesen + Abfrage (etwa 35 Sekunden je Frage), auf 5 Minuten gerundet */
// Tabellen zum Selbstausfüllen zählen nicht mit: Sie sind zusätzliches Praxis-Training und würden den ohnehin vollen Lernplan weiter aufblähen.
export const lektionsDauer = (l: Lektion) => Math.max(15, Math.ceil((l.dauer_min + l.fragen.filter((f) => f.typ !== "tabelle").length * 0.6) / 5) * 5);
export type Lauf = { id: string; kurs: KursId; punkte: number; max: number; dauer_s: number; fehler: string[]; erstellt: string };
export type Eintrag = { kurs: Kurs; lektion: Lektion; frage: Frage; schluessel: string };

class Lernen {
  stand = $state<Record<string, Stand>>(lies("lern:stand", {}));
  laeufe = $state<Lauf[]>(lies("lern:laeufe", []));
  kurse = $state<Partial<Record<KursId, Kurs>>>({});
  geladen = $state(false);
  #warte = new Map<KursId, Promise<Kurs>>();

  async laden() {
    const [s, l] = await Promise.all([
      sb.from("org_lernstand").select("schluessel,box,faellig,richtig,falsch,zuletzt").limit(10000),
      sb.from("org_pruefungslauf").select("*").order("erstellt", { ascending: false }).limit(200),
    ]);
    if (s.error || l.error) { if (!this.geladen) daten.melden("Lernstand nicht geladen: " + (s.error ?? l.error)!.message, undefined, true); return; }
    this.stand = Object.fromEntries(((s.data ?? []) as Stand[]).map((x) => [x.schluessel, x]));
    this.laeufe = ((l.data ?? []) as any[]).map((x) => ({ ...x, punkte: Number(x.punkte), max: Number(x.max) }));
    this.geladen = true; merk("lern:stand", this.stand); merk("lern:laeufe", this.laeufe);
  }

  fehlt = $state<KursId[]>([]);
  kurs(id: KursId): Promise<Kurs | null> {
    const da = this.kurse[id]; if (da) return Promise.resolve(da);
    let p = this.#warte.get(id);
    if (!p) {
      p = (async () => {
        const alt = await ausCache(id);
        if (alt) this.kurse = { ...this.kurse, [id]: alt };
        const neu = await ausSpeicher(id).catch(() => null);
        if (neu && neu.kurs.stand !== alt?.stand) { this.kurse = { ...this.kurse, [id]: neu.kurs }; inCache(id, neu.text); }
        if (!alt && !neu) { this.fehlt = [...new Set([...this.fehlt, id])]; this.#warte.delete(id); return null; }
        return this.kurse[id]!;
      })() as Promise<Kurs>;
      this.#warte.set(id, p);
    }
    return p;
  }
  alleLaden() { return Promise.all(KURSE.map((k) => this.kurs(k.id))); }

  /** Lektion mit Kapitel, Nachbarn und Position im Kurs */
  finde(k: Kurs, id: string) {
    const alle = k.kapitel.flatMap((c) => c.lektionen.map((l) => ({ kapitel: c, lektion: l })));
    const i = alle.findIndex((x) => x.lektion.id === id);
    if (i < 0) return null;
    return { ...alle[i], nr: i + 1, gesamt: alle.length, vor: alle[i - 1]?.lektion ?? null, nach: alle[i + 1]?.lektion ?? null };
  }
  /** Lektionen ohne Aufgabe im Plan (noch nicht gelesen) */
  ungeplant(id: KursId) {
    const k = this.kurse[id]; if (!k) return 0;
    const da = new Set(org.aufgaben.filter((a) => a.lektion?.startsWith(id + "/")).map((a) => a.lektion));
    return k.kapitel.flatMap((c) => c.lektionen).filter((l) => !da.has(`${id}/${l.id}`) && !this.gelesen(id, l.id)).length;
  }
  /** Geplante Termine der Lektionen aus dem Organizer (Aufgaben mit Lektion) */
  plan(k: KursId) {
    const m = new Map<string, { geplant: string | null; erledigt: boolean; id: string }>();
    for (const a of org.aufgaben) if (a.lektion?.startsWith(k + "/")) { const id = a.lektion.slice(k.length + 1), alt = m.get(id); if (!alt || (a.geplant ?? "") < (alt.geplant ?? "~")) m.set(id, { geplant: a.geplant, erledigt: !!a.erledigt, id: a.id }); }
    return m;
  }

  // ---------- Schlüssel
  key = (k: KursId, l: string, f: string) => `${k}/${l}/${f}`;
  heute = () => tagKey(org.jetzt);

  /** Klausurtermin: aus dem Kalender (Fach + Klausur), sonst der bekannte Termin */
  klausur(k: KursKopf): string {
    const fach = this.fach(k);
    const t = fach && org.termine.filter((x) => x.art === "klausur" && x.fach_id === fach.id).sort((a, b) => a.start.localeCompare(b.start)).find((x) => Date.parse(x.ende) > org.jetzt);
    return t?.start ?? k.klausur;
  }
  fach(k: KursKopf) { const n = k.fach.map(norm); return org.faecher.find((f) => n.includes(norm(f.name)) || (f.name_lang && n.includes(norm(f.name_lang)))) ?? null; }
  /** Letzter Wiederholungstag vor der Klausur */
  bis = (k: KursKopf) => tagKey(plusTage(new Date(this.klausur(k)), -1));

  // ---------- Fortschritt
  fragenVon = (l: Lektion) => l.fragen;
  boxen(k: Kurs, l: Lektion) { return l.fragen.map((f) => this.stand[this.key(k.id, l.id, f.id)]?.box ?? 0); }
  lektionStand(k: Kurs, l: Lektion) { return beherrschung(this.boxen(k, l)); }
  gelesen = (k: KursId, l: string) => !!this.stand[`gelesen:${k}/${l}`];
  kursStand(k: Kurs) {
    const boxen = k.kapitel.flatMap((c) => c.lektionen.flatMap((l) => this.boxen(k, l)));
    const lek = k.kapitel.flatMap((c) => c.lektionen);
    return { wert: beherrschung(boxen), fragen: boxen.length, sicher: boxen.filter((b) => b >= 4).length, neu: boxen.filter((b) => b === 0).length, gelesen: lek.filter((l) => this.gelesen(k.id, l.id)).length, lektionen: lek.length };
  }
  /** Fällige Wiederholungen (schon gesehene Fragen, deren Termin erreicht ist) */
  faellig(k: Kurs): Eintrag[] {
    const h = this.heute(), out: Eintrag[] = [];
    for (const c of k.kapitel) for (const l of c.lektionen) for (const f of l.fragen) {
      const s = this.stand[this.key(k.id, l.id, f.id)];
      if (s && s.box > 0 && s.faellig && s.faellig <= h) out.push({ kurs: k, lektion: l, frage: f, schluessel: this.key(k.id, l.id, f.id) });
    }
    return out;
  }
  anzahlFaellig(id?: KursId) { return KURSE.filter((k) => !id || k.id === id).reduce((n, k) => n + (this.kurse[k.id] ? this.faellig(this.kurse[k.id]!).length : 0), 0); }
  /** Nächste Lektion: erste, die noch nicht gelesen oder noch nicht sicher ist */
  naechste(k: Kurs): Lektion | null {
    for (const c of k.kapitel) for (const l of c.lektionen) if (!this.gelesen(k.id, l.id) || this.lektionStand(k, l) < 0.5) return l;
    return null;
  }

  /** Offene Lektions-Aufgaben, deren Dauer nicht mehr zur (inzwischen aktualisierten) Lektion passt */
  veraltet(id: KursId) {
    const k = this.kurse[id]; if (!k) return [];
    const m = new Map<string, Lektion>(k.kapitel.flatMap((c) => c.lektionen).map((l) => [`${id}/${l.id}`, l]));
    return org.aufgaben.filter((a) => !a.erledigt && a.lektion && m.has(a.lektion) && lektionsDauer(m.get(a.lektion)!) !== a.dauer_min);
  }

  // ---------- Lernplan im Organizer: je Lektion eine Aufgabe (mit Link), Fristen gestaffelt bis 3 Tage vor der Klausur,
  // dazu zwei Prüfungssimulationen. Danach plant der Organizer alles in freie Lernzeit.
  // Gibt es schon einen Plan und die Lerninhalte wurden aktualisiert, wird er nachgezogen: neue Lektionen (z. B. Lernchecks)
  // kommen direkt hinter die Lektion davor im selben Kapitel, geänderte Lernzeiten werden übernommen, dann wird alles neu verteilt.
  async planAnlegen(ids: KursId[]) {
    const neu = new Set<string>(); let n = 0, angepasst = 0, nachtrag = false;
    for (const id of ids) {
      const k = await this.kurs(id); if (!k) continue;
      const kopf = KURSE.find((x) => x.id === id)!, fach = this.fach(kopf);
      for (const a of this.veraltet(id)) {
        const l = k.kapitel.flatMap((c) => c.lektionen).find((x) => `${id}/${x.id}` === a.lektion); if (!l) continue;
        if (await org.aufgabeSpeichern({ ...a, dauer_min: lektionsDauer(l) }, false)) { angepasst++; nachtrag = true; }
      }
      const meine = org.aufgaben.filter((a) => a.lektion?.startsWith(id + "/"));
      const vorhanden = new Set(meine.map((a) => a.lektion!)), hatPlan = meine.some((a) => !a.lektion!.endsWith("/pruefung"));
      const lek = k.kapitel.flatMap((c) => c.lektionen).filter((l) => !vorhanden.has(`${id}/${l.id}`) && !this.gelesen(id, l.id));
      const heute = tagBeginn(org.jetzt), klausur = tagBeginn(new Date(this.klausur(kopf)));
      const ende = plusTage(klausur, -3), spanne = Math.max(1, Math.round((ende.getTime() - heute.getTime()) / 86_400_000));
      for (let i = 0; i < lek.length; i++) {
        const l = lek[i]; let frist = tagKey(plusTage(heute, Math.max(0, Math.ceil(((i + 1) / lek.length) * spanne) - 1))), position = Date.now() / 1e6 + n++;
        if (hatPlan) {
          const kap = k.kapitel.find((c) => c.lektionen.includes(l))!;
          const davor = kap.lektionen.slice(0, kap.lektionen.indexOf(l)).map((x) => meine.find((a) => !a.erledigt && a.lektion === `${id}/${x.id}`)).filter((a) => !!a).pop();
          if (davor) { frist = davor.frist ?? frist; position = davor.position + 0.5; }
          else frist = tagKey(plusTage(heute, Math.min(2, spanne)));   // Kapitel schon durch: bald nachholen
          nachtrag = true;
        }
        const dauer = lektionsDauer(l);
        const r = await org.aufgabeSpeichern({ titel: `${kopf.titel}: ${l.titel}`.slice(0, 300), fach_id: fach?.id ?? null, dauer_min: dauer, frist, prio: 2, lektion: `${id}/${l.id}`, position }, false);
        if (r) { neu.add(r.id); meine.push(r); }
      }
      // eine Prüfungssimulation in den letzten Tagen vor der Klausur (wichtig: vor den letzten Lektionen eingeplant)
      if (!vorhanden.has(`${id}/pruefung`)) {
        const frist = tagKey(plusTage(klausur, -5));
        if (frist >= tagKey(heute)) {
          const r = await org.aufgabeSpeichern({ titel: `${kopf.titel}: Prüfungssimulation (kurz)`, fach_id: fach?.id ?? null, dauer_min: 35, frist, prio: 1, lektion: `${id}/pruefung`, position: 0 }, false);
          if (r) neu.add(r.id);
        }
      }
    }
    if (nachtrag) await org.planen(undefined, true);   // der bestehende Plan hat sich geändert: alles neu verteilen, damit die Reihenfolge stimmt
    else if (neu.size) await org.planen(neu, true);
    return { neu: neu.size, angepasst };
  }

  /** Original-Skript öffnen, auf Wunsch an einer Folie */
  async skriptOeffnen(datei: string, seite?: number) {
    const uid = auth.session?.user.id; if (!uid) return;
    const { data, error } = await sb.storage.from("organizer").createSignedUrl(`${uid}/skripte/${datei}`, 3600);
    if (error || !data?.signedUrl) { daten.melden("Skript nicht gefunden", undefined, true); return; }
    const url = data.signedUrl + (seite ? `#page=${seite}` : "");
    if (istDesktop()) { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(url); }
    else window.open(url, "_blank", "noopener");
  }
  /** Erste Folienangabe einer Quelle („Skript Folien 45–58“ → 45) */
  folie = (quelle?: string) => { const m = quelle?.match(/Folien?\s+(\d+)/i) ?? quelle?.match(/\bF\s?(\d+)/) ?? quelle?.match(/\bS(?:eiten?|\.)\s*(\d+)/); return m ? Number(m[1]) : undefined; };

  // ---------- Schreiben
  async #speichern(z: Stand[]) {
    const uid = auth.session?.user.id; if (!uid || !z.length) return;
    const r = await sb.from("org_lernstand").upsert(z.map((s) => ({ user_id: uid, ...s })), { onConflict: "user_id,schluessel" });
    if (r.error) daten.melden("Lernstand nicht gespeichert: " + r.error.message, undefined, true);
  }
  async antwort(k: KursKopf, schluessel: string, anteil: number) {
    const s = weiter(this.stand[schluessel], schluessel, anteil, this.heute(), this.bis(k));
    this.stand = { ...this.stand, [schluessel]: s }; merk("lern:stand", this.stand);
    await this.#speichern([s]);
    return s;
  }
  async alsGelesen(k: KursId, l: string) {
    const schluessel = `gelesen:${k}/${l}`; if (this.stand[schluessel]) return;
    const s: Stand = { schluessel, box: 0, faellig: null, richtig: 0, falsch: 0, zuletzt: new Date().toISOString() };
    this.stand = { ...this.stand, [schluessel]: s }; merk("lern:stand", this.stand);
    await this.#speichern([s]);
    // passende Aufgabe im Plan abhaken
    const a = org.aufgaben.find((x) => !x.erledigt && x.lektion === `${k}/${l}`);
    if (a) await org.erledigen(a, true);
  }
  async laufSpeichern(l: Omit<Lauf, "id" | "erstellt">) {
    const z = { id: crypto.randomUUID(), erstellt: new Date().toISOString(), ...l };
    this.laeufe = [z, ...this.laeufe]; merk("lern:laeufe", this.laeufe);
    const r = await sb.from("org_pruefungslauf").insert({ ...z, user_id: auth.session?.user.id });
    if (r.error) daten.melden("Prüfung nicht gespeichert: " + r.error.message, undefined, true);
    const a = org.aufgaben.filter((x) => !x.erledigt && x.lektion === `${l.kurs}/pruefung`).sort((x, y) => (x.frist ?? "").localeCompare(y.frist ?? ""))[0];
    if (a) await org.erledigen(a, true);
  }
}

export const lernen = new Lernen();
