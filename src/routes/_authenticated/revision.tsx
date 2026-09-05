import { Suspense, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Sparkles, Loader2, RotateCcw, Clock, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listLectures, generateRevisionPlan } from "@/lib/lectures.functions";

const lecturesQ = queryOptions({
  queryKey: ["lectures"],
  queryFn: () => listLectures(),
});

export const Route = createFileRoute("/_authenticated/revision")({
  head: () => ({
    meta: [
      { title: "Revision Plans — AuraLearn AI" },
      { name: "description", content: "Day-by-day revision schedules generated from your lectures." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(lecturesQ),
  component: () => (
    <Suspense fallback={<RevisionSkeleton />}>
      <RevisionPage />
    </Suspense>
  ),
});

function RevisionSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    </div>
  );
}

function LectureRevisionCard({ lecture }: { lecture: { id: string; title: string; transcript_status: string } }) {
  const genRevFn = useServerFn(generateRevisionPlan);
  const [expanded, setExpanded] = useState(false);

  const revQuery = useQuery({
    queryKey: ["revision", lecture.id],
    queryFn: () => genRevFn({ data: { id: lecture.id } }),
    enabled: false,
    staleTime: Infinity,
  });

  const isReady = lecture.transcript_status === "completed";
  const totalMin = revQuery.data?.daily_plan?.reduce((s: number, d: { estimated_minutes: number }) => s + (d.estimated_minutes || 0), 0) ?? 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <Link
            to="/lectures/$id"
            params={{ id: lecture.id }}
            className="truncate text-sm font-semibold hover:text-primary transition-colors block"
          >
            {lecture.title}
          </Link>
          {!isReady && <p className="mt-0.5 text-xs text-muted-foreground">Needs transcription first</p>}
          {revQuery.data && (
            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {revQuery.data.total_days} days
              <span>•</span>
              <Clock className="h-3 w-3" />
              {Math.round(totalMin / 60)}h {totalMin % 60}m total
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {isReady && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => { revQuery.refetch(); setExpanded(true); }}
              disabled={revQuery.isFetching}
            >
              {revQuery.isFetching
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><Sparkles className="mr-1 h-3 w-3" />{revQuery.data ? "Regenerate" : "Generate Plan"}</>
              }
            </Button>
          )}
          {revQuery.data && !revQuery.isFetching && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide" : "View Plan"}
            </Button>
          )}
        </div>
      </div>

      {/* Plan body */}
      {revQuery.data && expanded && (
        <div className="border-t border-border/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">{revQuery.data.title}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={() => { revQuery.refetch(); }}
              disabled={revQuery.isFetching}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Redo
            </Button>
          </div>
          {revQuery.data.daily_plan?.map((day: {
            day: number;
            topic: string;
            tasks: string[];
            estimated_minutes: number;
          }, idx: number) => (
            <div key={day.day ?? idx} className="rounded-xl border border-border/50 bg-background/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Day {day.day} — {day.topic}</p>
                <span className="text-xs text-muted-foreground">{day.estimated_minutes} min</span>
              </div>
              <ul className="space-y-1">
                {day.tasks?.map((task: string, ti: number) => (
                  <li key={ti} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RevisionPage() {
  const { data: lectures } = useSuspenseQuery(lecturesQ);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <span className="badge-brand">
            <Calendar className="h-3.5 w-3.5" />
            Spaced Learning
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Revision Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated day-by-day study schedules for each lecture. Click "Generate Plan" to build yours.
        </p>
      </div>

      {/* Empty state */}
      {lectures.length === 0 && (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <Calendar className="mb-3 h-10 w-10 text-primary/50" />
          <h3 className="text-base font-semibold">No lectures yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">Add a lecture to generate a revision plan.</p>
          <Button asChild size="sm" className="mt-5">
            <Link to="/lectures/new"><BookOpen className="mr-1.5 h-3.5 w-3.5" /> New lecture</Link>
          </Button>
        </div>
      )}

      {/* Cards */}
      {lectures.length > 0 && (
        <div className="mt-8 space-y-4">
          {lectures.map((l) => <LectureRevisionCard key={l.id} lecture={l} />)}
        </div>
      )}
    </div>
  );
}
