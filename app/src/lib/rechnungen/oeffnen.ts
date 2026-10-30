// Belege öffnen: Entwürfe im Editor, ausgestellte in der Detailansicht
import { B } from "./blatt.svelte";
import RechnungEditor from "../../components/rechnungen/RechnungEditor.svelte";
import RechnungDetail from "../../components/rechnungen/RechnungDetail.svelte";
import AngebotEditor from "../../components/rechnungen/AngebotEditor.svelte";
import AngebotDetail from "../../components/rechnungen/AngebotDetail.svelte";
import KundeEditor from "../../components/rechnungen/KundeEditor.svelte";
import AboEditor from "../../components/rechnungen/AboEditor.svelte";

export const oeffneRechnung = (inv: any) => (inv?.status === "draft" ? B.auf(RechnungEditor, { inv }) : B.auf(RechnungDetail, { inv }));
export const neueRechnung = (kunde = "") => B.auf(RechnungEditor, { inv: null, kunde });
export const oeffneAngebot = (q: any) => (q?.status === "draft" ? B.auf(AngebotEditor, { q }) : B.auf(AngebotDetail, { q }));
export const neuesAngebot = (kunde = "") => B.auf(AngebotEditor, { q: null, kunde });
export const oeffneKunde = (c: any, gespeichert?: (k: any) => void, extra: { vorlage?: Record<string, string>; kundeSlug?: string | null } = {}) => B.auf(KundeEditor, { c, gespeichert, ...extra });
export const oeffneAbo = (r: any, kunde = "") => B.auf(AboEditor, { r, kunde });
