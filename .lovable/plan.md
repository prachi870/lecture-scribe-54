# Phase 2: Recording + Transcription

Build the end-to-end lecture capture pipeline: record audio in the browser, upload to storage, transcribe with AI, and display results.

## Scope

1. **Storage bucket** for lecture audio (private, per-user RLS).
2. **New DB columns** on `lectures`: `audio_path`, `duration_seconds`, `transcript`, `transcript_status` (`pending` | `processing` | `completed` | `failed`), `transcript_error`, `transcribed_at`.
3. **Recording UI** at `/_authenticated/lectures/new`:
   - MediaRecorder-based capture (mic permission, waveform meter, pause/resume, elapsed timer).
   - File-upload fallback (mp3/m4a/wav/webm, max ~100 MB).
   - Title + course selector; creates a `lectures` row and uploads audio.
4. **Transcription server function** (`transcribeLecture`) using Lovable AI Gateway (Gemini audio-capable model). Streams status updates via row `transcript_status`.
5. **Lecture list** `/_authenticated/lectures`: cards showing status badges (Processing / Ready / Failed), duration, created date.
6. **Lecture detail** `/_authenticated/lectures/$id`:
   - Header with title, course, status.
   - Audio player.
   - Transcript panel (with retry button on failure).
7. **Dashboard update**: "Record lecture" primary CTA links to `/lectures/new`; recent lectures list pulls real rows.

Out of scope (later phases): speaker diarization, chapter/segment timestamps, chat/notes/flashcards generation, analytics graphs.

## Technical Details

**Storage**
- Bucket `lecture-audio`, private. RLS: `auth.uid()::text = (storage.foldername(name))[1]`. Paths: `{user_id}/{lecture_id}.{ext}`.

**Server functions** (`src/lib/lectures.functions.ts`, protected with `requireSupabaseAuth`)
- `createLecture({ title, course_id? })` → returns `{ id, upload_path }`.
- `finalizeLectureUpload({ id, audio_path, duration_seconds })` → sets status `pending`, then invokes transcription.
- `transcribeLecture({ id })` → signed-URL download, call Lovable AI Gateway audio transcription, update row.
- `listLectures()`, `getLecture(id)`, `retryTranscription(id)`, `deleteLecture(id)`.

**Client**
- `useMediaRecorder` hook wrapping the Web API.
- Upload via `supabase.storage.from('lecture-audio').upload(path, blob)` with progress.
- TanStack Query keys: `['lectures']`, `['lecture', id]`; poll `transcript_status` every 3s while `processing`.

**Model**: `google/gemini-2.5-flash` via Lovable AI Gateway with an audio input part; fall back to `google/gemini-2.5-pro` on rate-limit.

## File Plan

New:
- `supabase/migrations/<ts>_lecture_audio.sql` (columns + bucket + policies)
- `src/lib/lectures.functions.ts`
- `src/hooks/use-media-recorder.ts`
- `src/routes/_authenticated/lectures.index.tsx` (list; replaces stub)
- `src/routes/_authenticated/lectures.new.tsx`
- `src/routes/_authenticated/lectures.$id.tsx`
- `src/components/lectures/{recorder-panel,upload-dropzone,transcript-view,status-badge}.tsx`

Modified:
- `src/routes/_authenticated/dashboard.tsx` (real recent lectures + CTA)
- `src/components/app-sidebar.tsx` (no change unless needed)

## Deliverable

A signed-in user can record or upload a lecture, watch it transcribe, and read the transcript on its detail page.
