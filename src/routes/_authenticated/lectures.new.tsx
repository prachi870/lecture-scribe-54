import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  createLecture,
  finalizeLectureUpload,
  transcribeLecture,
  listCoursesForPicker,
} from "@/lib/lectures.functions";
import { RecorderPanel, type RecorderPanelHandle } from "@/components/lectures/recorder-panel";
import { UploadDropzone } from "@/components/lectures/upload-dropzone";

export const Route = createFileRoute("/_authenticated/lectures/new")({
  head: () => ({
    meta: [
      { title: "New lecture — ALIP" },
      { name: "description", content: "Record or upload a lecture for AI transcription." },
    ],
  }),
  component: NewLecture,
});

type Mode = "record" | "upload";

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
  const queryClient = useQueryClient();
  const createFn = useServerFn(createLecture);
  const finalizeFn = useServerFn(finalizeLectureUpload);
  const transcribeFn = useServerFn(transcribeLecture);

  const coursesQuery = useQuery({
    queryKey: ["courses", "picker"],
    queryFn: () => listCoursesForPicker(),
  });

  const [mode, setMode] = useState<Mode>("record");
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [recorder, setRecorder] = useState<RecorderPanelHandle | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
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
        .upload(path, blob, {
          contentType: blob.type || "audio/webm",
          upsert: true,
        });
      if (upErr) throw new Error(upErr.message);

      await finalizeFn({
        data: { id, audio_path: path, duration_seconds: duration || null },
      });

      // Fire and forget — poll on the detail page
      transcribeFn({ data: { id } }).catch(() => {});

      await queryClient.invalidateQueries({ queryKey: ["lectures"] });
      return id;
    },
    onSuccess: (id) => {
      navigate({ to: "/lectures/$id", params: { id } });
    },
  });

  const canSubmit =
    !submit.isPending &&
    (mode === "record" ? !!recorder?.blob : !!file);

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
        Record from your microphone or upload an existing audio file. ALIP transcribes it automatically.
      </p>

      <div className="mt-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Neural Networks — Lecture 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
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
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1">
          {(["record", "upload"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "record" ? (
          <RecorderPanel onReady={setRecorder} disabled={submit.isPending} />
        ) : (
          <UploadDropzone file={file} onFile={setFile} />
        )}

        {submit.error && (
          <p className="text-sm text-destructive">
            {submit.error instanceof Error ? submit.error.message : "Something went wrong"}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button asChild variant="ghost">
            <Link to="/lectures">Cancel</Link>
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={!canSubmit}
            className="shadow-lg shadow-primary/20"
          >
            {submit.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {submit.isPending ? "Uploading…" : "Save & transcribe"}
          </Button>
        </div>
      </div>
    </div>
  );
}
