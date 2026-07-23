import { AlertTriangle, Loader2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TranscriptStatus } from "./status-badge";

export function TranscriptView({
  status,
  transcript,
  error,
  onRetry,
  retrying,
}: {
  status: TranscriptStatus | string | null;
  transcript: string | null;
  error: string | null;
  onRetry: () => void;
  retrying?: boolean;
}) {
  if (status === "processing" || status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium">Transcribing your lecture…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This usually takes about 10% of the audio length.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="mt-4 text-sm font-medium">Transcription failed</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          {error ?? "Something went wrong. Retry to try again."}
        </p>
        <Button size="sm" className="mt-4" onClick={onRetry} disabled={retrying}>
          {retrying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Retry
        </Button>
      </div>
    );
  }

  if (status === "completed" && transcript) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Transcript
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {transcript}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 px-6 py-14 text-center text-sm text-muted-foreground">
      No transcript yet.
    </div>
  );
}
