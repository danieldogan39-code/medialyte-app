// Daten des Organizers: alles Eigene (Fächer, Termine, Aufgaben, Gewohnheiten, Kalender-Abos, Einstellungen).
// Startet sofort mit dem zuletzt gemerkten Stand, holt im Hintergrund das Neue und bleibt live (Handy ↔ Mac).
// Änderungen erscheinen sofort und werden danach gespeichert; schlägt das fehl, wird zurückgenommen.
import { sb } from "../supabase";
import { auth } from "../auth.svelte";
import { daten } from "../daten.svelte";
import { lies, merk } from "../speicher";
import { haptik } from "../haptik";
import { planen, gewohnheitsZeiten, type Iv } from "./planer";
import { MIN, TAG, beiMinute, minuten, plusTage, tagBeginn, tagKey, wochenBeginn, wochentag } from "./zeit";
import { lesen as icsLesen } from "./ics";
import { fachFuer, norm } from "./schnell";
import type { ImportPlan } from "./import";
import { EINST_STANDARD, FARBEN, type Aufgabe, type Block, type Einstellungen, type Fach, type Gewohnheit, type Kalender, type Log, type Termin } from "./typen";

const uuid = () => crypto.randomUUID();
const TABELLEN = ["org_faecher", "org_termine", "org_aufgaben", "org_gewohnheiten", "org_gewohnheit_log", "org_kalender"] as const;

function fehlerText(e: any): string {
  const m = String(e?.message ?? e ?? "");
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Keine Verbindung – bitte später nochmal.";
  if (/row-level security|permission denied/i.test(m)) return "Dafür fehlt dir das Recht.";
  return m || "Unbekannter Fehler";
}

class Organizer {
  faecher = $state<Fach[]>(lies("org:faecher", []));
  termine = $state<Termin[]>(lies("org:termine", []));
  aufgaben = $state<Aufgabe[]>(lies("org:aufgaben", []));
  gewohnheiten = $state<Gewohnheit[]>(lies("org:gewohnheiten", []));
  log = $state<Log[]>(lies("org:log", []));
  kalender = $state<Kalender[]>(lies("org:kalender", []));
  einst = $state<Einstellungen>(lies("org:einst", EINST_STANDARD));
  geladen = $state(lies("org:geladen", false));
  jetzt = $state(Date.now());           // tickt jede Minute: „Jetzt“-Linie, Countdowns
  plant = $state(false);
  #uhr: number | undefined;

  constructor() {
    if (typeof window !== "undefined") {
      this.#uhr = setInterval(() => (this.jetzt = Date.now()), 30_000) as unknown as number;
      addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { this.jetzt = Date.now(); if (auth.darf("organizer")) this.laden(); } });
    }
  }

  // ---------- Laden und live bleiben
  async laden() {
    const von = plusTage(tagBeginn(Date.now()), -45).toISOString(), bis = plusTage(tagBeginn(Date.now()), 240).toISOString();
    const erledigtSeit = plusTage(Date.now(), -90).toISOString();
    const [f, t, a, g, l, k, e] = await Promise.all([
      sb.from("org_faecher").select("*").order("position").order("name"),
      sb.from("org_termine").select("id,titel,start,ende,ganztag,ort,art,fach_id,notiz,kalender_id").gte("ende", von).lte("start", bis).order("start").limit(3000),
      sb.from("org_aufgaben").select("*").or(`erledigt.is.null,erledigt.gte.${erledigtSeit}`).order("position").limit(2000),
      sb.from("org_gewohnheiten").select("*").order("position").order("erstellt"),
      sb.from("org_gewohnheit_log").select("gewohnheit_id,tag").gte("tag", tagKey(plusTage(Date.now(), -120))),
      sb.from("org_kalender").select("*").order("erstellt"),
      sb.from("org_einstellungen").select("tag_start,tag_ende,puffer_min,tag_max_min,wochenende").maybeSingle(),
    ]);
    const fehler = [f, t, a, g, l, k, e].find((r) => r.error)?.error;
    if (fehler) { if (!this.geladen) daten.melden("Organizer nicht geladen: " + fehlerText(fehler), undefined, true); return; }
    this.faecher = merk("org:faecher", (f.data ?? []) as Fach[]);
    this.termine = merk("org:termine", (t.data ?? []) as Termin[]);
    this.aufgaben = merk("org:aufgaben", (a.data ?? []) as Aufgabe[]);
    this.gewohnheiten = merk("org:gewohnheiten", (g.data ?? []) as Gewohnheit[]);
    this.log = merk("org:log", (l.data ?? []) as Log[]);
    this.kalender = merk("org:kalender", (k.data ?? []) as Kalender[]);
    if (e.data) this.einst = merk("org:einst", { ...EINST_STANDARD, ...(e.data as any), tag_start: String(e.data.tag_start).slice(0, 5), tag_ende: String(e.data.tag_ende).slice(0, 5) });
    this.geladen = merk("org:geladen", true);
    // Kalender-Abos: höchstens alle 30 Minuten still im Hintergrund abgleichen
    const alt = this.kalender.filter((x) => !x.zuletzt || Date.now() - Date.parse(x.zuletzt) > 30 * MIN);
    if (alt.length) this.abgleichen(undefined, true);
  }

  live(): () => void {
    const uid = auth.session?.user.id; if (!uid) return () => {};
    let t: number | undefined;
    const neu = () => { clearTimeout(t); t = setTimeout(() => this.laden(), 400) as unknown as number; };
    const ch = sb.channel("organizer-" + uid);
    for (const tab of ["org_aufgaben", "org_termine", "org_gewohnheit_log"]) ch.on("postgres_changes" as any, { event: "*", schema: "public", table: tab, filter: `user_id=eq.${uid}` }, neu);
    ch.subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }

  #merken() {
    merk("org:faecher", this.faecher); merk("org:termine", this.termine); merk("org:aufgaben", this.aufgaben);
    merk("org:gewohnheiten", this.gewohnheiten); merk("org:log", this.log); merk("org:kalender", this.kalender);
  }

  /** Optimistisch ändern, speichern, bei Fehler zurück */
  async #schreiben<T extends { id?: string }>(liste: "faecher" | "termine" | "aufgaben" | "gewohnheiten" | "kalender", tabelle: (typeof TABELLEN)[number], zeile: T, loeschen = false): Promise<boolean> {
    const vorher = [...(this as any)[liste]] as any[];
    const i = vorher.findIndex((x) => x.id === zeile.id);
    if (loeschen) (this as any)[liste] = vorher.filter((x) => x.id !== zeile.id);
    else (this as any)[liste] = i >= 0 ? vorher.map((x, j) => (j === i ? { ...x, ...zeile } : x)) : [...vorher, zeile];
    const r = loeschen ? await sb.from(tabelle).delete().eq("id", zeile.id!) : i >= 0 ? await sb.from(tabelle).update(zeile as any).eq("id", zeile.id!) : await sb.from(tabelle).insert(zeile as any);
    if (r.error) { (this as any)[liste] = vorher; daten.melden("Nicht gespeichert: " + fehlerText(r.error), undefined, true); return false; }
    this.#merken(); return true;
  }

  // ---------- Fächer
  fach = (id: string | null | undefined) => (id ? this.faecher.find((f) => f.id === id) ?? null : null);
  farbe = (id: string | null | undefined, ersatz = "#8B98AD") => this.fach(id)?.farbe ?? ersatz;
  get aktiveFaecher() { return this.faecher.filter((f) => !f.archiviert); }
  naechsteFarbe() { const benutzt = new Set(this.faecher.map((f) => f.farbe)); return FARBEN.find((c) => !benutzt.has(c)) ?? FARBEN[this.faecher.length % FARBEN.length]; }
  async fachSpeichern(f: Partial<Fach> & { name: string }) {
    const z = { id: f.id ?? uuid(), name: f.name.trim(), farbe: f.farbe ?? this.naechsteFarbe(), position: f.position ?? this.faecher.length, archiviert: f.archiviert ?? false };
    return (await this.#schreiben("faecher", "org_faecher", z)) ? z : null;
  }
  fachLoeschen(f: Fach) { return this.#schreiben("faecher", "org_faecher", { id: f.id }, true); }

  // ---------- Aufgaben
  get offen() { return this.aufgaben.filter((a) => !a.erledigt); }
  /** Geplant in der Vergangenheit, aber nicht erledigt */
  get liegengeblieben() { const j = this.jetzt; return this.offen.filter((a) => a.geplant && Date.parse(a.geplant) + a.dauer_min * MIN < j); }
  async aufgabeSpeichern(a: Partial<Aufgabe> & { titel: string }, autoPlanen = true) {
    const neu = !a.id || !this.aufgaben.some((x) => x.id === a.id);
    const z: any = neu
      ? { id: a.id ?? uuid(), titel: a.titel.trim(), notiz: a.notiz ?? null, fach_id: a.fach_id ?? null, dauer_min: a.dauer_min ?? 60, frist: a.frist ?? null, prio: a.prio ?? 2,
          geplant: a.geplant ?? null, fixiert: a.fixiert ?? !!a.geplant, erledigt: a.erledigt ?? null, position: a.position ?? Date.now() / 1e6, erstellt: new Date().toISOString() }
      : { ...a, titel: a.titel.trim() };
    const ok = await this.#schreiben("aufgaben", "org_aufgaben", z);
    if (ok && autoPlanen && !z.geplant && !z.fixiert && !z.erledigt) await this.planen(new Set([z.id]), true);
    return ok ? z as Aufgabe : null;
  }
  async erledigen(a: Aufgabe, an = !a.erledigt) {
    haptik(an ? "erfolg" : "leicht");
    const ok = await this.#schreiben("aufgaben", "org_aufgaben", { id: a.id, erledigt: an ? new Date().toISOString() : null });
    if (ok && an) daten.melden(`„${a.titel.slice(0, 40)}“ erledigt`, { label: "Rückgängig", fn: () => this.erledigen({ ...a, erledigt: new Date().toISOString() }, false) });
  }
  async aufgabeLoeschen(a: Aufgabe) {
    const ok = await this.#schreiben("aufgaben", "org_aufgaben", { id: a.id }, true);
    if (ok) daten.melden("Aufgabe gelöscht", { label: "Rückgängig", fn: () => this.aufgabeSpeichern({ ...a }, false) });
  }

  // ---------- Termine
  async terminSpeichern(t: Partial<Termin> & { titel: string; start: string; ende: string }) {
    const neu = !t.id || !this.termine.some((x) => x.id === t.id);
    const z: any = neu ? { id: t.id ?? uuid(), titel: t.titel.trim(), start: t.start, ende: t.ende, ganztag: t.ganztag ?? false, ort: t.ort ?? null, art: t.art ?? "termin", fach_id: t.fach_id ?? null, notiz: t.notiz ?? null, kalender_id: null } : { ...t, titel: t.titel.trim() };
    const ok = await this.#schreiben("termine", "org_termine", z);
    if (ok) { this.termine = [...this.termine].sort((a, b) => a.start.localeCompare(b.start)); await this.#konflikteNeuPlanen(); }
    return ok;
  }
  terminLoeschen(t: Termin) { return this.#schreiben("termine", "org_termine", { id: t.id }, true); }
  get pruefungen() { const h = tagBeginn(this.jetzt).getTime(); return this.termine.filter((t) => (t.art === "klausur" || t.art === "abgabe") && Date.parse(t.ende) >= h).sort((a, b) => a.start.localeCompare(b.start)); }

  // ---------- Gewohnheiten
  async gewohnheitSpeichern(g: Partial<Gewohnheit> & { name: string }) {
    const neu = !g.id || !this.gewohnheiten.some((x) => x.id === g.id);
    const z: any = neu ? { id: g.id ?? uuid(), name: g.name.trim(), icon: g.icon ?? "dumbbell", farbe: g.farbe ?? "#4CC38A", pro_woche: g.pro_woche ?? 3, dauer_min: g.dauer_min ?? 60,
      uhrzeit: g.uhrzeit || null, tage: g.tage ?? [], aktiv: g.aktiv ?? true, position: g.position ?? this.gewohnheiten.length } : { ...g, uhrzeit: g.uhrzeit || null };
    const ok = await this.#schreiben("gewohnheiten", "org_gewohnheiten", z);
    if (ok) await this.#konflikteNeuPlanen();
    return ok;
  }
  gewohnheitLoeschen(g: Gewohnheit) { return this.#schreiben("gewohnheiten", "org_gewohnheiten", { id: g.id }, true); }
  hatLog = (g: Gewohnheit | string, tag: string) => this.log.some((l) => l.gewohnheit_id === (typeof g === "string" ? g : g.id) && l.tag === tag);
  async abhaken(g: Gewohnheit, tag = tagKey(this.jetzt)) {
    const an = !this.hatLog(g, tag), vorher = this.log;
    haptik(an ? "erfolg" : "leicht");
    this.log = an ? [...vorher, { gewohnheit_id: g.id, tag }] : vorher.filter((l) => !(l.gewohnheit_id === g.id && l.tag === tag));
    const r = an ? await sb.from("org_gewohnheit_log").insert({ gewohnheit_id: g.id, tag }) : await sb.from("org_gewohnheit_log").delete().eq("gewohnheit_id", g.id).eq("tag", tag);
    if (r.error && !(an && r.error.code === "23505")) { this.log = vorher; daten.melden("Nicht gespeichert: " + fehlerText(r.error), undefined, true); return; }
    merk("org:log", this.log);
    if (an) { const w = this.wocheStand(g); if (w.erreicht === w.ziel) daten.melden(`${g.name}: Wochenziel geschafft – ${w.ziel} von ${w.ziel}`); }
  }
  /** Stand der Woche: wie oft schon, Ziel, an welchen Tagen */
  wocheStand(g: Gewohnheit, bezug = this.jetzt) {
    const mo = wochenBeginn(bezug), tage = Array.from({ length: 7 }, (_, i) => tagKey(plusTage(mo, i)));
    const erreicht = tage.filter((t) => this.hatLog(g, t)).length;
    return { erreicht, ziel: g.pro_woche, tage };
  }
  /** Wochen in Folge mit erreichtem Ziel (die laufende zählt mit, wenn sie schon geschafft ist) */
  serie(g: Gewohnheit) {
    let n = 0, w = wochenBeginn(this.jetzt);
    const jetzt = this.wocheStand(g, w.getTime()); if (jetzt.erreicht >= g.pro_woche) n++;
    for (let i = 1; i < 18; i++) { w = plusTage(w, -7); if (this.wocheStand(g, w.getTime()).erreicht >= g.pro_woche) n++; else break; }
    return n;
  }
  /** Heute geplant? (feste Tage) bzw. noch nötig, um das Wochenziel zu schaffen */
  heuteDran(g: Gewohnheit) {
    if (!g.aktiv) return false;
    if (g.tage.length) return g.tage.includes(wochentag(this.jetzt));
    const s = this.wocheStand(g); return s.erreicht < s.ziel;
  }

  // ---------- Kalender-Abos
  async kalenderSpeichern(k: Partial<Kalender> & { name: string; url: string }) {
    const neu = !k.id || !this.kalender.some((x) => x.id === k.id);
    const z: any = neu ? { id: k.id ?? uuid(), name: k.name.trim(), url: k.url.trim().replace(/^webcal:/i, "https:"), art: k.art ?? "sonstige", farbe: k.farbe ?? "#8B98AD", fach_id: k.fach_id ?? null, zuletzt: null, fehler: null } : { ...k };
    const ok = await this.#schreiben("kalender", "org_kalender", z);
    if (ok) await this.abgleichen(z.id);
    return ok;
  }
  kalenderLoeschen(k: Kalender) { const ok = this.#schreiben("kalender", "org_kalender", { id: k.id }, true); ok.then((j) => { if (j) this.termine = this.termine.filter((t) => t.kalender_id !== k.id); }); return ok; }
  gleichtAb = $state(false);
  async abgleichen(id?: string, still = false) {
    if (this.gleichtAb) return; this.gleichtAb = true;
    try {
      const { data, error } = await sb.functions.invoke("kalender", { body: { aktion: "abgleichen", id } });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Dienst nicht erreichbar");
      const fehler = (data.kalender as any[]).filter((k) => k.fehler);
      if (!still) {
        if (fehler.length) daten.melden(`${fehler[0].name}: ${fehler[0].fehler}`, undefined, true);
        else daten.melden(`Kalender abgeglichen: ${(data.kalender as any[]).reduce((n, k) => n + k.anzahl, 0)} Termine`);
      }
      await this.laden();
      await this.#konflikteNeuPlanen();
    } catch (e) { if (!still) daten.melden("Abgleich fehlgeschlagen: " + fehlerText(e), undefined, true); }
    finally { this.gleichtAb = false; }
  }

  // ---------- Übernehmen: Lernplan aus der Tabelle, .ics-Datei
  async lernplanImportieren(plan: ImportPlan) {
    const BEKANNT: Record<string, string> = { mathe: "#6FA8F0", rechnungswesen: "#FB923C", "int management": "#4FC7D4", bwl: "#A78BFA", "wiss arbeiten": "#E7B94A" };
    const neueFaecher: string[] = [];
    for (const name of plan.faecher) {
      if (this.faecher.some((f) => norm(f.name) === norm(name))) continue;
      const f = await this.fachSpeichern({ name, farbe: BEKANNT[norm(name)] ?? this.naechsteFarbe() });
      if (f) neueFaecher.push(name);
    }
    const fachName = (n: string) => this.faecher.find((f) => norm(f.name) === norm(n))?.id ?? null;
    const schon = new Set([...this.termine.map((t) => t.titel + "|" + Date.parse(t.start)), ...this.aufgaben.map((a) => a.titel + "|" + (a.geplant ? Date.parse(a.geplant) : a.frist))]);
    const termine = plan.termine.map((z) => {
      const start = z.von ?? new Date(z.tag), ende = z.bis ?? new Date(start.getTime() + (z.von ? 60 : 24 * 60) * MIN);
      return { id: uuid(), titel: z.titel.slice(0, 200), start: start.toISOString(), ende: ende.toISOString(), ganztag: !z.von, art: norm(z.fach) === "klausur" ? "klausur" : "vorlesung", fach_id: fachFuer(this.faecher, z.titel)?.id ?? null, notiz: z.notiz, ort: null, kalender_id: null };
    }).filter((t) => !schon.has(t.titel + "|" + Date.parse(t.start)) && !this.termine.some((x) => (x.art === "vorlesung" || x.art === "klausur") && Date.parse(x.start) === Date.parse(t.start)));
    const aufgaben = plan.aufgaben.map((z, i) => ({
      id: uuid(), titel: z.titel.slice(0, 300), notiz: z.notiz, fach_id: fachName(z.fach), dauer_min: z.von && z.bis ? Math.max(5, Math.min(720, Math.round((z.bis.getTime() - z.von.getTime()) / MIN))) : 60,
      frist: tagKey(z.tag), prio: 2, geplant: z.von ? z.von.toISOString() : null, fixiert: !!z.von, erledigt: z.erledigt ? new Date().toISOString() : null, position: i,
    })).filter((a) => !schon.has(a.titel + "|" + (a.geplant ? Date.parse(a.geplant) : a.frist)));
    for (let i = 0; i < termine.length; i += 200) { const r = await sb.from("org_termine").insert(termine.slice(i, i + 200)); if (r.error) throw new Error(fehlerText(r.error)); }
    for (let i = 0; i < aufgaben.length; i += 200) { const r = await sb.from("org_aufgaben").insert(aufgaben.slice(i, i + 200)); if (r.error) throw new Error(fehlerText(r.error)); }
    let training = false;
    if (plan.training && !this.gewohnheiten.some((g) => norm(g.name) === "training")) {
      training = await this.gewohnheitSpeichern({ name: "Training", pro_woche: plan.training.pro_woche, tage: plan.training.tage, uhrzeit: plan.training.uhrzeit, dauer_min: plan.training.dauer, icon: "dumbbell", farbe: "#4CC38A" });
    }
    await this.laden();
    return { termine: termine.length, aufgaben: aufgaben.length, faecher: neueFaecher.length, training };
  }
  async icsImportieren(text: string) {
    const ev = icsLesen(text, plusTage(Date.now(), -30), plusTage(Date.now(), 400));
    const schon = new Set(this.termine.map((t) => t.titel + "|" + Date.parse(t.start)));
    const zeilen = ev.filter((x) => !schon.has(x.titel + "|" + x.start.getTime())).map((x) => {
      const n = norm(x.titel);
      const art = /\b(klausur|prufung|exam)/.test(n) ? "klausur" : /\b(abgabe|deadline)/.test(n) ? "abgabe" : "termin";
      return { id: uuid(), titel: x.titel.slice(0, 200), start: x.start.toISOString(), ende: x.ende.toISOString(), ganztag: x.ganztag, ort: x.ort?.slice(0, 200) ?? null, notiz: x.notiz, art, fach_id: fachFuer(this.faecher, x.titel)?.id ?? null, kalender_id: null };
    });
    for (let i = 0; i < zeilen.length; i += 200) { const r = await sb.from("org_termine").insert(zeilen.slice(i, i + 200)); if (r.error) throw new Error(fehlerText(r.error)); }
    await this.laden(); await this.#konflikteNeuPlanen();
    return { gelesen: ev.length, neu: zeilen.length };
  }

  // ---------- Einstellungen
  async einstSpeichern(e: Einstellungen) {
    const vorher = this.einst; this.einst = e;
    const r = await sb.from("org_einstellungen").upsert({ user_id: auth.session?.user.id, ...e });
    if (r.error) { this.einst = vorher; daten.melden("Nicht gespeichert: " + fehlerText(r.error), undefined, true); return false; }
    merk("org:einst", e); return true;
  }

  // ---------- Auto-Planung
  /** Belegte Zeiten (Termine mit Uhrzeit) ab jetzt */
  belegt(): Iv[] { const j = this.jetzt - TAG; return this.termine.filter((t) => !t.ganztag && Date.parse(t.ende) > j).map((t) => [Date.parse(t.start), Date.parse(t.ende)] as Iv); }

  /** Offene Aufgaben einplanen. nur = nur diese (sonst alle, die nicht fixiert sind); loesen = auch feste Zeiten neu vergeben (Liegengebliebenes) */
  async planen(nur?: Set<string>, still = false, loesen = false) {
    if (this.plant) return; this.plant = true;
    try {
      const r = planen({ aufgaben: this.aufgaben, belegt: this.belegt(), gewohnheiten: this.gewohnheiten, einst: this.einst, jetzt: Date.now(), tage: 75, nur, loesen: loesen ? nur : undefined });
      const aend = [...r.neu.entries()];
      if (aend.length) {
        const vorher = this.aufgaben;
        this.aufgaben = this.aufgaben.map((a) => (r.neu.has(a.id) ? { ...a, geplant: r.neu.get(a.id)!, fixiert: loesen ? false : a.fixiert } : a));
        const res = await Promise.all(aend.map(([id, g]) => sb.from("org_aufgaben").update(loesen ? { geplant: g, fixiert: false } : { geplant: g }).eq("id", id)));
        const f = res.find((x) => x.error)?.error;
        if (f) { this.aufgaben = vorher; daten.melden("Planung nicht gespeichert: " + fehlerText(f), undefined, true); return; }
        merk("org:aufgaben", this.aufgaben);
      }
      if (!still || r.ohnePlatz.size || r.zuSpaet.size) {
        const teile = [aend.length ? `${aend.length} ${aend.length === 1 ? "Aufgabe" : "Aufgaben"} eingeplant` : "Alles passt schon"];
        if (r.zuSpaet.size) teile.push(`${r.zuSpaet.size} erst nach der Frist`);
        if (r.ohnePlatz.size) teile.push(`${r.ohnePlatz.size} ohne Platz (zu lang oder Tage voll)`);
        daten.melden(teile.join(" · "), undefined, r.zuSpaet.size + r.ohnePlatz.size > 0);
      }
      if (aend.length) haptik("erfolg");
    } finally { this.plant = false; }
  }
  /** Nach neuen Terminen/Gewohnheiten: Aufgaben, die jetzt kollidieren, still neu einplanen */
  async #konflikteNeuPlanen() {
    const busy = [...this.belegt(), ...gewohnheitsZeiten(this.gewohnheiten, new Date(), 76)];
    const j = Date.now();
    const kollidiert = this.offen.filter((a) => {
      if (a.fixiert || !a.geplant) return false;
      const s = Date.parse(a.geplant), e = s + a.dauer_min * MIN;
      return s > j && busy.some(([x, y]) => x < e && y > s);
    });
    if (kollidiert.length) await this.planen(new Set(kollidiert.map((a) => a.id)), true);
  }

  // ---------- Zeitleiste eines Tages
  bloecke(tag: Date | string): Block[] {
    const d0 = tagBeginn(tag).getTime(), d1 = d0 + TAG, key = tagKey(d0), w = wochentag(d0);
    const out: Block[] = [];
    for (const t of this.termine) {
      const s = Date.parse(t.start), e = Date.parse(t.ende);
      if (e <= d0 || s >= d1 || (e === s && s < d0)) continue;
      out.push({ art: "termin", id: t.id, titel: t.titel, start: new Date(s), ende: new Date(e), farbe: this.farbe(t.fach_id, t.art === "klausur" ? "#F24A4A" : t.art === "abgabe" ? "#E7B94A" : "#8B98AD"), ganztag: t.ganztag, unter: t.ort ?? undefined, termin: t });
    }
    for (const a of this.aufgaben) {
      if (!a.geplant) continue; const s = Date.parse(a.geplant);
      if (s < d0 || s >= d1) continue;
      out.push({ art: "aufgabe", id: a.id, titel: a.titel, start: new Date(s), ende: new Date(s + a.dauer_min * MIN), farbe: this.farbe(a.fach_id, "#A78BFA"), erledigt: !!a.erledigt, unter: this.fach(a.fach_id)?.name, aufgabe: a });
    }
    for (const g of this.gewohnheiten) {
      if (!g.aktiv || !g.uhrzeit || !g.tage.includes(w)) continue;
      const s = beiMinute(new Date(d0), minuten(g.uhrzeit));
      out.push({ art: "gewohnheit", id: g.id + key, titel: g.name, start: s, ende: new Date(s.getTime() + g.dauer_min * MIN), farbe: g.farbe, erledigt: this.hatLog(g, key), gewohnheit: g });
    }
    return out.sort((a, b) => Number(!!b.ganztag) - Number(!!a.ganztag) || a.start.getTime() - b.start.getTime() || a.ende.getTime() - b.ende.getTime());
  }
  /** Fortschritt eines Fachs: erledigte/alle Aufgaben, Stunden */
  fachStand(fachId: string) {
    const alle = this.aufgaben.filter((a) => a.fach_id === fachId), fertig = alle.filter((a) => a.erledigt);
    const min = (l: Aufgabe[]) => l.reduce((n, a) => n + a.dauer_min, 0);
    return { alle: alle.length, fertig: fertig.length, minAlle: min(alle), minFertig: min(fertig), anteil: alle.length ? fertig.length / alle.length : 0 };
  }
}

export const org = new Organizer();
