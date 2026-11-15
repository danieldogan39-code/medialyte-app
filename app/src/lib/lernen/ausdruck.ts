// Sichere Rechenausdrücke für Lerninhalte (Graphen, Rechenaufgaben) – ohne eval.
// Unterstützt: Zahlen, Variablen, + - * / ^, Klammern, Vergleiche (< > <= >= == !=), && ||, Bedingung ? a : b,
// Funktionen sqrt, ln, log (Basis 10), exp, abs, round(x, n), floor, ceil, min, max, pow; Konstanten pi, e.

type Knoten =
  | { k: "z"; v: number } | { k: "v"; n: string } | { k: "u"; o: string; a: Knoten }
  | { k: "b"; o: string; a: Knoten; b: Knoten } | { k: "f"; n: string; args: Knoten[] } | { k: "t"; c: Knoten; a: Knoten; b: Knoten };

const FUNK: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
  min: Math.min, max: Math.max, pow: Math.pow, sin: Math.sin, cos: Math.cos,
  round: (x, n = 0) => { const f = 10 ** n; return Math.round((x + Math.sign(x) * 1e-12) * f) / f; },
};
const KONST: Record<string, number> = { pi: Math.PI, e: Math.E };

function lexer(s: string) {
  const t: string[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const m = s.slice(i).match(/^(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_][A-Za-z_0-9]*|<=|>=|==|!=|&&|\|\||[-+*/^(),<>?:!])/);
    if (!m) throw new Error(`Unerwartetes Zeichen „${c}“ in „${s}“`);
    t.push(m[1]); i += m[1].length;
  }
  return t;
}

export function parse(s: string): Knoten {
  const t = lexer(s); let p = 0;
  const peek = () => t[p], next = () => t[p++];
  const expect = (x: string) => { if (next() !== x) throw new Error(`„${x}“ erwartet in „${s}“`); };
  const ternaer = (): Knoten => { const c = oder(); if (peek() === "?") { next(); const a = ternaer(); expect(":"); const b = ternaer(); return { k: "t", c, a, b }; } return c; };
  const oder = (): Knoten => { let a = und(); while (peek() === "||") { next(); a = { k: "b", o: "||", a, b: und() }; } return a; };
  const und = (): Knoten => { let a = vergl(); while (peek() === "&&") { next(); a = { k: "b", o: "&&", a, b: vergl() }; } return a; };
  const vergl = (): Knoten => { let a = summe(); while (["<", ">", "<=", ">=", "==", "!="].includes(peek())) { const o = next(); a = { k: "b", o, a, b: summe() }; } return a; };
  const summe = (): Knoten => { let a = produkt(); while (peek() === "+" || peek() === "-") { const o = next(); a = { k: "b", o, a, b: produkt() }; } return a; };
  const produkt = (): Knoten => { let a = unaer(); while (peek() === "*" || peek() === "/") { const o = next(); a = { k: "b", o, a, b: unaer() }; } return a; };
  const unaer = (): Knoten => { if (peek() === "-" || peek() === "+" || peek() === "!") { const o = next(); return { k: "u", o, a: unaer() }; } return potenz(); };
  const potenz = (): Knoten => { const a = atom(); if (peek() === "^") { next(); return { k: "b", o: "^", a, b: unaer() }; } return a; };   // rechtsassoziativ, -x^2 = -(x^2)
  const atom = (): Knoten => {
    const x = next();
    if (x === undefined) throw new Error(`Ausdruck endet zu früh: „${s}“`);
    if (x === "(") { const a = ternaer(); expect(")"); return a; }
    if (/^[\d.]/.test(x)) return { k: "z", v: Number(x) };
    if (/^[A-Za-z_]/.test(x)) {
      if (peek() === "(") {
        if (!FUNK[x]) throw new Error(`Unbekannte Funktion ${x} in „${s}“`);
        next(); const args: Knoten[] = [];
        if (peek() !== ")") { args.push(ternaer()); while (peek() === ",") { next(); args.push(ternaer()); } }
        expect(")"); return { k: "f", n: x, args };
      }
      return { k: "v", n: x };
    }
    throw new Error(`Unerwartet „${x}“ in „${s}“`);
  };
  const r = ternaer();
  if (p < t.length) throw new Error(`Rest „${t.slice(p).join(" ")}“ in „${s}“`);
  return r;
}

export type Werte = Record<string, number>;
export function rechne(n: Knoten, w: Werte): number {
  switch (n.k) {
    case "z": return n.v;
    case "v": { if (n.n in w) return w[n.n]; if (n.n in KONST) return KONST[n.n]; throw new Error(`Unbekannte Variable ${n.n}`); }
    case "u": { const a = rechne(n.a, w); return n.o === "-" ? -a : n.o === "!" ? (a ? 0 : 1) : a; }
    case "t": return rechne(n.c, w) ? rechne(n.a, w) : rechne(n.b, w);
    case "f": return FUNK[n.n](...n.args.map((a) => rechne(a, w)));
    case "b": {
      if (n.o === "&&") return rechne(n.a, w) && rechne(n.b, w) ? 1 : 0;
      if (n.o === "||") return rechne(n.a, w) || rechne(n.b, w) ? 1 : 0;
      const a = rechne(n.a, w), b = rechne(n.b, w);
      switch (n.o) {
        case "+": return a + b; case "-": return a - b; case "*": return a * b; case "/": return a / b; case "^": return a ** b;
        case "<": return +(a < b); case ">": return +(a > b); case "<=": return +(a <= b); case ">=": return +(a >= b);
        case "==": return +(Math.abs(a - b) < 1e-9); case "!=": return +(Math.abs(a - b) >= 1e-9);
      }
    }
  }
  throw new Error("Unbekannter Knoten");
}

const cache = new Map<string, Knoten>();
/** Ausdruck einmal übersetzen, dann schnell auswerten */
export function funktion(s: string, variable = "x"): (x: number) => number {
  let n = cache.get(s); if (!n) { n = parse(s); cache.set(s, n); }
  const k = n;
  return (x: number) => { try { return rechne(k, { [variable]: x }); } catch { return NaN; } };
}
export function wert(s: string, w: Werte): number { let n = cache.get(s); if (!n) { n = parse(s); cache.set(s, n); } return rechne(n, w); }

/** Zahl deutsch: 1.234,5 – in Formeln mit {,}, damit KaTeX kein Leerzeichen setzt */
export function zahlText(n: number, stellen = 4, formel = false, fest = false) {
  const gerundet = Math.round(n * 10 ** stellen) / 10 ** stellen;
  const t = n.toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: fest && !Number.isInteger(gerundet) ? stellen : 0, useGrouping: Math.abs(n) >= 1000 });
  return formel ? t.replace(/\./g, "{.}").replace(/,/g, "{,}") : t;
}
/** Platzhalter [[a]], [[a:2]] (2 Nachkommastellen), [[a:+]] / [[a:+2]] (mit Vorzeichen „+ 3“ / „- 3“) oder [[=Ausdruck:2]] füllen; in $…$ formelgerecht */
export function fuellen(vorlage: string, w: Werte): string {
  let inFormel = false, out = "";
  for (let i = 0; i < vorlage.length; i++) {
    const c = vorlage[i];
    if (c === "$") { inFormel = !inFormel; out += c; continue; }
    if (c === "[" && vorlage[i + 1] === "[") {
      const m = vorlage.slice(i).match(/^\[\[(=[^\]:]+|[A-Za-z_][A-Za-z_0-9]*)(?::(\+)?(\d)?)?\]\]/);
      if (m) {
        const v = m[1].startsWith("=") ? wert(m[1].slice(1), w) : w[m[1]];
        if (v === undefined || !Number.isFinite(v)) throw new Error(`Platzhalter [[${m[1]}]] ohne gültigen Wert`);
        const st = m[3] ? Number(m[3]) : 4;
        const fest = !!m[3];
        out += m[2] ? (v < 0 ? "- " : "+ ") + zahlText(Math.abs(v), st, inFormel, fest) : zahlText(v, st, inFormel, fest);
        i += m[0].length - 1; continue;
      }
    }
    out += c;
  }
  return out;
}
