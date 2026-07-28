import { Check, Loader2, Circle, AlertTriangle } from "lucide-react";

export type TranscriptStatus = "idle" | "pending" | "processing" | "completed" | "failed";

export function StatusBadge({ status }: { status: TranscriptStatus | string | null | undefined }) {
  const s = (status ?? "idle") as TranscriptStatus;
  const map: Record<TranscriptStatus, { label: string; className: string; Icon: typeof Check }> = {
    idle: {
      label: "Draft",
      className: "border-border/60 bg-muted/40 text-muted-foreground",
      Icon: Circle,
    },
    pending: {
      label: "Queued",
      className: "border-border/60 bg-muted/40 text-muted-foreground",
      Icon: Loader2,
    },
    processing: {
      label: "Transcribing",
      className: "border-primary/30 bg-primary/10 text-primary",
      Icon: Loader2,
    },
    completed: {
      label: "Ready",
      className: "border-success/30 bg-success/10 text-success",
      Icon: Check,
    },
    failed: {
      label: "Failed",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
      Icon: AlertTriangle,
    },
  };
  const cfg = map[s] ?? map.idle;
  const spin = s === "processing" || s === "pending";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cfg.className}`}
    >
      <cfg.Icon className={`h-3 w-3 ${spin ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}
