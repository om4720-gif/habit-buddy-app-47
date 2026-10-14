import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const supabase = context.supabase;
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        name: z.string().min(1).max(200),
        code: z.string().max(100).optional(),
        color: z.string().max(50).optional(),
        // Optional: pre-create "Lecture 1..n" and "Tutorial 1..n" with the course.
        lectureCount: z.number().int().min(0).max(60).optional(),
        tutorialCount: z.number().int().min(0).max(60).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: course, error } = await supabase
      .from("courses")
      .insert({
        name: data.name,
        code: data.code ?? null,
        color: data.color ?? "#CE552F",
      } as never)
      .select("id")
      .single();
    if (error || !course) throw new Error(error?.message ?? "Could not create course");

    const courseId = (course as { id: string }).id;
    const rows = [
      ...Array.from({ length: data.lectureCount ?? 0 }, (_, i) => ({
        course_id: courseId,
        title: `Lecture ${i + 1}`,
        kind: "lecture",
      })),
      ...Array.from({ length: data.tutorialCount ?? 0 }, (_, i) => ({
        course_id: courseId,
        title: `Tutorial ${i + 1}`,
        kind: "tutorial",
      })),
    ];
    if (rows.length > 0) {
      const { error: bulkError } = await supabase.from("lectures").insert(rows as never);
      if (bulkError) {
        // Don't leave a half-created course behind.
        await supabase.from("courses").delete().eq("id", courseId);
        throw new Error(bulkError.message);
      }
    }
    return { success: true, courseId };
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        courseId: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        code: z.string().max(100).optional(),
        color: z.string().max(50).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { courseId } = data;
    const updates: Database["public"]["Tables"]["courses"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updates.name = data.name;
    if (data.code !== undefined) updates.code = data.code;
    if (data.color !== undefined) updates.color = data.color;
    const { error } = await supabase
      .from("courses")
      .update(updates)
      .eq("id", courseId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getLectures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let query = supabase
      .from("lectures")
      .select("*, courses(name, color)")
      .order("lecture_date", { ascending: false });
    if (data.courseId) {
      query = query.eq("course_id", data.courseId);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        courseId: z.string().uuid(),
        title: z.string().min(1).max(300),
        kind: z.enum(["lecture", "tutorial"]).optional(),
        lectureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase.from("lectures").insert({
      course_id: data.courseId,
      title: data.title,
      kind: data.kind ?? "lecture",
      lecture_date: data.lectureDate ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        lectureId: z.string().uuid(),
        title: z.string().min(1).max(300).optional(),
        lectureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        completed: z.boolean().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { lectureId } = data;
    const updates: Database["public"]["Tables"]["lectures"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updates.title = data.title;
    if (data.lectureDate !== undefined) updates.lecture_date = data.lectureDate;
    if (data.completed !== undefined) updates.completed = data.completed;
    const { error } = await supabase
      .from("lectures")
      .update(updates)
      .eq("id", lectureId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ lectureId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error } = await supabase
      .from("lectures")
      .delete()
      .eq("id", data.lectureId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
