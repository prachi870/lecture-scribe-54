import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/lectures/status-badge";
import { TranscriptView } from "@/components/lectures/transcript-view";
import {
  deleteLecture,
  getLecture,
  retryTranscription,
} from "@/lib/lectures.functions";

const lectureQuery = (id: string) =>
  queryOptions({
    queryKey: ["lecture", id],
    queryFn: () => getLecture({ data: { id } }),
    refetchInterval: (q) => {
      const data = q.state.data as { transcript_status?: string } | undefined;
      return data?.transcript_status === "processing" || data?.transcript_status === "pending"
        ? 3000
        : false;
    },
  });

export const Route = createFileRoute("/_authenticated/lectures/$id")({
  head: () => ({
    meta: [
      { title: "Lecture — ALIP" },
      { name: "description", content: "Lecture transcript and details." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(lectureQuery(params.id)),
  component: LectureDetail,
});

function LectureDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(lectureQuery(id));
  const retryFn = useServerFn(retryTranscription);
  const deleteFn = useServerFn(deleteLecture);

  const retry = useMutation({
    mutationFn: () => retryFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lecture", id] }),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lectures"] });
      navigate({ to: "/lectures" });
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/lectures"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All lectures
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{data.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <StatusBadge status={data.transcript_status} />
            <span>{new Date(data.created_at).toLocaleString()}</span>
            {data.duration_seconds ? <span>{Math.round(data.duration_seconds / 60)} min</span> : null}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Delete this lecture and its audio?")) del.mutate();
          }}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      {data.audioUrl && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-4">
          <audio src={data.audioUrl} controls className="w-full" />
        </div>
      )}

      <div className="mt-6">
        <TranscriptView
          status={data.transcript_status}
          transcript={data.transcript}
          error={data.transcript_error}
          onRetry={() => retry.mutate()}
          retrying={retry.isPending}
        />
      </div>
    </div>
  );
}
