// Social Media: Creatives (Bilder, Karussells, Videos) mit Texten und der Plan dahinter.
// Die Dateien liegen im privaten Speicher „creatives“; angezeigt und geladen wird über kurzlebige signierte Links.
import { sb } from "./supabase";
import { hat, lies, merk } from "./speicher";
import { istAndroidApp, istDesktop } from "./appupdate.svelte";

export type Datei = { name: string; pfad: string; art: "bild" | "video" | "titelbild" | "paket"; groesse?: number; typ?: string; b?: number; h?: number; dauer?: number };
export type Creative = {
  id: string; slug: string; titel: string; art: "bild" | "karussell" | "video"; serie: string | null; text: string; format: string | null;
  status: "pruefen" | "freigegeben" | "gepostet" | "verworfen"; saeule: string | null; dateien: Datei[]; vorschau: string | null;
  position: number | null; geplant: string | null; notiz: string | null; erstellt: string; geaendert: string; plattformen: string[];
  favorit?: boolean; eigen?: boolean; hochgeladen_von?: string | null;
};
/** Noch zu posten (bekommt eine Nummer in der Reihenfolge) */
export const offen = (c: Creative) => c.status === "pruefen" || c.status === "freigegeben";
/** Für die Suche in der Bibliothek */
export const suchtext = (c: Creative) => `${c.titel} ${c.text} ${c.serie ?? ""} ${c.notiz ?? ""} ${c.slug}`.toLowerCase();
export type Saeule = { id: string; name: string; farbe: string; text: string };
export type Plan = { idee?: string; faden?: string; zielgruppe?: string; ton?: string; rhythmus?: string; saeulen?: Saeule[] };

export const STATUS: Record<Creative["status"], { name: string; ton: string }> = {
  pruefen: { name: "Zur Freigabe", ton: "gelb" }, freigegeben: { name: "Freigegeben", ton: "gruen" },
  gepostet: { name: "Gepostet", ton: "blau" }, verworfen: { name: "Verworfen", ton: "grau" },
};
export const ART: Record<Creative["art"], string> = { bild: "Einzelbild", karussell: "Karussell", video: "Video" };
// Plattformen und was dort gepostet wird. Gespeichert wird je Creative, auf welchen Plätzen es läuft:
// ig-beitrag, ig-story, fb-beitrag, fb-story, yt, li
export type Typ = "story" | "video" | "beitrag" | "karussell" | "short" | "logo" | "titelbild" | "foto" | "leistung";
export type Plattform = { key: string; name: string; kurz: string; icon: string; farbe: string; flaeche: string; typen: Typ[] };
export const PLATTFORMEN: Plattform[] = [
  { key: "instagram", name: "Instagram", kurz: "ig", icon: "instagram", farbe: "#E4405F", flaeche: "linear-gradient(135deg, #FEDA75 0%, #F58529 22%, #DD2A7B 52%, #8134AF 78%, #515BD4 100%)", typen: ["story", "video", "beitrag", "karussell"] },
  { key: "facebook", name: "Facebook", kurz: "fb", icon: "facebook", farbe: "#1877F2", flaeche: "linear-gradient(135deg, #3B95FF, #1877F2 55%, #0B5BD3)", typen: ["story", "video", "beitrag", "karussell"] },
  { key: "tiktok", name: "TikTok", kurz: "tt", icon: "tiktok", farbe: "#FE2C55", flaeche: "linear-gradient(135deg, #25F4EE 0%, #121212 38%, #121212 62%, #FE2C55 100%)", typen: ["video", "karussell", "story"] },
  { key: "linkedin", name: "LinkedIn", kurz: "li", icon: "linkedin", farbe: "#0A66C2", flaeche: "linear-gradient(135deg, #2D8CE8, #0A66C2 55%, #064C93)", typen: ["video", "beitrag", "karussell"] },
  { key: "youtube", name: "YouTube", kurz: "yt", icon: "youtube", farbe: "#FF0033", flaeche: "linear-gradient(135deg, #FF4D5E, #FF0033 55%, #C4001F)", typen: ["short", "video"] },
  { key: "google", name: "Google", kurz: "gm", icon: "google", farbe: "#4285F4", flaeche: "linear-gradient(135deg, #4285F4 0%, #34A853 38%, #FBBC05 68%, #EA4335 100%)", typen: ["foto", "beitrag", "leistung", "titelbild", "logo"] },
];
export const TYPEN: Record<Typ, { name: string; mehr: string; icon: string }> = {
  story: { name: "Story", mehr: "Stories", icon: "story" },
  video: { name: "Video", mehr: "Videos", icon: "play" },
  beitrag: { name: "Beitrag", mehr: "Beiträge", icon: "image" },
  karussell: { name: "Mehrseitiger Beitrag", mehr: "Mehrseitige Beiträge", icon: "stapel" },
  short: { name: "Shorts", mehr: "Shorts", icon: "story" },
  foto: { name: "Foto", mehr: "Fotos", icon: "image" },
  leistung: { name: "Leistung", mehr: "Leistungen", icon: "layers" },
  titelbild: { name: "Titelbild", mehr: "Titelbilder", icon: "image" },
  logo: { name: "Logo", mehr: "Logos", icon: "sparkles" },
};
/** Plätze zum Ankreuzen auf der Detailseite */
export const PLAETZE: { key: string; plattform: string; name: string }[] = [
  { key: "ig-beitrag", plattform: "instagram", name: "Beitrag" }, { key: "ig-story", plattform: "instagram", name: "Story" },
  { key: "fb-beitrag", plattform: "facebook", name: "Beitrag" }, { key: "fb-story", plattform: "facebook", name: "Story" },
  { key: "li", plattform: "linkedin", name: "Beitrag" }, { key: "yt", plattform: "youtube", name: "Video" },
  { key: "tt-video", plattform: "tiktok", name: "Video" }, { key: "tt-foto", plattform: "tiktok", name: "Foto-Beitrag" }, { key: "tt-story", plattform: "tiktok", name: "Story" },
  { key: "gm-foto", plattform: "google", name: "Foto" }, { key: "gm-beitrag", plattform: "google", name: "Beitrag" },
  { key: "gm-leistung", plattform: "google", name: "Leistung" }, { key: "gm-titel", plattform: "google", name: "Titelbild" }, { key: "gm-logo", plattform: "google", name: "Logo" },
];
/** Name eines Typs auf einer Plattform (Videos heißen bei Instagram und Facebook „Reels“) */
export const typName = (p: Plattform | undefined, t: Typ, mehrzahl = false) =>
  t === "video" && (p?.kurz === "ig" || p?.kurz === "fb") ? (mehrzahl ? "Reels" : "Reel") : mehrzahl ? TYPEN[t].mehr : TYPEN[t].name;
export const plattform = (key: string) => PLATTFORMEN.find((p) => p.key === key);
const hochkant = (c: Creative) => { const d = c.dateien.find((x) => x.art === "video" || x.art === "bild"); return d?.b && d?.h ? d.h > d.b * 1.3 : true; };
const artTyp = (c: Creative): Typ => (c.art === "video" ? "video" : c.art === "karussell" ? "karussell" : "beitrag");
/** Als was ein Creative auf einer Plattform läuft (z. B. Video als Story und als Video) */
export function typenVon(c: Creative, p: Plattform): Typ[] {
  const pl = c.plattformen ?? [], r: Typ[] = [];
  if (p.kurz === "ig" || p.kurz === "fb") {
    if (pl.includes(p.kurz + "-story")) r.push("story");
    if (pl.includes(p.kurz + "-beitrag")) r.push(artTyp(c));
  } else if (p.kurz === "li" && pl.includes("li")) r.push(artTyp(c));
  else if (p.kurz === "yt" && pl.includes("yt") && c.art === "video") r.push(hochkant(c) ? "short" : "video");
  else if (p.kurz === "tt") {
    if (pl.includes("tt-video") && c.art === "video") r.push("video");
    if (pl.includes("tt-foto") && c.art !== "video") r.push(c.art === "karussell" ? "karussell" : "beitrag");
    if (pl.includes("tt-story")) r.push("story");
  } else if (p.kurz === "gm") {
    const m: [string, Typ][] = [["gm-foto", "foto"], ["gm-beitrag", "beitrag"], ["gm-leistung", "leistung"], ["gm-titel", "titelbild"], ["gm-logo", "logo"]];
    for (const [k, t] of m) if (pl.includes(k)) r.push(c.art === "video" && t === "foto" ? "video" : t);
  }
  return r;
}

export const FARBEN = ["#FF5757", "#F7C65E", "#8AB0FF", "#4EDC8F", "#A78BFA", "#4FC7D4", "#F08FC0", "#FB923C"];

class Social {
  liste = $state<Creative[]>(lies("social:creatives", []));
  plan = $state<Plan>(lies("social:plan", {}));
  laedt = $state(!hat("social:creatives"));
  fehler = $state("");
  zuletzt = "";   // zuletzt geöffnete Plattform-Ansicht (für „Zurück“ auf der Detailseite)
  private urls = new Map<string, { url: string; bis: number }>();
  private kanal: ReturnType<typeof sb.channel> | null = null;

  get zurFreigabe() { return this.liste.filter((c) => c.status === "pruefen").length; }
  get favoriten() { return this.liste.filter((c) => c.favorit).length; }
  sortiert() { return [...this.liste].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || b.erstellt.localeCompare(a.erstellt)); }
  saeule(id: string | null | undefined) { return (this.plan.saeulen ?? []).find((s) => s.id === id); }

  async laden() {
    const [c, p] = await Promise.all([sb.from("social_creatives").select("*"), sb.from("social_plan").select("inhalt").eq("id", 1).maybeSingle()]);
    if (c.error) { this.fehler = c.error.message; this.laedt = false; return; }
    this.liste = merk("social:creatives", (c.data as Creative[]) ?? []);
    if (p.data) this.plan = merk("social:plan", (p.data as any).inhalt ?? {});
    this.fehler = ""; this.laedt = false;
    await this.vorschauen();
  }
  live() {
    if (this.kanal) return () => {};
    this.kanal = sb.channel("social-live").on("postgres_changes", { event: "*", schema: "public", table: "social_creatives" }, () => this.laden()).subscribe();
    return () => { if (this.kanal) sb.removeChannel(this.kanal); this.kanal = null; };
  }

  // ---------- Links zu den Dateien (1 Stunde gültig, im Speicher wiederverwendet)
  bild = $state<Record<string, string>>({});
  async vorschauen() {
    const pfade = this.liste.map((c) => c.vorschau).filter((p): p is string => !!p);
    await this.links(pfade);
  }
  async links(pfade: string[]) {
    const jetzt = Date.now(), fehlt = [...new Set(pfade)].filter((p) => !this.urls.has(p) || this.urls.get(p)!.bis < jetzt + 60_000);
    if (fehlt.length) {
      const { data } = await sb.storage.from("creatives").createSignedUrls(fehlt, 3600);
      const neu: Record<string, string> = {};
      for (const d of data ?? []) if (d.signedUrl && d.path) { this.urls.set(d.path, { url: d.signedUrl, bis: jetzt + 3500_000 }); neu[d.path] = d.signedUrl; }
      if (Object.keys(neu).length) this.bild = { ...this.bild, ...neu };
    }
    return pfade.map((p) => this.urls.get(p)?.url ?? "");
  }

  // ---------- Ändern
  async setzen(id: string, werte: Partial<Creative>) {
    const alt = this.liste.find((c) => c.id === id); if (!alt) return false;
    const vorher = { ...alt };
    Object.assign(alt, werte);
    const { error } = await sb.from("social_creatives").update(werte).eq("id", id);
    if (error) { Object.assign(alt, vorher); throw new Error(error.message); }
    merk("social:creatives", this.liste);
    return true;
  }
  /** Nach dem Ziehen: neue Position zwischen den Nachbarn (nur eine Zeile wird geschrieben) */
  async verschieben(id: string, reihe: Creative[]) {
    const i = reihe.findIndex((c) => c.id === id); if (i < 0) return;
    const v = reihe[i - 1]?.position, n = reihe[i + 1]?.position;
    const pos = v == null && n == null ? 0 : v == null ? (n as number) - 1 : n == null ? v + 1 : (v + n) / 2;
    await this.setzen(id, { position: pos });
  }
  async favorit(c: Creative) { return this.setzen(c.id, { favorit: !c.favorit }); }

  // ---------- Eigene Creatives aus der App hochladen (Ordner „eigene/“ im privaten Speicher)
  async hochladen(e: { dateien: File[]; titel: string; text: string; plattformen: string[]; saeule: string | null; status: Creative["status"] },
    onFortschritt?: (t: string) => void) {
    const MAX = 50 * 1024 * 1024;
    const video = e.dateien.find((f) => f.type.startsWith("video/"));
    if (!e.dateien.length) throw new Error("Bitte mindestens eine Datei wählen.");
    if (video && e.dateien.length > 1) throw new Error("Ein Video bitte einzeln hochladen.");
    if (e.dateien.some((f) => !f.type.startsWith("image/") && !f.type.startsWith("video/"))) throw new Error("Nur Bilder und Videos.");
    const zuGross = e.dateien.find((f) => f.size > MAX);
    if (zuGross) throw new Error(`„${zuGross.name}“ ist größer als 50 MB.`);
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id; if (!uid) throw new Error("Bitte neu anmelden.");
    const slug = `eigen-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;
    const ordner = `eigene/${slug}`, hoch: string[] = [];
    const sauber = (n: string) => n.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "datei";
    try {
      const dateien: Datei[] = [];
      let i = 0;
      for (const f of e.dateien) {
        onFortschritt?.(e.dateien.length > 1 ? `Lädt ${i + 1} von ${e.dateien.length} …` : "Lädt hoch …");
        const mass = await abmessen(f);
        const pfad = `${ordner}/${String(++i).padStart(2, "0")}-${sauber(f.name)}`;
        const { error } = await sb.storage.from("creatives").upload(pfad, f, { contentType: f.type, upsert: false });
        if (error) throw new Error(error.message);
        hoch.push(pfad);
        dateien.push({ name: f.name, pfad, art: f.type.startsWith("video/") ? "video" : "bild", groesse: f.size, typ: f.type, ...mass });
      }
      onFortschritt?.("Vorschau …");
      let vorschau: string | null = null;
      const bild = await vorschaubild(e.dateien[0]).catch(() => null);
      if (bild) {
        const pfad = `${ordner}/vorschau.jpg`;
        const { error } = await sb.storage.from("creatives").upload(pfad, bild, { contentType: "image/jpeg", upsert: false });
        if (!error) { vorschau = pfad; hoch.push(pfad); }
      }
      const erste = dateien[0];
      const zeile = {
        slug, titel: e.titel.trim() || e.dateien[0].name.replace(/\.[^.]+$/, ""), art: video ? "video" : dateien.length > 1 ? "karussell" : "bild",
        text: e.text, format: erste.b && erste.h ? `${erste.b} × ${erste.h}` : null, status: e.status, saeule: e.saeule, dateien, vorschau,
        plattformen: e.plattformen, eigen: true, hochgeladen_von: uid,
      };
      const { data, error } = await sb.from("social_creatives").insert(zeile).select().single();
      if (error) throw new Error(error.message);
      this.liste = merk("social:creatives", [...this.liste.filter((x) => x.id !== data.id), data as Creative]);
      await this.vorschauen();
      return data as Creative;
    } catch (err) {
      if (hoch.length) await sb.storage.from("creatives").remove(hoch).catch(() => {});
      throw err;
    } finally { onFortschritt?.(""); }
  }

  async loeschen(c: Creative) {
    const pfade = [...c.dateien.map((d) => d.pfad), ...(c.vorschau ? [c.vorschau] : [])];
    const { error } = await sb.from("social_creatives").delete().eq("id", c.id);
    if (error) throw new Error(error.message);
    if (pfade.length) await sb.storage.from("creatives").remove(pfade);
    this.liste = merk("social:creatives", this.liste.filter((x) => x.id !== c.id));
  }
  private planTimer: any = null;
  planSpeichern(teil: Partial<Plan>) {
    this.plan = merk("social:plan", { ...this.plan, ...teil });
    clearTimeout(this.planTimer);
    return new Promise<void>((res, rej) => {
      this.planTimer = setTimeout(async () => {
        const { data: u } = await sb.auth.getUser();
        const { error } = await sb.from("social_plan").update({ inhalt: this.plan, geaendert: new Date().toISOString(), geaendert_von: u.user?.id ?? null }).eq("id", 1);
        error ? rej(new Error(error.message)) : res();
      }, 700);
    });
  }

  // ---------- Herunterladen
  /** Eine oder mehrere Dateien aufs Gerät holen:
   *  Android: Teilen-Menü (direkt an Instagram, in die Galerie oder nach Drive) · Mac/Windows: Standard-Browser lädt herunter · Browser: Download */
  async herunterladen(dateien: Datei[], onFortschritt?: (t: string) => void) {
    if (!dateien.length) return;
    if (istAndroidApp()) return this.android(dateien, onFortschritt);
    for (const d of dateien) {
      const { data, error } = await sb.storage.from("creatives").createSignedUrl(d.pfad, 600, { download: d.name });
      if (error || !data?.signedUrl) throw new Error(error?.message || "Kein Link");
      if (istDesktop()) { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(data.signedUrl); }
      else { const a = document.createElement("a"); a.href = data.signedUrl; a.download = d.name; a.rel = "noopener"; document.body.append(a); a.click(); a.remove(); }
      if (dateien.length > 1) await new Promise((r) => setTimeout(r, 600));
    }
  }
  private async android(dateien: Datei[], onFortschritt?: (t: string) => void) {
    const C = (window as any).Capacitor;
    const plugin = (n: string) => C.Plugins[n] ||= C.registerPlugin(n);
    const Filesystem = plugin("Filesystem");
    const uris: string[] = [];
    let i = 0;
    for (const d of dateien) {
      onFortschritt?.(dateien.length > 1 ? `Lädt ${++i} von ${dateien.length} …` : "Lädt …");
      const { data } = await sb.storage.from("creatives").createSignedUrl(d.pfad, 600);
      if (!data?.signedUrl) throw new Error("Kein Link");
      const pfad = `creatives/${d.name}`;
      await Filesystem.deleteFile({ path: pfad, directory: "CACHE" }).catch(() => {});
      const r = await Filesystem.downloadFile({ url: data.signedUrl, path: pfad, directory: "CACHE", recursive: true });
      uris.push(r?.path ? (String(r.path).startsWith("file:") ? r.path : "file://" + r.path) : (await Filesystem.getUri({ path: pfad, directory: "CACHE" })).uri);
    }
    onFortschritt?.("");
    const Share = C.Plugins.Share || (C.isPluginAvailable?.("Share") ? plugin("Share") : null);
    if (Share) {
      try { await Share.share({ files: uris, dialogTitle: "Speichern oder teilen" }); return; }
      catch (e: any) { if (/cancel/i.test(String(e?.message || e))) return; }
    }
    // ältere App-Version ohne Teilen-Menü: im passenden Programm öffnen (dort speichern/teilen)
    const FileOpener = plugin("FileOpener");
    await FileOpener.open({ filePath: uris[0], contentType: dateien[0].typ || "application/octet-stream", openWithDefault: true });
  }
}

export const social = new Social();

export const groesse = (b?: number) => (b == null ? "" : b > 1e6 ? (b / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");

// Breite, Höhe (und Länge bei Videos) einer Datei auf dem Gerät
function abmessen(f: File): Promise<{ b?: number; h?: number; dauer?: number }> {
  const url = URL.createObjectURL(f);
  return new Promise<{ b?: number; h?: number; dauer?: number }>((res) => {
    const fertig = (m: { b?: number; h?: number; dauer?: number }) => { URL.revokeObjectURL(url); res(m); };
    if (f.type.startsWith("video/")) {
      const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
      v.onloadedmetadata = () => fertig({ b: v.videoWidth, h: v.videoHeight, dauer: Math.round(v.duration * 10) / 10 });
      v.onerror = () => fertig({}); v.src = url;
    } else {
      const i = new Image(); i.onload = () => fertig({ b: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => fertig({}); i.src = url;
    }
  });
}
// Kleines JPEG fürs Gitter: erstes Bild bzw. ein Bild aus dem Video (nach einer halben Sekunde)
function vorschaubild(f: File): Promise<Blob | null> {
  const url = URL.createObjectURL(f);
  const zeichnen = (q: CanvasImageSource, w: number, h: number) => {
    const s = Math.min(1, 720 / Math.max(w, 1)), c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d")!.drawImage(q, 0, 0, c.width, c.height);
    return new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
  };
  return new Promise<Blob | null>((res, rej) => {
    const ende = (b: Blob | null) => { URL.revokeObjectURL(url); res(b); };
    const fehler = () => { URL.revokeObjectURL(url); rej(new Error("Keine Vorschau")); };
    if (f.type.startsWith("video/")) {
      const v = document.createElement("video"); v.preload = "auto"; v.muted = true; v.playsInline = true;
      v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
      v.onseeked = () => zeichnen(v, v.videoWidth, v.videoHeight).then(ende, fehler);
      v.onerror = fehler; v.src = url;
    } else {
      const i = new Image(); i.onload = () => zeichnen(i, i.naturalWidth, i.naturalHeight).then(ende, fehler); i.onerror = fehler; i.src = url;
    }
  });
}
