import { bestMatch } from "@/lib/mero-match";

// Exams are stored as ordinary deadlines (the database only allows 'assignment' or 'quiz'), marked by
// a 🎓 at the start of the title: "🎓 Final exam · 09:00 · Hall B". Nothing in the database changes.

export const EXAM_PREFIX = "🎓 ";
export const isExam = (d: { title: string }) => d.title.startsWith(EXAM_PREFIX);

const SEP = " · ";
const part = (s: string, max: number) => s.replace(/\s*·\s*/g, " ").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export type ExamParts = { name: string; time: string; place: string };

export function makeExamTitle({ name, time, place }: ExamParts): string {
  return EXAM_PREFIX + [part(name, 60) || "Exam", part(time, 8), part(place, 60)].filter(Boolean).join(SEP);
}

export function parseExamTitle(title: string): ExamParts {
  const parts = title.replace(EXAM_PREFIX, "").split(SEP).map((p) => p.trim()).filter(Boolean);
  const name = parts[0] ?? "Exam";
  const time = parts.find((p, i) => i > 0 && /^\d{1,2}:\d{2}$/.test(p)) ?? "";
  const place = parts.filter((p, i) => i > 0 && p !== time).join(SEP);
  return { name, time, place };
}

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const todayIso = (now = new Date()) => iso(now.getFullYear(), now.getMonth() + 1, now.getDate());

/** Whole calendar days from today to an ISO date (0 = today, 1 = tomorrow, negative = already passed). */
export function daysUntil(isoDate: string, now = new Date()): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

export const urgency = (daysLeft: number): "now" | "soon" | "later" => (daysLeft <= 2 ? "now" : daysLeft <= 7 ? "soon" : "later");

export type ExamItem = {
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  name: string;
  time: string;
  place: string;
  date: string;
  daysLeft: number;
};

type DeadlineRow = { id: string; course_id: string; title: string; due_date: string; courses?: { name: string; color: string | null } | null };

export function toExams(rows: DeadlineRow[], now = new Date()): ExamItem[] {
  return rows
    .filter(isExam)
    .map((d) => {
      const p = parseExamTitle(d.title);
      return {
        id: d.id,
        courseId: d.course_id,
        courseName: d.courses?.name ?? "Course",
        courseColor: d.courses?.color ?? "#CE552F",
        ...p,
        date: d.due_date.slice(0, 10),
        daysLeft: daysUntil(d.due_date, now),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

// ---------------------------------------------------------------------------------------------
// Reading a pasted timetable (English or Arabic, any common date format). No AI involved.

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const asciiDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

const EN_MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const AR_MONTHS: Record<string, number> = {
  "يناير": 1, "فبراير": 2, "مارس": 3, "ابريل": 4, "أبريل": 4, "مايو": 5, "يونيو": 6,
  "يوليو": 7, "اغسطس": 8, "أغسطس": 8, "سبتمبر": 9, "اكتوبر": 10, "أكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12,
};
const AR_MONTH_RE = Object.keys(AR_MONTHS).join("|");
const enMonth = (s: string) => ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(s.slice(0, 3).toLowerCase()) + 1;
const WEEKDAYS = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?\b|السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|الجمعه/gi;

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? iso(y, m, d) : null;
}

/** No year written: the next time that day comes around. */
function withYear(m: number, d: number, now: Date): string | null {
  const y = now.getFullYear();
  const thisYear = validDate(y, m, d);
  if (thisYear && daysUntil(thisYear, now) >= 0) return thisYear;
  return validDate(y + 1, m, d);
}

function findDate(line: string, now: Date): { date: string; from: number; to: number } | null {
  let m: RegExpExecArray | null;
  const at = (found: RegExpExecArray, date: string | null) => (date ? { date, from: found.index, to: found.index + found[0].length } : null);

  if ((m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(line))) return at(m, validDate(+m[1]!, +m[2]!, +m[3]!));
  if ((m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/.exec(line))) {
    let a = +m[1]!;
    let b = +m[2]!;
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    if (b > 12 && a <= 12) [a, b] = [b, a]; // 12/25/2026 is clearly month-first; otherwise day-first
    return at(m, validDate(y, b, a));
  }
  if ((m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${EN_MONTHS})\\b\\.?,?(?:\\s+(\\d{4}))?`, "i").exec(line)))
    return at(m, m[3] ? validDate(+m[3], enMonth(m[2]!), +m[1]!) : withYear(enMonth(m[2]!), +m[1]!, now));
  if ((m = new RegExp(`\\b(${EN_MONTHS})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "i").exec(line)))
    return at(m, m[3] ? validDate(+m[3], enMonth(m[1]!), +m[2]!) : withYear(enMonth(m[1]!), +m[2]!, now));
  if ((m = new RegExp(`(\\d{1,2})\\s+(${AR_MONTH_RE})(?:\\s+(\\d{4}))?`).exec(line)))
    return at(m, m[3] ? validDate(+m[3], AR_MONTHS[m[2]!]!, +m[1]!) : withYear(AR_MONTHS[m[2]!]!, +m[1]!, now));
  return null;
}

function findTime(line: string): { time: string; from: number; to: number } | null {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.|ص|م)?|\b(\d{1,2})\s*(am|pm)\b/i.exec(line);
  if (!m) return null;
  let h = +(m[1] ?? m[4]!);
  const min = +(m[2] ?? 0);
  const ap = (m[3] ?? m[5] ?? "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" || ap === "م") {
    if (h < 12) h += 12;
  } else if ((ap === "am" || ap === "ص") && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, from: m.index, to: m.index + m[0].length };
}

export type ParsedExam = { line: string; courseId: string | null; courseGuess: string; name: string; date: string; time: string };

export function parseTimetableText(
  text: string,
  courses: { id: string; name: string; code: string | null }[],
  now = new Date(),
): { exams: ParsedExam[]; skipped: string[] } {
  const exams: ParsedExam[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = asciiDigits(raw).trim();
    if (line.length < 3) continue;
    const dateHit = findDate(line, now);
    if (!dateHit) {
      skipped.push(raw.trim());
      continue;
    }
    // blank out the date, then the time, keep the rest for course / exam name
    line = line.slice(0, dateHit.from) + " " + line.slice(dateHit.to);
    const timeHit = findTime(line);
    let time = "";
    if (timeHit) {
      time = timeHit.time;
      line = line.slice(0, timeHit.from) + " " + line.slice(timeHit.to);
    }
    const lower = line.toLowerCase();
    const name = /mid\s*-?\s*term|منتصف|ميد/.test(lower) ? "Midterm" : /final|نهائي|فاينال/.test(lower) ? "Final exam" : "Exam";
    const rest = line.replace(WEEKDAYS, " ").replace(/[|;,،()[\]\u2013\u2014]+/g, "\t").replace(/\s{2,}/g, "\t");
    const segments = [rest.replace(/\t+/g, " ").trim(), ...rest.split("\t").map((s) => s.trim())].filter((s) => s.length >= 2);

    let courseId: string | null = null;
    for (const seg of segments) {
      const m = bestMatch(seg, courses, (c) => [c.name, c.code ?? ""]);
      if ("item" in m) {
        courseId = m.item.id;
        break;
      }
    }
    const guess = segments.slice(1).sort((a, b) => b.length - a.length)[0] ?? segments[0] ?? "";
    exams.push({ line: raw.trim(), courseId, courseGuess: courseId ? "" : guess, name, date: dateHit.date, time });
  }
  return { exams, skipped };
}
