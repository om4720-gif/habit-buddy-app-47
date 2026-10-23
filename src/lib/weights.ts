// Reads a grading scheme pasted as text, e.g.
//   Quizzes - 20%
//   Midterm: 30
//   Final exam 50%
// Lines without a weight (headers, notes) are skipped. Nothing here uses AI.

export type WeightRow = { title: string; weight: number; isFinal: boolean };

const FINAL = /\bfinal\b|نهائ/i;
const EN_DIGITS = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export function parseWeightsText(text: string): { rows: WeightRow[]; skipped: string[] } {
  const rows: WeightRow[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = EN_DIGITS(raw).replace(/\s+/g, " ").trim();
    if (!line) continue;
    // title, separator, weight, optional %
    const m = /^(.*?)(\s*[:\-–—|]\s*|\s+)(\d+(?:\.\d+)?)\s*(%)?$/.exec(line);
    // A bare number like "Quiz 1" must not become a weight: require a % sign or an explicit separator.
    const explicit = !!m && (!!m[4] || /[:\-–—|]/.test(m[2] ?? ""));
    const title = m ? m[1]!.replace(/[\s:\-–—|]+$/, "").trim() : "";
    const weight = m ? Number(m[3]) : NaN;
    if (!m || !explicit || !title || /^total\b/i.test(title) || weight <= 0 || weight > 100) {
      skipped.push(raw.trim());
      continue;
    }
    rows.push({ title: title.slice(0, 200), weight, isFinal: FINAL.test(title) });
  }
  return { rows, skipped };
}

/** Checks a list against the rules the Grades section enforces. Returns an error message, or null. */
export function checkWeights(rows: WeightRow[], existing: { weight: number; is_final: boolean }[]): string | null {
  const total = existing.reduce((s, i) => s + i.weight, 0) + rows.reduce((s, r) => s + r.weight, 0);
  if (total > 100.0001) return `Weights would add up to ${Math.round(total * 10) / 10}%. The limit is 100%.`;
  if (rows.filter((r) => r.isFinal).length > 1 || (rows.some((r) => r.isFinal) && existing.some((i) => i.is_final)))
    return "A course can only have one final exam component.";
  return null;
}
