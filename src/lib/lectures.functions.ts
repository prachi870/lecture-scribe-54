import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { geminiChatJSON, geminiChat, geminiTranscribe, NotesSchema, FlashcardSchema, ExamPrepSchema, MindMapSchema, RevisionPlanSchema } from "./gemini";

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
    .select("id, audio_path, transcript")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (fetchErr || !lecture) throw new Error(fetchErr?.message || "Lecture not found");

  await supabase
    .from("lectures")
    .update({ transcript_status: "processing", transcript_error: null })
    .eq("id", id)
    .eq("user_id", userId);

  try {
    let transcript = lecture.transcript?.trim() ?? "";

    if (!transcript) {
      if (!lecture.audio_path) {
        throw new Error("No audio path recorded for this lecture.");
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from("lecture-audio")
        .createSignedUrl(lecture.audio_path, 60 * 10);
      if (signErr || !signed?.signedUrl) throw new Error(signErr?.message || "Failed to sign audio URL");

      const audioRes = await fetch(signed.signedUrl);
      if (!audioRes.ok) throw new Error(`Failed to fetch audio (${audioRes.status})`);
      const audioBlob = await audioRes.blob();

      transcript = await geminiTranscribe(audioBlob, lecture.audio_path);
    }

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
      console.error("Auto notes generation notice:", e);
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
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

  // Try every English track in order until one returns non-empty content.
  // YouTube sometimes returns HTTP 200 with 0 bytes for certain track types
  // depending on IP/region — iterate all en tracks as fallback.
  const enTracks = [
    ...tracks.filter((t) => t.languageCode === "en" && !t.kind),
    ...tracks.filter((t) => t.languageCode === "en"),
    ...tracks.filter((t) => t.languageCode?.startsWith("en")),
    tracks[0],
  ];
  // Deduplicate by baseUrl
  const seen = new Set<string>();
  const uniqueTracks = enTracks.filter((t) => {
    if (seen.has(t.baseUrl)) return false;
    seen.add(t.baseUrl);
    return true;
  });

  let capRaw = "";
  let lastError = "";
  for (const track of uniqueTracks) {
    const capUrl = track.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3";
    try {
      const capRes = await fetch(capUrl);
      if (!capRes.ok) { lastError = `HTTP ${capRes.status}`; continue; }
      const text = await capRes.text().catch(() => "");
      if (text && text.trim().length > 10) { capRaw = text; break; }
      lastError = "empty response";
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  if (!capRaw || !capRaw.trim()) {
    throw new Error(
      `No caption content could be retrieved for this video. ` +
      `YouTube may be blocking caption access from the server (last error: ${lastError}). ` +
      `Try a different video or download the audio and use the Upload tab.`
    );
  }

  let cap: { events?: Array<{ segs?: Array<{ utf8?: string }> }> } = {};
  try {
    cap = JSON.parse(capRaw);
  } catch {
    throw new Error("Failed to parse YouTube subtitle track data. The response was not valid JSON.");
  }

  const text = (cap.events || [])
    .map((e) => (e.segs || []).map((s) => s.utf8 || "").join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
  if (!text) {
    throw new Error("The subtitle track for this YouTube video contained no text content.");
  }
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

    try {
      await runGenerateNotes(context.supabase, context.userId, row.id, text);
    } catch (e) {
      console.error("notes failed", e);
    }

    return { id: row.id };
  });

// ---------- AI Notes ----------
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
  const notes = await geminiChatJSON<NotesShape>(
    `Transcript:\n\n${truncated}\n\nReturn JSON with fields: summary (2-3 paragraphs), eli5 (explain like I'm 12, plain simple English, 1 paragraph), key_points (array of 5-10 short bullet strings), glossary (array of {term, definition} for 5-10 important terms).`,
    "You are an expert study-notes generator. Return ONLY valid JSON with the exact shape requested. No prose outside JSON.",
    NotesSchema,
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

    const gen = await geminiChatJSON<FlashShape>(
      `Transcript:\n\n${text.slice(0, 20000)}\n\nGenerate 8-12 quiz flashcards. Return JSON: { "cards": [ { "question": string, "answer": string, "difficulty": "easy"|"medium"|"hard" } ] }`,
      "You generate high-quality study flashcards. Return ONLY valid JSON.",
      FlashcardSchema,
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
// ---------- RAG Transcript Helper ----------
type TranscriptChunk = {
  timestamp: string;
  seconds: number;
  text: string;
};

function buildTimestampedChunks(transcript: string, durationSeconds?: number | null): TranscriptChunk[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const totalWords = words.length;
  const totalSec = durationSeconds && durationSeconds > 0 ? durationSeconds : Math.ceil(totalWords / 2.5);
  const chunkSize = 60; // words per chunk (~24s)
  const chunks: TranscriptChunk[] = [];

  for (let i = 0; i < totalWords; i += chunkSize) {
    const chunkWords = words.slice(i, i + chunkSize);
    const fraction = i / totalWords;
    const sec = Math.floor(fraction * totalSec);
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    chunks.push({
      timestamp: `${m}:${s}`,
      seconds: sec,
      text: chunkWords.join(" "),
    });
  }
  return chunks;
}

function retrieveRAGChunks(chunks: TranscriptChunk[], query: string, topK = 5): TranscriptChunk[] {
  if (!chunks.length) return [];
  const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!queryTerms.length) return chunks.slice(0, topK);

  const scored = chunks.map((c) => {
    const textLower = c.text.toLowerCase();
    let score = 0;
    queryTerms.forEach((term) => {
      if (textLower.includes(term)) score += 1;
    });
    return { chunk: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, topK).map((s) => s.chunk);
  selected.sort((a, b) => a.seconds - b.seconds);
  return selected;
}

// ---------- Chat with RAG Citations ----------
const ChatInput = z.object({
  lecture_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export const chatWithLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ChatInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: lec } = await context.supabase
      .from("lectures")
      .select("transcript, title, duration_seconds")
      .eq("id", data.lecture_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!lec?.transcript) throw new Error("Transcript not available yet.");

    const chunks = buildTimestampedChunks(lec.transcript, lec.duration_seconds);
    const relevantChunks = retrieveRAGChunks(chunks, data.message, 6);

    const ragContext = relevantChunks
      .map((c) => `[${c.timestamp}] ${c.text}`)
      .join("\n\n");

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

    const systemPrompt = `You are an AI lecture tutor helping a student understand "${lec.title}".
Use the following retrieved transcript excerpts with timestamps to answer the student's question.
IMPORTANT: Always cite the exact timestamp bracket like [MM:SS] when stating facts from the lecture.

Retrieved Transcript Passages:
${ragContext}

If the question cannot be answered from the retrieved excerpts, give a concise answer based on general lecture context and note where relevant.`;

    const messages = [
      // Note: systemPrompt is passed to geminiChat as config.systemInstruction.
      // Do NOT include a role:"system" entry here — Gemini only accepts user/model.
      ...(history || []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: data.message },
    ];

    const reply = await geminiChat(systemPrompt, messages);

    await context.supabase.from("chat_messages").insert({
      lecture_id: data.lecture_id,
      role: "assistant",
      content: reply,
    });

    return { reply };
  });

// ---------- AI Exam Prep & Quiz Generator ----------
type ExamPrepShape = {
  title: string;
  summary: string;
  questions: Array<{
    id: number;
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
    timestamp?: string;
  }>;
};

export const generateExamPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: lec } = await context.supabase
      .from("lectures")
      .select("transcript, title, duration_seconds")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const text = lec?.transcript ?? "";
    if (text.trim().length < 20) throw new Error("Transcript not ready yet.");

    const chunks = buildTimestampedChunks(text, lec?.duration_seconds);
    const sampleChunks = chunks.slice(0, 10).map((c) => `[${c.timestamp}] ${c.text}`).join("\n");

    const gen = await geminiChatJSON<ExamPrepShape>(
      `Lecture Title: "${lec?.title}"\nTranscript Excerpts:\n${sampleChunks}\n\nGenerate an Exam Prep Quiz with 5 multiple choice practice exam questions. Include RAG explanation and cited timestamp [MM:SS] for each question. Return JSON: { "title": string, "summary": string, "questions": [ { "id": number, "question": string, "options": [string, string, string, string], "answerIndex": number (0-3), "explanation": string, "timestamp": string } ] }`,
      "You generate exam preparation quizzes with detailed RAG explanations. Return ONLY valid JSON.",
      ExamPrepSchema,
    );

    return gen;
  });

// ---------- Concept Mind Map Generator ----------
type MindMapNode = {
  label: string;
  summary: string;
  subtopics: string[];
};

type MindMapShape = {
  topic: string;
  nodes: MindMapNode[];
};

export const generateMindMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: lec } = await context.supabase
      .from("lectures")
      .select("transcript, title")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const text = lec?.transcript ?? "";
    if (text.trim().length < 20) throw new Error("Transcript not ready yet.");

    const gen = await geminiChatJSON<MindMapShape>(
      `Lecture Title: "${lec?.title}"\nTranscript:\n${text.slice(0, 15000)}\n\nExtract a hierarchical Mind Map breakdown of 4-6 major themes/concepts discussed in this lecture. Return JSON: { "topic": string, "nodes": [ { "label": string, "summary": string, "subtopics": [string, string, string] } ] }`,
      "You generate structured concept mind maps from educational content. Return ONLY valid JSON.",
      MindMapSchema,
    );

    return gen;
  });

// ---------- Revision Plan Generator ----------
type RevisionPlanShape = {
  title: string;
  total_days: number;
  daily_plan: Array<{
    day: number;
    topic: string;
    tasks: string[];
    estimated_minutes: number;
  }>;
};

export const generateRevisionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdInput.parse(v))
  .handler(async ({ data, context }) => {
    const { data: lec } = await context.supabase
      .from("lectures")
      .select("transcript, title")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const text = lec?.transcript ?? "";
    if (text.trim().length < 20) throw new Error("Transcript not ready yet.");

    const gen = await geminiChatJSON<RevisionPlanShape>(
      `Lecture Title: "${lec?.title}"\nTranscript:\n${text.slice(0, 20000)}\n\nGenerate a structured revision study plan. Return JSON: { "title": string, "total_days": number, "daily_plan": [ { "day": number, "topic": string, "tasks": [string, string, string], "estimated_minutes": number } ] }`,
      "You generate structured revision study plans for students. Return ONLY valid JSON.",
      RevisionPlanSchema,
    );

    return gen;
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

// ---------- AI provider health check ----------
/**
 * Lightweight probe: tries a minimal Gemini call to verify the key is valid
 * and the API is reachable. Returns { ok: true } or { ok: false, reason: string }.
 */
export const checkAIProvider = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = process.env.GEMINI_API_KEY?.trim();

    if (!key) {
      return { ok: false, reason: "GEMINI_API_KEY is not set. Add it to your .env file and restart the server." };
    }

    if (key.startsWith("AQ.")) {
      return {
        ok: false,
        reason:
          "The current GEMINI_API_KEY is a Lovable proxy key (AQ.…) with zero quota outside Lovable hosting. " +
          "Replace it with a Google AI Studio key from https://aistudio.google.com/app/apikey",
      };
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const probe = new GoogleGenAI({ apiKey: key });
      const res = await probe.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: "1" }] }],
        config: { maxOutputTokens: 1, temperature: 0 },
      });
      if (res.text !== undefined) return { ok: true as const, reason: null };
      return { ok: false as const, reason: "Gemini responded but returned no text." };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("403") || msg.includes("blocked")) {
        return {
          ok: false as const,
          reason:
            "Gemini API key is blocked or the Generative Language API is not enabled. " +
            "Enable it at console.cloud.google.com/apis/library/generativelanguage.googleapis.com",
        };
      }
      if (msg.includes("429")) {
        return { ok: false as const, reason: "Gemini API quota exhausted. Check your usage at ai.dev/rate-limit" };
      }
      return { ok: false as const, reason: `Gemini error: ${msg}` };
    }
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
      .select("lecture_id");

    const { data: flashcards } = await context.supabase
      .from("flashcards")
      .select("id, lecture_id, lectures!inner(user_id)")
      .eq("lectures.user_id", context.userId);

    const totalSeconds = (lectures ?? []).reduce((a, l) => a + (l.duration_seconds ?? 0), 0);
    const ready = (lectures ?? []).filter((l) => l.transcript_status === "completed").length;

    return {
      lectureCount: lectures?.length ?? 0,
      hours: +(totalSeconds / 3600).toFixed(1),
      notesCount: notes?.length ?? 0,
      flashcardsCount: flashcards?.length ?? 0,
      readyCount: ready,
      recent: (lectures ?? []).slice(0, 5),
    };
  });

// ---------- Analytics data ----------
export const getAnalyticsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: lectures } = await context.supabase
      .from("lectures")
      .select("id, title, duration_seconds, transcript_status, created_at, course_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });

    const { data: notes } = await context.supabase
      .from("lecture_notes")
      .select("lecture_id");

    const { data: flashcards } = await context.supabase
      .from("flashcards")
      .select("id, difficulty, lecture_id, lectures!inner(user_id)")
      .eq("lectures.user_id", context.userId);

    const { data: courses } = await context.supabase
      .from("courses")
      .select("id, title")
      .eq("user_id", context.userId);

    const statusCounts = [
      { name: "Completed", value: 0, color: "#10B981" },
      { name: "Processing", value: 0, color: "#3B82F6" },
      { name: "Pending", value: 0, color: "#F59E0B" },
      { name: "Failed", value: 0, color: "#EF4444" },
      { name: "Idle", value: 0, color: "#6B7280" },
    ];

    (lectures ?? []).forEach((l) => {
      const s = (l.transcript_status || "idle").toLowerCase();
      if (s === "completed") statusCounts[0].value++;
      else if (s === "processing") statusCounts[1].value++;
      else if (s === "pending") statusCounts[2].value++;
      else if (s === "failed") statusCounts[3].value++;
      else statusCounts[4].value++;
    });

    const courseMap: Record<string, { name: string; count: number }> = {};
    (courses ?? []).forEach((c) => {
      courseMap[c.id] = { name: c.title, count: 0 };
    });
    let uncategorized = 0;
    (lectures ?? []).forEach((l) => {
      if (l.course_id && courseMap[l.course_id]) {
        courseMap[l.course_id].count++;
      } else {
        uncategorized++;
      }
    });

    const courseDistribution = Object.values(courseMap).filter((c) => c.count > 0);
    if (uncategorized > 0) {
      courseDistribution.push({ name: "Uncategorized", count: uncategorized });
    }

    const difficultyBreakdown = [
      { name: "Easy", count: 0, color: "#10B981" },
      { name: "Medium", count: 0, color: "#F59E0B" },
      { name: "Hard", count: 0, color: "#EF4444" },
    ];
    (flashcards ?? []).forEach((f) => {
      const d = (f.difficulty || "medium").toLowerCase();
      if (d === "easy") difficultyBreakdown[0].count++;
      else if (d === "hard") difficultyBreakdown[2].count++;
      else difficultyBreakdown[1].count++;
    });

    const totalSeconds = (lectures ?? []).reduce((a, l) => a + (l.duration_seconds ?? 0), 0);

    const timelineMap: Record<string, { date: string; lectures: number; durationMinutes: number }> = {};
    (lectures ?? []).forEach((l) => {
      const dateStr = new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!timelineMap[dateStr]) {
        timelineMap[dateStr] = { date: dateStr, lectures: 0, durationMinutes: 0 };
      }
      timelineMap[dateStr].lectures += 1;
      timelineMap[dateStr].durationMinutes += Math.round((l.duration_seconds ?? 0) / 60);
    });

    return {
      totalLectures: lectures?.length ?? 0,
      totalHours: +(totalSeconds / 3600).toFixed(1),
      notesCount: notes?.length ?? 0,
      flashcardsCount: flashcards?.length ?? 0,
      statusCounts: statusCounts.filter((s) => s.value > 0),
      courseDistribution,
      difficultyBreakdown,
      activityTimeline: Object.values(timelineMap).slice(-10),
    };
  });

