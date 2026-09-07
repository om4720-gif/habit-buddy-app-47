import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("user_id", userId)
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
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("courses").insert({
      user_id: userId,
      name: data.name,
      code: data.code ?? null,
      color: data.color ?? "#CE552F",
    });
    if (error) throw new Error(error.message);
    return { success: true };
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
    const { supabase, userId } = context;
    const { courseId } = data;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updates["name"] = data.name;
    if (data.code !== undefined) updates["code"] = data.code;
    if (data.color !== undefined) updates["color"] = data.color;
    const { error } = await supabase
      .from("courses")
      .update(updates)
      .eq("id", courseId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", data.courseId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getLectures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("lectures")
      .select("*, courses(name, color)")
      .eq("user_id", userId)
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
        lectureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("lectures").insert({
      course_id: data.courseId,
      user_id: userId,
      title: data.title,
      lecture_date: data.lectureDate ?? null,
    });
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
    const { supabase, userId } = context;
    const { lectureId } = data;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updates["title"] = data.title;
    if (data.lectureDate !== undefined) updates["lecture_date"] = data.lectureDate;
    if (data.completed !== undefined) updates["completed"] = data.completed;
    const { error } = await supabase
      .from("lectures")
      .update(updates)
      .eq("id", lectureId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ lectureId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("lectures")
      .delete()
      .eq("id", data.lectureId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
