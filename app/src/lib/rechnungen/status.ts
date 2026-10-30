// Status von Rechnungen und Angeboten (wie in der Rechnungs-App)
import { R } from "./daten.svelte";
import { todayISO } from "./kern";

export function invStatus(inv: any): { key: string; label: string; ton: string } {
  if (inv.kind === "storno") return { key: "cancelled", label: "Storno", ton: "grau" };
  if (inv.status === "draft") return { key: "draft", label: "Entwurf", ton: "blau" };
  if (inv.status === "cancelled") return { key: "cancelled", label: "Storniert", ton: "grau" };
  if (inv.status === "paid") return { key: "paid", label: "Bezahlt", ton: "gruen" };
  if (inv.due_date && inv.due_date < todayISO()) return { key: "overdue", label: inv.reminders_sent ? `Überfällig · ${inv.reminders_sent}× erinnert` : "Überfällig", ton: "rot" };
  return { key: "open", label: "Offen", ton: "gelb" };
}
export function quoteStatus(q: any): { key: string; label: string; ton: string } {
  if (q.status === "draft") return { key: "draft", label: "Entwurf", ton: "blau" };
  if (q.status === "accepted") return { key: "accepted", label: (q.invoice_id || R.recurring.some((r) => r.quote_id === q.id)) ? "Angenommen · umgesetzt" : "Angenommen", ton: "gruen" };
  if (q.status === "declined") return { key: "declined", label: "Abgelehnt", ton: "grau" };
  if (q.valid_until && q.valid_until < todayISO()) return { key: "expired", label: "Abgelaufen", ton: "grau" };
  return { key: "open", label: "Offen", ton: "gelb" };
}
export const isWU = (q: any) => q?.category === "website_update";
