// Rechnungen & Angebote: Rechenregeln, Texte und Formate (1:1 aus der Rechnungs-App übernommen, damit Summen,
// Nummern und Status genau gleich bleiben wie auf dem Server)

export const DEFAULTS: Record<string, any> = {
  prefix: "RE", number_year: false, number_digits: 4, number_start: 1, small_business: false,
  payment_days: 14, accent: "#F44C4C",
  discount_types: [{ name: "Bestandskundenrabatt", mode: "percent", value: 10 }],
  intro: "Vielen Dank für Ihren Auftrag. Wir stellen Ihnen folgende Leistungen in Rechnung:",
  closing: "Vielen Dank für die gute Zusammenarbeit!",
  bcc_self: true, reminders_enabled: true, reminder_interval: 7, max_reminders: 3,
  tpl_invoice_subject: "Rechnung {nummer} – {firma}",
  tpl_invoice_body: "{anrede},\n\nanbei erhalten Sie unsere Rechnung {nummer} vom {datum} über {betrag}.\n\nBitte überweisen Sie den Betrag bis zum {faellig} unter Angabe der Rechnungsnummer.\n\nVielen Dank und viele Grüße\n{firma}",
  tpl_correction_subject: "Korrigierte Rechnung {nummer} (ersetzt {alte_nummer})",
  tpl_correction_body: "{anrede},\n\ndie Rechnung {alte_nummer} wurde storniert und durch die beigefügte Rechnung {nummer} über {betrag} ersetzt. Im Anhang finden Sie die Stornorechnung und die neue Rechnung.\n\nBitte überweisen Sie den Betrag bis zum {faellig}. Falls Sie die ursprüngliche Rechnung bereits bezahlt haben, geben Sie uns bitte kurz Bescheid, dann verrechnen wir den Betrag.\n\nViele Grüße\n{firma}",
  tpl_cancel_subject: "Stornierung der Rechnung {alte_nummer}",
  tpl_cancel_body: "{anrede},\n\ndie Rechnung {alte_nummer} wurde storniert. Die Stornorechnung {nummer} finden Sie im Anhang. Sie müssen nichts weiter tun. Falls Sie bereits bezahlt haben, erstatten wir Ihnen den Betrag.\n\nViele Grüße\n{firma}",
  tpl_reminder_subject: "Zahlungserinnerung zur Rechnung {nummer}",
  wu_title: "Zeit für eine neue Website",
  wu_letter:
    "{anrede},\n\nseit {kunde_seit} dürfen wir Sie mit Ihrer Website begleiten – vielen Dank für Ihr Vertrauen. In dieser Zeit haben sich die Ansprüche an Websites spürbar verändert: Die meisten Besucher kommen heute über das Smartphone, Google achtet stärker auf Ladezeit und Bedienbarkeit, und Interessenten entscheiden in wenigen Sekunden, ob sie bleiben oder weiterklicken.\n\nDeshalb machen wir unseren langjährigen Kunden ein besonderes Angebot: eine komplett neue Website zum Festpreis – modern gestaltet, technisch auf dem neuesten Stand und ohne Aufwand für Sie.\n\n## Warum sich ein Update jetzt lohnt\n- Zeitgemäßes Design, das Vertrauen schafft und Ihr Unternehmen so zeigt, wie es heute ist\n- Perfekt auf dem Smartphone und mit kurzen Ladezeiten\n- Besser gefunden werden: saubere Technik und Struktur für Google\n- Mehr Anfragen durch klare Wege zu Anruf, E-Mail und Kontaktformular\n- Aktuelle Sicherheitsstandards und Datenschutz nach DSGVO\n\n## So einfach geht es\nWir übernehmen Ihre bestehenden Inhalte, gestalten alles neu und stimmen den Entwurf mit Ihnen ab. Erst wenn Sie zufrieden sind, geht die neue Website online – Ihre Internetadresse und Ihre E-Mail-Postfächer bleiben unverändert.\n\nAlle Leistungen und den Festpreis finden Sie auf der nächsten Seite. Das Angebot gilt bis zum {gueltig}. Wir freuen uns auf Ihre Rückmeldung.\n\nViele Grüße\nDaniel Dogan\n{firma}",
  wu_intro: "Wie im Anschreiben beschrieben, erneuern wir Ihre Website komplett zum Festpreis:",
  wu_valid_days: 30,
  wu_items: [{
    description: "Komplett neue Website\nNeues Design, Übernahme Ihrer Inhalte, optimiert für Smartphone und Google, Kontaktformular, Impressum und Datenschutz, Einrichtung und Livegang",
    quantity: 1, unit: "pauschal", price: 0, vat: 19, discount: 0, billing: "once",
  }],
  tpl_wu_subject: "Ihre neue Website – Angebot {nummer}",
  tpl_wu_body:
    "{anrede},\n\nanbei erhalten Sie unser Angebot für eine komplett neue Website. Auf der ersten Seite haben wir zusammengefasst, warum sich ein Update jetzt lohnt, auf der zweiten finden Sie alle Leistungen und den Festpreis von {betrag}. Das Angebot gilt bis zum {gueltig}.\n\nWenn alles passt, genügt eine kurze Antwort auf diese E-Mail.\n\nViele Grüße\n{firma}",
  quote_prefix: "AN", quote_valid_days: 30,
  quote_intro: "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:",
  quote_closing: "Wir freuen uns auf Ihre Zusage und die Zusammenarbeit.",
  tpl_quote_subject: "Angebot {nummer} – {firma}",
  tpl_quote_body: "{anrede},\n\nvielen Dank für Ihr Interesse. Anbei erhalten Sie unser Angebot {nummer} über {betrag}. Es ist gültig bis zum {gueltig}.\n\nWenn alles passt, genügt eine kurze Antwort auf diese E-Mail. Bei Fragen melden Sie sich jederzeit gern.\n\nViele Grüße\n{firma}",
  tpl_reminder_body: "{anrede},\n\nsicher ist es nur untergegangen: Für unsere Rechnung {nummer} vom {datum} über {betrag}, fällig am {faellig}, konnten wir noch keinen Zahlungseingang feststellen.\n\nBitte überweisen Sie den Betrag in den nächsten Tagen. Die Rechnung finden Sie noch einmal im Anhang. Falls Sie bereits gezahlt haben, betrachten Sie diese E-Mail bitte als gegenstandslos.\n\nViele Grüße\n{firma}",
};

export type Posten = { type?: "discount"; description?: string; quantity?: number; unit?: string; price?: number; discount?: number; vat?: number;
  discount_label?: string; billing?: string; mode?: "percent" | "amount"; value?: number };

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const eur = (n: unknown) => EUR.format(+(n as number) || 0);
export const fmtDate = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split("-").reverse().join(".") : "–");
export const fmtDateTime = (ts?: string | number | null) => (ts ? new Date(ts).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–");
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
export const num = (v: unknown) => { let s = String(v ?? "").trim().replace(/\s|€/g, ""); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); const n = parseFloat(s); return isFinite(n) ? n : 0; };
export const fmtNum = (n: unknown, d = 2) => (+(n as number) || 0).toLocaleString("de-DE", { minimumFractionDigits: d === 2 ? 2 : 0, maximumFractionDigits: d === 2 ? 2 : 3, useGrouping: false });
export const HISTORY_START = "2024-01-01";
export const STEP_M: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };
export const addMonthsISO = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return t.toISOString().slice(0, 10); };
export const addDaysISO = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export function firstOfNextMonth() { const [y, m] = todayISO().split("-").map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); }
export const INTERVALS: Record<string, string> = { monthly: "monatlich", quarterly: "vierteljährlich", yearly: "jährlich" };
export const BILLING: Record<string, string> = { once: "Einmalig (pauschal)", monthly: "Abo · monatlich", quarterly: "Abo · vierteljährlich", yearly: "Abo · jährlich" };
export const BILL_SUFFIX: Record<string, string> = { once: "", monthly: " / Monat", quarterly: " / Quartal", yearly: " / Jahr" };
export const UNITS = ["Std.", "Stk.", "pauschal", "Monat", "Tag", "Seite"];
export const billingOf = (it?: Posten | null) => (it && it.billing && BILLING[it.billing] ? it.billing : "once");
export const isOn = (v: unknown) => v === true || v === "true";
export const isDiscLine = (it?: Posten | null) => it?.type === "discount";
export const positionsOf = (items: Posten[] = []) => items.filter((it) => !isDiscLine(it));
export const lineNet = (it: Posten) => r2((+(it.quantity ?? 0) || 0) * (+(it.price ?? 0) || 0) * (1 - Math.min(Math.max(+(it.discount ?? 0) || 0, 0), 100) / 100));

export type Summen = { net: number; vat: number; gross: number; vatLines: { rate: number; base: number; amount: number }[]; subtotal: number;
  discounts: { label: string; mode: string; value: number; amount: number }[]; discountTotal: number };
export function totals(items: Posten[] = [], smallBusiness = false): Summen {
  let sub = 0; const byRate: Record<string, number> = {};
  for (const it of positionsOf(items)) { const line = lineNet(it); sub += line; const rate = smallBusiness ? 0 : (+(it.vat ?? 0) || 0); byRate[rate] = (byRate[rate] || 0) + line; }
  sub = r2(sub);
  const abs = Math.abs(sub), sign = sub < 0 ? -1 : 1; let left = abs;
  const discounts = items.filter(isDiscLine).map((d) => {
    const mode = d.mode === "amount" ? "amount" : "percent", value = Math.max(+(d.value ?? 0) || 0, 0);
    const a = r2(Math.min(mode === "amount" ? value : abs * Math.min(value, 100) / 100, left)); left = r2(left - a);
    return { label: String(d.description || "").trim() || "Rabatt", mode, value, amount: r2(a * sign) };
  });
  const discountTotal = r2(discounts.reduce((s, d) => s + d.amount, 0));
  const net = r2(sub - discountTotal), factor = sub ? net / sub : 1;
  const vatLines = Object.entries(byRate).map(([rate, base]) => ({ rate: +rate, base: r2(base * factor), amount: r2(base * factor * +rate / 100) })).filter((v) => v.rate > 0).sort((a, b) => b.rate - a.rate);
  const vat = r2(vatLines.reduce((s, v) => s + v.amount, 0));
  return { net, vat, gross: r2(net + vat), vatLines, subtotal: sub, discounts, discountTotal };
}
export const discText = (d: { label: string; mode: string; value: number }) => `${d.label}${d.mode === "percent" ? ` (${fmtNum(d.value, 3)} %)` : ""}`;
export function splitByBilling(items: Posten[] = []) {
  const g: Record<string, Posten[]> = {}; for (const it of items) (g[billingOf(it)] ||= []).push(it);
  return ["once", "monthly", "quarterly", "yearly"].filter((k) => g[k]?.some((it) => it?.type !== "discount")).map((k) => ({ billing: k, items: g[k] }));
}

export const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const MONTHS_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const pct = (now: number, before: number) => (before > 0 ? (now - before) / before * 100 : null);
export const fmtPct = (p: number | null) => (p === null ? "" : `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`);
export const WU_PLACEHOLDERS = "{anrede} {kunde} {kunde_seit} {preis} {gueltig} {nummer} {website} {firma}";
export const TYPE_LABEL: Record<string, string> = { invoice: "Rechnung", correction: "Korrektur", cancel: "Storno", reminder: "Zahlungserinnerung", quote: "Angebot" };

export function greeting(name: string) {
  const h = +new Intl.DateTimeFormat("de-DE", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" }).format(new Date());
  const g = h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
  const first = String(name || "").trim().split(/\s+/)[0];
  return first ? `${g}, ${first}` : g;
}
export const sinceText = (d: string | null) => {
  if (!d) return "noch keine Rechnungen";
  const t = todayISO(), months = (+t.slice(0, 4) - +d.slice(0, 4)) * 12 + (+t.slice(5, 7) - +d.slice(5, 7));
  const dur = months >= 12 ? `${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? "Jahr" : "Jahre"}${months % 12 >= 6 ? " +" : ""}` : `${Math.max(months, 0)} ${months === 1 ? "Monat" : "Monate"}`;
  return `Kunde seit ${MONTHS_LONG[+d.slice(5, 7) - 1]} ${d.slice(0, 4)} · ${dur}`;
};
export const sparkPunkte = (vals: number[]) => {
  if (vals.length < 2) return "";
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
  return vals.map((v, i) => `${(i / (vals.length - 1) * 100).toFixed(1)},${(26 - (v - min) / (max - min || 1) * 24).toFixed(1)}`).join(" ");
};
