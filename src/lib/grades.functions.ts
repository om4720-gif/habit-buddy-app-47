import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const gradeItemSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  score: z.number().min(0).nullable(),
  maxScore: z.number().positive().max(100_000),
  weight: z.number().positive().max(100),
  isFinal: z.boolean(),
});

async function validateCourseWeights(
  supabase: SupabaseClient<Database>,
  courseId: string,
  gradeItemId: string | undefined,
  weight: number,
  isFinal: boolean,
) {
  const { data: items, error } = await supabase
    .from("course_grade_items")
    .select("id, weight, is_final")
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  const remaining = (items ?? []).filter((item) => item.id !== gradeItemId);
  if (remaining.reduce((total, item) => total + item.weight, 0) + weight > 100.0001)
    throw new Error("Course grade weights cannot add up to more than 100%.");
  if (isFinal && remaining.some((item) => item.is_final))
    throw new Error("This course already has a final exam component.");
}

export const getGradeItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ courseId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("course_grade_items")
      .select("*")
      .order("created_at", { ascending: true });
    if (data.courseId) query = query.eq("course_id", data.courseId);
    const { data: items, error } = await query;
    if (error) throw new Error(error.message);
    return items ?? [];
  });

export const getCourseGradeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ courseId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    let query = context.supabase.from("course_grade_settings").select("*");
    if (data.courseId) query = query.eq("course_id", data.courseId);
    const { data: settings, error } = await query;
    if (error) throw new Error(error.message);
    return settings ?? [];
  });

export const createGradeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => gradeItemSchema.parse(data))
  .handler(async ({ data, context }) => {
    await validateCourseWeights(
      context.supabase,
      data.courseId,
      undefined,
      data.weight,
      data.isFinal,
    );
    const row: Database["public"]["Tables"]["course_grade_items"]["Insert"] = {
      course_id: data.courseId,
      title: data.title,
      score: data.score,
      max_score: data.maxScore,
      weight: data.weight,
      is_final: data.isFinal,
    };
    const { error } = await context.supabase.from("course_grade_items").insert(row);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateGradeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => gradeItemSchema.extend({ gradeItemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await validateCourseWeights(
      context.supabase,
      data.courseId,
      data.gradeItemId,
      data.weight,
      data.isFinal,
    );
    const updates: Database["public"]["Tables"]["course_grade_items"]["Update"] = {
      title: data.title,
      score: data.score,
      max_score: data.maxScore,
      weight: data.weight,
      is_final: data.isFinal,
      updated_at: new Date().toISOString(),
    };
    const { error } = await context.supabase
      .from("course_grade_items")
      .update(updates)
      .eq("id", data.gradeItemId)
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteGradeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ gradeItemId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("course_grade_items")
      .delete()
      .eq("id", data.gradeItemId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const saveCourseGradeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        courseId: z.string().uuid(),
        creditHours: z.number().positive().max(30),
        gradeCutoffs: z
          .record(
            z.string().trim().min(1).max(10),
            z.object({
              minimum: z.number().min(0).max(100),
              gpaStart: z.number().min(0).max(5),
              gpaEnd: z.number().min(0).max(5),
            }),
          )
          .refine(
            (cutoffs) => Object.keys(cutoffs).length > 0 && Object.keys(cutoffs).length <= 20,
            "Add between 1 and 20 grade cutoffs.",
          ),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const row: Database["public"]["Tables"]["course_grade_settings"]["Insert"] = {
      course_id: data.courseId,
      credit_hours: data.creditHours,
      grade_cutoffs: data.gradeCutoffs,
    };
    const { error } = await context.supabase
      .from("course_grade_settings")
      .upsert(row, { onConflict: "course_id" });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getUnreadGradeNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("grade_notifications")
      .select("*")
      .is("read_at", null)
      .order("received_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const dismissGradeNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ notificationIds: z.array(z.string().uuid()).min(1).max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("grade_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", data.notificationIds);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getGradeInboxToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing, error: readError } = await context.supabase
      .from("grade_inbox_tokens")
      .select("token")
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (existing) return { token: existing.token };

    const { data, error } = await context.supabase
      .from("grade_inbox_tokens")
      .insert({})
      .select("token")
      .single();
    if (error) throw new Error("Could not create the grade inbox link");
    return { token: data.token };
  });

export const resetGradeInboxToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error: deleteError } = await context.supabase
      .from("grade_inbox_tokens")
      .delete()
      .eq("user_id", context.userId);
    if (deleteError) throw new Error("Could not reset the grade inbox link");

    const { data, error } = await context.supabase
      .from("grade_inbox_tokens")
      .insert({})
      .select("token")
      .single();
    if (error) throw new Error("Could not create a new grade inbox link");
    return { token: data.token };
  });
