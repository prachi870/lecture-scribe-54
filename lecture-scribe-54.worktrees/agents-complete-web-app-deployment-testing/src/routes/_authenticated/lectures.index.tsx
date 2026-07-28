import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Plus, Clock } from "lucide-react";
import { queryOptions } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { listLectures } from "@/lib/lectures.functions";
import { StatusBadge } from "@/components/lectures/status-badge";

const lecturesQuery = () =>
  queryOptions({
    queryKey: ["lectures"],
    queryFn: () => listLectures(),
    refetchInterval: (q) => {
      const data = q.state.data as Array<{ transcript_status: string }> | undefined;
      const active = data?.some(
        (l) => l.transcript_status === "processing" || l.transcript_status === "pending",
      );
      return active ? 3000 : false;
    },
  });

export const Route = createFileRoute("/_authenticated/lectures/")({
  head: () => ({
    meta: [
      { title: "Lectures — ALIP" },
      { name: "description", content: "All your recorded and uploaded lectures." },
    ],
  }),
  loader: ({ context }) => {
    void useServerFn; // preserve import for tree-shake safety in generated split
    return context.queryClient.ensureQueryData(lecturesQuery());
  },
  component: LecturesList,
});

function fmtDuration(sec: number | null | undefined) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LecturesList() {
  const { data } = useSuspenseQuery(lecturesQuery());

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Library
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Lectures</h1>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link to="/lectures/new">
            <Plus className="mr-2 h-4 w-4" />
            New lecture
          </Link>
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
            <Mic className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">No lectures yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Record a lecture or upload an existing audio file. ALIP will transcribe it automatically.
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link to="/lectures/new">
              <Mic className="mr-2 h-3.5 w-3.5" />
              Start recording
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          {data.map((l) => (
            <li key={l.id}>
              <Link
                to="/lectures/$id"
                params={{ id: l.id }}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-card/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDuration(l.duration_seconds)}
                    </span>
                    <span>{new Date(l.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <StatusBadge status={l.transcript_status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
