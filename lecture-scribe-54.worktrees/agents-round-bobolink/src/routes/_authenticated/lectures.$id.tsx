import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2, FileText, BookOpen, Zap, MessagesSquare, Youtube } from "lucide-react";
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
  clearChat,
  deleteLecture,
  generateFlashcards,
  generateLectureNotes,
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
      return data?.transcript_status === "processing" || data?.transcript_status === "pending"
        ? 3000
        : false;
    },
  });

export const Route = createFileRoute("/_authenticated/lectures/$id")({
  head: () => ({
    meta: [
      { title: "Lecture — ALIP" },
      { name: "description", content: "Lecture transcript, AI notes, flashcards, and chat." },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(lectureQuery(params.id)),
  component: LectureDetail,
});

function LectureDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(lectureQuery(id));

  const retryFn = useServerFn(retryTranscription);
  const deleteFn = useServerFn(deleteLecture);
  const notesFn = useServerFn(getLectureNotes);
  const genNotesFn = useServerFn(generateLectureNotes);
  const cardsListFn = useServerFn(listFlashcards);
  const genCardsFn = useServerFn(generateFlashcards);
  const chatListFn = useServerFn(listChatMessages);
  const chatSendFn = useServerFn(chatWithLecture);
  const chatClearFn = useServerFn(clearChat);

  const hasTranscript = data.transcript_status === "completed" && !!data.transcript;

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

      {data.audioUrl && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-4">
          <audio src={data.audioUrl} controls className="w-full" />
        </div>
      )}

      <Tabs defaultValue="notes" className="mt-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="notes"><BookOpen className="mr-1.5 h-3.5 w-3.5" />Notes</TabsTrigger>
          <TabsTrigger value="transcript"><FileText className="mr-1.5 h-3.5 w-3.5" />Transcript</TabsTrigger>
          <TabsTrigger value="cards"><Zap className="mr-1.5 h-3.5 w-3.5" />Cards</TabsTrigger>
          <TabsTrigger value="chat"><MessagesSquare className="mr-1.5 h-3.5 w-3.5" />Chat</TabsTrigger>
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
            disabled={!hasTranscript}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
