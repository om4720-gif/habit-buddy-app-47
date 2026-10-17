import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { buildBackupJson, buildIcs, toCsv, type Row } from "@/lib/exportFormats";

const TABLES = [
  "habits",
  "habit_completions",
  "courses",
  "lectures",
  "deadlines",
  "rewards",
  "reward_redemptions",
  "user_settings",
  "course_photos",
  "course_photo_folders",
] as const;
type Table = (typeof TABLES)[number];

/** Reads a whole table, a page at a time (the database returns at most 1000 rows per request). */
async function fetchAll(table: Table, orderBy?: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table as "habits").select("*");
    if (orderBy) q = q.order(orderBy as "id", { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => format(new Date(), "yyyy-MM-dd");
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Open deadlines as calendar events (Google Calendar, Apple Calendar, Outlook). Returns how many. */
export async function exportDeadlinesIcs(): Promise<number> {
  const [deadlines, courses] = await Promise.all([fetchAll("deadlines", "id"), fetchAll("courses", "id")]);
  const name = new Map(courses.map((c) => [str(c["id"]), str(c["name"])]));
  const open = deadlines
    .filter((d) => !d["completed"])
    .map((d) => ({
      id: str(d["id"]),
      title: str(d["title"]),
      kind: str(d["kind"]) || "deadline",
      due_date: str(d["due_date"]),
      course: name.get(str(d["course_id"])) ?? "Course",
    }));
  if (open.length === 0) return 0;
  download(`ritual-deadlines-${stamp()}.ics`, "text/calendar", buildIcs(open));
  return open.length;
}

/** Everything in one JSON file. Course photo files themselves are not included, only their records. */
export async function exportBackup(): Promise<{ tables: number; failed: string[] }> {
  const results = await Promise.allSettled(
    TABLES.map((t) => fetchAll(t, t === "habit_completions" ? "id" : undefined)),
  );
  const tables: Record<string, Row[]> = {};
  const errors: Record<string, string> = {};
  results.forEach((r, i) => {
    const t = TABLES[i]!;
    if (r.status === "fulfilled") tables[t] = r.value;
    else errors[t] = r.reason instanceof Error ? r.reason.message : String(r.reason);
  });
  download(`ritual-backup-${stamp()}.json`, "application/json", buildBackupJson(tables, errors));
  return { tables: Object.keys(tables).length, failed: Object.keys(errors) };
}

export async function exportHabitCsv(): Promise<number> {
  const [habits, completions] = await Promise.all([fetchAll("habits", "id"), fetchAll("habit_completions", "id")]);
  const name = new Map(habits.map((h) => [str(h["id"]), str(h["name"])]));
  const rows = completions
    .map((c) => ({ date: str(c["completed_date"]), habit: name.get(str(c["habit_id"])) ?? "(deleted habit)" }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.habit.localeCompare(b.habit));
  download(
    `ritual-habit-history-${stamp()}.csv`,
    "text/csv",
    toCsv(rows, [
      { key: "date", label: "Date" },
      { key: "habit", label: "Habit" },
    ]),
  );
  return rows.length;
}

export async function exportStudyCsv(): Promise<number> {
  const [courses, lectures] = await Promise.all([fetchAll("courses", "id"), fetchAll("lectures", "id")]);
  const course = new Map(courses.map((c) => [str(c["id"]), c]));
  const rows = lectures
    .map((l) => {
      const c = course.get(str(l["course_id"]));
      return {
        course: str(c?.["name"]),
        code: str(c?.["code"]),
        type: str(l["kind"]),
        title: str(l["title"]),
        studied: l["completed"] ? "yes" : "no",
        date: str(l["lecture_date"]),
      };
    })
    .sort((a, b) => a.course.localeCompare(b.course) || a.type.localeCompare(b.type) || a["title"].localeCompare(b["title"], undefined, { numeric: true }));
  download(
    `ritual-courses-${stamp()}.csv`,
    "text/csv",
    toCsv(rows, [
      { key: "course", label: "Course" },
      { key: "code", label: "Code" },
      { key: "type", label: "Type" },
      { key: "title", label: "Title" },
      { key: "studied", label: "Studied" },
      { key: "date", label: "Date" },
    ]),
  );
  return rows.length;
}

export async function exportDeadlinesCsv(): Promise<number> {
  const [courses, deadlines] = await Promise.all([fetchAll("courses", "id"), fetchAll("deadlines", "id")]);
  const name = new Map(courses.map((c) => [str(c["id"]), str(c["name"])]));
  const rows = deadlines
    .map((d) => ({
      course: name.get(str(d["course_id"])) ?? "",
      type: str(d["kind"]),
      title: str(d["title"]),
      due: str(d["due_date"]),
      done: d["completed"] ? "yes" : "no",
    }))
    .sort((a, b) => a.due.localeCompare(b.due));
  download(
    `ritual-deadlines-${stamp()}.csv`,
    "text/csv",
    toCsv(rows, [
      { key: "course", label: "Course" },
      { key: "type", label: "Type" },
      { key: "title", label: "Title" },
      { key: "due", label: "Due" },
      { key: "done", label: "Done" },
    ]),
  );
  return rows.length;
}
