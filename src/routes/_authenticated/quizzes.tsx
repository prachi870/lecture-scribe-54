import { Suspense, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  GraduationCap,
  Sparkles,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Trophy,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listLectures, generateExamPrep } from "@/lib/lectures.functions";

const lecturesQ = queryOptions({
  queryKey: ["lectures"],
  queryFn: () => listLectures(),
});

export const Route = createFileRoute("/_authenticated/quizzes")({
  head: () => ({
    meta: [
      { title: "Quizzes — AuraLearn AI" },
      { name: "description", content: "AI-generated practice quizzes from your lectures." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(lecturesQ),
  component: () => (
    <Suspense fallback={<QuizSkeleton />}>
      <QuizzesPage />
    </Suspense>
  ),
});

function QuizSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  );
}

// ── Per-lecture quiz ───────────────────────────────────────────────────────
function LectureQuizCard({ lecture }: { lecture: { id: string; title: string; transcript_status: string } }) {
  const genExamFn = useServerFn(generateExamPrep);
  const [expanded, setExpanded] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const examQuery = useQuery({
    queryKey: ["exam", lecture.id],
    queryFn: () => genExamFn({ data: { id: lecture.id } }),
    enabled: false,
    staleTime: Infinity,
  });

  const isReady = lecture.transcript_status === "completed";

  const handleGenerate = () => {
    setAnswers({});
    setSubmitted(false);
    examQuery.refetch();
    setExpanded(true);
  };

  const score = examQuery.data
    ? Object.entries(answers).reduce((acc, [qIdx, aIdx]) => {
        const q = examQuery.data!.questions[Number(qIdx)];
        return acc + (q && q.answerIndex === aIdx ? 1 : 0);
      }, 0)
    : 0;

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
          {examQuery.data && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {examQuery.data.questions?.length} questions
              {submitted && ` • Score: ${score}/${examQuery.data.questions?.length}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {isReady && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleGenerate} disabled={examQuery.isFetching}>
              {examQuery.isFetching
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><Sparkles className="mr-1 h-3 w-3" />{examQuery.data ? "New Quiz" : "Generate Quiz"}</>
              }
            </Button>
          )}
          {examQuery.data && !examQuery.isFetching && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide" : "Take Quiz"}
            </Button>
          )}
        </div>
      </div>

      {/* Quiz body */}
      {examQuery.data && expanded && (
        <div className="border-t border-border/40 p-5 space-y-4">
          {/* Summary */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
            <p className="text-xs font-semibold text-primary">{examQuery.data.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{examQuery.data.summary}</p>
          </div>

          {/* Questions */}
          {examQuery.data.questions?.map((q: {
            id: number;
            question: string;
            options: string[];
            answerIndex: number;
            explanation: string;
            timestamp?: string;
          }, idx: number) => (
            <div key={q.id ?? idx} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-sm font-medium">{idx + 1}. {q.question}</p>
              <div className="mt-3 space-y-2">
                {q.options?.map((opt: string, optIdx: number) => {
                  const isSelected = answers[idx] === optIdx;
                  const isCorrect = q.answerIndex === optIdx;
                  let cls = "border-border/60 bg-background/50 hover:bg-card/80";
                  if (submitted) {
                    if (isCorrect) cls = "border-success/60 bg-success/10 text-success font-medium";
                    else if (isSelected) cls = "border-destructive/60 bg-destructive/10 text-destructive";
                  } else if (isSelected) cls = "border-primary bg-primary/10 text-primary font-medium";
                  return (
                    <button
                      key={optIdx}
                      onClick={() => !submitted && setAnswers((p) => ({ ...p, [idx]: optIdx }))}
                      className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-xs transition ${cls}`}
                    >
                      <span>{opt}</span>
                      {submitted && isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div className="mt-2.5 rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed">
                  <span className="font-semibold">Explanation: </span>{q.explanation}
                  {q.timestamp && (
                    <span className="ml-2 rounded bg-primary/20 px-1 py-0.5 font-mono text-[10px] text-primary">
                      [{q.timestamp}]
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Submit / Score */}
          <div className="flex items-center justify-between pt-1">
            {!submitted ? (
              <Button
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length === 0}
                size="sm"
              >
                Submit & Grade
              </Button>
            ) : (
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-warning" />
                  <span className="text-sm font-semibold">
                    {score}/{examQuery.data.questions?.length} ({Math.round((score / (examQuery.data.questions?.length || 1)) * 100)}%)
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setAnswers({}); setSubmitted(false); }}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Try again
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuizzesPage() {
  const { data: lectures } = useSuspenseQuery(lecturesQ);
  const ready = lectures.filter((l) => l.transcript_status === "completed");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <span className="badge-brand">
            <GraduationCap className="h-3.5 w-3.5" />
            Practice Exams
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Quizzes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated MCQ practice exams from your lectures with detailed explanations.
        </p>
      </div>

      {/* Stats */}
      <div className="mt-6 flex items-center gap-4 rounded-xl border border-border/60 bg-card/40 p-4 text-xs">
        <div className="text-center">
          <p className="font-display text-xl font-bold">{lectures.length}</p>
          <p className="text-muted-foreground">Total lectures</p>
        </div>
        <div className="h-8 w-px bg-border/60" />
        <div className="text-center">
          <p className="font-display text-xl font-bold text-success">{ready.length}</p>
          <p className="text-muted-foreground">Ready for quiz</p>
        </div>
        <div className="h-8 w-px bg-border/60" />
        <p className="text-muted-foreground flex-1">
          Click "Generate Quiz" on any lecture to create a practice exam with RAG explanations and timestamp references.
        </p>
      </div>

      {/* Empty state */}
      {lectures.length === 0 && (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <GraduationCap className="mb-3 h-10 w-10 text-primary/50" />
          <h3 className="text-base font-semibold">No lectures yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">Add a lecture to generate practice quizzes.</p>
          <Button asChild size="sm" className="mt-5">
            <Link to="/lectures/new"><BookOpen className="mr-1.5 h-3.5 w-3.5" /> New lecture</Link>
          </Button>
        </div>
      )}

      {/* Lecture quiz cards */}
      {lectures.length > 0 && (
        <div className="mt-8 space-y-4">
          {lectures.map((l) => <LectureQuizCard key={l.id} lecture={l} />)}
        </div>
      )}
    </div>
  );
}
