import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

import { getDb } from "./db.server";

export const getCourses = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = getDb();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createCourse = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        name: z.string().min(1).max(200),
        code: z.string().max(100).optional(),
        color: z.string().max(50).optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const supabase = getDb();
    const { error } = await supabase.from("courses").insert({
      name: data.name,
      code: data.code ?? null,
      color: data.color ?? "#CE552F",
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateCourse = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const supabase = getDb();
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
  .validator((data) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = getDb();
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getLectures = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(data)
  )
  .handler(async ({ data }) => {
    const supabase = getDb();
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
  .handler(async ({ data }) => {
    const supabase = getDb();
    const { error } = await supabase.from("lectures").insert({
      course_id: data.courseId,
      title: data.title,
      kind: data.kind ?? "lecture",
      lecture_date: data.lectureDate ?? null,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateLecture = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const supabase = getDb();
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
  .validator((data) => z.object({ lectureId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = getDb();
    const { error } = await supabase
      .from("lectures")
      .delete()
      .eq("id", data.lectureId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
