import { Mic, Pause, Play, Square, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMediaRecorder } from "@/hooks/use-media-recorder";

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export interface RecorderPanelHandle {
  blob: Blob | null;
  mimeType: string | null;
  duration: number;
  reset: () => void;
}

export function RecorderPanel({
  onReady,
  disabled,
}: {
  onReady: (h: RecorderPanelHandle) => void;
  disabled?: boolean;
}) {
  const rec = useMediaRecorder();

  const notify = (blob: Blob | null) => {
    onReady({
      blob,
      mimeType: rec.mimeType,
      duration: rec.elapsed,
      reset: rec.reset,
    });
  };

  const handleStop = async () => {
    const b = await rec.stop();
    notify(b);
  };

  const bars = Array.from({ length: 24 });
  const activeBars = Math.floor(rec.level * bars.length);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-full border transition-colors ${
            rec.state === "recording"
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border/60 bg-muted/30 text-muted-foreground"
          }`}
        >
          <Mic className="h-9 w-9" />
        </div>

        <div className="mt-5 font-mono text-3xl font-semibold tracking-tight tabular-nums">
          {fmt(rec.elapsed)}
        </div>

        <div className="mt-4 flex h-8 items-end gap-0.5">
          {bars.map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all ${
                i < activeBars ? "bg-primary" : "bg-muted/60"
              }`}
              style={{ height: `${8 + (i < activeBars ? rec.level * 24 : 0)}px` }}
            />
          ))}
        </div>

        {rec.error && (
          <p className="mt-4 text-xs text-destructive">{rec.error}</p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {rec.state === "idle" && (
            <Button onClick={rec.start} disabled={disabled} className="shadow-md shadow-primary/20">
              <Mic className="mr-2 h-4 w-4" /> Start recording
            </Button>
          )}
          {rec.state === "recording" && (
            <>
              <Button variant="outline" onClick={rec.pause}>
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
              <Button onClick={handleStop} variant="destructive">
                <Square className="mr-2 h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {rec.state === "paused" && (
            <>
              <Button onClick={rec.resume}>
                <Play className="mr-2 h-4 w-4" /> Resume
              </Button>
              <Button onClick={handleStop} variant="destructive">
                <Square className="mr-2 h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {rec.state === "stopped" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  rec.reset();
                  notify(null);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Re-record
              </Button>
            </>
          )}
        </div>

        {rec.state === "stopped" && rec.blob && (
          <p className="mt-4 text-xs text-muted-foreground">
            Recorded {fmt(rec.elapsed)} · {(rec.blob.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </div>
    </div>
  );
}
