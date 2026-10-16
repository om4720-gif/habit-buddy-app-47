// Forgiving name matching, so Mero can act on "physics lecture 3" however it was said or typed.

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function norm(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // Arabic diacritics and tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function score(query: string, name: string): number {
  const q = norm(query);
  const n = norm(name);
  if (!q || !n) return 0;
  if (q === n) return 100;
  const qc = q.replace(/ /g, "");
  const nc = n.replace(/ /g, "");
  if (qc === nc) return 95; // "civ 301" vs "CIV301"
  if (n.length >= 2 && q.length >= 2 && (n.includes(q) || q.includes(n))) return 60 + Math.min(q.length, n.length);
  const qt = q.split(" ").filter((t) => t.length >= 2);
  const nt = n.split(" ").filter((t) => t.length >= 2);
  if (qt.length === 0 || nt.length === 0) return 0;
  const shared = qt.filter((t) => nt.includes(t)).length;
  return Math.round((shared / Math.max(nt.length, qt.length)) * 55);
}

export type Match<T> = { item: T } | { ambiguous: T[] } | { none: true };

/** Best match for `query` among items, each of which may have several names (name, code...). */
export function bestMatch<T>(query: string, items: T[], names: (t: T) => string[]): Match<T> {
  const scored = items
    .map((item) => ({ item, s: Math.max(0, ...names(item).filter(Boolean).map((n) => score(query, n))) }))
    .filter((x) => x.s >= 40)
    .sort((a, b) => b.s - a.s);
  const top = scored[0];
  if (!top) return { none: true };
  const ties = scored.filter((x) => x.s >= top.s - 5);
  if (ties.length > 1 && top.s < 100) return { ambiguous: ties.map((t) => t.item) };
  return { item: top.item };
}

/** "Lecture 3" -> 3; titles without a number -> null. */
export function titleNumber(title: string): number | null {
  const m = norm(title).match(/\d+/);
  return m ? Number(m[0]) : null;
}
