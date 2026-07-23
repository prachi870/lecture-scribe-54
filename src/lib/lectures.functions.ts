import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AuthedSupabase = SupabaseClient<Database>;

const CreateInput = z.object({
  title: z.string().min(1).max(200),
  course_id: z.string().uuid().nullable().optional(),
});

export const createLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CreateInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("lectures")
      .insert({
        title: data.title,
        course_id: data.course_id ?? null,
        user_id: context.userId,
        status: "draft",
        transcript_status: "idle",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const FinalizeInput = z.object({
  id: z.string().uuid(),
  audio_path: z.string().min(1),
  duration_seconds: z.number().int().nonnegative().nullable().optional(),
});

export const finalizeLectureUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => FinalizeInput.parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("lectures")
      .update({
        audio_path: data.audio_path,
        duration_seconds: data.duration_seconds ?? null,
        status: "processing",
        transcript_status: "pending",
        transcript_error: null,
        recorded_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const IdInput = z.object({ id: z.string().uuid() });

async function runTranscription(
  supabase: AuthedSupabase,
  userId: string,
  id: string,
) {
  const { data: lecture, error: fetchErr } = await supabase
    .from("lectures")
    .select("id, audio_path")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (fetchErr || !lecture?.audio_path) throw new Error(fetchErr?.message || "Lecture not found");

  await supabase
    .from("lectures")
    .update({ transcript_status: "processing", transcript_error: null })
    .eq("id", id)
    .eq("user_id", userId);

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  try {
    const { data: signed, error: signErr } = await supabase.storage
      .from("lecture-audio")
      .createSignedUrl(lecture.audio_path, 60 * 10);
    if (signErr || !signed?.signedUrl) throw new Error(signErr?.message || "Failed to sign audio URL");

    const audioRes = await fetch(signed.signedUrl);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio (${audioRes.status})`);
    const audioBlob = await audioRes.blob();

    const ext = lecture.audio_path.split(".").pop()?.toLowerCase() || "webm";
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", audioBlob, `recording.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Transcription failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const payload = (await res.json()) as { text?: string };
    const transcript = payload.text?.trim() ?? "";

    await supabase
      .from("lectures")
      .update({
        transcript,
        transcript_status: "completed",
        transcript_error: null,
        transcribed_at: new Date().toISOString(),
        status: "processed",
      })
      .eq("id", id)
      .eq("user_id", userId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("lectures")
      .update({ transcript_status: "failed", transcript_error: message })
      .eq("id", id)
      .eq("user_id", userId);
    throw err;
  }
}

export const transcribeLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    return runTranscription(context.supabase, context.userId, data.id);
  });

export const retryTranscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    return runTranscription(context.supabase, context.userId, data.id);
  });

export const listLectures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lectures")
      .select("id, title, status, transcript_status, duration_seconds, created_at, course_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("lectures")
      .select(
        "id, title, description, status, transcript_status, transcript, transcript_error, duration_seconds, audio_path, course_id, created_at, transcribed_at",
      )
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Lecture not found");

    let audioUrl: string | null = null;
    if (row.audio_path) {
      const { data: signed } = await context.supabase.storage
        .from("lecture-audio")
        .createSignedUrl(row.audio_path, 60 * 60);
      audioUrl = signed?.signedUrl ?? null;
    }
    return { ...row, audioUrl };
  });

export const deleteLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("lectures")
      .select("audio_path")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (row?.audio_path) {
      await context.supabase.storage.from("lecture-audio").remove([row.audio_path]);
    }
    const { error } = await context.supabase
      .from("lectures")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCoursesForPicker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("courses")
      .select("id, title, code, color")
      .eq("user_id", context.userId)
      .order("title");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
