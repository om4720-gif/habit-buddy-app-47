import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeConsistencyRate,
  computeLongestStreak,
  computeStreak,
  type HabitWithMeta,
} from "./habits.server";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const getHabitsForDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ date: dateSchema, category: z.enum(["general", "german", "uni"]).optional() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { date, category } = data;
    const supabase = context.supabase;

    let query = supabase
      .from("habits")
      .select("id, name, description, category, created_at")
      .eq("archived", false);
    if (category) {
      query = query.eq("category", category);
    }
    const { data: habits, error: habitsError } = await query.order("created_at", { ascending: true });

    if (habitsError) throw new Error(habitsError.message);

    const habitIds = habits?.map((h) => h.id) ?? [];

    const { data: completions, error: completionsError } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_date")
      .in("habit_id", habitIds.length > 0 ? habitIds : [""])
      .order("completed_date", { ascending: true });

    if (completionsError) throw new Error(completionsError.message);

    const completionsByHabit = new Map<string, string[]>();
    const todayCompleted = new Set<string>();

    for (const c of completions ?? []) {
      const list = completionsByHabit.get(c.habit_id) ?? [];
      list.push(c.completed_date);
      completionsByHabit.set(c.habit_id, list);
      if (c.completed_date === date) {
        todayCompleted.add(c.habit_id);
      }
    }

    const result: HabitWithMeta[] =
      habits?.map((h) => ({
        id: h.id,
        name: h.name,
        description: h.description,
        category: h.category ?? "general",
        created_at: h.created_at ?? "",
        completed: todayCompleted.has(h.id),
        streak: computeStreak(completionsByHabit.get(h.id) ?? [], date),
      })) ?? [];

    return result;
  });

export const toggleCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ habitId: z.string().uuid(), date: dateSchema }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { habitId, date } = data;
    const supabase = context.supabase;

    const { data: existing } = await supabase
      .from("habit_completions")
      .select("id")
      .eq("habit_id", habitId)
      .eq("completed_date", date)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { completed: false };
    }

    const { error } = await supabase.from("habit_completions").insert({
      habit_id: habitId,
      completed_date: date,
    } as never);
    if (error) throw new Error(error.message);
    return { completed: true };
  });

export const createHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        name: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        category: z.string().max(100).default("general"),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase.from("habits").insert({
      name: data.name,
      description: data.description ?? null,
      category: data.category,
    } as never);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        habitId: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(500).optional(),
        archived: z.boolean().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { habitId } = data;

    const updates: Database["public"]["Tables"]["habits"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.archived !== undefined) updates.archived = data.archived;

    const { error } = await supabase
      .from("habits")
      .update(updates)
      .eq("id", habitId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ habitId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", data.habitId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ date: dateSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { date } = data;
    const supabase = context.supabase;

    const { data: habits, error: habitsError } = await supabase
      .from("habits")
      .select("id, name, archived")
      .order("created_at", { ascending: true });

    if (habitsError) throw new Error(habitsError.message);

    const activeHabits = habits?.filter((h) => !h.archived) ?? [];
    const allHabitIds = habits?.map((h) => h.id) ?? [];

    const { data: completions, error: completionsError } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_date")
      .in("habit_id", allHabitIds.length > 0 ? allHabitIds : [""]);

    if (completionsError) throw new Error(completionsError.message);

    const completionsByHabit = new Map<string, string[]>();
    for (const c of completions ?? []) {
      const list = completionsByHabit.get(c.habit_id) ?? [];
      list.push(c.completed_date);
      completionsByHabit.set(c.habit_id, list);
    }

    let longestStreak = 0;
    let longestStreakHabit = "";
    for (const habit of activeHabits) {
      const dates = completionsByHabit.get(habit.id) ?? [];
      const streak = computeLongestStreak(dates);
      if (streak > longestStreak) {
        longestStreak = streak;
        longestStreakHabit = habit.name;
      }
    }

    // Consistency rate for current month up to the reference date.
    const monthStart = `${date.slice(0, 7)}-01`;
    const allMonthDates: string[] = [];
    for (const habit of activeHabits) {
      const dates = completionsByHabit.get(habit.id) ?? [];
      allMonthDates.push(...dates.filter((d) => d >= monthStart && d <= date));
    }
    const consistencyRate = computeConsistencyRate(
      allMonthDates,
      monthStart,
      date
    );

    return {
      longestStreak,
      longestStreakHabit,
      consistencyRate,
      activeHabitCount: activeHabits.length,
    };
  });

export const getWeeklyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ date: dateSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { date } = data;
    const supabase = context.supabase;

    const end = new Date(`${date}T00:00:00`);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startStr = start.toISOString().slice(0, 10);

    const { data: habits, error: habitsError } = await supabase
      .from("habits")
      .select("id")
      .eq("archived", false);

    if (habitsError) throw new Error(habitsError.message);
    const habitIds = habits?.map((h) => h.id) ?? [];

    const { data: completions, error: completionsError } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_date")
      .gte("completed_date", startStr)
      .lte("completed_date", date)
      .in("habit_id", habitIds.length > 0 ? habitIds : [""]);

    if (completionsError) throw new Error(completionsError.message);

    const days: { date: string; completed: number; total: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dStr = d.toISOString().slice(0, 10);
      const completed =
        completions?.filter((c) => c.completed_date === dStr).length ?? 0;
      days.push({ date: dStr, completed, total: habitIds.length });
    }

    return days;
  });
