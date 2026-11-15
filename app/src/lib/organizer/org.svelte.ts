// Daten des Organizers: alles Eigene (Fächer, Termine, Aufgaben, Gewohnheiten, Kalender-Abos, Einstellungen).
// Startet sofort mit dem zuletzt gemerkten Stand, holt im Hintergrund das Neue und bleibt live (Handy ↔ Mac).
// Änderungen erscheinen sofort und werden danach gespeichert; schlägt das fehl, wird zurückgenommen.
import { sb } from "../supabase";
import { auth } from "../auth.svelte";
import { daten } from "../daten.svelte";
import { lies, merk } from "../speicher";
import { haptik } from "../haptik";
import { planen, gewohnheitsZeiten, routineZeiten, type Iv } from "./planer";
import { MIN, TAG, beiMinute, minuten, plusTage, tagBeginn, tagKey, wochenBeginn, wochentag } from "./zeit";
import { lesen as icsLesen } from "./ics";
import { fachFuer, norm } from "./schnell";
import type { ImportPlan } from "./import";
import { EINST_STANDARD, FARBEN, type Aufgabe, type Block, type Einstellungen, type Fach, type Gewohnheit, type Kalender, type Log, type Routine, type Termin } from "./typen";

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
  routine = $state<Routine[]>(lies("org:routine", []));
  einst = $state<Einstellungen>({ ...EINST_STANDARD, ...lies("org:einst", EINST_STANDARD) });
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
    const [f, t, a, g, l, k, e, r] = await Promise.all([
      sb.from("org_faecher").select("*").order("position").order("name"),
      sb.from("org_termine").select("id,titel,start,ende,ganztag,ort,art,fach_id,notiz,kalender_id,fahrt").gte("ende", von).lte("start", bis).order("start").limit(3000),
      sb.from("org_aufgaben").select("*").or(`erledigt.is.null,erledigt.gte.${erledigtSeit}`).order("position").limit(2000),
      sb.from("org_gewohnheiten").select("*").order("position").order("erstellt"),
      sb.from("org_gewohnheit_log").select("gewohnheit_id,tag").gte("tag", tagKey(plusTage(Date.now(), -120))),
      sb.from("org_kalender").select("*").order("erstellt"),
      sb.from("org_einstellungen").select("tag_start,tag_ende,puffer_min,tag_max_min,wochenende,fahrzeit_min").maybeSingle(),
      sb.from("org_routine").select("*").order("start"),
    ]);
    const fehler = [f, t, a, g, l, k, e].find((x) => x.error)?.error;
    if (fehler) { if (!this.geladen) daten.melden("Organizer nicht geladen: " + fehlerText(fehler), undefined, true); return; }
    this.faecher = merk("org:faecher", (f.data ?? []) as Fach[]);
    this.termine = merk("org:termine", (t.data ?? []) as Termin[]);
    this.aufgaben = merk("org:aufgaben", (a.data ?? []) as Aufgabe[]);
    this.gewohnheiten = merk("org:gewohnheiten", (g.data ?? []) as Gewohnheit[]);
    this.log = merk("org:log", (l.data ?? []) as Log[]);
    this.kalender = merk("org:kalender", (k.data ?? []) as Kalender[]);
    if (!r.error) this.routine = merk("org:routine", ((r.data ?? []) as any[]).map((x) => ({ ...x, start: String(x.start).slice(0, 5) })) as Routine[]);
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
    merk("org:gewohnheiten", this.gewohnheiten); merk("org:log", this.log); merk("org:kalender", this.kalender); merk("org:routine", this.routine);
  }

  /** Optimistisch ändern, speichern, bei Fehler zurück */
  async #schreiben<T extends { id?: string }>(liste: "faecher" | "termine" | "aufgaben" | "gewohnheiten" | "kalender" | "routine", tabelle: (typeof TABELLEN)[number] | "org_routine", zeile: T, loeschen = false): Promise<boolean> {
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
    const z = { id: f.id ?? uuid(), name: f.name.trim(), farbe: f.farbe ?? this.naechsteFarbe(), position: f.position ?? this.faecher.length, archiviert: f.archiviert ?? false,
      name_lang: f.name_lang?.trim() || null, dozent: f.dozent?.trim() || null, pruefung: f.pruefung?.trim() || null, link: f.link?.trim() || null, notiz: f.notiz?.trim() || null, niveau: f.niveau ?? 2 };
    return (await this.#schreiben("faecher", "org_faecher", z)) ? z : null;
  }
  fachLoeschen(f: Fach) { return this.#schreiben("faecher", "org_faecher", { id: f.id }, true); }
  /** Fächer mit Kalender und Aufgaben verbinden: Termine und Aufgaben ohne Fach bekommen das passende (Name oder voller Name im Titel) */
  async zuordnen(still = true) {
    const t = this.termine.filter((x) => !x.fach_id).map((x) => [x, fachFuer(this.faecher, x.titel)] as const).filter(([, f]) => f);
    const a = this.aufgaben.filter((x) => !x.fach_id && !x.erledigt).map((x) => [x, fachFuer(this.faecher, x.titel)] as const).filter(([, f]) => f);
    const res = await Promise.all([
      ...t.map(([x, f]) => sb.from("org_termine").update({ fach_id: f!.id }).eq("id", x.id)),
      ...a.map(([x, f]) => sb.from("org_aufgaben").update({ fach_id: f!.id }).eq("id", x.id)),
    ]);
    const ok = new Set(res.map((r, i) => (r.error ? null : i)).filter((i) => i != null));
    this.termine = this.termine.map((x) => { const i = t.findIndex(([y]) => y.id === x.id); return i >= 0 && ok.has(i) ? { ...x, fach_id: t[i][1]!.id } : x; });
    this.aufgaben = this.aufgaben.map((x) => { const i = a.findIndex(([y]) => y.id === x.id); return i >= 0 && ok.has(t.length + i) ? { ...x, fach_id: a[i][1]!.id } : x; });
    this.#merken();
    if (!still) daten.melden(t.length + a.length ? `${t.length} Termine und ${a.length} Aufgaben zugeordnet` : "Alles ist schon zugeordnet");
    if (this.kalender.length) await this.abgleichen(undefined, true);
    return t.length + a.length;
  }

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
  belegt(): Iv[] {
    const j = this.jetzt - TAG;
    return [...this.termine.filter((t) => !t.ganztag && Date.parse(t.ende) > j).map((t) => [Date.parse(t.start), Date.parse(t.ende)] as Iv), ...this.fahrten(j).map((f) => [f.von, f.bis] as Iv)];
  }
  /** Braucht der Termin einen Weg? Von Hand gesetzt, sonst: Vorlesungen und Prüfungen vor Ort (nicht Zoom/online) */
  brauchtFahrt(t: Termin) {
    if (t.ganztag) return false;
    if (t.fahrt != null) return t.fahrt;
    return (t.art === "vorlesung" || t.art === "klausur") && !/zoom|online|teams|webex|meet\b|digital/i.test(t.ort ?? "") && !/\(online/i.test(t.titel);
  }
  /** Hin- und Rückwege (je Fahrzeit) um zusammenhängende Termine vor Ort; liegen zwei nah beieinander, bleibt man dort */
  fahrten(ab = this.jetzt - TAG, bis = Infinity): { von: number; bis: number; hin: boolean; ziel: string }[] {
    const f = (this.einst.fahrzeit_min ?? 45) * MIN; if (!f) return [];
    const vorOrt = this.termine.filter((t) => this.brauchtFahrt(t) && Date.parse(t.ende) > ab && Date.parse(t.start) < bis).sort((a, b) => a.start.localeCompare(b.start));
    const out: { von: number; bis: number; hin: boolean; ziel: string }[] = [];
    let g: { s: number; e: number; ort: string } | null = null;
    const zu = () => { if (g) { out.push({ von: g.s - f, bis: g.s, hin: true, ziel: g.ort }, { von: g.e, bis: g.e + f, hin: false, ziel: g.ort }); } };
    for (const t of vorOrt) {
      const s = Date.parse(t.start), e = Date.parse(t.ende);
      if (g && s - g.e < 2 * f && tagKey(s) === tagKey(g.e)) g.e = Math.max(g.e, e);
      else { zu(); g = { s, e, ort: t.ort || "Uni" }; }
    }
    zu();
    return out;
  }
  /** Niveau, das eine Aufgabe braucht: wichtig = 1, unwichtig = 3, sonst das Niveau des Fachs */
  niveauVon = (a: Aufgabe) => (a.prio === 1 ? 1 : a.prio === 3 ? 3 : this.fach(a.fach_id)?.niveau ?? 2);

  /** Offene Aufgaben einplanen. nur = nur diese (sonst alle, die nicht fixiert sind); loesen = auch feste Zeiten neu vergeben (Liegengebliebenes) */
  async planen(nur?: Set<string>, still = false, loesen = false) {
    if (this.plant) return; this.plant = true;
    try {
      const r = planen({ aufgaben: this.aufgaben, belegt: this.belegt(), gewohnheiten: this.gewohnheiten, einst: this.einst, routine: this.routine, niveauVon: this.niveauVon, jetzt: Date.now(), tage: 75, nur, loesen: loesen ? nur : undefined });
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
    const busy = [...this.belegt(), ...gewohnheitsZeiten(this.gewohnheiten, new Date(), 76), ...routineZeiten(this.routine, new Date(), 76)];
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
    // Wege zur Uni
    for (const f of this.fahrten(d0 - TAG, d1)) {
      if (f.bis <= d0 || f.von >= d1) continue;
      out.push({ art: "fahrt", id: "fahrt" + f.von, titel: f.hin ? "Weg zur Uni" : "Rückweg", start: new Date(f.von), ende: new Date(f.bis), farbe: "#8B98AD", unter: f.hin ? f.ziel : "nach Hause" });
    }
    // Tagesroutine: fällt aus, wo ein Termin oder ein Weg liegt; Fokusblöcke nur, wenn noch nichts drin ist
    const belegtHeute = out.filter((b) => !b.ganztag && (b.art === "termin" || b.art === "fahrt")).map((b) => [b.start.getTime(), b.ende.getTime()] as Iv);
    const aufgabenHeute = out.filter((b) => b.art === "aufgabe").map((b) => [b.start.getTime(), b.ende.getTime()] as Iv);
    const vergangen = d1 <= tagBeginn(this.jetzt).getTime();   // vergangene Tage: Routine nicht mehr zeigen
    for (const r of this.routine) {
      if (vergangen || !r.aktiv || !r.tage.includes(w)) continue;
      const s = beiMinute(new Date(d0), minuten(r.start)), e = new Date(s.getTime() + r.dauer_min * MIN);
      const faellt = belegtHeute.some(([x, y]) => x < e.getTime() && y > s.getTime());
      if (faellt) continue;
      if (r.art === "block" && aufgabenHeute.some(([x, y]) => x < e.getTime() && y > s.getTime())) continue;
      out.push({ art: "routine", id: "r" + r.id + key, titel: r.titel, start: s, ende: e, farbe: r.art === "block" ? "#8E7CFF" : "#5A6880", routine: r, leer: r.art === "block" });
    }
    return out.sort((a, b) => Number(!!b.ganztag) - Number(!!a.ganztag) || a.start.getTime() - b.start.getTime() || a.ende.getTime() - b.ende.getTime());
  }

  // ---------- Tagesroutine
  async routineSpeichern(r: Partial<Routine> & { titel: string; start: string }) {
    const neu = !r.id || !this.routine.some((x) => x.id === r.id);
    const z: any = { ...(neu ? { id: r.id ?? uuid(), dauer_min: 30, tage: [1, 2, 3, 4, 5], art: "fix", niveau: null, aktiv: true } : {}), ...r, titel: r.titel.trim() };
    if (z.art !== "block") z.niveau = null; else z.niveau = z.niveau ?? 2;
    const ok = await this.#schreiben("routine", "org_routine", z);
    if (ok) { this.routine = [...this.routine].sort((a, b) => a.start.localeCompare(b.start)); merk("org:routine", this.routine); }
    return ok;
  }
  routineLoeschen(r: Routine) { return this.#schreiben("routine", "org_routine", { id: r.id }, true); }

  /** Lange Aufgabe in Teile zerlegen (z. B. 3 Std. → 2 × 90 Min.), die Teile plant die App einzeln */
  async aufteilen(a: Aufgabe, teil = 90, planenDanach = true) {
    const n = Math.ceil(a.dauer_min / teil); if (n < 2) return [a.id];
    const basis = a.titel.replace(/ \(Teil \d+\/\d+\)$/, "");
    const rest = a.dauer_min - teil * (n - 1);
    const neue = Array.from({ length: n - 1 }, (_, i) => ({ id: uuid(), titel: `${basis} (Teil ${i + 2}/${n})`.slice(0, 300), notiz: a.notiz, fach_id: a.fach_id, dauer_min: i === n - 2 ? rest : teil,
      frist: a.frist, prio: a.prio, geplant: null, fixiert: false, erledigt: null, position: a.position + (i + 1) / 100, erstellt: a.erstellt, ab: a.ab ?? null }));
    const r1 = await sb.from("org_aufgaben").update({ titel: `${basis} (Teil 1/${n})`.slice(0, 300), dauer_min: teil, fixiert: false }).eq("id", a.id);
    const r2 = r1.error ? r1 : await sb.from("org_aufgaben").insert(neue);
    if (r2.error) { daten.melden("Nicht aufgeteilt: " + fehlerText(r2.error), undefined, true); return []; }
    this.aufgaben = [...this.aufgaben.map((x) => (x.id === a.id ? { ...x, titel: `${basis} (Teil 1/${n})`, dauer_min: teil, fixiert: false } : x)), ...(neue as Aufgabe[])];
    merk("org:aufgaben", this.aufgaben);
    const ids = [a.id, ...neue.map((x) => x.id)];
    if (planenDanach) await this.planen(new Set(ids), true);
    return ids;
  }

  /** Feste Lernblöcke (z. B. aus dem Lernplan) in die Tagesroutine einpassen: gleicher Tag, aber in die Fokusblöcke,
   *  zu lange Blöcke werden in Teile von höchstens der Blocklänge zerlegt. Fahrten und Termine bleiben frei. */
  async anRoutineAnpassen() {
    const bloecke = this.routine.filter((r) => r.aktiv && r.art === "block");
    if (!bloecke.length) { daten.melden("Erst eine Tagesroutine mit Fokusblöcken anlegen.", undefined, true); return; }
    const teil = Math.max(30, ...bloecke.map((r) => r.dauer_min));   // so lang wie der längste Fokusblock
    const j = Date.now();
    const kandidaten = this.offen.filter((a) => a.fixiert && a.geplant && Date.parse(a.geplant) > j);
    const ids = new Set<string>();
    for (const a of kandidaten) {
      const tag = tagKey(a.geplant!);
      await sb.from("org_aufgaben").update({ fixiert: false, ab: tag, frist: a.frist && a.frist < tag ? a.frist : tag }).eq("id", a.id);
      const x = { ...a, fixiert: false, ab: tag, frist: a.frist && a.frist < tag ? a.frist : tag };
      this.aufgaben = this.aufgaben.map((y) => (y.id === a.id ? x : y));
      for (const id of a.dauer_min > teil ? await this.aufteilen(x, teil, false) : [a.id]) ids.add(id);
    }
    merk("org:aufgaben", this.aufgaben);
    await this.planen(ids, false, true);
    return ids.size;
  }
  /** Fortschritt eines Fachs: erledigte/alle Aufgaben, Stunden */
  fachStand(fachId: string) {
    const alle = this.aufgaben.filter((a) => a.fach_id === fachId), fertig = alle.filter((a) => a.erledigt);
    const min = (l: Aufgabe[]) => l.reduce((n, a) => n + a.dauer_min, 0);
    return { alle: alle.length, fertig: fertig.length, minAlle: min(alle), minFertig: min(fertig), anteil: alle.length ? fertig.length / alle.length : 0 };
  }
}

export const org = new Organizer();
