import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Sparkles, Link2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  checkAIProvider,
  createLecture,
  finalizeLectureUpload,
  ingestLectureFromUrl,
  transcribeLecture,
  listCoursesForPicker,
} from "@/lib/lectures.functions";
import { RecorderPanel, type RecorderPanelHandle } from "@/components/lectures/recorder-panel";
import { UploadDropzone } from "@/components/lectures/upload-dropzone";

export const Route = createFileRoute("/_authenticated/lectures/new")({
  head: () => ({
    meta: [
      { title: "New lecture — AuraLearn AI" },
      { name: "description", content: "Record, upload, or paste a YouTube link for AI transcription and notes." },
    ],
  }),
  component: NewLecture,
});

type Mode = "record" | "upload" | "url";

function extFromMime(mime: string | null) {
  if (!mime) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function NewLecture() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createLecture);
  const finalizeFn = useServerFn(finalizeLectureUpload);
  const transcribeFn = useServerFn(transcribeLecture);
  const ingestFn = useServerFn(ingestLectureFromUrl);

  // Probe AI provider once on mount — surface a banner before the user wastes time uploading
  const aiStatusQuery = useQuery({
    queryKey: ["ai-provider-status"],
    queryFn: () => checkAIProvider(),
    staleTime: 60_000, // re-check at most once per minute
    retry: false,      // don't retry on config errors
  });

  const coursesQuery = useQuery({
    queryKey: ["courses", "picker"],
    queryFn: () => listCoursesForPicker(),
  });

  const [mode, setMode] = useState<Mode>("record");
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [recorder, setRecorder] = useState<RecorderPanelHandle | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "url") {
        if (!url.trim()) throw new Error("Paste a YouTube URL.");
        const { id } = await ingestFn({
          data: { url: url.trim(), course_id: courseId || null },
        });
        return id;
      }

      const finalTitle = title.trim() || `Lecture ${new Date().toLocaleString()}`;
      let blob: Blob | null = null;
      let ext = "webm";
      let duration = 0;

      if (mode === "record") {
        if (!recorder?.blob) throw new Error("Please record something first.");
        blob = recorder.blob;
        ext = extFromMime(recorder.mimeType);
        duration = recorder.duration;
      } else {
        if (!file) throw new Error("Please choose an audio file.");
        blob = file;
        ext = file.name.split(".").pop()?.toLowerCase() || extFromMime(file.type);
      }

      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { id } = await createFn({
        data: { title: finalTitle, course_id: courseId || null },
      });

      const path = `${userId}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("lecture-audio")
        .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
      if (upErr) throw new Error(`Audio upload failed: ${upErr.message}`);

      await finalizeFn({ data: { id, audio_path: path, duration_seconds: duration || null } });
      transcribeFn({ data: { id } }).catch((err) => {
        console.error("Transcription failed:", err instanceof Error ? err.message : "Unknown error");
      });
      return id;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["lectures"] });
      toast.success(mode === "url" ? "Lecture imported! Generating notes…" : "Lecture created! Transcription is processing…");
      navigate({ to: "/lectures/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create lecture"),
  });

  const canSubmit =
    !submit.isPending &&
    (mode === "record" ? !!recorder?.blob : mode === "upload" ? !!file : !!url.trim());

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/lectures"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to lectures
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">New lecture</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Record, upload audio, or paste a YouTube link. AuraLearn AI transcribes and generates notes automatically.
      </p>

      {/* AI provider status banner */}
      {aiStatusQuery.data && !aiStatusQuery.data.ok && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">AI transcription unavailable</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{aiStatusQuery.data.reason}</p>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="title">Title {mode === "url" && <span className="text-xs text-muted-foreground">(auto-detected)</span>}</Label>
            <Input
              id="title"
              placeholder="e.g. Neural Networks — Lecture 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              disabled={mode === "url"}
            />
          </div>
          <div>
            <Label htmlFor="course">Course (optional)</Label>
            <select
              id="course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">No course</option>
              {coursesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="record">Record</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="url"><Link2 className="mr-1.5 h-3.5 w-3.5" />YouTube</TabsTrigger>
          </TabsList>
          <TabsContent value="record" className="mt-5">
            <RecorderPanel onReady={setRecorder} disabled={submit.isPending} />
          </TabsContent>
          <TabsContent value="upload" className="mt-5">
            <UploadDropzone file={file} onFile={setFile} />
          </TabsContent>
          <TabsContent value="url" className="mt-5">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <Label htmlFor="url">YouTube URL</Label>
              <Input
                id="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                We fetch the video's captions (English) and generate AI notes. Videos without
                subtitles can't be processed — download the audio and use the Upload tab instead.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {submit.error && (
          <p className="text-sm text-destructive">
            {submit.error instanceof Error ? submit.error.message : "Something went wrong"}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button asChild variant="ghost"><Link to="/lectures">Cancel</Link></Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit} className="shadow-lg shadow-primary/20">
            {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {submit.isPending ? "Working…" : mode === "url" ? "Import & analyze" : "Save & transcribe"}
          </Button>
        </div>
      </div>
    </div>
  );
}
