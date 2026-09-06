import { useRef, useState } from "react";
import { UploadCloud, FileAudio, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { classifyFile } from "@/lib/extract-document";

const MAX_MB = 100;

// All accepted MIME types and extensions
const ACCEPT = [
  // Audio / video
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav",
  "audio/mp3", "audio/m4a", "audio/ogg", "video/mp4",
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown", "text/csv",
].join(",");

const ACCEPT_EXTS = ".mp3,.m4a,.wav,.webm,.mp4,.ogg,.pdf,.docx,.txt,.md,.csv";

function fileIcon(file: File) {
  const kind = classifyFile(file);
  if (kind === "audio") return <FileAudio className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function fileLabel(file: File) {
  const kind = classifyFile(file);
  if (kind === "audio") return "audio";
  if (kind === "pdf") return "PDF";
  if (kind === "docx") return "DOCX";
  if (kind === "text") return "text";
  return file.type || "file";
}

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

    const kind = classifyFile(f);
    const name = f.name.toLowerCase();

    // Check MIME or extension
    const isAudio = f.type.startsWith("audio") || f.type.startsWith("video");
    const isPDF = name.endsWith(".pdf") || f.type === "application/pdf";
    const isDocx = name.endsWith(".docx");
    const isText = name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv") || f.type.startsWith("text/");

    if (!isAudio && !isPDF && !isDocx && !isText) {
      setError("Please choose an audio file (MP3, WAV, WebM) or a document (PDF, DOCX, TXT).");
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
            {fileIcon(file)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {fileLabel(file)}
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
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
        <p className="text-sm font-medium">Drop file here or click to browse</p>
        <p className="text-xs text-muted-foreground">
          Audio: MP3, M4A, WAV, WebM · up to {MAX_MB} MB
        </p>
        <p className="text-xs text-muted-foreground">
          Documents: PDF, DOCX, TXT · text extracted automatically
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT_EXTS}
          onChange={(e) => accept(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
