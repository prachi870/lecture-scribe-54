import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.server";

const CourseInput = z.object({
  title: z.string().trim().min(1).max(120),
  code: z.string().trim().max(30).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("courses")
      .select("id, title, code, color, description, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // count lectures per course
    const ids = (data ?? []).map((c) => c.id);
    let counts = new Map<string, number>();
    if (ids.length) {
      const { data: lectures } = await context.supabase
        .from("lectures")
        .select("course_id")
        .in("course_id", ids)
        .eq("user_id", context.userId);
      (lectures ?? []).forEach((l) => {
        if (l.course_id) counts.set(l.course_id, (counts.get(l.course_id) ?? 0) + 1);
      });
    }
    return (data ?? []).map((c) => ({ ...c, lectureCount: counts.get(c.id) ?? 0 }));
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CourseInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("courses")
      .insert({
        user_id: context.userId,
        title: data.title,
        code: data.code || null,
        description: data.description || null,
        color: data.color || "#8B5CF6",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const UpdateInput = CourseInput.extend({ id: z.string().uuid() });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => UpdateInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("courses")
      .update({
        title: data.title,
        code: data.code || null,
        description: data.description || null,
        color: data.color || "#8B5CF6",
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("courses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
