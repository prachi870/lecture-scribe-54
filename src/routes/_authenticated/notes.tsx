import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles, ArrowRight } from "lucide-react";

import { listLectures, getLectureNotes } from "@/lib/lectures.functions";
import { useQueries } from "@tanstack/react-query";

const q = queryOptions({ queryKey: ["lectures"], queryFn: () => listLectures() });

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes — ALIP" },
      { name: "description", content: "AI-generated notes across all your lectures." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: NotesPage,
});

function NotesPage() {
  const { data: lectures } = useSuspenseQuery(q);
  const ready = lectures.filter((l) => l.transcript_status === "completed");

  const notes = useQueries({
    queries: ready.map((l) => ({
      queryKey: ["notes", l.id],
      queryFn: () => getLectureNotes({ data: { id: l.id } }),
    })),
  });

  const items = ready
    .map((l, i) => ({ lecture: l, notes: notes[i]?.data }))
    .filter((x) => x.notes);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Study</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every lecture, summarized and explained in easy terms.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">No notes yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Notes are generated automatically after transcription. Add a lecture to get started.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map(({ lecture, notes: n }) => (
            <Link
              key={lecture.id}
              to="/lectures/$id"
              params={{ id: lecture.id }}
              className="group rounded-2xl border border-border/60 bg-card/40 p-5 transition-colors hover:bg-card/70"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{lecture.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(lecture.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              {n?.eli5 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">{n.eli5}</p>
                </div>
              )}
              {Array.isArray(n?.key_points) && n!.key_points.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {(n!.key_points as string[]).length} key points
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
