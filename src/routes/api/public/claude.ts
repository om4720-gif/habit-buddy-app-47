import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { getDb } from "@/lib/db.server";

function pct(done: number, total: number) {
  return total === 0 ? "—" : `${Math.round((done / total) * 100)}%`;
}

export const Route = createFileRoute("/api/public/claude")({
  server: {
    handlers: {
      GET: async () => {
        const db = getDb();
        const [courses, lectures, deadlines, habits, completions] = await Promise.all([
          db.from("courses").select("id,name,code").order("name"),
          db.from("lectures").select("course_id,title,kind,lecture_date,completed").order("lecture_date"),
          db.from("deadlines").select("course_id,title,kind,due_date,completed").order("due_date"),
          db.from("habits").select("id,name,category").eq("archived", false),
          db
            .from("habit_completions")
            .select("habit_id,completed_date")
            .gte("completed_date", format(new Date(Date.now() - 7 * 864e5), "yyyy-MM-dd")),
        ]);
        const err = courses.error || lectures.error || deadlines.error || habits.error || completions.error;
        if (err) return new Response("Could not load data", { status: 500 });

        const today = new Date();
        const name = new Map((courses.data ?? []).map((c) => [c.id, c.name]));
        const L: string[] = [];
        L.push(`# Study tracker — live snapshot`, ``, `Generated: ${format(today, "EEEE d MMM yyyy, HH:mm")} UTC`, ``);

        const allL = lectures.data ?? [];
        const lec = allL.filter((l) => l.kind !== "tutorial");
        const tut = allL.filter((l) => l.kind === "tutorial");
        L.push(`## Overview`);
        L.push(`- Courses: ${courses.data?.length ?? 0}`);
        L.push(`- Lectures studied: ${lec.filter((l) => l.completed).length}/${lec.length} (${pct(lec.filter((l) => l.completed).length, lec.length)})`);
        L.push(`- Tutorials studied: ${tut.filter((l) => l.completed).length}/${tut.length} (${pct(tut.filter((l) => l.completed).length, tut.length)})`, ``);

        const open = (deadlines.data ?? []).filter((d) => !d.completed);
        L.push(`## Upcoming assignments & quizzes`);
        if (open.length === 0) L.push(`- None open`);
        for (const d of open) {
          const days = differenceInCalendarDays(parseISO(d.due_date), today);
          const when = days < 0 ? `OVERDUE by ${-days}d` : days === 0 ? "due today" : `in ${days}d`;
          L.push(`- [${d.kind}] ${d.title} — ${name.get(d.course_id) ?? "?"} — ${d.due_date} (${when})`);
        }
        const done = (deadlines.data ?? []).filter((d) => d.completed);
        if (done.length) L.push(``, `Completed: ${done.map((d) => `${d.title} (${name.get(d.course_id) ?? "?"})`).join("; ")}`);
        L.push(``);

        L.push(`## Courses`);
        for (const c of courses.data ?? []) {
          const items = allL.filter((l) => l.course_id === c.id);
          L.push(``, `### ${c.name}${c.code ? ` (${c.code})` : ""}`);
          for (const [label, kind] of [["Lectures", "lecture"], ["Tutorials", "tutorial"]] as const) {
            const list = items.filter((l) => (kind === "tutorial" ? l.kind === "tutorial" : l.kind !== "tutorial"));
            const n = list.filter((l) => l.completed).length;
            L.push(`**${label}** ${n}/${list.length} studied (${pct(n, list.length)})`);
            for (const l of list) L.push(`- [${l.completed ? "x" : " "}] ${l.title}${l.lecture_date ? ` — ${l.lecture_date}` : ""}`);
          }
        }
        L.push(``);

        L.push(`## Habits (last 7 days)`);
        for (const h of habits.data ?? []) {
          const n = (completions.data ?? []).filter((x) => x.habit_id === h.id).length;
          L.push(`- ${h.name} (${h.category ?? "general"}): ${n}/7 days`);
        }

        return new Response(L.join("\n"), {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
