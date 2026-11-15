// Hausarbeiten: Daten laden, speichern, Dateien im privaten Speicher, Regelwerk, Prüfungen, Schreibplan.
import { sb } from "../supabase";
import { auth } from "../auth.svelte";
import { daten } from "../daten.svelte";
import { lies, merk } from "../speicher";
import { org } from "../organizer/org.svelte";
import { istDesktop } from "../appupdate.svelte";
import { plusTage, tagKey } from "../organizer/zeit";
import type { Arbeit, Datei, KiNutzung, Quelle, Regelwerk } from "./typen";

export type Pruefung = { id: string; arbeit_id: string; datei: string; woerter: number | null; fehler: number; hinweise: number; ergebnis: any; erstellt: string };
const uuid = () => crypto.randomUUID();
const fehlerText = (e: any) => { const m = String(e?.message ?? e ?? ""); return /Failed to fetch|network/i.test(m) ? "Keine Verbindung – bitte später nochmal." : m || "Unbekannter Fehler"; };

class Arbeiten {
  liste = $state<Arbeit[]>(lies("arb:liste", []));
  dateien = $state<Datei[]>([]);
  quellen = $state<Quelle[]>([]);
  ki = $state<KiNutzung[]>([]);
  pruefungen = $state<Pruefung[]>([]);
  regelwerk = $state<Regelwerk | null>(lies("arb:regelwerk", null));
  geladen = $state(false);

  get uid() { return auth.session?.user.id ?? ""; }

  async laden() {
    const [a, d, q, k, p] = await Promise.all([
      sb.from("org_arbeiten").select("*").order("abgabe", { nullsFirst: false }),
      sb.from("org_arbeit_dateien").select("*").order("erstellt", { ascending: false }),
      sb.from("org_quellen").select("*").order("erstellt"),
      sb.from("org_ki_nutzung").select("*").order("datum").order("erstellt"),
      sb.from("org_arbeit_pruefungen").select("id,arbeit_id,datei,woerter,fehler,hinweise,ergebnis,erstellt").order("erstellt", { ascending: false }).limit(100),
    ]);
    const f = a.error ?? d.error ?? q.error ?? k.error ?? p.error;
    if (f) { daten.melden("Hausarbeiten nicht geladen: " + fehlerText(f), undefined, true); return; }
    this.liste = (a.data ?? []) as Arbeit[]; this.dateien = (d.data ?? []) as Datei[]; this.quellen = (q.data ?? []) as Quelle[];
    this.ki = (k.data ?? []) as KiNutzung[]; this.pruefungen = (p.data ?? []) as Pruefung[];
    this.geladen = true; merk("arb:liste", this.liste);
    this.regelwerkLaden();
  }
  async regelwerkLaden() {
    if (!this.uid) return;
    const r = await sb.storage.from("organizer").download(`${this.uid}/arbeiten/regelwerk.json`);
    if (r.error || !r.data) return;
    try { const rw = JSON.parse(await r.data.text()) as Regelwerk; if (rw.stand !== this.regelwerk?.stand) { this.regelwerk = rw; merk("arb:regelwerk", rw); } } catch { /* altes behalten */ }
  }

  arbeit = (id: string) => this.liste.find((a) => a.id === id) ?? null;
  von = <T extends { arbeit_id: string }>(l: T[], id: string) => l.filter((x) => x.arbeit_id === id);

  // ---------- Schreiben (sofort sichtbar, bei Fehler zurück)
  async #sichern<T extends { id: string }>(liste: "liste" | "dateien" | "quellen" | "ki", tabelle: string, z: T, loeschen = false) {
    const vorher = [...(this as any)[liste]] as T[];
    const i = vorher.findIndex((x) => x.id === z.id);
    (this as any)[liste] = loeschen ? vorher.filter((x) => x.id !== z.id) : i >= 0 ? vorher.map((x, j) => (j === i ? { ...x, ...z } : x)) : [...vorher, z];
    const r = loeschen ? await sb.from(tabelle).delete().eq("id", z.id) : i >= 0 ? await sb.from(tabelle).update(z as any).eq("id", z.id) : await sb.from(tabelle).insert(z as any);
    if (r.error) { (this as any)[liste] = vorher; daten.melden("Nicht gespeichert: " + fehlerText(r.error), undefined, true); return false; }
    if (liste === "liste") merk("arb:liste", this.liste);
    return true;
  }
  async speichern(a: Partial<Arbeit> & { titel: string }) {
    const z = { id: a.id ?? uuid(), ...a, titel: a.titel.trim() } as Arbeit;
    if (!a.id) Object.assign(z, { toleranz: a.toleranz ?? 10, sprache: a.sprache ?? "de", zitierweise: a.zitierweise ?? "fussnoten", status: a.status ?? "idee", art: a.art ?? "hausarbeit", erstellt: new Date().toISOString() });
    return (await this.#sichern("liste", "org_arbeiten", z)) ? z : null;
  }
  loeschen = (a: Arbeit) => this.#sichern("liste", "org_arbeiten", { id: a.id } as Arbeit, true);
  quelleSpeichern = async (q: Partial<Quelle> & { arbeit_id: string }) => { const z = { id: q.id ?? uuid(), typ: q.typ ?? "buch", daten: q.daten ?? {}, datei_id: q.datei_id ?? null, notiz: q.notiz ?? null, erstellt: q.erstellt ?? new Date().toISOString(), ...q } as Quelle; return (await this.#sichern("quellen", "org_quellen", z)) ? z : null; };
  quelleLoeschen = (q: Quelle) => this.#sichern("quellen", "org_quellen", q, true);
  kiSpeichern = async (k: Partial<KiNutzung> & { arbeit_id: string; tool: string; zweck: string; prompt: string }) => { const z = { id: k.id ?? uuid(), datum: k.datum ?? tagKey(Date.now()), ergebnis: k.ergebnis ?? null, textstelle: k.textstelle ?? null, erstellt: k.erstellt ?? new Date().toISOString(), ...k } as KiNutzung; return (await this.#sichern("ki", "org_ki_nutzung", z)) ? z : null; };
  kiLoeschen = (k: KiNutzung) => this.#sichern("ki", "org_ki_nutzung", k, true);

  // ---------- Dateien
  async hochladen(arbeit: Arbeit, dateien: File[], kategorie: Datei["kategorie"]) {
    const neu: Datei[] = [];
    for (const f of dateien) {
      const id = uuid(), name = f.name.replace(/[\\/]/g, "_").slice(0, 200);
      const pfad = `${this.uid}/arbeiten/${arbeit.id}/${id}-${name.replace(/[^\w.\-äöüÄÖÜß ]/g, "_")}`;
      const up = await sb.storage.from("organizer").upload(pfad, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (up.error) { daten.melden(`„${name}“ nicht hochgeladen: ${fehlerText(up.error)}`, undefined, true); continue; }
      const z: Datei = { id, arbeit_id: arbeit.id, kategorie, name, pfad, groesse: f.size, typ: f.type || null, notiz: null, erstellt: new Date().toISOString() };
      if (await this.#sichern("dateien", "org_arbeit_dateien", z)) neu.push(z);
      else await sb.storage.from("organizer").remove([pfad]);
    }
    if (neu.length) daten.melden(neu.length === 1 ? `„${neu[0].name}“ gespeichert` : `${neu.length} Dateien gespeichert`);
    return neu;
  }
  dateiAendern = (d: Datei, z: Partial<Datei>) => this.#sichern("dateien", "org_arbeit_dateien", { ...d, ...z });
  async dateiLoeschen(d: Datei) { if (await this.#sichern("dateien", "org_arbeit_dateien", d, true)) await sb.storage.from("organizer").remove([d.pfad]); }
  async oeffnen(d: Datei) {
    const { data, error } = await sb.storage.from("organizer").createSignedUrl(d.pfad, 3600);
    if (error || !data?.signedUrl) { daten.melden("Datei nicht gefunden", undefined, true); return; }
    if (istDesktop()) { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(data.signedUrl); } else window.open(data.signedUrl, "_blank", "noopener");
  }
  async bytes(d: Datei) { const r = await sb.storage.from("organizer").download(d.pfad); if (r.error || !r.data) throw new Error(fehlerText(r.error)); return new Uint8Array(await r.data.arrayBuffer()); }

  // ---------- Prüfungen
  async pruefungSpeichern(arbeit: Arbeit, datei: string, woerter: number, befunde: any[]) {
    const z = { id: uuid(), arbeit_id: arbeit.id, datei: datei.slice(0, 300), woerter, fehler: befunde.filter((b) => b.status === "fehler").length, hinweise: befunde.filter((b) => b.status === "hinweis").length, ergebnis: befunde, erstellt: new Date().toISOString() };
    this.pruefungen = [z, ...this.pruefungen];
    const r = await sb.from("org_arbeit_pruefungen").insert(z);
    if (r.error) daten.melden("Prüfung nicht gespeichert: " + fehlerText(r.error), undefined, true);
  }

  // ---------- Schreibplan: Etappen rückwärts von der Abgabe als Aufgaben im Organizer
  async schreibplan(a: Arbeit) {
    if (!a.abgabe) { daten.melden("Erst ein Abgabedatum eintragen"); return 0; }
    const ende = new Date(a.abgabe), heute = new Date(org.jetzt);
    const tage = Math.max(4, Math.round((ende.getTime() - heute.getTime()) / 86_400_000));
    const w = a.woerter_ziel ?? 3000, f = Math.max(1, w / 3000);
    const etappen: [string, number, number, string][] = [   // Titel, Anteil der Zeit bis zur Frist, Dauer (Min.), Notiz
      ["Thema eingrenzen und Forschungsfrage formulieren", 0.12, 90, "Frage so eng, dass sie auf der vorgegebenen Seitenzahl beantwortbar ist; mit dem Dozenten abstimmen."],
      ["Literaturrecherche (Bibliothek, Google Scholar, Datenbanken)", 0.3, Math.round(180 * f), "Quellen direkt im Organizer unter „Quellen“ erfassen – dann entsteht das Literaturverzeichnis automatisch."],
      ["Gliederung und Kapitelziele festlegen", 0.38, 90, "Gliederung mit dem Dozenten abstimmen (Vorgabe aus dem Skript)."],
      ["Rohfassung schreiben – Hauptteil", 0.62, Math.round(240 * f), "Erst schreiben, dann feilen. Jede fremde Aussage sofort mit Fußnote belegen."],
      ["Rohfassung schreiben – Einleitung und Fazit", 0.72, Math.round(120 * f), "Einleitung: Problem, Forschungsfrage, Vorgehen. Fazit: Antwort auf die Frage, Grenzen, Ausblick."],
      ["Überarbeiten: Argumentation, Sprache, Belege", 0.84, Math.round(150 * f), "Laut lesen, Wiederholungen streichen, Wortzahl prüfen."],
      ["Automatische Prüfung im Organizer + Formalia korrigieren", 0.93, 90, "Reiter „Prüfen“: .docx hochladen, alle Fehler beheben, KI-Nachweis vollständig."],
      ["Abgabe vorbereiten und hochladen", 1, 45, "Eidesstattliche Erklärung mit Wortzahl, PDF/Word laut Vorgabe, rechtzeitig in Moodle hochladen."],
    ];
    // Kurzer Name für die Aufgaben („WiAr – Teilprüfung 3/3: Baustein 3 Hausarbeit (70 %)“ → „Baustein 3 Hausarbeit“)
    const kurz = a.titel.includes(":") ? a.titel.replace(/^.*:\s*/, "").replace(/\s*\(\d+\s*%\)\s*$/, "") : a.titel;
    const ids = new Set<string>(); let n = 0, ab = tagKey(heute);
    for (const [titel, anteil, dauer, notiz] of etappen) {
      const frist = tagKey(plusTage(heute, Math.max(0, Math.round(tage * anteil) - (anteil === 1 ? 1 : 0))));
      // lange Etappen in Arbeitsblöcke von höchstens 90 Min. teilen; jede Etappe beginnt erst nach der vorigen (ab … Frist)
      const teile = Math.max(1, Math.ceil(dauer / 90));
      for (let t = 0; t < teile; t++) {
        const d = t < teile - 1 ? 90 : dauer - 90 * (teile - 1);
        const r = await org.aufgabeSpeichern({ titel: `${kurz}: ${titel}${teile > 1 ? ` (Teil ${t + 1}/${teile})` : ""}`.slice(0, 300), fach_id: a.fach_id, dauer_min: d, frist, ab: ab <= frist ? ab : frist, prio: anteil === 1 ? 1 : 2, notiz, arbeit_id: a.id, position: Date.now() / 1e6 + n }, false);
        if (r) { ids.add(r.id); n++; }
      }
      ab = tagKey(plusTage(new Date(frist + "T12:00:00"), 1));
    }
    if (n) { await org.planen(ids, true); daten.melden(`${n} Arbeitsschritte in deinen Kalender geplant`); }
    return n;
  }
}

export const arbeiten = new Arbeiten();
