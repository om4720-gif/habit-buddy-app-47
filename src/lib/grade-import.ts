// Reads grades from a JSON or CSV file (for example, an export from another app).
// It finds the course, item name, score and maximum by common field names, and never fetches anything itself.

export type ImportedGrade = { course: string; title: string; score: number; max_score: number };
export type ImportResult = { grades: ImportedGrade[]; skipped: number; fields: Record<string, string> };

const FIELD_CANDIDATES = {
  course: ["course_name", "courseName", "course", "subject", "course_code", "courseCode", "code", "module"],
  title: ["title", "item", "element", "element_name", "elementName", "assessment", "name", "quiz", "assignment"],
  score: ["score", "grade", "mark", "marks", "earned", "obtained", "points"],
  max: ["max_score", "maxScore", "max", "out_of", "outOf", "total", "possible", "maximum"],
} as const;

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

function pick(row: Record<string, unknown>, names: readonly string[]): string | null {
  const keys = Object.keys(row);
  for (const name of names) {
    const hit = keys.find((k) => k.toLowerCase() === name.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return null;
}

/** "4.75 / 10" or "4.75" -> { score, max } (max is null when not written). */
export function parseScoreText(value: unknown): { score: number; max: number | null } | null {
  const text = clean(value).replace(/,/g, ".");
  const pair = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(text);
  if (pair) return { score: Number(pair[1]), max: Number(pair[2]) };
  const single = /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
  return Number.isFinite(single) ? { score: single, max: null } : null;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

type Leaf = { record: Record<string, unknown>; course: string | null };

const hasAny = (row: Record<string, unknown>, names: readonly string[]) => pick(row, names) !== null;

/**
 * Walks any JSON shape and collects the objects that look like graded items (a title and a score).
 * A course name is inherited from the nearest parent object that has one.
 */
function collectLeaves(value: unknown, inheritedCourse: string | null, out: Leaf[], depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) collectLeaves(v, inheritedCourse, out, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  const ownCourse = pick(obj, FIELD_CANDIDATES.course) ? clean(obj[pick(obj, FIELD_CANDIDATES.course)!]) : null;
  const course = ownCourse || inheritedCourse;
  if (hasAny(obj, FIELD_CANDIDATES.title) && hasAny(obj, FIELD_CANDIDATES.score)) {
    out.push({ record: obj, course });
    return;
  }
  for (const v of Object.values(obj)) collectLeaves(v, course, out, depth + 1);
}

export function parseGradeFile(text: string, fileName = ""): ImportResult {
  const trimmed = text.trim();
  let leaves: Leaf[];
  if (fileName.toLowerCase().endsWith(".csv") || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    leaves = parseCsv(trimmed).map((record) => ({ record, course: null }));
  } else {
    leaves = [];
    try {
      collectLeaves(JSON.parse(trimmed), null, leaves);
    } catch {
      leaves = [];
    }
  }
  if (leaves.length === 0) return { grades: [], skipped: 0, fields: {} };

  const sample = leaves[0]!.record;
  const fields = {
    course: pick(sample, FIELD_CANDIDATES.course) ?? "",
    title: pick(sample, FIELD_CANDIDATES.title) ?? "",
    score: pick(sample, FIELD_CANDIDATES.score) ?? "",
    max: pick(sample, FIELD_CANDIDATES.max) ?? "",
  };
  const grades: ImportedGrade[] = [];
  let skipped = 0;
  for (const { record: r, course: inherited } of leaves) {
    // Field names are read per record, so mixed shapes still work.
    const own = (names: readonly string[]) => {
      const key = pick(r, names);
      return key === null ? "" : clean(r[key]);
    };
    const course = own(FIELD_CANDIDATES.course) || inherited || "";
    const title = own(FIELD_CANDIDATES.title);
    const parsed = parseScoreText(own(FIELD_CANDIDATES.score));
    const max = Number(own(FIELD_CANDIDATES.max));
    const maxScore = Number.isFinite(max) && max > 0 ? max : parsed?.max ?? 100;
    if (!title || !parsed || parsed.score < 0 || parsed.score > maxScore) {
      skipped++;
      continue;
    }
    grades.push({ course, title: title.slice(0, 200), score: parsed.score, max_score: maxScore });
  }
  return { grades, skipped, fields };
}
