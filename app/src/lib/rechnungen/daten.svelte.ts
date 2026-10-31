// Rechnungen & Angebote: Daten, Offline-Warteschlange und Server-Aktionen (wie in der Rechnungs-App).
// Jede Änderung geht sofort an den Server. Ohne Internet landet sie in einer Warteschlange auf dem Gerät
// und wird automatisch übertragen, sobald wieder Netz da ist. PDFs abgeschlossener Belege bleiben offline verfügbar.
import { sb } from "../supabase";
import { SUPABASE_KEY, SUPABASE_URL } from "../config";
import { DEFAULTS, totals, isOn, todayISO, positionsOf, type Posten } from "./kern";

const FN_URL = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/rechnungen";
const CACHE_KEY = "medialyte-rechnungen-cache-v1", OUTBOX_KEY = "medialyte-rechnungen-outbox-v1", FAILED_KEY = "medialyte-rechnungen-failed-v1";
const TABLE_STATE: Record<string, string> = { customers: "customers", invoices: "alleRechnungen", quotes: "alleAngebote", products: "products", recurring: "recurring", mail_log: "mail", kundenkategorien: "kategorien" };
const TABLE_LABEL: Record<string, string> = { invoices: "Rechnung", quotes: "Angebot", customers: "Kunde", products: "Standard-Position", recurring: "Abo", settings: "Einstellungen", kundenkategorien: "Kundenkategorie" };
const OP_LABEL: Record<string, string> = { insert: "angelegt", update: "geändert", upsert: "gespeichert", delete: "gelöscht" };
const FN_LABEL: Record<string, string> = { issue: "Rechnung abschließen", send: "Rechnung senden", remind: "Zahlungserinnerung senden", correct: "Rechnung stornieren", quote_issue: "Angebot abschließen",
  quote_send: "Angebot senden", recurring_backfill: "Abo-Rechnungen nachtragen", run_recurring: "Abo-Rechnung erstellen" };
export const QUEUED_MSG = "Ohne Internet gespeichert – wird automatisch erledigt, sobald du wieder online bist";

type Op = { kind: "db" | "fn"; uid: string; at: number; t?: string; op?: string; filters?: [string, unknown][]; vals?: any; action?: string; payload?: any; error?: string };
const readLS = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
export const isNetErr = (e: any) => e instanceof TypeError || /RetryableFetch/.test(e?.name || "") || /Failed to fetch|NetworkError|Load failed|network|Keine Verbindung|ERR_INTERNET|timeout/i.test(e?.message || String(e || ""));
const isAuthErr = (e: any) => /JWT|401|not authenticated|invalid claim|refresh token|neu anmelden/i.test(e?.message || String(e || ""));
const online = () => navigator.onLine !== false;
const NATIVE = typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();

// PDFs zum Offline-Ansehen auf dem Gerät aufheben
const pdfStore = (() => {
  let p: Promise<IDBDatabase> | null = null;
  const open = () => (p ||= new Promise((res, rej) => { const r = indexedDB.open("medialyte-rechnungen", 1); r.onupgradeneeded = () => r.result.createObjectStore("pdf"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void) => { const d = await open(); return new Promise<any>((res, rej) => { const t = d.transaction("pdf", mode); const q = fn(t.objectStore("pdf")); t.oncomplete = () => res((q as IDBRequest | undefined)?.result); t.onerror = () => rej(t.error); }); };
  return { get: (k: string) => tx("readonly", (s) => s.get(k)).catch(() => null) as Promise<Blob | null>, set: (k: string, v: Blob) => tx("readwrite", (s) => s.put(v, k)).catch(() => {}) };
})();

class Rechnungen {
  settings = $state<Record<string, any>>({ ...DEFAULTS });
  firmaId = $state<string | null>(null);
  // GoBD: ausgestellte Rechnungen und verschickte Angebote werden nie gelöscht, nur ausgeblendet.
  // Die Listen der App zeigen nur Sichtbares; ausgeblendete bleiben gespeichert und erreichbar (Filter „Ausgeblendet“).
  alleRechnungen = $state<any[]>([]); alleAngebote = $state<any[]>([]);
  invoices = $derived(this.alleRechnungen.filter((r) => !r.ausgeblendet_am));
  quotes = $derived(this.alleAngebote.filter((r) => !r.ausgeblendet_am));
  ausgeblendet = $derived(this.alleRechnungen.filter((r) => r.ausgeblendet_am));
  ausgeblendeteAngebote = $derived(this.alleAngebote.filter((r) => r.ausgeblendet_am));
  customers = $state<any[]>([]); products = $state<any[]>([]); recurring = $state<any[]>([]); mail = $state<any[]>([]);
  kategorien = $state<{ id: string; name: string; farbe: string; sortierung: number }[]>([]);   // eigene Kundenkategorien
  outbox = $state<Op[]>(readLS(OUTBOX_KEY, [])); failed = $state<Op[]>(readLS(FAILED_KEY, []));
  offline = $state(false); loaded = $state(false); syncedAt = $state<number | null>(null);
  offeneBlaetter = $state(0);   // offene Formulare: dann nicht neu zeichnen
  pdf = $state<{ url: string; name: string } | null>(null);   // PDF-Ansicht im Programm
  #flushing: Promise<number> | null = null; #timer = 0; #kanal: ReturnType<typeof sb.channel> | null = null; #gestartet = false; #nachladen = 0;

  get small() { return isOn(this.settings.small_business); }
  totals(items: Posten[] = []) { return totals(items, this.small); }

  // ---------- Start, Laden, Cache
  starten() {
    if (this.#gestartet) return; this.#gestartet = true;
    if (this.cacheLoad()) this.loaded = true;
    this.loadAll().catch((e) => this.meldung?.(e?.message || String(e), true));
    addEventListener("online", () => { this.offline = false; this.flush().then(() => this.loadAll()); });
    addEventListener("offline", () => { this.offline = true; });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { if (this.offeneBlaetter) this.flush(); else this.loadAll(); } });
    setInterval(() => { if (this.outbox.length && online()) this.flush().then((n) => { if (n && !this.offeneBlaetter) this.loadAll(); }); }, 60000);
    // Änderungen anderer Team-Mitglieder und der Abo-Automatik
    this.#kanal = sb.channel("rechnungen-live");
    for (const t of ["invoices", "quotes", "customers", "recurring", "products", "settings", "kundenkategorien"])
      this.#kanal.on("postgres_changes", { event: "*", schema: "public", table: t }, () => { clearTimeout(this.#nachladen); this.#nachladen = setTimeout(() => { if (!this.offeneBlaetter && !this.outbox.length) this.loadAll(); }, 1500) as unknown as number; });
    this.#kanal.subscribe();
  }
  cacheSave() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ settings: this.settings, firmaId: this.firmaId, customers: this.customers, invoices: this.alleRechnungen, quotes: this.alleAngebote, products: this.products, recurring: this.recurring, mail: this.mail, kategorien: this.kategorien, at: Date.now(), syncedAt: this.syncedAt })); } catch { /* voll */ }
  }
  cacheLoad() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); if (!c) return false;
      this.settings = { ...DEFAULTS, ...c.settings }; this.firmaId = c.firmaId ?? null; this.customers = c.customers ?? []; this.alleRechnungen = c.invoices ?? []; this.alleAngebote = c.quotes ?? [];
      this.products = c.products ?? []; this.recurring = c.recurring ?? []; this.mail = c.mail ?? []; this.kategorien = c.kategorien ?? []; this.syncedAt = c.syncedAt ?? null; return true;
    } catch { return false; }
  }
  async loadAll() {
    try {
      if (!online()) throw new TypeError("offline");
      if (this.outbox.length) await this.flush();
      const q = await Promise.all([
        sb.from("settings").select("user_id,company,updated_at").order("updated_at"),
        sb.from("customers").select("*").order("name"),
        sb.from("invoices").select("*").order("created_at", { ascending: false }),
        sb.from("recurring").select("*").order("next_date"),
        sb.from("quotes").select("*").order("created_at", { ascending: false }),
        sb.from("products").select("*").order("name"),
        sb.from("mail_log").select("*").order("sent_at", { ascending: false }).limit(1000),
        sb.rpc("firma_id"),
        sb.from("kundenkategorien").select("*").order("sortierung").order("name"),
      ]);
      const err = q.slice(0, 8).find((r) => r.error); if (err) throw err.error;
      if (!q[8].error) this.kategorien = (q[8].data as any[]) ?? [];
      // Einstellungen des Firmenkontos (falls jemand aus dem Team früher eigene angelegt hat, gelten trotzdem die der Firma)
      const sets = (q[0].data as any[]) ?? [], fid = (q[7].data as string | null) ?? null;
      const set = sets.find((x) => x.user_id === fid) ?? sets[0] ?? null;
      this.settings = { ...DEFAULTS, ...(set?.company || {}) };
      this.firmaId = (set?.user_id ?? fid ?? null) as string | null;
      this.customers = q[1].data as any[]; this.alleRechnungen = q[2].data as any[]; this.recurring = q[3].data as any[]; this.alleAngebote = q[4].data as any[];
      this.products = q[5].data as any[]; this.mail = q[6].data as any[];
      this.reapplyOutbox();
      this.offline = false; this.loaded = true; this.syncedAt = Date.now(); this.cacheSave();
    } catch (e: any) {
      if (!isNetErr(e)) console.error(e);
      if (this.cacheLoad()) { this.reapplyOutbox(); this.offline = true; this.loaded = true; }
      else { this.loaded = true; throw new Error(isNetErr(e) ? "Keine Internetverbindung und noch keine Daten auf diesem Gerät." : "Daten konnten nicht geladen werden: " + (e?.message || e)); }
    }
  }
  async reloadProducts() { const { data, error } = await sb.from("products").select("*").order("name"); if (!error) { this.products = data ?? []; this.cacheSave(); } }

  // ---------- Schreiben (sofort sichtbar, offline in der Warteschlange)
  saveQueue() { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(this.outbox)); localStorage.setItem(FAILED_KEY, JSON.stringify(this.failed)); } catch { /* voll */ } }
  async #exec(o: Op) {
    let q: any = sb.from(o.t!);
    q = o.op === "insert" ? q.insert(o.vals) : o.op === "update" ? q.update(o.vals) : o.op === "upsert" ? q.upsert(o.vals) : q.delete();
    for (const [c, v] of o.filters || []) q = q.eq(c, v);
    q = o.op === "delete" ? q.select("id") : q.select();
    const { data, error } = await q;
    if (error) throw error;
    // Ohne Recht löscht die Datenbank still nichts – das soll nicht wie ein Erfolg aussehen
    if (o.op === "delete" && !data?.length) {
      const weg = (o.filters || []).some(([c, v]) => c === "id" && !(this as any)[TABLE_STATE[o.t!]]?.some?.((r: any) => r.id === v));
      if (!weg) throw new Error("Konnte nicht gelöscht werden: Dafür fehlt dir das Recht, oder der Eintrag ist schon weg.");
    }
    return data;
  }
  applyLocal(o: Op, rows?: any[]) {
    if (o.t === "settings") { if (o.vals?.company) this.settings = { ...DEFAULTS, ...o.vals.company }; return o.vals; }
    const key = TABLE_STATE[o.t!]; if (!key) return null;
    const list: any[] = (this as any)[key];
    const match = (r: any) => (o.filters || []).every(([c, v]) => r[c] === v);
    if (o.op === "insert") {
      const row = rows?.[0] || { created_at: new Date().toISOString(), ...o.vals };
      const i = list.findIndex((r) => r.id === row.id);
      if (i >= 0) list[i] = { ...list[i], ...row }; else list.unshift(row);
      return row;
    }
    if (o.op === "update" || o.op === "upsert") {
      let last = null;
      list.forEach((r, i) => { if (match(r)) { list[i] = { ...r, ...o.vals, ...(rows?.find((x: any) => x.id === r.id) || {}) }; last = list[i]; } });
      return last;
    }
    if (o.op === "delete") { (this as any)[key] = list.filter((r) => !match(r)); return null; }
    return null;
  }
  reapplyOutbox() { for (const o of this.outbox) if (o.kind === "db") this.applyLocal(o); }
  enqueue(o: Op) { this.outbox.push(o); this.saveQueue(); this.scheduleFlush(); }

  /** Schreibvorgang wie bei Supabase: await R.write("invoices", "update", {..}, [["id", x]]) */
  async write(t: string, op: "insert" | "update" | "upsert" | "delete", vals?: any, filters: [string, unknown][] = []): Promise<{ data: any; error: any }> {
    const o: Op = { kind: "db", uid: uuid(), at: Date.now(), t, op, filters, vals: op === "insert" && !Array.isArray(vals) ? { id: uuid(), ...vals } : vals };
    if (this.outbox.length && online()) await this.flush().catch(() => {});
    if (!this.outbox.length && online()) {
      try { const rows = await this.#exec(o); const row = this.applyLocal(o, rows); this.cacheSave(); return { data: rows?.[0] ?? row, error: null }; }
      catch (e) { if (!isNetErr(e)) return { data: null, error: e }; this.offline = true; }
    }
    const row = this.applyLocal(o); this.cacheSave(); this.enqueue(o);
    return { data: row, error: null };
  }
  /** Server-Aktion (Abschließen, Senden …): ohne Internet merken und später ausführen */
  async act(action: string, payload: Record<string, unknown> = {}): Promise<any> {
    if (this.outbox.length && online()) await this.flush().catch(() => {});
    if (!this.outbox.length && online()) {
      try { return await this.fn(action, payload); }
      catch (e) { if (!isNetErr(e)) throw e; this.offline = true; }
    }
    this.enqueue({ kind: "fn", uid: uuid(), at: Date.now(), action, payload });
    return { queued: true };
  }
  needsNet(what: string) { if (!online() || this.offline) throw new Error(`${what} braucht eine Internetverbindung. Versuch es noch mal, sobald du wieder online bist.`); }
  async fn(action: string, payload: Record<string, unknown> = {}, binary = false): Promise<any> {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { if (!online()) throw new TypeError("Keine Verbindung zum Server."); throw new Error("Bitte neu anmelden."); }
    let res: Response;
    try {
      res = await fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY }, body: JSON.stringify({ action, ...payload }) });
    } catch { throw new TypeError("Keine Verbindung zum Server."); }
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Fehler ${res.status}`); }
    return binary ? res.blob() : res.json();
  }
  scheduleFlush(ms = 1500) {
    clearTimeout(this.#timer);
    if (this.outbox.length) this.#timer = setTimeout(() => { if (online()) this.flush().then((n) => { if (n && !this.offeneBlaetter) this.loadAll(); }); else this.scheduleFlush(30000); }, ms) as unknown as number;
  }
  meldung: ((t: string, schlecht?: boolean) => void) | null = null;
  async flush(): Promise<number> {
    if (this.#flushing) return this.#flushing;
    if (!this.outbox.length || !online()) return 0;
    this.#flushing = (async () => {
      let done = 0;
      while (this.outbox.length) {
        const o = this.outbox[0];
        try { if (o.kind === "fn") await this.fn(o.action!, o.payload); else await this.#exec(o); }
        catch (e: any) {
          if (isNetErr(e) || isAuthErr(e)) { this.offline = isNetErr(e); this.scheduleFlush(30000); break; }
          // Anlegen war schon angekommen (Antwort ging unterwegs verloren) → gilt als erledigt
          const already = o.op === "insert" && (e?.code === "23505" || /duplicate key/i.test(e?.message || ""));
          if (!already) this.failed.push({ ...o, error: e?.message || String(e) });
        }
        this.outbox.shift(); this.saveQueue(); done++;
      }
      if (done) {
        if (!this.outbox.length) this.offline = false;
        this.meldung?.(this.failed.length ? `Synchronisiert – ${this.failed.length} ${this.failed.length === 1 ? "Änderung hat" : "Änderungen haben"} ein Problem (oben antippen)` : `${done} ${done === 1 ? "Änderung" : "Änderungen"} in die Cloud übertragen`, !!this.failed.length);
      }
      return done;
    })();
    try { return await this.#flushing; } finally { this.#flushing = null; }
  }
  get syncInfo() {
    if (this.failed.length) return { cls: "bad", text: `${this.failed.length} Problem${this.failed.length === 1 ? "" : "e"}` };
    if (this.outbox.length) return { cls: "off", text: `${this.outbox.length} ausstehend` };
    if (this.offline) return { cls: "off", text: "Offline" };
    return { cls: "", text: "Synchron" };
  }
  pendingFor(id?: string) { return !!id && this.outbox.some((o) => opTarget(o) === id); }
  opLabel(o: Op) {
    let base = o.kind === "fn" ? FN_LABEL[o.action!] || o.action! : `${TABLE_LABEL[o.t!] || o.t} ${OP_LABEL[o.op!] || ""}`;
    if (o.op === "insert" && o.vals?.status === "draft") base = o.t === "quotes" ? "Angebotsentwurf angelegt" : "Rechnungsentwurf angelegt";
    if (o.op === "update" && o.vals?.status === "paid") base = "Als bezahlt markiert";
    if (o.kind === "fn" && o.action === "issue" && o.payload?.send) base = "Rechnung abschließen & senden";
    if (o.kind === "fn" && o.action === "quote_issue" && o.payload?.send) base = "Angebot abschließen & senden";
    const id = opTarget(o);
    const row = id && (this.invoice(id) || this.quote(id) || this.recurring.find((x) => x.id === id) || this.customer(id));
    const who = row ? (row.name || this.custName(row)) : "";
    return who ? `${base} · ${who}` : base;
  }
  retry(i: number) { const [o] = this.failed.splice(i, 1); delete o.error; this.outbox.push(o); this.saveQueue(); return this.flush().then(() => this.loadAll()); }
  drop(i: number) { this.failed.splice(i, 1); this.saveQueue(); return this.loadAll(); }

  /** Einstellungen speichern (gehören dem Firmenkonto, auch wenn jemand aus dem Team speichert) */
  async saveSettings(company: Record<string, any>) {
    const uid = this.firmaId ?? (await sb.auth.getUser()).data.user?.id;
    const { error } = await this.write("settings", "upsert", { user_id: uid, company, updated_at: new Date().toISOString() });
    if (error) throw error;
    this.settings = { ...DEFAULTS, ...company }; this.cacheSave();
  }

  // ---------- Nachschlagen
  customer(id?: string | null) { return this.customers.find((c) => c.id === id); }
  kategorie(id?: string | null) { return this.kategorien.find((k) => k.id === id); }
  /** Kategorie „Website“ (für Website-Kunden aus dem Agenten automatisch) */
  get webKategorie() { return this.kategorien.find((k) => k.name.trim().toLowerCase() === "website") ?? null; }
  invoice(id?: string | null) { return this.alleRechnungen.find((i) => i.id === id); }
  quote(id?: string | null) { return this.alleAngebote.find((q) => q.id === id); }
  custName(inv: any) { return inv.customer?.name || this.customer(inv.customer_id)?.name || "Ohne Kunde"; }
  invTotal(inv: any) { return inv.status === "draft" ? this.totals(inv.items).gross : +inv.gross; }
  quoteTotal(q: any) { return q.status === "draft" ? this.totals(q.items).gross : +q.gross; }
  splitText(items: Posten[] = []) { return splitText(items, this); }
  discTypes() { return (Array.isArray(this.settings.discount_types) ? this.settings.discount_types : []).filter((t: any) => t?.name) as { name: string; mode: string; value: number }[]; }
  customerSince(cid: string) { return this.invoices.filter((i) => i.customer_id === cid && i.kind === "invoice" && ["open", "paid"].includes(i.status) && i.issue_date).map((i) => i.issue_date).sort()[0] || null; }
  wuItems(): Posten[] { const s = this.settings; return (Array.isArray(s.wu_items) && s.wu_items.length ? s.wu_items : DEFAULTS.wu_items).map((it: Posten) => (this.small && it.type !== "discount" ? { ...it, vat: 0 } : it)); }
  revenueEvents() {
    return this.invoices.filter((i) => i.kind === "invoice" && i.status === "paid")
      .map((i) => ({ inv: i, date: String(i.paid_at || i.issue_date || "").slice(0, 10), amount: +i.gross })).filter((e) => e.date >= "2024-01-01");
  }
  nextCustomerNumber() { const nums = this.customers.map((c) => parseInt(c.number, 10)).filter((n) => isFinite(n)); return String(nums.length ? Math.max(...nums) + 1 : 10001); }
  customerInvoiceNumber(c: any, n: number) { const s = this.settings; const p = String(s.prefix || ""); const sep = p && !/[-_/]$/.test(p) ? "-" : ""; return `${p}${sep}${c.number || "Kundennr."}-${String(n).padStart(+s.number_digits || 4, "0")}`; }

  // ---------- PDF ansehen / teilen (offline: abgeschlossene Belege vom Gerät)
  async openPdf(doc: { id: string; kind?: string; number?: string | null; status?: string }) {
    const isQ = doc.kind === "quote", key = `${isQ ? "q" : "i"}:${doc.id}`;
    const final = !!doc.number && doc.status !== "draft";
    let blob: Blob | null = null;
    if (online() && !this.pendingFor(doc.id)) {
      try { blob = await this.fn(isQ ? "quote_pdf" : "pdf", { id: doc.id }, true); if (final) pdfStore.set(key, blob!); }
      catch (e) { if (!isNetErr(e)) throw e; }
    }
    if (!blob && final) blob = await pdfStore.get(key);
    if (!blob) throw new Error(this.pendingFor(doc.id) ? "Das PDF gibt es, sobald die Änderung übertragen ist – dafür brauchst du Internet." : "Für dieses PDF brauchst du einmal Internet. Danach ist es auch offline auf dem Gerät.");
    const name = `${isQ ? "Angebot" : doc.kind === "storno" ? "Stornorechnung" : "Rechnung"}_${doc.number || "Entwurf"}.pdf`;
    if (NATIVE) return openPdfNative(blob, name);
    const file = new File([blob], name, { type: "application/pdf" });
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e: any) { if (e.name === "AbortError") return; }
    }
    if (this.pdf) URL.revokeObjectURL(this.pdf.url);
    this.pdf = { url: URL.createObjectURL(file), name };   // Ansicht in der App, mit Speichern und Drucken
  }
  /** GoBD-Export für den Betriebsprüfer: ZIP mit CSV-Daten, index.xml (GDPdU), Protokoll und Original-PDFs */
  async gobdExport(von: string, bis: string) {
    this.needsNet("Der GoBD-Export");
    const blob: Blob = await this.fn("gobd_export", { von, bis }, true);
    const name = `GoBD-Export_${von}_bis_${bis}.zip`;
    if (NATIVE) {
      const C = (window as any).Capacitor;
      const plugin = (n: string) => C.Plugins[n] ||= C.registerPlugin(n);
      const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
      const w = await plugin("Filesystem").writeFile({ path: `export/${name}`, data, directory: "CACHE", recursive: true });
      const Share = C.isPluginAvailable?.("Share") ? plugin("Share") : null;
      if (!Share) throw new Error("Zum Speichern bitte die App einmal aktualisieren (neue Version installieren).");
      try { await Share.share({ files: [w.uri], dialogTitle: "GoBD-Export speichern oder teilen" }); } catch (e: any) { if (!/cancel/i.test(String(e?.message || e))) throw e; }
      return name;
    }
    const url = URL.createObjectURL(new File([blob], name, { type: "application/zip" }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return name;
  }
}
function opTarget(o: Op) { return o.kind === "fn" ? o.payload?.id : (o.vals?.id || o.filters?.find((f) => f[0] === "id")?.[1]); }
export function splitText(items: Posten[], R: Rechnungen) {
  const gs = (items.length ? items : []).length ? groupsWithTotals(items, R) : [];
  return gs.length ? gs.map((g) => g.text).join(" + ") : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(0);
}
function groupsWithTotals(items: Posten[], R: Rechnungen) {
  const SUF: Record<string, string> = { once: "", monthly: " / Monat", quarterly: " / Quartal", yearly: " / Jahr" };
  const g: Record<string, Posten[]> = {}; for (const it of items) (g[(it.billing && SUF[it.billing] !== undefined) ? it.billing : "once"] ||= []).push(it);
  return ["once", "monthly", "quarterly", "yearly"].filter((k) => g[k]?.some((it) => it?.type !== "discount"))
    .map((k) => ({ billing: k, text: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(R.totals(g[k]).gross) + SUF[k] }));
}

// Android-App: PDF als Datei ablegen und mit dem PDF-Programm des Handys öffnen
async function openPdfNative(blob: Blob, name: string) {
  const C = (window as any).Capacitor;
  const plugin = (n: string) => C.Plugins[n] ||= C.registerPlugin(n);
  const Filesystem = plugin("Filesystem"), FileOpener = plugin("FileOpener");
  const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const w = await Filesystem.writeFile({ path: `pdf/${name}`, data, directory: "CACHE", recursive: true });
  try { await FileOpener.open({ filePath: w.uri, contentType: "application/pdf", openWithDefault: true }); }
  catch { throw new Error("Kein PDF-Programm gefunden. Installiere z. B. Google Drive oder Adobe Acrobat."); }
}

export const R = new Rechnungen();
export { todayISO, positionsOf };
