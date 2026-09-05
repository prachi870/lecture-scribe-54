import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Trash2,
  FileText,
  BookOpen,
  Zap,
  MessagesSquare,
  Youtube,
  GraduationCap,
  Network,
  Sparkles,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/lectures/status-badge";
import { TranscriptView } from "@/components/lectures/transcript-view";
import { NotesPanel } from "@/components/lectures/notes-panel";
import { FlashcardsPanel } from "@/components/lectures/flashcards-panel";
import { ChatPanel } from "@/components/lectures/chat-panel";
import {
  chatWithLecture,
  checkAIProvider,
  clearChat,
  deleteLecture,
  generateExamPrep,
  generateFlashcards,
  generateLectureNotes,
  generateMindMap,
  generateRevisionPlan,
  getLecture,
  getLectureNotes,
  listChatMessages,
  listFlashcards,
  retryTranscription,
} from "@/lib/lectures.functions";

const lectureQuery = (id: string) =>
  queryOptions({
    queryKey: ["lecture", id],
    queryFn: () => getLecture({ data: { id } }),
    refetchInterval: (q) => {
      const data = q.state.data as { transcript_status?: string } | undefined;
      return data?.transcript_status === "processing" || data?.transcript_status === "pending" || data?.transcript_status === "idle"
        ? 1000
        : false;
    },
    refetchIntervalInBackground: true,
  });

export const Route = createFileRoute("/_authenticated/lectures/$id")({
  head: () => ({
    meta: [
      { title: "Lecture — ALIP" },
      { name: "description", content: "Lecture transcript, AI notes, flashcards, exam prep, and chat." },
    ],
  }),
  loader: ({ context, params }) => {
    if (params.id === "new") {
      throw redirect({ to: "/lectures/new" });
    }
    return context.queryClient.ensureQueryData(lectureQuery(params.id));
  },
  component: LectureDetail,
});

function LectureDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(lectureQuery(id));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const retryFn = useServerFn(retryTranscription);
  const deleteFn = useServerFn(deleteLecture);
  const notesFn = useServerFn(getLectureNotes);
  const genNotesFn = useServerFn(generateLectureNotes);
  const cardsListFn = useServerFn(listFlashcards);
  const genCardsFn = useServerFn(generateFlashcards);
  const chatListFn = useServerFn(listChatMessages);
  const chatSendFn = useServerFn(chatWithLecture);
  const chatClearFn = useServerFn(clearChat);
  const genExamFn = useServerFn(generateExamPrep);
  const genMindFn = useServerFn(generateMindMap);
  const genRevisionFn = useServerFn(generateRevisionPlan);

  // AI provider health check — shown when key is missing/blocked
  const aiStatusQuery = useQuery({
    queryKey: ["ai-provider-status"],
    queryFn: () => checkAIProvider(),
    staleTime: 60_000,
    retry: false,
  });

  const hasTranscript = data.transcript_status === "completed" && !!data.transcript;

  const handleSeekTime = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      audioRef.current.play().catch(() => {});
      toast.info(`Jumped to ${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`);
    }
  };

  const notesQuery = useQuery({
    queryKey: ["notes", id],
    queryFn: () => notesFn({ data: { id } }),
    enabled: hasTranscript,
  });
  const cardsQuery = useQuery({
    queryKey: ["cards", id],
    queryFn: () => cardsListFn({ data: { id } }),
    enabled: hasTranscript,
  });
  const chatQuery = useQuery({
    queryKey: ["chat", id],
    queryFn: () => chatListFn({ data: { id } }),
    enabled: hasTranscript,
  });

  const examQuery = useQuery({
    queryKey: ["exam", id],
    queryFn: () => genExamFn({ data: { id } }),
    enabled: false,
  });
  const mindQuery = useQuery({
    queryKey: ["mindmap", id],
    queryFn: () => genMindFn({ data: { id } }),
    enabled: false,
  });
  const revisionQuery = useQuery({
    queryKey: ["revision", id],
    queryFn: () => genRevisionFn({ data: { id } }),
    enabled: false,
  });

  const retry = useMutation({
    mutationFn: () => retryFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lecture", id] }),
  });
  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lectures"] });
      navigate({ to: "/lectures" });
    },
  });
  const genNotes = useMutation({
    mutationFn: () => genNotesFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", id] });
      toast.success("Notes generated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const genCards = useMutation({
    mutationFn: () => genCardsFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards", id] });
      toast.success("Flashcards generated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const sendChat = useMutation({
    mutationFn: (message: string) => chatSendFn({ data: { lecture_id: id, message } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", id] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Chat failed"),
  });
  const clearChatM = useMutation({
    mutationFn: () => chatClearFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", id] }),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        to="/lectures"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All lectures
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{data.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <StatusBadge status={data.transcript_status} />
            <span>{new Date(data.created_at).toLocaleString()}</span>
            {data.duration_seconds ? <span>{Math.round(data.duration_seconds / 60)} min</span> : null}
            {data.source_url && (
              <a
                href={data.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Youtube className="h-3 w-3" /> Source
              </a>
            )}
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

      {/* AI provider status banner — shown when key is missing or blocked */}
      {aiStatusQuery.data && !aiStatusQuery.data.ok && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">AI features unavailable</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{aiStatusQuery.data.reason}</p>
          </div>
        </div>
      )}

      {data.audioUrl && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-4">
          <audio ref={audioRef} src={data.audioUrl} controls className="w-full" />
        </div>
      )}

      <Tabs defaultValue="notes" className="mt-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="notes"><BookOpen className="mr-1.5 h-3.5 w-3.5" />Notes</TabsTrigger>
          <TabsTrigger value="transcript"><FileText className="mr-1.5 h-3.5 w-3.5" />Transcript</TabsTrigger>
          <TabsTrigger value="cards"><Zap className="mr-1.5 h-3.5 w-3.5" />Cards</TabsTrigger>
          <TabsTrigger value="chat"><MessagesSquare className="mr-1.5 h-3.5 w-3.5" />Chat</TabsTrigger>
          <TabsTrigger value="examprep"><GraduationCap className="mr-1.5 h-3.5 w-3.5" />Exam Prep</TabsTrigger>
          <TabsTrigger value="mindmap"><Network className="mr-1.5 h-3.5 w-3.5" />Mind Map</TabsTrigger>
          <TabsTrigger value="revision"><Calendar className="mr-1.5 h-3.5 w-3.5" />Revision Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-5">
          <NotesPanel
            notes={notesQuery.data}
            loading={notesQuery.isLoading}
            onGenerate={() => genNotes.mutate()}
            generating={genNotes.isPending}
            hasTranscript={hasTranscript}
          />
        </TabsContent>

        <TabsContent value="transcript" className="mt-5">
          <TranscriptView
            status={data.transcript_status}
            transcript={data.transcript}
            error={data.transcript_error}
            onRetry={() => retry.mutate()}
            retrying={retry.isPending}
          />
        </TabsContent>

        <TabsContent value="cards" className="mt-5">
          <FlashcardsPanel
            cards={cardsQuery.data ?? []}
            loading={cardsQuery.isLoading}
            onGenerate={() => genCards.mutate()}
            generating={genCards.isPending}
            hasTranscript={hasTranscript}
          />
        </TabsContent>

        <TabsContent value="chat" className="mt-5">
          <ChatPanel
            messages={chatQuery.data ?? []}
            loading={chatQuery.isLoading}
            sending={sendChat.isPending}
            onSend={(t) => sendChat.mutate(t)}
            onClear={() => clearChatM.mutate()}
            onSeekTime={handleSeekTime}
            disabled={!hasTranscript}
          />
        </TabsContent>

        <TabsContent value="examprep" className="mt-5">
          <ExamPrepPanel
            data={examQuery.data}
            loading={examQuery.isFetching}
            onGenerate={() => examQuery.refetch()}
            generating={examQuery.isFetching}
            hasTranscript={hasTranscript}
            onSeekTime={handleSeekTime}
          />
        </TabsContent>

        <TabsContent value="mindmap" className="mt-5">
          <MindMapPanel
            data={mindQuery.data}
            loading={mindQuery.isFetching}
            onGenerate={() => mindQuery.refetch()}
            generating={mindQuery.isFetching}
            hasTranscript={hasTranscript}
          />
        </TabsContent>

        <TabsContent value="revision" className="mt-5">
          <RevisionPlanPanel
            data={revisionQuery.data}
            loading={revisionQuery.isFetching}
            onGenerate={() => revisionQuery.refetch()}
            generating={revisionQuery.isFetching}
            hasTranscript={hasTranscript}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExamPrepPanel({
  data,
  loading,
  onGenerate,
  generating,
  hasTranscript,
  onSeekTime,
}: {
  data: any;
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  hasTranscript: boolean;
  onSeekTime?: (sec: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!hasTranscript) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Transcript required before generating Exam Prep quiz.
      </div>
    );
  }

  if (loading || generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium">Generating AI Exam Prep Quiz & RAG Explanations…</p>
      </div>
    );
  }

  if (!data?.questions?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
        <GraduationCap className="mb-3 h-8 w-8 text-primary" />
        <h3 className="text-base font-semibold">AI Exam Prep Quiz</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Generate multiple-choice practice questions with detailed RAG explanations and timestamp references.
        </p>
        <Button onClick={onGenerate} className="mt-4" size="sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate Exam Prep
        </Button>
      </div>
    );
  }

  const score = Object.entries(answers).reduce((acc, [qIdx, aIdx]) => {
    const q = data.questions[Number(qIdx)];
    return acc + (q && q.answerIndex === aIdx ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-5">
        <div>
          <h2 className="text-base font-semibold">{data.title || "Practice Exam"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{data.summary}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
        </Button>
      </div>

      <div className="space-y-4">
        {data.questions.map((q: any, idx: number) => (
          <div key={q.id || idx} className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <p className="text-sm font-medium">
              {idx + 1}. {q.question}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt: string, optIdx: number) => {
                const isSelected = answers[idx] === optIdx;
                const isCorrect = q.answerIndex === optIdx;
                let btnStyle = "border-border/60 bg-background/50 hover:bg-card/80";
                if (submitted) {
                  if (isCorrect) btnStyle = "border-success/60 bg-success/10 text-success font-medium";
                  else if (isSelected && !isCorrect) btnStyle = "border-destructive/60 bg-destructive/10 text-destructive";
                } else if (isSelected) {
                  btnStyle = "border-primary bg-primary/10 text-primary font-medium";
                }
                return (
                  <button
                    key={optIdx}
                    onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [idx]: optIdx }))}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs transition ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {submitted && isCorrect && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </button>
                );
              })}
            </div>

            {submitted && (
              <div className="mt-3 rounded-xl bg-muted/40 p-3 text-xs leading-relaxed">
                <span className="font-semibold text-foreground">RAG Explanation: </span>
                {q.explanation}
                {q.timestamp && (
                  <button
                    onClick={() => {
                      const m = q.timestamp.match(/(\d{1,2}):(\d{2})/);
                      if (m && onSeekTime) onSeekTime(parseInt(m[1], 10) * 60 + parseInt(m[2], 10));
                    }}
                    className="ml-2 inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary hover:underline"
                  >
                    ⏱️ [{q.timestamp}]
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        {!submitted ? (
          <Button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length === 0}>
            Submit & Grade Quiz
          </Button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-semibold">
              Score: {score} / {data.questions.length} ({Math.round((score / data.questions.length) * 100)}%)
            </span>
            <Button variant="outline" size="sm" onClick={() => { setAnswers({}); setSubmitted(false); }}>
              Reset Quiz
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function MindMapPanel({
  data,
  loading,
  onGenerate,
  generating,
  hasTranscript,
}: {
  data: any;
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  hasTranscript: boolean;
}) {
  if (!hasTranscript) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Transcript required before generating Mind Map.
      </div>
    );
  }

  if (loading || generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium">Analyzing concept hierarchy and building Mind Map…</p>
      </div>
    );
  }

  if (!data?.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
        <Network className="mb-3 h-8 w-8 text-primary" />
        <h3 className="text-base font-semibold">Concept Mind Map</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Generate an interactive visual concept tree mapping the major themes and subtopics of this lecture.
        </p>
        <Button onClick={onGenerate} className="mt-4" size="sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate Mind Map
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-5">
        <div>
          <h2 className="text-base font-semibold">{data.topic || "Lecture Concept Map"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Structured knowledge nodes synthesized by AI.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.nodes.map((node: any, idx: number) => (
          <div key={idx} className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                {idx + 1}
              </span>
              <h3 className="text-sm font-semibold">{node.label}</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{node.summary}</p>
            {node.subtopics && node.subtopics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {node.subtopics.map((sub: string, subIdx: number) => (
                  <span key={subIdx} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                    • {sub}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RevisionPlanPanel({
  data,
  loading,
  onGenerate,
  generating,
  hasTranscript,
}: {
  data: any;
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  hasTranscript: boolean;
}) {
  if (!hasTranscript) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Transcript required before generating a Revision Plan.
      </div>
    );
  }

  if (loading || generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm font-medium">Generating AI Revision Study Plan…</p>
      </div>
    );
  }

  if (!data?.daily_plan?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
        <Calendar className="mb-3 h-8 w-8 text-primary" />
        <h3 className="text-base font-semibold">AI Revision Study Plan</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Generate a structured day-by-day revision schedule with tasks and estimated time commitments.
        </p>
        <Button onClick={onGenerate} className="mt-4" size="sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate Revision Plan
        </Button>
      </div>
    );
  }

  const totalMinutes = data.daily_plan.reduce((sum: number, d: any) => sum + (d.estimated_minutes || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-5">
        <div>
          <h2 className="text-base font-semibold">{data.title || "Revision Study Plan"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.total_days} days • {Math.round(totalMinutes / 60)}h {totalMinutes % 60}m total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
        </Button>
      </div>

      <div className="space-y-3">
        {data.daily_plan.map((day: any, idx: number) => (
          <div key={day.day || idx} className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Day {day.day} — {day.topic}</h3>
              <span className="text-xs text-muted-foreground">{day.estimated_minutes} min</span>
            </div>
            <ul className="mt-2 space-y-1">
              {day.tasks?.map((task: string, tIdx: number) => (
                <li key={tIdx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-primary/40" />
                  {task}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

