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

/** Rough "sounds like" key for English words, so speech-to-text slips match: still ~ steel ~ stall. */
const phon = (t: string) => t.replace(/[aeiouy]+/g, "a").replace(/(.)\1+/g, "$1");
const isLatinWord = (t: string) => t.length >= 4 && /^[a-z]+$/.test(t);

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
  const same = (a: string, b: string) => a === b || (isLatinWord(a) && isLatinWord(b) && phon(a) === phon(b));
  const shared = qt.filter((t) => nt.some((u) => same(t, u))).length;
  // One distinctive word that sounds like one word of the name (still ~ Steel Design).
  if (qt.length === 1 && shared === 1) return 58;
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

// ---- Quick commands: "I finished lecture 3 of structural analysis" without any AI ----

const DONE_WORDS = new Set([
  "finished", "finish", "done", "completed", "complete", "studied", "attended", "watched", "reviewed",
  "خلصت", "خلصنا", "خلصتها", "خلصتهم", "خلص", "ذاكرت", "ذاكرتها", "حضرت", "انهيت", "كملت",
]);
const NEG_WORDS = new Set([
  "not", "haven", "hasn", "didn", "dont", "don", "never", "cant", "cannot", "unfinished", "undo", "unmark",
  "لسه", "مش", "لم", "مخلصتش", "ما", "لا", "الغي", "شيل",
]);
const QUESTION_WORDS = new Set(["did", "do", "does", "have", "what", "which", "how", "when", "هل", "ايه", "امتي", "امتى", "كام"]);
const FILLER = new Set([
  "i", "ve", "m", "have", "has", "just", "the", "a", "an", "of", "in", "for", "from", "my", "course", "class",
  "already", "please", "and", "also", "number", "no", "all", "mero", "ميرو",
  "في", "من", "بتاع", "بتاعت", "مادة", "مادّه", "ماده", "كورس", "ال", "و", "انا", "رقم", "برضه", "كمان", "يا",
]);
const KIND_WORDS: Record<string, "lecture" | "tutorial"> = {
  lecture: "lecture", lectures: "lecture", lec: "lecture", lect: "lecture",
  "محاضره": "lecture", "محاضرات": "lecture", "ليكتشر": "lecture",
  tutorial: "tutorial", tutorials: "tutorial", tut: "tutorial", section: "tutorial", sections: "tutorial",
  "تيوتوريال": "tutorial", "تيوتوريل": "tutorial", "سكشن": "tutorial", "تمارين": "tutorial",
};
const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", "واحد": "1", "اتنين": "2", "اثنين": "2", "تلاته": "3", "ثلاثه": "3",
  "اربعه": "4", "اربع": "4", "خمسه": "5", "سته": "6", "سبعه": "7", "تمانيه": "8", "ثمانيه": "8", "تسعه": "9", "عشره": "10",
};

export type QuickCommand = {
  items: { kind: "lecture" | "tutorial"; number: number }[];
  courseQuery: string;
};

/**
 * Understands the plain "I finished lecture 3 [of course]" family, in English or Arabic.
 * Returns null for anything else (questions, negations, other requests) so the AI can handle it.
 */
export function parseQuickCommand(text: string): QuickCommand | null {
  if (/[?؟]/.test(text)) return null;
  const tokens = norm(text)
    .split(" ")
    .filter(Boolean)
    .map((t) => NUMBER_WORDS[t] ?? t);
  if (tokens.some((t) => NEG_WORDS.has(t) || QUESTION_WORDS.has(t))) return null;
  if (!tokens.some((t) => DONE_WORDS.has(t))) return null;

  const items: QuickCommand["items"] = [];
  const used = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    const kind = KIND_WORDS[tokens[i]!];
    if (!kind) continue;
    used.add(i);
    // find the first number within the next few tokens (skipping repeated kind words and fillers)
    let j = i + 1;
    while (j < tokens.length && j <= i + 3 && !/^\d+$/.test(tokens[j]!) && (KIND_WORDS[tokens[j]!] || FILLER.has(tokens[j]!))) {
      used.add(j);
      j++;
    }
    while (j < tokens.length && /^\d+$/.test(tokens[j]!)) {
      items.push({ kind, number: Number(tokens[j]) });
      used.add(j);
      j++;
      while (j < tokens.length && (tokens[j] === "and" || tokens[j] === "و")) {
        used.add(j);
        j++;
      }
    }
    i = j - 1;
  }
  if (items.length === 0) return null;

  const courseQuery = tokens
    .filter((t, i) => !used.has(i) && !DONE_WORDS.has(t) && !FILLER.has(t) && !KIND_WORDS[t] && !/^\d+$/.test(t))
    .join(" ");
  return { items, courseQuery };
}
