import { Suspense, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Network,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listLectures, generateMindMap } from "@/lib/lectures.functions";

const lecturesQ = queryOptions({
  queryKey: ["lectures"],
  queryFn: () => listLectures(),
});

export const Route = createFileRoute("/_authenticated/knowledge-graph")({
  head: () => ({
    meta: [
      { title: "Knowledge Graph — AuraLearn AI" },
      { name: "description", content: "Concept map across all your lectures." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(lecturesQ),
  component: () => (
    <Suspense fallback={<KGSkeleton />}>
      <KnowledgeGraphPage />
    </Suspense>
  ),
});

function KGSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ── Per-lecture mind map node ──────────────────────────────────────────────
function LectureMindMapCard({ lecture }: { lecture: { id: string; title: string; transcript_status: string } }) {
  const genMindFn = useServerFn(generateMindMap);
  const [expanded, setExpanded] = useState(false);

  const mindQuery = useQuery({
    queryKey: ["mindmap", lecture.id],
    queryFn: () => genMindFn({ data: { id: lecture.id } }),
    enabled: false,
    staleTime: Infinity,
  });

  const isReady = lecture.transcript_status === "completed";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <Link
            to="/lectures/$id"
            params={{ id: lecture.id }}
            className="truncate text-sm font-semibold hover:text-primary transition-colors"
          >
            {lecture.title}
          </Link>
          {!isReady && (
            <p className="mt-1 text-xs text-muted-foreground">Transcript not ready yet</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {isReady && !mindQuery.data && !mindQuery.isFetching && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => mindQuery.refetch()}>
              <Sparkles className="mr-1 h-3 w-3" /> Map concepts
            </Button>
          )}
          {mindQuery.data && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {mindQuery.data.nodes?.length} concepts
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {mindQuery.isFetching && (
        <div className="flex items-center gap-2 border-t border-border/40 px-5 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Extracting concept hierarchy…</span>
        </div>
      )}

      {/* Concept nodes */}
      {mindQuery.data && expanded && (
        <div className="border-t border-border/40 p-5 pt-4">
          <p className="mb-3 text-xs font-semibold text-primary">{mindQuery.data.topic}</p>
          <div className="space-y-3">
            {(mindQuery.data.nodes ?? []).map((node: { label: string; summary: string; subtopics: string[] }, idx: number) => (
              <div key={idx} className="rounded-xl bg-background/40 border border-border/40 p-3">
                <p className="text-xs font-semibold">{node.label}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{node.summary}</p>
                {node.subtopics?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {node.subtopics.map((sub: string, si: number) => (
                      <span key={si} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground/70">
                        {sub}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeGraphPage() {
  const { data: lectures } = useSuspenseQuery(lecturesQ);
  const ready = lectures.filter((l) => l.transcript_status === "completed");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-brand">
              <Network className="h-3.5 w-3.5" />
              Concept Intelligence
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Knowledge Graph</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Concept hierarchy extracted from each lecture. Click "Map concepts" to analyse any lecture.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <p className="text-xs text-muted-foreground">Total Lectures</p>
          <p className="mt-1 font-display text-2xl font-bold">{lectures.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <p className="text-xs text-muted-foreground">Transcribed</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{ready.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:block hidden">
          <p className="text-xs text-muted-foreground">How it works</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Click "Map concepts" on any transcribed lecture to extract its concept hierarchy using AI.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {lectures.length === 0 && (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <Network className="mb-3 h-10 w-10 text-primary/50" />
          <h3 className="text-base font-semibold">No lectures yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">Add a lecture first to start mapping concepts.</p>
          <Button asChild size="sm" className="mt-5">
            <Link to="/lectures/new"><BookOpen className="mr-1.5 h-3.5 w-3.5" /> New lecture</Link>
          </Button>
        </div>
      )}

      {/* Lecture cards */}
      {lectures.length > 0 && (
        <div className="mt-8 space-y-4">
          {lectures.map((l) => (
            <LectureMindMapCard key={l.id} lecture={l} />
          ))}
        </div>
      )}

      {/* CTA to lecture detail */}
      {ready.length > 0 && (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/20 p-4 text-xs text-muted-foreground">
          <Network className="h-3.5 w-3.5 text-primary" />
          Tip: Open any lecture and use the{" "}
          <Link to="/lectures" className="font-medium text-primary hover:underline inline-flex items-center gap-0.5">
            Mind Map tab <ArrowRight className="h-3 w-3" />
          </Link>{" "}
          for the full interactive concept tree.
        </div>
      )}
    </div>
  );
}
