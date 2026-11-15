// iCal (.ics) lesen: Termine mit Zeitzonen, ganztägige Termine, Wiederholungen (RRULE, EXDATE, geänderte Einzeltermine).
// Rein rechnend, ohne Netz – so auch lokal testbar (node --experimental-strip-types).

export type Ereignis = { uid: string; titel: string; ort: string | null; notiz: string | null; start: Date; ende: Date; ganztag: boolean };
type Zeit = { y: number; m: number; d: number; h: number; mi: number; s: number; datum: boolean; utc: boolean; tz: string | null };
type Prop = { name: string; params: Record<string, string>; wert: string };

const STANDARD_TZ = "Europe/Berlin";
// Windows-Namen, wie Outlook/Exchange sie schreiben
const WINDOWS_TZ: Record<string, string> = {
  "W. Europe Standard Time": "Europe/Berlin", "Central Europe Standard Time": "Europe/Budapest", "Romance Standard Time": "Europe/Paris",
  "GMT Standard Time": "Europe/London", "UTC": "UTC", "Coordinated Universal Time": "UTC", "Central European Standard Time": "Europe/Warsaw",
};

function zone(tz: string | null): string {
  if (!tz) return STANDARD_TZ;
  const t = tz.replace(/^"|"$/g, "").replace(/^\/[^/]+\/[^/]+\//, "");   // „/mozilla.org/20050126_1/Europe/Berlin“
  const kandidat = WINDOWS_TZ[t] ?? t;
  try { new Intl.DateTimeFormat("en-US", { timeZone: kandidat }); return kandidat; } catch { return STANDARD_TZ; }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function versatz(utcMs: number, tz: string): number {
  let f = fmtCache.get(tz);
  if (!f) { f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); fmtCache.set(tz, f); }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(utcMs))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second) - utcMs;
}
/** Wanduhrzeit in einer Zeitzone → echter Zeitpunkt */
export function wandzeit(y: number, m: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const roh = Date.UTC(y, m - 1, d, h, mi, s);
  let t = roh - versatz(roh, tz);
  t = roh - versatz(t, tz);
  return new Date(t);
}

function zeitLesen(p: Prop): Zeit | null {
  const m = p.wert.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const datum = !m[4] || p.params.VALUE === "DATE";
  return { y: +m[1], m: +m[2], d: +m[3], h: datum ? 0 : +m[4], mi: datum ? 0 : +m[5], s: datum ? 0 : +(m[6] ?? 0), datum, utc: !!m[7], tz: p.params.TZID ?? null };
}
function zuDatum(z: Zeit): Date {
  if (z.utc) return new Date(Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s));
  return wandzeit(z.y, z.m, z.d, z.h, z.mi, z.s, zone(z.tz));
}
function dauerMs(s: string): number {
  const m = s.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const v = (((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 + +(m[4] ?? 0)) * 60 + +(m[5] ?? 0)) * 60 + +(m[6] ?? 0);
  return (m[1] === "-" ? -1 : 1) * v * 1000;
}
const text = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

function zeilen(ics: string): Prop[] {
  const roh = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: Prop[] = [];
  for (const z of roh) {
    if (!z) continue;
    // Name und Parameter bis zum ersten Doppelpunkt außerhalb von Anführungszeichen
    let i = 0, q = false;
    for (; i < z.length; i++) { const c = z[i]; if (c === '"') q = !q; else if (c === ":" && !q) break; }
    if (i >= z.length) continue;
    const kopf = z.slice(0, i), wert = z.slice(i + 1);
    const teile = kopf.match(/(?:[^;"]+|"[^"]*")+/g) ?? [kopf];
    const params: Record<string, string> = {};
    for (const t of teile.slice(1)) { const k = t.indexOf("="); if (k > 0) params[t.slice(0, k).toUpperCase()] = t.slice(k + 1).replace(/^"|"$/g, ""); }
    out.push({ name: teile[0].toUpperCase(), params, wert });
  }
  return out;
}

type Roh = { props: Prop[] };
const eins = (e: Roh, n: string) => e.props.find((p) => p.name === n);

const TAGE: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
const wochentag = (y: number, m: number, d: number) => { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return w === 0 ? 7 : w; };
const plusTage = (y: number, m: number, d: number, n: number) => { const t = new Date(Date.UTC(y, m - 1, d + n)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()] as const; };
const tageImMonat = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Alle Tage (Wanduhr-Datum) einer Wiederholung ab dem Start, höchstens bis „bis“ */
function wiederholungen(start: Zeit, rrule: string, bis: Date, max = 800): [number, number, number][] {
  const r: Record<string, string> = {};
  for (const t of rrule.split(";")) { const [k, v] = t.split("="); if (k && v) r[k.toUpperCase()] = v; }
  const freq = r.FREQ, iv = Math.max(1, +(r.INTERVAL ?? 1) || 1), count = r.COUNT ? +r.COUNT : Infinity;
  let until = Infinity;
  if (r.UNTIL) { const u = zeitLesen({ name: "UNTIL", params: {}, wert: r.UNTIL }); if (u) until = (u.datum ? zuDatum({ ...u, h: 23, mi: 59, s: 59, tz: start.tz, utc: false }) : zuDatum({ ...u, tz: start.tz })).getTime(); }
  const grenze = Math.min(until, bis.getTime());
  const byday = (r.BYDAY ?? "").split(",").filter(Boolean).map((x) => { const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: m[1] ? +m[1] : 0, t: TAGE[m[2]] } : null; }).filter(Boolean) as { n: number; t: number }[];
  const bymd = (r.BYMONTHDAY ?? "").split(",").filter(Boolean).map(Number);
  const out: [number, number, number][] = [];
  const nimm = (y: number, m: number, d: number) => {
    const t = zuDatum({ ...start, y, m, d }).getTime();
    if (t < zuDatum(start).getTime()) return true;
    if (t > grenze || out.length >= count || out.length >= max) return false;
    out.push([y, m, d]); return true;
  };
  let [y, m, d] = [start.y, start.m, start.d];
  for (let schritt = 0; schritt < 5000; schritt++) {
    let weiter = true;
    if (freq === "DAILY") { weiter = nimm(y, m, d); [y, m, d] = plusTage(y, m, d, iv); }
    else if (freq === "WEEKLY") {
      // Woche ab Montag der Startwoche
      const wt = wochentag(y, m, d), [my, mm, md] = plusTage(y, m, d, 1 - wt);
      const tage = byday.length ? byday.map((b) => b.t).sort() : [wochentag(start.y, start.m, start.d)];
      for (const t of tage) { const [a, b, c] = plusTage(my, mm, md, t - 1); if (!(weiter = nimm(a, b, c))) break; }
      [y, m, d] = plusTage(my, mm, md, 7 * iv);
    } else if (freq === "MONTHLY") {
      const n = tageImMonat(y, m);
      let tage: number[] = [];
      if (bymd.length) tage = bymd.map((x) => (x < 0 ? n + x + 1 : x)).filter((x) => x >= 1 && x <= n);
      else if (byday.length) {
        for (const b of byday) {
          const alle = Array.from({ length: n }, (_, i) => i + 1).filter((x) => wochentag(y, m, x) === b.t);
          if (!b.n) tage.push(...alle); else { const x = b.n > 0 ? alle[b.n - 1] : alle[alle.length + b.n]; if (x) tage.push(x); }
        }
      } else if (start.d <= n) tage = [start.d];
      for (const t of tage.sort((a, b) => a - b)) if (!(weiter = nimm(y, m, t))) break;
      m += iv; while (m > 12) { m -= 12; y++; } d = 1;
    } else if (freq === "YEARLY") {
      if (start.d <= tageImMonat(y, start.m)) weiter = nimm(y, start.m, start.d);
      y += iv;
    } else { nimm(y, m, d); break; }
    if (!weiter || out.length >= count || out.length >= max) break;
    if (zuDatum({ ...start, y, m, d: Math.min(d, 28) }).getTime() > grenze + 31 * 864e5) break;
  }
  return out;
}

/** .ics → Termine zwischen „von“ und „bis“ */
export function lesen(ics: string, von: Date, bis: Date): Ereignis[] {
  const props = zeilen(ics);
  const events: Roh[] = [];
  let akt: Roh | null = null, tiefe = 0;
  for (const p of props) {
    if (p.name === "BEGIN") { if (p.wert.toUpperCase() === "VEVENT" && tiefe === 0) akt = { props: [] }; else if (akt) tiefe++; continue; }
    if (p.name === "END") { if (akt && tiefe > 0) { tiefe--; continue; } if (p.wert.toUpperCase() === "VEVENT" && akt) { events.push(akt); akt = null; } continue; }
    if (akt && tiefe === 0) akt.props.push(p);
  }

  // Geänderte Einzeltermine einer Serie (RECURRENCE-ID) ersetzen den regulären Termin an diesem Tag
  const ersatz = new Map<string, Set<number>>();
  for (const e of events) {
    const rid = eins(e, "RECURRENCE-ID"), uid = eins(e, "UID")?.wert;
    if (!rid || !uid) continue;
    const z = zeitLesen(rid); if (!z) continue;
    if (!ersatz.has(uid)) ersatz.set(uid, new Set());
    ersatz.get(uid)!.add(zuDatum(z).getTime());
  }

  const out: Ereignis[] = [];
  for (const e of events) {
    if ((eins(e, "STATUS")?.wert ?? "").toUpperCase() === "CANCELLED") continue;
    const ds = eins(e, "DTSTART"); if (!ds) continue;
    const start = zeitLesen(ds); if (!start) continue;
    const uid = eins(e, "UID")?.wert ?? `${eins(e, "SUMMARY")?.wert}-${ds.wert}`;
    const titel = text(eins(e, "SUMMARY")?.wert ?? "") || "(ohne Titel)";
    const ort = eins(e, "LOCATION") ? text(eins(e, "LOCATION")!.wert) || null : null;
    const notiz = eins(e, "DESCRIPTION") ? text(eins(e, "DESCRIPTION")!.wert).slice(0, 2000) || null : null;
    const s0 = zuDatum(start);
    let dauer: number;
    const de = eins(e, "DTEND"), du = eins(e, "DURATION");
    if (de) { const z = zeitLesen(de); dauer = z ? zuDatum(z).getTime() - s0.getTime() : 0; }
    else if (du) dauer = dauerMs(du.wert);
    else dauer = start.datum ? 864e5 : 0;
    if (!(dauer >= 0)) dauer = 0;

    const rrule = eins(e, "RRULE")?.wert;
    const istErsatz = !!eins(e, "RECURRENCE-ID");
    const exdates = new Set<number>();
    for (const p of e.props.filter((x) => x.name === "EXDATE"))
      for (const w of p.wert.split(",")) { const z = zeitLesen({ ...p, wert: w }); if (z) exdates.add(zuDatum({ ...z, tz: z.tz ?? start.tz }).getTime()); }
    const ersetzt = istErsatz ? new Set<number>() : ersatz.get(uid) ?? new Set<number>();

    const tage: [number, number, number][] = rrule && !istErsatz ? wiederholungen(start, rrule, bis) : [[start.y, start.m, start.d]];
    for (const [y, m, d] of tage) {
      const s = rrule && !istErsatz ? zuDatum({ ...start, y, m, d }) : s0;
      // Ganztägige Termine: Dauer in Kalendertagen, damit die Sommerzeit nichts verschiebt
      const ende = start.datum ? (() => { const n = Math.max(1, Math.round(dauer / 864e5)); const [a, b, c] = plusTage(y, m, d, n); return zuDatum({ ...start, y: a, m: b, d: c }); })() : new Date(s.getTime() + dauer);
      if (exdates.has(s.getTime()) || ersetzt.has(s.getTime())) continue;
      if (ende.getTime() < von.getTime() || s.getTime() > bis.getTime()) continue;
      out.push({ uid: `${uid}|${s.toISOString()}`, titel, ort, notiz, start: s, ende, ganztag: start.datum });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
