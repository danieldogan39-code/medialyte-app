// Leichtes Markdown für Lerninhalte: **fett**, *kursiv*, $Formel$, $$Block$$, Listen, Absätze.
import katex from "katex";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cache = new Map<string, string>();

export function tex(t: string, block = false): string {
  const k = (block ? "B" : "I") + t;
  let h = cache.get(k);
  if (!h) { h = katex.renderToString(t, { displayMode: block, throwOnError: false, strict: "ignore", output: "html" }); cache.set(k, h); }
  return h;
}

function inline(s: string): string {
  // Formeln zuerst herauslösen, damit * und _ darin unberührt bleiben
  const teile: string[] = [];
  s = s.replace(/\$\$([^$]+)\$\$|\$([^$\n]+)\$/g, (_, b, i) => { teile.push(b ? tex(b, true) : tex(i)); return `\u0000${teile.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<i>$2</i>")
    .replace(/==(.+?)==/g, "<mark>$1</mark>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => teile[Number(n)]);
}

/** Markdown → HTML (nur eigene Inhalte, kein fremder Text) */
export function md(text: string): string {
  const zeilen = text.trim().split("\n"), out: string[] = [];
  let liste: "ul" | "ol" | null = null, absatz: string[] = [];
  const absatzZu = () => { if (absatz.length) { out.push(`<p>${inline(absatz.join(" "))}</p>`); absatz = []; } };
  const listeZu = () => { if (liste) { out.push(`</${liste}>`); liste = null; } };
  for (const roh of zeilen) {
    const z = roh.trimEnd();
    const ul = z.match(/^\s*[-•]\s+(.*)$/), ol = z.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (/^\$\$.+\$\$$/.test(z.trim())) { absatzZu(); listeZu(); out.push(`<div class="fb">${tex(z.trim().slice(2, -2), true)}</div>`); }
    else if (ul || ol) {
      absatzZu();
      const art = ul ? "ul" : "ol";
      if (liste !== art) { listeZu(); out.push(ol && ol[1] !== "1" ? `<ol start="${ol[1]}">` : `<${art}>`); liste = art; }
      out.push(`<li>${inline(ul ? ul[1] : ol![2])}</li>`);
    } else if (!z.trim()) { absatzZu(); listeZu(); }
    else { listeZu(); absatz.push(z.trim()); }
  }
  absatzZu(); listeZu();
  return out.join("");
}
/** Einzeiler ohne Absatz */
export const mdZeile = (t: string) => inline(t);
