import { GoogleGenAI, Type } from "@google/genai";

let _ai: GoogleGenAI | null = null;

type AIProvider = "gemini" | "openai" | "huggingface";
type TranscriptionProvider = "huggingface" | AIProvider;

function getProvider(): AIProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "openai" || explicit === "gemini" || explicit === "huggingface") return explicit as AIProvider;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.HUGGINGFACE_API_KEY) return "huggingface" as AIProvider;
  return "gemini";
}

function getTranscriptionProvider(): TranscriptionProvider {
  const explicit = process.env.TRANSCRIPTION_PROVIDER?.trim().toLowerCase();
  if (explicit === "huggingface" || explicit === "openai" || explicit === "gemini") {
    return explicit as TranscriptionProvider;
  }
  if (process.env.HUGGINGFACE_API_KEY) return "huggingface";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "gemini";
}

const AI_PROVIDER = getProvider();
const TRANSCRIPTION_PROVIDER = getTranscriptionProvider();
const GEMINI_MODEL = "gemini-2.0-flash";
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
const HUGGINGFACE_TRANSCRIBE_MODEL = process.env.HUGGINGFACE_TRANSCRIBE_MODEL?.trim() || "openai/whisper-small";
// Hugging Face generation model (configurable)
const HUGGINGFACE_GENERATE_MODEL = process.env.HUGGINGFACE_GENERATE_MODEL?.trim() || "gpt2";

function getAi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  if (!_ai) _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

function getOpenAiApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY environment variable for OpenAI provider");
  }
  return key;
}

function normalizeOpenAiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
  return cleaned;
}

function getOpenAiHeaders(contentType?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getOpenAiApiKey()}`,
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

function getHuggingFaceApiKey() {
  const key = process.env.HUGGINGFACE_API_KEY?.trim();
  if (!key) {
    throw new Error("Missing HUGGINGFACE_API_KEY environment variable for Hugging Face transcription");
  }
  return key;
}

async function huggingfaceRequest(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const text = await response.text();
  if (!response.ok) {
    let message = `Hugging Face request failed with status ${response.status}`;
    try {
      const json = JSON.parse(text);
      message = json.error?.message ?? JSON.stringify(json);
    } catch {
      if (text) message = text;
    }
    const err: any = new Error(message);
    err.status = response.status;
    err.responseText = text;
    throw err;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }
  return text;
}

async function huggingfaceTranscribeBlob(audioBlob: Blob, fileName: string): Promise<string> {
  const model = HUGGINGFACE_TRANSCRIBE_MODEL;
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
  const response = await huggingfaceRequest(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getHuggingFaceApiKey()}`,
      "Content-Type": audioBlob.type || "audio/wav",
      Accept: "text/plain",
    },
    body: audioBlob,
  });

  if (typeof response === "string") {
    const text = response.trim();
    if (!text) throw new Error("Empty Hugging Face transcription response");
    return text;
  }

  if (typeof response === "object" && response !== null) {
    if (typeof (response as any).text === "string") {
      const text = ((response as any).text as string).trim();
      if (!text) throw new Error("Empty Hugging Face transcription response");
      return text;
    }
  }

  throw new Error("Unexpected Hugging Face transcription response format");
}

/**
 * Minimal Hugging Face text-generation helper using Inference API.
 * Returns the generated text string.
 */
async function huggingfaceTextGenerate(model: string, prompt: string, parameters?: Record<string, any>): Promise<string> {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
  const bodyPayload: any = { inputs: prompt };
  if (parameters && Object.keys(parameters).length) bodyPayload.parameters = parameters;

  const resp = await withRetry(() => huggingfaceRequest(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getHuggingFaceApiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(bodyPayload),
  }), 2);

  // resp may be string or JSON. Normalize to string.
  if (typeof resp === "string") {
    return resp.trim();
  }
  const r: any = resp as any;
  // Common shapes: { generated_text }, [{ generated_text }], { text }
  if (typeof r.generated_text === "string") return r.generated_text.trim();
  if (Array.isArray(r) && r[0] && typeof r[0].generated_text === "string") return r[0].generated_text.trim();
  if (typeof r.text === "string") return r.text.trim();
  if (typeof r[0]?.text === "string") return r[0].text.trim();

  // As a last resort, stringify the response if it's small
  try {
    const asString = JSON.stringify(r);
    if (asString && asString.length < 2000) return asString;
  } catch {}

  throw new Error("Unexpected Hugging Face generation response format");
}

/**
 * Retry wrapper with exponential backoff for transient failures.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isTransient =
        err instanceof Error &&
        (err.message.includes("503") ||
          err.message.includes("502") ||
          err.message.includes("429") ||
          err.message.includes("timeout") ||
          err.message.includes("ECONNRESET"));
      if (!isTransient || attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function openaiRequest(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!response.ok) {
    let message = `OpenAI request failed with status ${response.status}`;
    try {
      const json = JSON.parse(text);
      message = json.error?.message ?? JSON.stringify(json);
    } catch {
      if (text) message = text;
    }
    const err: any = new Error(message);
    err.status = response.status;
    err.responseText = text;
    throw err;
  }
  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }
  return text;
}

function openaiChatPromptForSchema(prompt: string, schema: Record<string, unknown>) {
  const schemaJson = JSON.stringify(schema, null, 2);
  return `${prompt}\n\nRespond only with valid JSON strictly matching this schema:\n${schemaJson}\nDo not add any markdown, comments, or extra text.`;
}

async function openaiChatJSON<T>(prompt: string, systemPrompt: string, schema: Record<string, unknown>): Promise<T> {
  const openAiPayload = {
    model: OPENAI_CHAT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: openaiChatPromptForSchema(prompt, schema) },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  } as const;

  const response = await openaiRequest("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: getOpenAiHeaders("application/json"),
    body: JSON.stringify(openAiPayload),
  });

  const text = String(response?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Empty OpenAI response");

  const cleaned = normalizeOpenAiJson(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("OpenAI response was not valid JSON");
  }
}

async function openaiChat(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const response = await openaiRequest("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: getOpenAiHeaders("application/json"),
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  const text = String(response?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Empty OpenAI chat response");
  return text;
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
  if (AI_PROVIDER === "openai") {
    return withRetry(async () => openaiChatJSON<T>(prompt, systemPrompt, schema));
  }

  if (AI_PROVIDER === "huggingface") {
    // Build a strong prompt requesting strict JSON
    const hfPrompt = `${systemPrompt}\n\n${openaiChatPromptForSchema(prompt, schema)}`;
    const model = HUGGINGFACE_GENERATE_MODEL;
    // Try generation and parse JSON robustly
    const mod = await import('./hf-gen');
    const raw = await withRetry(() => mod.huggingfaceTextGenerate(model, hfPrompt, { max_new_tokens: 512 }), 2);
    const cleaned = normalizeOpenAiJson(raw);
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as T;
      throw new Error("Hugging Face response was not valid JSON");
    }
  }

  return withRetry(async () => {
    const response = await getAi().models.generateContent({
      model: GEMINI_MODEL,
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
 */
export async function geminiChat(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  if (AI_PROVIDER === "openai") {
    return withRetry(async () => openaiChat(systemPrompt, messages));
  }

  if (AI_PROVIDER === "huggingface") {
    // Concatenate system + messages into a single prompt for HF models
    const combined = [systemPrompt, ...messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`)].join("\n\n");
    const model = HUGGINGFACE_GENERATE_MODEL;
    const mod = await import('./hf-gen');
    const raw = await withRetry(() => mod.huggingfaceTextGenerate(model, combined, { max_new_tokens: 512 }), 2);
    return raw.trim();
  }

  return withRetry(async () => {
    const contents = messages.map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const response = await getAi().models.generateContent({
      model: GEMINI_MODEL,
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
 * The current implementation supports Gemini by default, but can also use OpenAI
 * when OPENAI_API_KEY is present or AI_PROVIDER=openai is configured.
 */
const MAX_AUDIO_BYTES = 18 * 1024 * 1024; // 18MB safety margin under 20MB limit

async function openaiTranscribeBlob(audioBlob: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.set("model", OPENAI_TRANSCRIBE_MODEL);
  form.set("file", audioBlob, fileName || "audio.wav");
  const response = await openaiRequest("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: getOpenAiHeaders(),
    body: form,
  });

  const text = String(response?.text ?? "").trim();
  if (!text) throw new Error("Empty OpenAI transcription response");
  return text;
}

export async function geminiTranscribe(
  audioBlob: Blob,
  fileName: string,
): Promise<string> {
  async function callGenerateWithRetries(contents: any[], config: any, timeoutMs = 60000, retries = 2) {
    return withRetry(async () => {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("AI request timed out")), timeoutMs));
      if (AI_PROVIDER === "openai") {
        const response = await openaiChat("", [{ role: "user", content: contents[0]?.parts?.[0]?.text ?? "" }]);
        return { text: response } as any;
      }
      const genPromise = getAi().models.generateContent({ model: GEMINI_MODEL, contents, config });
      return Promise.race([genPromise, timeout]) as Promise<any>;
    }, retries);
  }

  if (TRANSCRIPTION_PROVIDER === "huggingface") {
    if (audioBlob.size <= MAX_AUDIO_BYTES) {
      return withRetry(async () => {
        const mod = await import("./hf-gen");
        return mod.huggingfaceTranscribeBlob(audioBlob, fileName);
      }, 3);
    }

    const chunks = await chunkAudioBlob(audioBlob, audioBlob.type || "audio/webm");
    const transcripts: string[] = [];
    const failedChunks: number[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const text = await withRetry(
          async () => {
          const mod = await import("./hf-gen");
          return mod.huggingfaceTranscribeBlob(chunk, `${fileName.replace(/\.[^/.]+$/, "")}-${i + 1}.wav`);
        },
          2,
        );
        if (text) transcripts.push(text);
        else {
          failedChunks.push(i);
          transcripts.push(`[Transcription segment ${i + 1} returned empty]`);
        }
      } catch (err) {
        console.error(`Chunk ${i + 1} transcription failed:`, err instanceof Error ? err.message : err);
        failedChunks.push(i);
        transcripts.push(`[Transcription segment ${i + 1} failed after retries]`);
      }
    }

    if (!transcripts.length || transcripts.every((t) => t.startsWith("[Transcription segment"))) {
      throw new Error("All transcription segments failed");
    }

    const final = transcripts.join("\n\n");
    if (failedChunks.length) {
      const errMsg = `Transcription completed with ${failedChunks.length} failed segments: ${failedChunks.join(", ")}`;
      return `${final}\n\n[NOTE: ${errMsg}]`;
    }

    return final;
  }

  if (AI_PROVIDER === "openai") {
    if (audioBlob.size <= MAX_AUDIO_BYTES) {
      return withRetry(() => openaiTranscribeBlob(audioBlob, fileName), 3);
    }

    const chunks = await chunkAudioBlob(audioBlob, audioBlob.type || "audio/webm");
    const transcripts: string[] = [];
    const failedChunks: number[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const text = await withRetry(() => openaiTranscribeBlob(chunk, `${fileName.replace(/\.[^/.]+$/, "")}-${i + 1}.wav`), 2);
        if (text) transcripts.push(text);
        else {
          failedChunks.push(i);
          transcripts.push(`[Transcription segment ${i + 1} returned empty]`);
        }
      } catch (err) {
        console.error(`Chunk ${i + 1} transcription failed:`, err instanceof Error ? err.message : err);
        failedChunks.push(i);
        transcripts.push(`[Transcription segment ${i + 1} failed after retries]`);
      }
    }

    if (!transcripts.length || transcripts.every((t) => t.startsWith("[Transcription segment"))) {
      throw new Error("All transcription segments failed");
    }

    const final = transcripts.join("\n\n");
    if (failedChunks.length) {
      const errMsg = `Transcription completed with ${failedChunks.length} failed segments: ${failedChunks.join(", ")}`;
      return `${final}\n\n[NOTE: ${errMsg}]`;
    }

    return final;
  }

  // Single-shot small audio
  if (audioBlob.size <= MAX_AUDIO_BYTES) {
    const base64 = await blobToBase64(audioBlob);
    const contents = [
      {
        role: "user",
        parts: [
          { text: "Transcribe this audio file accurately. Return only the transcribed text, no additional formatting or commentary." },
          { inlineData: { mimeType: audioBlob.type || "audio/webm", data: base64 } },
        ],
      },
    ];

    const response = await callGenerateWithRetries(contents, { temperature: 0.1, maxOutputTokens: 32768 }, 120000, 3);
    const text = response?.text?.trim() ?? "";
    if (!text) throw new Error("Empty transcription response from Gemini");
    return text;
  }

  // For large files, chunk and transcribe sequentially with per-chunk retries
  const chunks = await chunkAudioBlob(audioBlob, audioBlob.type || "audio/webm");
  const transcripts: string[] = [];
  const failedChunks: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let base64: string;
    try {
      base64 = await blobToBase64(chunk);
    } catch (err) {
      failedChunks.push(i);
      transcripts.push(`[Transcription segment ${i + 1} failed: blob conversion error]`);
      continue;
    }

    const contents = [
      {
        role: "user",
        parts: [
          { text: `Transcribe this audio segment (${i + 1} of ${chunks.length}) accurately. Return only the transcribed text.` },
          { inlineData: { mimeType: chunk.type || "audio/webm", data: base64 } },
        ],
      },
    ];

    try {
      const response = await callGenerateWithRetries(contents, { temperature: 0.1, maxOutputTokens: 32768 }, 120000, 2);
      const text = response?.text?.trim() ?? "";
      if (text) transcripts.push(text);
      else {
        failedChunks.push(i);
        transcripts.push(`[Transcription segment ${i + 1} returned empty]`);
      }
    } catch (err) {
      console.error(`Chunk ${i + 1} transcription failed:`, err instanceof Error ? err.message : err);
      failedChunks.push(i);
      transcripts.push(`[Transcription segment ${i + 1} failed after retries]`);
    }
  }

  if (!transcripts.length || transcripts.every((t) => t.startsWith("[Transcription segment"))) {
    throw new Error("All transcription segments failed");
  }

  const final = transcripts.join("\n\n");
  if (failedChunks.length) {
    const errMsg = `Transcription completed with ${failedChunks.length} failed segments: ${failedChunks.join(", ")}`;
    return `${final}\n\n[NOTE: ${errMsg}]`;
  }

  return final;
}

/**
 * Split a large audio Blob into smaller chunks under MAX_AUDIO_BYTES each.
 * Uses the Web Audio API to decode and re-encode segments.
 */
export async function chunkAudioBlob(blob: Blob, mimeType: string): Promise<Blob[]> {
  // Prefer decoding and re-encoding segments using the Web Audio API when available
  // This avoids corrupting container headers when slicing raw bytes.
  if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    const sampleRate = audioBuffer.sampleRate;
    const channelData = [] as Float32Array[];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channelData.push(audioBuffer.getChannelData(c));
    }

    // target size per chunk in seconds, approximate from MAX_AUDIO_BYTES
    // estimate bytes per second: sampleRate * channels * 2 (16-bit)
    const bytesPerSecond = sampleRate * audioBuffer.numberOfChannels * 2;
    const targetSeconds = Math.floor(MAX_AUDIO_BYTES / Math.max(1, bytesPerSecond));
    const segments: Blob[] = [];
    if (targetSeconds <= 0) {
      // fallback to single chunk
      segments.push(blob);
      return segments;
    }

    const totalSeconds = Math.ceil(audioBuffer.length / sampleRate);
    let offsetSec = 0;
    while (offsetSec < totalSeconds) {
      const startSample = offsetSec * sampleRate;
      const endSample = Math.min(audioBuffer.length, (offsetSec + targetSeconds) * sampleRate);
      const frames = endSample - startSample;

      // interleave channels into 16-bit PCM
      const interleaved = new Int16Array(frames * audioBuffer.numberOfChannels);
      for (let i = 0; i < frames; i++) {
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const sample = channelData[ch][startSample + i] || 0;
          // clamp
          const s = Math.max(-1, Math.min(1, sample));
          interleaved[i * audioBuffer.numberOfChannels + ch] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
      }

      // encode WAV
      const wavBlob = encodeWAV(interleaved, audioBuffer.numberOfChannels, sampleRate);
      segments.push(wavBlob);
      offsetSec += targetSeconds;
    }

    // close AudioContext where possible
    try {
      if (typeof ctx.close === 'function') await ctx.close();
    } catch {}

    return segments;
  }

  // Server or no Web Audio API: attempt server-side re-encoding and segmentation using ffmpeg
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs');
      const os = await import('os');
      const pathMod = await import('path');
      const ffmpegStatic = await import('ffmpeg-static');
      const ffmpegModule = await import('fluent-ffmpeg');
      const ffmpeg = ffmpegModule?.default || ffmpegModule;
      ffmpeg.setFfmpegPath(ffmpegStatic.default || ffmpegStatic);

      const tmpDir = await fs.promises.mkdtemp(pathMod.join(os.tmpdir(), 'aud-'));
      const inPath = pathMod.join(tmpDir, 'in');
      const buf = Buffer.from(await (blob as any).arrayBuffer());
      await fs.promises.writeFile(inPath, buf);

      // Rough estimate for segment duration: assume 16kHz mono 16-bit PCM if we can't probe.
      const bytesPerSecondEstimate = 16000 * 1 * 2; // sampleRate * channels * bytesPerSample
      let targetSeconds = Math.max(10, Math.floor(MAX_AUDIO_BYTES / Math.max(1, bytesPerSecondEstimate)));
      // Cap targetSeconds to a reasonable upper bound
      if (targetSeconds > 300) targetSeconds = 300;

      const outPattern = pathMod.join(tmpDir, 'out%03d.wav');

      await new Promise((resolve, reject) => {
        ffmpeg(inPath)
          .outputOptions([
            '-f', 'segment',
            '-segment_time', String(targetSeconds),
            '-c:a', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
          ])
          .output(outPattern)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Read generated files
      const files = await fs.promises.readdir(tmpDir);
      const wavFiles = files.filter((f) => f.startsWith('out') && f.endsWith('.wav')).sort();
      const result: Blob[] = [];
      for (const wf of wavFiles) {
        const p = pathMod.join(tmpDir, wf);
        const data = await fs.promises.readFile(p);
        // Node 18+ has global Blob
        const nodeBlob = new Blob([data], { type: 'audio/wav' });
        result.push(nodeBlob);
      }

      // cleanup
      try {
        for (const f of files) await fs.promises.unlink(pathMod.join(tmpDir, f));
        await fs.promises.rmdir(tmpDir);
      } catch {}

      if (result.length) return result;
    } catch (err) {
      // if ffmpeg segmentation fails for any reason, fallback to byte-slicing below
      console.error('ffmpeg segmentation failed, falling back to byte-slice:', err instanceof Error ? err.message : err);
    }
  }

  // Byte-slice fallback (best-effort)
  const chunkSize = MAX_AUDIO_BYTES;
  const chunks: Blob[] = [];

  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, blob.size);
    chunks.push(blob.slice(offset, end));
  }

  return chunks;
}

function encodeWAV(interleaved: Int16Array, numChannels: number, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteLength = 44 + interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  let offset = 0;

  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
    offset += s.length;
  }

  writeString('RIFF');
  view.setUint32(offset, 36 + interleaved.length * bytesPerSample, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4; // subchunk1Size
  view.setUint16(offset, 1, true); offset += 2; // PCM
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2; // bitsPerSample
  writeString('data');
  view.setUint32(offset, interleaved.length * bytesPerSample, true); offset += 4;

  // PCM samples
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    view.setInt16(offset, interleaved[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function blobToBase64(blob: Blob): Promise<string> {
  // Browser environment
  if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Node / server environment
  if ((blob as any).arrayBuffer) {
    const ab = await (blob as any).arrayBuffer();
    const buf = Buffer.from(ab);
    return buf.toString('base64');
  }

  throw new Error('Unable to convert Blob to base64 in this environment');
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
