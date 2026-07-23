import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

export interface UseMediaRecorderResult {
  state: RecorderState;
  elapsed: number;
  level: number;
  error: string | null;
  blob: Blob | null;
  mimeType: string | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<Blob | null>;
  reset: () => void;
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

export function useMediaRecorder(): UseMediaRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const stopResolveRef = useRef<((b: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const tickLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 2));
    rafRef.current = requestAnimationFrame(tickLevel);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setElapsed(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mt = pickMimeType();
      setMimeType(mt);
      const rec = new MediaRecorder(stream, { mimeType: mt });
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mt });
        setBlob(b);
        setState("stopped");
        cleanup();
        stopResolveRef.current?.(b);
        stopResolveRef.current = null;
      };
      rec.start(1000);

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(tickLevel);

      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);

      setState("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone access denied");
      cleanup();
      setState("idle");
    }
  }, [cleanup, tickLevel]);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    setState("paused");
  }, []);
  const resume = useCallback(() => {
    recorderRef.current?.resume();
    setState("recording");
  }, []);
  const stop = useCallback(async (): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return blob;
    return new Promise<Blob | null>((resolve) => {
      stopResolveRef.current = resolve;
      rec.stop();
    });
  }, [blob]);
  const reset = useCallback(() => {
    cleanup();
    setState("idle");
    setElapsed(0);
    setLevel(0);
    setBlob(null);
    setError(null);
    chunksRef.current = [];
  }, [cleanup]);

  return { state, elapsed, level, error, blob, mimeType, start, pause, resume, stop, reset };
}
