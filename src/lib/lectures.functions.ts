import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AuthedSupabase = SupabaseClient<Database>;

// ---------- Create / finalize ----------
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

// ---------- Transcription ----------
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
        status: "ready",
      })
      .eq("id", id)
      .eq("user_id", userId);

    // Auto-generate notes after transcription completes
    try {
      await runGenerateNotes(supabase, userId, id, transcript);
    } catch (e) {
      console.error("auto-notes failed", e);
    }

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

// ---------- YouTube / URL ingestion ----------
function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/");
      const i = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "v");
      if (i >= 0 && parts[i + 1]) return parts[i + 1];
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchYouTubeTranscript(videoId: string): Promise<{ text: string; title: string }> {
  // Fetch watch page and parse captionTracks
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`YouTube fetch failed (${res.status})`);
  const html = await res.text();

  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  const title = titleMatch?.[1]?.replace(/ - YouTube$/, "").trim() || `YouTube ${videoId}`;

  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) throw new Error("No captions available for this video. Try one with subtitles.");
  let tracks: Array<{ baseUrl: string; languageCode?: string; kind?: string }> = [];
  try {
    tracks = JSON.parse(m[1]);
  } catch {
    throw new Error("Failed to parse captions.");
  }
  if (!tracks.length) throw new Error("No captions available for this video.");
  const preferred =
    tracks.find((t) => t.languageCode === "en" && !t.kind) ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks[0];
  const capUrl = preferred.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3";
  const capRes = await fetch(capUrl);
  if (!capRes.ok) throw new Error(`Caption fetch failed (${capRes.status})`);
  const cap = (await capRes.json()) as {
    events?: Array<{ segs?: Array<{ utf8?: string }> }>;
  };
  const text = (cap.events || [])
    .map((e) => (e.segs || []).map((s) => s.utf8 || "").join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
  if (!text) throw new Error("Captions were empty.");
  return { text, title };
}

const IngestUrlInput = z.object({
  url: z.string().url().max(500),
  course_id: z.string().uuid().nullable().optional(),
});

export const ingestLectureFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IngestUrlInput.parse(v))
  .handler(async ({ data, context }) => {
    const vid = extractYouTubeId(data.url);
    if (!vid) {
      throw new Error(
        "Only YouTube links are supported for URL ingestion. Please upload the audio file for other sources.",
      );
    }
    const { text, title } = await fetchYouTubeTranscript(vid);

    const { data: row, error } = await context.supabase
      .from("lectures")
      .insert({
        user_id: context.userId,
        title,
        course_id: data.course_id ?? null,
        source_url: data.url,
        status: "ready",
        transcript_status: "completed",
        transcript: text,
        transcribed_at: new Date().toISOString(),
        recorded_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // fire and forget notes
    runGenerateNotes(context.supabase, context.userId, row.id, text).catch((e) =>
      console.error("notes failed", e),
    );

    return { id: row.id };
  });

// ---------- AI Notes ----------
async function callLovableChatJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI call failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  try {
    return JSON.parse(content) as T;
  } catch {
    // try to extract JSON block
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI response was not valid JSON");
  }
}

type NotesShape = {
  summary: string;
  eli5: string;
  key_points: string[];
  glossary: Array<{ term: string; definition: string }>;
};

async function runGenerateNotes(
  supabase: AuthedSupabase,
  userId: string,
  lectureId: string,
  transcript?: string,
) {
  let text = transcript;
  if (!text) {
    const { data } = await supabase
      .from("lectures")
      .select("transcript")
      .eq("id", lectureId)
      .eq("user_id", userId)
      .maybeSingle();
    text = data?.transcript ?? "";
  }
  if (!text || text.trim().length < 20) {
    throw new Error("No transcript available yet.");
  }
  const truncated = text.slice(0, 20000);
  const notes = await callLovableChatJSON<NotesShape>(
    `Transcript:\n\n${truncated}\n\nReturn JSON with fields: summary (2-3 paragraphs), eli5 (explain like I'm 12, plain simple English, 1 paragraph), key_points (array of 5-10 short bullet strings), glossary (array of {term, definition} for 5-10 important terms).`,
    "You are an expert study-notes generator. Return ONLY valid JSON with the exact shape requested. No prose outside JSON.",
  );

  await supabase.from("lecture_notes").upsert(
    {
      lecture_id: lectureId,
      summary: notes.summary?.slice(0, 5000) ?? "",
      eli5: notes.eli5?.slice(0, 5000) ?? "",
      key_points: Array.isArray(notes.key_points) ? notes.key_points.slice(0, 20) : [],
      glossary: Array.isArray(notes.glossary) ? notes.glossary.slice(0, 20) : [],
      generated_at: new Date().toISOString(),
    },
    { onConflict: "lecture_id" },
  );
  return { ok: true };
}

export const generateLectureNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    return runGenerateNotes(context.supabase, context.userId, data.id);
  });

export const getLectureNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("lecture_notes")
      .select("summary, eli5, key_points, glossary, generated_at")
      .eq("lecture_id", data.id)
      .maybeSingle();
    return row;
  });

// ---------- Flashcards ----------
type FlashShape = { cards: Array<{ question: string; answer: string; difficulty?: string }> };

export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: lec } = await context.supabase
      .from("lectures")
      .select("transcript")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const text = lec?.transcript ?? "";
    if (text.trim().length < 20) throw new Error("Transcript not ready yet.");

    const gen = await callLovableChatJSON<FlashShape>(
      `Transcript:\n\n${text.slice(0, 20000)}\n\nGenerate 8-12 quiz flashcards. Return JSON: { "cards": [ { "question": string, "answer": string, "difficulty": "easy"|"medium"|"hard" } ] }`,
      "You generate high-quality study flashcards. Return ONLY valid JSON.",
    );

    // wipe & reinsert
    await context.supabase.from("flashcards").delete().eq("lecture_id", data.id);
    const rows = (gen.cards || []).slice(0, 20).map((c) => ({
      lecture_id: data.id,
      question: String(c.question || "").slice(0, 500),
      answer: String(c.answer || "").slice(0, 2000),
      difficulty: ["easy", "medium", "hard"].includes(c.difficulty || "") ? c.difficulty! : "medium",
    }));
    if (rows.length) {
      const { error } = await context.supabase.from("flashcards").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { count: rows.length };
  });

export const listFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("flashcards")
      .select("id, question, answer, difficulty")
      .eq("lecture_id", data.id)
      .order("created_at");
    return rows ?? [];
  });

export const listAllFlashcards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("flashcards")
      .select("id, question, answer, difficulty, lecture_id, lectures!inner(title, user_id)")
      .eq("lectures.user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

// ---------- Chat ----------
const ChatInput = z.object({
  lecture_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export const chatWithLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ChatInput.parse(v))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { data: lec } = await context.supabase
      .from("lectures")
      .select("transcript, title")
      .eq("id", data.lecture_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!lec?.transcript) throw new Error("Transcript not available yet.");

    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("lecture_id", data.lecture_id)
      .order("created_at")
      .limit(30);

    // Save user message
    await context.supabase.from("chat_messages").insert({
      lecture_id: data.lecture_id,
      role: "user",
      content: data.message,
    });

    const messages = [
      {
        role: "system",
        content: `You are an AI tutor helping a student understand a lecture titled "${lec.title}". Answer clearly and simply, using easy terms. If the question is outside the lecture's scope, say so briefly. Lecture transcript:\n\n${lec.transcript.slice(0, 18000)}`,
      },
      ...(history || []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: data.message },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.6-flash", messages }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Chat failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim() || "Sorry, no reply.";

    await context.supabase.from("chat_messages").insert({
      lecture_id: data.lecture_id,
      role: "assistant",
      content: reply,
    });

    return { reply };
  });

export const listChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("lecture_id", data.id)
      .order("created_at");
    return rows ?? [];
  });

export const clearChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    await context.supabase.from("chat_messages").delete().eq("lecture_id", data.id);
    return { ok: true };
  });

// ---------- List / detail / delete ----------
export const listLectures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lectures")
      .select("id, title, status, transcript_status, duration_seconds, created_at, course_id, source_url")
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
        "id, title, description, status, transcript_status, transcript, transcript_error, duration_seconds, audio_path, course_id, created_at, transcribed_at, source_url",
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

// ---------- Dashboard stats ----------
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: lectures } = await context.supabase
      .from("lectures")
      .select("id, duration_seconds, transcript_status, created_at, title")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    const { data: notes } = await context.supabase
      .from("lecture_notes")
      .select("lecture_id")
      .in("lecture_id", (lectures ?? []).map((l) => l.id).length ? (lectures ?? []).map((l) => l.id) : ["00000000-0000-0000-0000-000000000000"]);

    const totalSeconds = (lectures ?? []).reduce((a, l) => a + (l.duration_seconds ?? 0), 0);
    const ready = (lectures ?? []).filter((l) => l.transcript_status === "completed").length;

    return {
      lectureCount: lectures?.length ?? 0,
      hours: +(totalSeconds / 3600).toFixed(1),
      notesCount: notes?.length ?? 0,
      readyCount: ready,
      recent: (lectures ?? []).slice(0, 5),
    };
  });
