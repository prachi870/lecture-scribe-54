import { useRef, useState } from "react";
import { UploadCloud, FileAudio, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const MAX_MB = 100;
const ACCEPT = "audio/webm,audio/mp4,audio/mpeg,audio/wav,audio/x-wav,audio/mp3,audio/m4a,audio/ogg";

export function UploadDropzone({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (f: File | null) => {
    setError(null);
    if (!f) return onFile(null);
    if (!f.type.startsWith("audio")) {
      setError("Please choose an audio file.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_MB} MB.`);
      return;
    }
    onFile(f);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-muted text-primary">
            <FileAudio className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "audio"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => accept(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-10 text-center transition-colors ${
          dragging
            ? "border-primary/60 bg-primary/5"
            : "border-border/60 bg-card/40 hover:bg-card/60"
        }`}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drop audio here or click to browse</p>
        <p className="text-xs text-muted-foreground">
          MP3, M4A, WAV, or WebM · up to {MAX_MB} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT}
          onChange={(e) => accept(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
