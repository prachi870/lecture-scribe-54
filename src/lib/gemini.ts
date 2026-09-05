/**
 * AI Provider — Groq (primary) + Gemini (fallback)
 *
 * Groq:
 *   - Chat / Notes / Flashcards / Exam / MindMap / Revision / Chat-RAG
 *     → qwen/qwen3.8-27b  (OpenAI-compatible, ~14,400 req/day free)
 *   - Audio Transcription
 *     → whisper-large-v3-turbo  (purpose-built STT, 20 audio files/hour free)
 *
 * Gemini (fallback when GROQ_API_KEY is absent):
 *   - gemini-3.5-flash / gemini-3.6-flash  (20–100 req/day free)
 *
 * Priority:  GROQ_API_KEY > GEMINI_API_KEY
 */

import Groq from "groq-sdk";
import { GoogleGenAI, Type } from "@google/genai";

// ── Provider instances (lazy) ─────────────────────────────────────────────
let _groq: Groq | null = null;
let _gemini: GoogleGenAI | null = null;

function getGroq(): Groq {
  if (_groq) return _groq;
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("NO_GROQ");
  _groq = new Groq({ apiKey: key });
  return _groq;
}

function getGemini(): GoogleGenAI {
  if (_gemini) return _gemini;
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("AI_PROVIDER_NOT_CONFIGURED: Set GROQ_API_KEY or GEMINI_API_KEY in .env");
  _gemini = new GoogleGenAI({ apiKey: key });
  return _gemini;
}

// Gemini model rotation (fallback when Groq unavailable)
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];
const GROQ_CHAT_MODEL = "qwen/qwen3.8-27b";
const GROQ_TRANSCRIBE_MODEL = "whisper-large-v3-turbo";

// ── JSON structured output via Groq ──────────────────────────────────────
async function groqJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
  const completion = await getGroq().chat.completions.create({
    model: GROQ_CHAT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: 900,   // Groq free tier: 1000 output tokens/min limit — stay under safely
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty Groq response");
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Groq response was not valid JSON");
  }
}

// ── JSON structured output via Gemini (fallback) ──────────────────────────
async function geminiJSONWithRotation<T>(
  prompt: string,
  systemPrompt: string,
  schema: Record<string, unknown>,
): Promise<T> {
  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await getGemini().models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema as never,
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });
      const content = response.text?.trim() ?? "";
      if (!content) throw new Error("Empty Gemini response");
      try { return JSON.parse(content) as T; }
      catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]) as T;
        throw new Error("Gemini response was not valid JSON");
      }
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429")) { console.warn(`[Gemini] ${model} quota hit, trying next`); continue; }
      if (msg.includes("403") || msg.includes("blocked")) {
        throw new Error("Gemini API key blocked. Set GROQ_API_KEY in .env for unlimited usage.");
      }
      throw err;
    }
  }
  throw new Error("All Gemini models quota exhausted. Add GROQ_API_KEY to .env for unlimited usage.");
}

// ── Chat via Groq ─────────────────────────────────────────────────────────
async function groqChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const msgs: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
  ];
  const completion = await getGroq().chat.completions.create({
    model: GROQ_CHAT_MODEL,
    messages: msgs,
    max_tokens: 900,   // Groq free tier: 1000 output tokens/min — stay safe
    temperature: 0.7,
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty Groq chat response");
  return text;
}

// ── Chat via Gemini (fallback) ────────────────────────────────────────────
async function geminiChatInternal(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
          parts: [{ text: m.content }],
        }));
      const response = await getGemini().models.generateContent({
        model,
        contents,
        config: { systemInstruction: systemPrompt, temperature: 0.7, maxOutputTokens: 4096 },
      });
      const text = response.text?.trim() ?? "";
      if (!text) throw new Error("Empty Gemini response");
      return text;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429")) { continue; }
      throw err;
    }
  }
  throw lastErr as Error;
}

// ── Transcription via Groq Whisper ────────────────────────────────────────
async function groqTranscribe(audioBlob: Blob, fileName: string): Promise<string> {
  // Groq Whisper expects a File object with a name
  const ext = fileName.split(".").pop() || "webm";
  const file = new File([audioBlob], `audio.${ext}`, { type: audioBlob.type || "audio/webm" });
  const transcription = await getGroq().audio.transcriptions.create({
    file,
    model: GROQ_TRANSCRIBE_MODEL,
    response_format: "text",
  });
  const text = (transcription as unknown as string).trim();
  if (!text) throw new Error("Empty Whisper transcription");
  return text;
}

// ── Transcription via Gemini (fallback) ───────────────────────────────────
const MAX_AUDIO_BYTES = 18 * 1024 * 1024;

async function geminiTranscribeWithRotation(audioBlob: Blob, fileName: string): Promise<string> {
  const transcribeChunk = async (chunk: Blob, model: string, segLabel: string): Promise<string> => {
    const buf = await chunk.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const response = await getGemini().models.generateContent({
      model,
      contents: [{
        role: "user",
        parts: [
          { text: `Transcribe this audio${segLabel} accurately. Return only the transcribed text.` },
          { inlineData: { mimeType: chunk.type || "audio/webm", data: base64 } },
        ],
      }],
      config: { temperature: 0.1, maxOutputTokens: 32768 },
    });
    return response.text?.trim() ?? "";
  };

  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      if (audioBlob.size <= MAX_AUDIO_BYTES) {
        const text = await transcribeChunk(audioBlob, model, "");
        if (text) return text;
        throw new Error("Empty transcription");
      }
      // Chunk large files
      const chunks: Blob[] = [];
      for (let offset = 0; offset < audioBlob.size; offset += MAX_AUDIO_BYTES) {
        chunks.push(audioBlob.slice(offset, Math.min(offset + MAX_AUDIO_BYTES, audioBlob.size)));
      }
      const parts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const t = await transcribeChunk(chunks[i], model, ` (segment ${i + 1}/${chunks.length})`);
        if (t) parts.push(t);
      }
      if (!parts.length) throw new Error("No transcription segments");
      return parts.join("\n\n");
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429")) { continue; }
      throw err;
    }
  }
  throw lastErr as Error;
}

// ── Public API ────────────────────────────────────────────────────────────
// These are the functions called by lectures.functions.ts.
// They automatically use Groq if available, falling back to Gemini.

export async function geminiChatJSON<T>(
  prompt: string,
  systemPrompt: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try { return await groqJSON<T>(prompt, systemPrompt); }
    catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "NO_GROQ") return geminiJSONWithRotation<T>(prompt, systemPrompt, schema);
      // Groq rate limit → fall through to Gemini
      if (msg.includes("429") || msg.includes("rate_limit")) {
        console.warn("[Groq] rate limit hit, falling back to Gemini");
        return geminiJSONWithRotation<T>(prompt, systemPrompt, schema);
      }
      throw err;
    }
  }
  return geminiJSONWithRotation<T>(prompt, systemPrompt, schema);
}

export async function geminiChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try { return await groqChat(systemPrompt, messages); }
    catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "NO_GROQ") return geminiChatInternal(systemPrompt, messages);
      if (msg.includes("429") || msg.includes("rate_limit")) {
        return geminiChatInternal(systemPrompt, messages);
      }
      throw err;
    }
  }
  return geminiChatInternal(systemPrompt, messages);
}

export async function geminiTranscribe(audioBlob: Blob, fileName: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try { return await groqTranscribe(audioBlob, fileName); }
    catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "NO_GROQ") return geminiTranscribeWithRotation(audioBlob, fileName);
      if (msg.includes("429") || msg.includes("rate_limit")) {
        console.warn("[Groq Whisper] rate limit, falling back to Gemini");
        return geminiTranscribeWithRotation(audioBlob, fileName);
      }
      throw err;
    }
  }
  return geminiTranscribeWithRotation(audioBlob, fileName);
}

// ── JSON Schemas (unchanged — used by lectures.functions.ts) ─────────────

export const NotesSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "2-3 paragraphs summarizing the lecture" },
    eli5: { type: Type.STRING, description: "Explain like I'm 12, plain simple English, 1 paragraph" },
    key_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5-10 short bullet point strings",
    },
    glossary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING },
        },
        required: ["term", "definition"],
      },
      description: "5-10 important terms with definitions",
    },
  },
  required: ["summary", "eli5", "key_points", "glossary"],
};

export const FlashcardSchema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
        },
        required: ["question", "answer", "difficulty"],
      },
    },
  },
  required: ["cards"],
};

export const ExamPrepSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answerIndex: { type: Type.INTEGER, description: "0-3" },
          explanation: { type: Type.STRING },
          timestamp: { type: Type.STRING },
        },
        required: ["id", "question", "options", "answerIndex", "explanation"],
      },
    },
  },
  required: ["title", "summary", "questions"],
};

export const MindMapSchema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          summary: { type: Type.STRING },
          subtopics: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["label", "summary", "subtopics"],
      },
    },
  },
  required: ["topic", "nodes"],
};

export const RevisionPlanSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    total_days: { type: Type.INTEGER },
    daily_plan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.INTEGER },
          topic: { type: Type.STRING },
          tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
          estimated_minutes: { type: Type.INTEGER },
        },
        required: ["day", "topic", "tasks", "estimated_minutes"],
      },
    },
  },
  required: ["title", "total_days", "daily_plan"],
};
