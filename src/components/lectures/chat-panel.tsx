import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2, Bot, User, ShieldCheck, Sparkles, BookOpen, Quote, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

type Msg = { id: string; role: string; content: string };

function parseTimestamp(ts: string): number | null {
  const m = ts.match(/\[(\d{1,2}):(\d{2})\]/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function RenderMessageContent({
  content,
  onSeekTime,
}: {
  content: string;
  onSeekTime?: (sec: number) => void;
}) {
  const parts = content.split(/(\[\d{1,2}:\d{2}\])/g);
  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        const sec = parseTimestamp(part);
        if (sec !== null && onSeekTime) {
          return (
            <button
              key={idx}
              onClick={() => onSeekTime(sec)}
              title={`Jump to ${part.slice(1, -1)} in lecture recording`}
              className="mx-1 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
            >
              <Clock className="h-3 w-3" />
              <span>{part}</span>
            </button>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}

export function ChatPanel({
  messages,
  loading,
  sending,
  onSend,
  onClear,
  onSeekTime,
  disabled,
}: {
  messages: Msg[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
  onSeekTime?: (sec: number) => void;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (!t || sending || disabled) return;
    onSend(t);
    setInput("");
  };

  const samplePrompts = [
    "What are the core definitions mentioned?",
    "Explain the most complex formula step-by-step",
    "List all action items or assignment hints",
  ];

  return (
    <div className="flex h-[580px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
      {/* ── Tutor Header ── */}
      <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold tracking-tight">AI Tutor (RAG-Grounded)</h3>
              <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-success">
                <ShieldCheck className="h-3 w-3" /> Zero-Hallucination
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Every response is verified against the lecture transcript & uploaded materials</p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-xs text-muted-foreground hover:text-foreground">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Reset Chat
          </Button>
        )}
      </div>

      {/* ── Message Area ── */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-xs text-muted-foreground">Loading lecture context & index...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h4 className="font-display text-sm font-semibold">Ask your AI Lecture Tutor</h4>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              The AI Tutor listens to your lecture transcript and cites exact timestamps <span className="font-mono text-primary">[MM:SS]</span> so you can click to listen.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSend(prompt)}
                  disabled={disabled}
                  className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card hover:text-foreground text-left"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role !== "user" && (
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4.5 py-3 text-xs leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 bg-card/80 text-foreground backdrop-blur"
                }`}
              >
                <RenderMessageContent content={m.content} onSeekTime={onSeekTime} />
                
                {m.role !== "user" && (
                  <div className="mt-2.5 flex items-center gap-2 border-t border-border/40 pt-2 font-mono text-[10px] text-muted-foreground">
                    <Quote className="h-3 w-3 text-primary" />
                    <span>Grounded in Lecture Transcript & RAG Embeddings</span>
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-xs text-muted-foreground backdrop-blur flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Querying lecture vector store & validating citations...</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Input Form ── */}
      <form onSubmit={submit} className="border-t border-border/60 bg-card/60 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? "Transcript required before AI Tutor can answer…" : "Ask anything about formulas, topics, or definitions…"}
            disabled={disabled || sending}
            className="flex h-10 flex-1 rounded-xl border border-input bg-background/80 px-4 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          <Button type="submit" size="default" disabled={disabled || sending || !input.trim()} className="rounded-xl px-4 shadow-md">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
