// Notenschätzung aus dem Anteil der Punkte (übliche Hochschul-Skala, 50 % = 4,0). Nur eine Orientierung.
export function note(anteil: number): string {
  const p = anteil * 100;
  const s: [number, string][] = [[95, "1,0"], [90, "1,3"], [85, "1,7"], [80, "2,0"], [75, "2,3"], [70, "2,7"], [65, "3,0"], [60, "3,3"], [55, "3,7"], [50, "4,0"]];
  return s.find(([g]) => p >= g)?.[1] ?? "5,0";
}
