## Phase 3 scope

Building on Phase 1 (auth + shell) and Phase 2 (record/upload + transcription), Phase 3 makes every feature real and adds the ones you picked.

### 1. Video URL ingestion (YouTube + others)
- New "Paste a link" tab on `/lectures/new` alongside Record and Upload.
- Server function `ingestLectureFromUrl(url)` runs on TanStack, uses a public transcript service (YouTube Transcript API via public endpoint) when the URL is YouTube; falls back to a clear error for non-transcript sources.
- If a transcript is fetched directly, we skip audio storage and jump straight to `transcript_status = completed`, then run AI Notes automatically.
- We will NOT download YouTube audio (ToS + Cloudflare Worker constraints). Non-YouTube URLs will require the user to upload the file.

### 2. AI Notes ("explain in easy terms")
- New table `lecture_notes` (summary, key_points jsonb, eli5, glossary jsonb, generated_at). RLS scoped to `auth.uid()` via lecture ownership.
- Server fn `generateLectureNotes(lectureId)` calls Lovable AI (`google/gemini-3.6-flash`) with structured output: summary, 5–10 key points, ELI5 explanation, glossary of terms.
- Auto-triggered when transcription completes; also a manual "Regenerate notes" button.
- Rendered on the lecture detail page in a tabbed layout: Transcript | Notes | Flashcards | Chat.

### 3. Flashcards
- New table `flashcards` (lecture_id, question, answer, difficulty). RLS by ownership.
- Server fn `generateFlashcards(lectureId)` → structured array of Q/A pairs from transcript.
- Study UI on `/flashcards`: filter by course/lecture, flip card, "Got it / Review again", spaced-review counter in localStorage.

### 4. Chat with lecture
- New table `chat_messages` (lecture_id, role, content). RLS by ownership.
- Streaming server route `POST /api/chat` using AI SDK + Lovable Gateway; system prompt = "Answer using this lecture transcript" + transcript context.
- Chat tab on lecture detail page uses AI Elements (`conversation`, `message`, `prompt-input`, `shimmer`).

### 5. Courses (real CRUD)
- Replace `/courses` placeholder with grid + create/edit dialog (title, code, color, description).
- Course detail page `/courses/$id` lists its lectures; lecture create flow lets you pick a course.

### 6. Password reset
- Add "Forgot password?" link on `/auth` → sends reset email via `supabase.auth.resetPasswordForEmail`.
- New public route `/reset-password` that detects `type=recovery` and calls `updateUser({ password })`.
- Scaffold Lovable auth email templates so the reset email is branded.

### 7. UI polish pass
- Lecture detail: hero header (course color, status, duration, timestamps), tabbed content (Transcript / Notes / Flashcards / Chat), sticky audio player.
- Dashboard: real stats from DB (lectures count, hours transcribed, notes generated, streak).
- Sidebar: badge counts (unread notes, pending transcripts).
- Consistent empty states, loading skeletons, error toasts.

### Technical details

- DB migrations (single call): `lecture_notes`, `flashcards`, `chat_messages` tables with GRANTs + RLS scoped to `auth.uid() = (SELECT user_id FROM lectures WHERE id = lecture_id)`.
- New server fns in `src/lib/lectures.functions.ts` and `src/lib/courses.functions.ts`.
- Chat route: `src/routes/api/chat.ts` using `createLovableAiGatewayProvider` + `streamText` + `toUIMessageStreamResponse`.
- YouTube transcript fetch: call `https://youtubetranscript.com/?server_vid=<id>` (public, no key) inside the server fn; parse response; on failure fall back to yt-dlp is NOT possible on Worker, so return actionable error.
- AI Elements: install `conversation message prompt-input shimmer` for chat.
- Auth emails: `email_domain--scaffold_auth_email_templates` for branded reset email.
- All AI calls go through Lovable AI Gateway — no user-provided keys.

### Out of scope
- Downloading YouTube audio server-side (ToS + runtime).
- Browser tab-capture / Chrome extension.
- Real-time collaborative notes.
- Payment / plans.

Approve and I'll ship it end-to-end.