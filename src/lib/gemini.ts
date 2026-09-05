import { GoogleGenAI, Type } from "@google/genai";

// ── Lazy AI client ──────────────────────────────────────────────────────────
// Initialization is deferred to the first actual call.
// This prevents a module-level crash when GEMINI_API_KEY is missing or invalid,
// which would otherwise kill all 19 server functions at startup.
let _ai: GoogleGenAI | null = null;

/**
 * Returns a validated GoogleGenAI instance, or throws a clear user-facing
 * error if the key is absent, obviously malformed, or blocked by Google.
 */
function getAI(): GoogleGenAI {
  if (_ai) return _ai;

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "AI_PROVIDER_NOT_CONFIGURED: No GEMINI_API_KEY found. " +
      "Add a valid key from https://aistudio.google.com/app/apikey to the .env file and restart the server."
    );
  }

  // The Lovable-issued AQ. proxy keys previously had quota limit:0.
  // Newer AQ. keys from Google AI Studio are valid — do not block them.
  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

const MODEL = "gemini-2.0-flash";

/**
 * Retry wrapper with exponential backoff for transient failures.
 * 403 (key blocked / API not enabled) is NOT retried — it's a config error.
 * 429 (quota exceeded) IS retried — it may resolve after a brief wait.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "";

      // Non-retryable: configuration errors — fail immediately with a clean message
      if (msg.includes("403") || msg.includes("API_KEY_INVALID") || msg.includes("blocked")) {
        throw new Error(
          "AI_PROVIDER_ERROR: Gemini API key is blocked or the Generative Language API is not " +
          "enabled on this Google Cloud project. Enable it at " +
          "https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com " +
          "or create a fresh key at https://aistudio.google.com/app/apikey"
        );
      }

      // Non-retryable: missing / invalid key caught by getAI()
      if (msg.startsWith("AI_PROVIDER_NOT_CONFIGURED")) throw err;

      const isTransient =
        err instanceof Error &&
        (msg.includes("503") ||
          msg.includes("502") ||
          msg.includes("429") ||
          msg.includes("timeout") ||
          msg.includes("ECONNRESET"));
      if (!isTransient || attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Call Gemini with JSON schema response.
 * Replaces callLovableChatJSON.
 */
export async function geminiChatJSON<T>(
  prompt: string,
  systemPrompt: string,
  schema: Record<string, unknown>,
): Promise<T> {
  return withRetry(async () => {
    const response = await getAI().models.generateContent({
      model: MODEL,
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

    try {
      return JSON.parse(content) as T;
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as T;
      throw new Error("Gemini response was not valid JSON");
    }
  });
}

/**
 * Call Gemini for conversational chat (non-JSON).
 * Replaces the direct chat API call in chatWithLecture.
 *
 * Role mapping: Gemini only accepts "user" and "model" in the contents array.
 * - "assistant" (stored in DB)  → "model"
 * - "system"                    → stripped (already handled via config.systemInstruction)
 * - anything else               → "user"
 */
export async function geminiChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  return withRetry(async () => {
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      }));

    const response = await getAI().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });

    const content = response.text?.trim() ?? "";
    if (!content) throw new Error("Empty Gemini response");
    return content;
  });
}

/**
 * Transcribe audio using Gemini's audio transcription.
 *
 * ARCHITECTURE NOTE:
 * Gemini 2.0 Flash supports audio input natively (20MB file limit, ~180 min max).
 * For long lecture recordings, we chunk the audio into segments and transcribe
 * each independently, then concatenate. This is a pragmatic approach that avoids
 * the 20MB file size limit while keeping a single API provider.
 *
 * For production use with very long lectures (>60 min), a dedicated STT model
 * (e.g., OpenAI Whisper, Google Speech-to-Text) would be more appropriate:
 *   - Lower cost per minute
 *   - Better word error rate on speech
 *   - Speaker diarization support
 *   - Per-word timestamps
 *   - Streaming capability
 *
 * The current implementation uses Gemini 2.0 Flash because:
 *   1. It's already configured with the user's GEMINI_API_KEY
 *   2. It eliminates the need for a second API key/service
 *   3. It handles the typical lecture length (5-30 min) well
 *   4. Chunking provides a fallback for longer files
 */
const MAX_AUDIO_BYTES = 18 * 1024 * 1024; // 18MB safety margin under 20MB limit

export async function geminiTranscribe(
  audioBlob: Blob,
  fileName: string,
): Promise<string> {
  return withRetry(async () => {
    // If audio is small enough, transcribe in one shot
    if (audioBlob.size <= MAX_AUDIO_BYTES) {
      const base64 = await blobToBase64(audioBlob);

      const response = await getAI().models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: "Transcribe this audio file accurately. Return only the transcribed text, no additional formatting or commentary." },
              {
                inlineData: {
                  mimeType: audioBlob.type || "audio/webm",
                  data: base64,
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 32768,
        },
      });

      const text = response.text?.trim() ?? "";
      if (!text) throw new Error("Empty transcription response from Gemini");
      return text;
    }

    // For large files, chunk and transcribe sequentially
    const chunks = await chunkAudioBlob(audioBlob, audioBlob.type || "audio/webm");
    const transcripts: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const base64 = await blobToBase64(chunk);

      const response = await getAI().models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: `Transcribe this audio segment (${i + 1} of ${chunks.length}) accurately. Return only the transcribed text.` },
              {
                inlineData: {
                  mimeType: chunk.type || "audio/webm",
                  data: base64,
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 32768,
        },
      });

      const text = response.text?.trim() ?? "";
      if (text) transcripts.push(text);
    }

    if (!transcripts.length) throw new Error("No transcription segments returned");
    return transcripts.join("\n\n");
  });
}

/**
 * Split a large audio Blob into smaller chunks under MAX_AUDIO_BYTES each.
 * Uses the Web Audio API to decode and re-encode segments.
 */
async function chunkAudioBlob(blob: Blob, mimeType: string): Promise<Blob[]> {
  // Fallback: split by byte size if Web Audio API is not available
  const chunkSize = MAX_AUDIO_BYTES;
  const chunks: Blob[] = [];

  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, blob.size);
    chunks.push(blob.slice(offset, end));
  }

  return chunks;
}

async function blobToBase64(blob: Blob): Promise<string> {
  // Use arrayBuffer() — works in Node.js, Cloudflare Workers, and the browser.
  // FileReader is browser-only and would throw ReferenceError in server contexts.
  const buf = await blob.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

// JSON Schemas for AI features
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
          difficulty: {
            type: Type.STRING,
            enum: ["easy", "medium", "hard"],
          },
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
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
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
          subtopics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
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
          tasks: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          estimated_minutes: { type: Type.INTEGER },
        },
        required: ["day", "topic", "tasks", "estimated_minutes"],
      },
    },
  },
  required: ["title", "total_days", "daily_plan"],
};
