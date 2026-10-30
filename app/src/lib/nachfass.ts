// Nachfass-Regeln (gleich wie agent/nachfass.py, damit App und Morgen-Erinnerung übereinstimmen)
export const NF_STATUS: Record<string, string> = {
  offen: "Offen", nicht_erreicht: "Nicht erreicht", rueckruf: "Rückruf", interesse: "Interesse", kunde: "Kunde", kein_interesse: "Kein Interesse",
};
export const NF_ERLEDIGT = new Set(["kunde", "kein_interesse"]);
export const GERAET: Record<string, string> = { handy: "Handy", tablet: "Tablet", laptop: "Rechner", m: "Handy", d: "Rechner", t: "Tablet" };
export const TAGE_BIS_ANRUF = 6;

const berlin = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
export const tagHeute = () => berlin.format(new Date());
export const tagVon = (t: string | number | Date) => berlin.format(new Date(t));
export function tagPlus(iso: string, n: number) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function werktag(iso: string) { const d = new Date(iso + "T12:00:00Z"); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
export function tageZwischen(a: string, b: string) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
const tagFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const langFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" });
const datumFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" });
export const zeitFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
export function tagText(iso?: string | null) {
  if (!iso) return "";
  const d = tageZwischen(tagHeute(), iso);
  return d === 0 ? "heute" : d === 1 ? "morgen" : d === -1 ? "gestern" : tagFmt.format(new Date(iso + "T12:00:00Z"));
}
export const datumLang = (iso: string) => datumFmt.format(new Date(iso + "T12:00:00Z"));

export type Aufruf = { z: string; g?: string; s?: string };
export type Anfrage = { slug: string; zeit: string; telefon?: string; kontakt?: string; name?: string; wann?: string; nachricht?: string };
export type Eintrag = { slug: string; status: string; wieder: string | null; notiz: string; verlauf: { zeit: string; status: string; wieder?: string | null }[]; zeit: string | null };
export type Fall = {
  slug: string; name: string; branche?: string; ort?: string; telefon?: string | null; url?: string; kurz?: string | null; betriebId?: string; verschickt?: string | null;
};
export type Einschaetzung = {
  g: "heiss" | "heute" | "spaeter" | "erledigt"; st: string; faellig: string | null; auf: Aufruf[]; e: Partial<Eintrag>; gesendet: string;
  kontakt: number; anf: Anfrage[]; anfNeu: Anfrage | null; brief: boolean;
};

export function einschaetzen(x: Fall, e: Partial<Eintrag> | undefined, aufrufe: Aufruf[], anf: Anfrage[], tage = TAGE_BIS_ANRUF): Einschaetzung {
  e = e ?? {};
  const st = e.status && NF_STATUS[e.status] ? e.status : "offen", heute = tagHeute();
  const gesendet = x.verschickt ? String(x.verschickt).slice(0, 10) : anf.length ? tagVon(anf[anf.length - 1].zeit) : heute;
  // Aufrufe zählen erst ab dem Tag nach dem Versand (vorher warst es vermutlich du)
  const ab = Date.parse(tagPlus(gesendet, 1) + "T00:00:00Z");
  const auf = x.verschickt ? aufrufe.filter((a) => Date.parse(a.z) >= ab) : [];
  let kontakt = 0;
  for (const v of e.verlauf ?? []) if (v.status !== "offen") kontakt = Math.max(kontakt, Date.parse(v.zeit) || 0);
  const anfNeu = anf.length && Date.parse(anf[0].zeit) > kontakt ? anf[0] : null;
  const letzt = Math.max(auf.length ? Date.parse(auf[0].z) : 0, anfNeu ? Date.parse(anfNeu.zeit) : 0);
  let g: Einschaetzung["g"], faellig: string | null = null;
  if (anfNeu) { g = "heiss"; faellig = heute; }
  else if (NF_ERLEDIGT.has(st)) g = "erledigt";
  else if (letzt && letzt > kontakt) { g = "heiss"; faellig = heute; }
  else if (st === "offen") { faellig = werktag(tagPlus(gesendet, tage)); g = heute >= faellig ? "heute" : "spaeter"; }
  else if (e.wieder) { faellig = e.wieder; g = heute >= faellig ? "heute" : "spaeter"; }
  else if (st === "interesse") g = "spaeter";
  else { g = "heute"; faellig = heute; }
  return { g, st, faellig, auf, e, gesendet, kontakt, anf, anfNeu, brief: !!x.verschickt };
}

export function grund(n: Einschaetzung): string {
  const heute = tagHeute(), w = n.e.wieder ?? null;
  if (n.anfNeu) {
    const r = n.anfNeu, WANN: Record<string, string> = { vormittags: "vormittags", nachmittags: "nachmittags", abends: "abends" };
    return "Möchte zurückgerufen werden" + (r.kontakt ? " · " + r.kontakt : "") + (r.wann && WANN[r.wann] ? " · am liebsten " + WANN[r.wann] : "") + " · " + zeitFmt.format(new Date(r.zeit));
  }
  if (n.g === "heiss") {
    const a = n.auf[0], gleich = n.auf.filter((b) => (b.s || "demo") === (a.s || "demo"));
    return (a.s === "angebot" ? "Hat sich das Angebot angesehen · " : "Hat die Demo geöffnet · ") + zeitFmt.format(new Date(a.z)) +
      (a.g && GERAET[a.g] ? " · " + GERAET[a.g] : "") + (gleich.length > 1 ? ` · ${gleich.length}×` : "");
  }
  if (n.g === "erledigt") {
    const seit = n.e.zeit ? " seit " + datumLang(tagVon(n.e.zeit)) : "";
    return n.st === "kunde" ? `Kunde${seit}. Die Demo bleibt online.` : `Kein Interesse${n.e.zeit ? " (" + datumLang(tagVon(n.e.zeit)) + ")" : ""}.`;
  }
  if (!n.brief) return n.st === "offen" ? "Hatte um Rückruf gebeten. Bitte den Stand eintragen." : NF_STATUS[n.st] + (w ? " · " + (heute >= w ? "heute dran" : tagText(w)) : "");
  const da = tagPlus(n.gesendet, 1);
  if (n.st === "offen") {
    const seitDa = tageZwischen(da, heute);
    if (n.g === "heute") return `Brief ist seit ${seitDa === 1 ? "einem Tag" : seitDa + " Tagen"} da, noch keine Reaktion. Heute anrufen.`;
    return (heute < da ? "Brief ist unterwegs" : "Brief ist da") + " · anrufen ab " + tagText(n.faellig);
  }
  if (n.st === "nicht_erreicht") return n.g === "heute" ? `Nicht erreicht${n.kontakt ? " (" + tagText(tagVon(n.kontakt)) + ")" : ""} · heute nochmal versuchen` : "Nicht erreicht · nochmal " + tagText(w);
  if (n.st === "rueckruf") return n.g === "heute" ? (w === heute ? "Rückruf für heute vereinbart" : "Rückruf war " + tagText(w) + " dran") : "Rückruf " + tagText(w);
  if (n.st === "interesse") return w ? (n.g === "heute" ? "Interesse · heute nachhaken" : "Interesse · nachhaken " + tagText(w)) : "Interesse · im Gespräch";
  return "";
}

export function skript(x: Fall, n: Einschaetzung, ich = "Daniel", firma = "Medialyte"): { text: string[]; tipp: string } {
  if (n.anfNeu) return {
    text: [`„Guten Tag, hier ist ${ich} von ${firma}. Sie hatten auf der Seite zu Ihrem Website-Entwurf um einen Rückruf gebeten. Schön, dass Sie sich gemeldet haben.“`,
      "„Was hat Ihnen am Entwurf gefallen, und was soll anders sein?“"].concat(n.anfNeu.nachricht ? [`Die Nachricht dazu: „${n.anfNeu.nachricht}“`] : []),
    tipp: "Nach dem Gespräch oben den Stand antippen.",
  };
  const d = tageZwischen(n.gesendet, tagHeute()), datum = new Date(n.gesendet + "T12:00:00Z");
  const wann = d <= 6 ? "am " + langFmt.format(datum) : "am " + datumFmt.format(datum);
  return {
    text: [`„Guten Tag, hier ist ${ich} von ${firma}. Ich habe Ihnen ${wann} einen Brief geschickt, mit einem fertigen Entwurf für eine neue Website von ${x.name}.“`,
      n.auf.length ? "„Sie haben ihn sich schon angesehen. Wie gefällt er Ihnen?“" : "„Ist der Brief bei Ihnen angekommen? Ich schicke Ihnen den Link auch gern per WhatsApp, dann können Sie gleich reinschauen.“",
      "„Was müsste noch rein, damit die Seite für Sie passt?“"],
    tipp: `Nach dem Gespräch oben den Stand antippen. Bei „Nicht erreicht“ steht ${x.name} am nächsten Werktag wieder oben.`,
  };
}

export function verlauf(n: Einschaetzung): { zeit: string; tag?: string; text: string }[] {
  const ev: { t: number; zeit: string; tag?: string; text: string }[] = n.brief ? [{ t: Date.parse(n.gesendet + "T08:00:00Z"), zeit: "", tag: n.gesendet, text: "Brief verschickt" }] : [];
  for (const a of [...n.auf].reverse()) ev.push({ t: Date.parse(a.z), zeit: a.z, text: (a.s === "angebot" ? "Angebot angesehen" : "Demo geöffnet") + (a.g && GERAET[a.g] ? " · " + GERAET[a.g] : "") });
  for (const r of n.anf) ev.push({ t: Date.parse(r.zeit), zeit: r.zeit, text: "Rückruf gewünscht · " + (r.telefon ?? "") + (r.kontakt ? ` (${r.kontakt})` : "") });
  for (const v of n.e.verlauf ?? []) ev.push({ t: Date.parse(v.zeit) || 0, zeit: v.zeit, text: (NF_STATUS[v.status] ?? v.status) + (v.wieder && !NF_ERLEDIGT.has(v.status) && v.status !== "offen" ? " · wieder " + datumLang(v.wieder) : "") });
  ev.sort((a, b) => a.t - b.t);
  return ev.slice(-8);
}

/** Wiedervorlage, die ein Status automatisch setzt (wie im Cockpit) */
export function wiederFuer(status: string, bisher: string | null): string | null {
  const morgen = werktag(tagPlus(tagHeute(), 1));
  if (status === "nicht_erreicht") return morgen;
  if (status === "rueckruf") return bisher && bisher >= tagHeute() ? bisher : morgen;
  if (status === "interesse") { let d = tagHeute(); for (let i = 0; i < 3; i++) d = werktag(tagPlus(d, 1)); return d; }
  return null;
}

// ---------- Daten laden (Nachfass-Seite und Zähler im Menü)
import { sb } from "./supabase";
export type NfDaten = { faelle: Fall[]; eintraege: Record<string, Eintrag>; aufrufe: Record<string, Aufruf[]>; anfragen: Record<string, Anfrage[]> };
export async function nachfassDaten(): Promise<NfDaten> {
  const [br, nf, z] = await Promise.all([
    sb.from("briefe").select("demo_slug,verschickt,betriebe(id,name,branche,ort,telefon),demos(slug,url,kurz,geloescht)").not("verschickt", "is", null),
    sb.from("nachfass").select("*"),
    sb.functions.invoke("zaehler", { body: { aktion: "stand" } }),
  ]);
  const map: Record<string, Fall> = {};
  for (const b of (br.data ?? []) as any[]) {
    if (!b.demos || b.demos.geloescht) continue;
    map[b.demo_slug] = { slug: b.demo_slug, name: b.betriebe?.name ?? b.demo_slug, branche: b.betriebe?.branche, ort: b.betriebe?.ort, telefon: b.betriebe?.telefon,
      url: b.demos.url, kurz: b.demos.kurz, betriebId: b.betriebe?.id, verschickt: b.verschickt };
  }
  const aufrufe = z.data?.aufrufe ?? {}, anfragen = z.data?.anfragen ?? {};
  // Rückrufwünsche ohne Brief (z. B. Demo-Link direkt weitergegeben)
  const ohne = Object.keys(anfragen).filter((s) => !map[s]);
  if (ohne.length) {
    const { data } = await sb.from("demos").select("slug,url,kurz,geloescht,betriebe(id,name,branche,ort,telefon)").in("slug", ohne);
    for (const d of (data ?? []) as any[]) if (!d.geloescht) map[d.slug] = { slug: d.slug, name: d.betriebe?.name ?? d.slug, branche: d.betriebe?.branche, ort: d.betriebe?.ort,
      telefon: d.betriebe?.telefon, url: d.url, kurz: d.kurz, betriebId: d.betriebe?.id, verschickt: null };
  }
  return { faelle: Object.values(map), eintraege: Object.fromEntries(((nf.data ?? []) as Eintrag[]).map((e) => [e.slug, e])), aufrufe, anfragen };
}
/** Letzte Aktivität (Aufruf oder Rückrufwunsch) für die Sortierung der heißen Fälle */
export const letzteAktivitaet = (n: Einschaetzung) => Math.max(n.auf.length ? Date.parse(n.auf[0].z) : 0, n.anfNeu ? Date.parse(n.anfNeu.zeit) : 0);
