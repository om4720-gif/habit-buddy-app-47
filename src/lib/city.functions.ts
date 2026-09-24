import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const POINTS = {
  habit: 5,
  lecture: 10,
  assignment: 20,
  earlyPerDay: 5,
  earlyMaxDays: 5,
};

export const getCityProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [habits, lectures, deadlines] = await Promise.all([
      supabase
        .from("habit_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("lectures")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("completed", true),
      supabase
        .from("deadlines")
        .select("due_date, updated_at")
        .eq("user_id", userId)
        .eq("completed", true),
    ]);
    if (habits.error) throw new Error(habits.error.message);
    if (lectures.error) throw new Error(lectures.error.message);
    if (deadlines.error) throw new Error(deadlines.error.message);

    const habitCount = habits.count ?? 0;
    const lectureCount = lectures.count ?? 0;
    const doneDeadlines = deadlines.data ?? [];

    let earlyBonus = 0;
    let earlyCount = 0;
    for (const d of doneDeadlines) {
      const doneOn = Date.parse(d.updated_at.slice(0, 10));
      const due = Date.parse(d.due_date);
      const daysEarly = Math.round((due - doneOn) / 86400000);
      if (daysEarly > 0) {
        earlyCount++;
        earlyBonus += Math.min(daysEarly, POINTS.earlyMaxDays) * POINTS.earlyPerDay;
      }
    }

    const breakdown = {
      habits: habitCount * POINTS.habit,
      lectures: lectureCount * POINTS.lecture,
      assignments: doneDeadlines.length * POINTS.assignment,
      early: earlyBonus,
    };
    return {
      total: breakdown.habits + breakdown.lectures + breakdown.assignments + breakdown.early,
      breakdown,
      counts: {
        habits: habitCount,
        lectures: lectureCount,
        assignments: doneDeadlines.length,
        early: earlyCount,
      },
    };
  });
