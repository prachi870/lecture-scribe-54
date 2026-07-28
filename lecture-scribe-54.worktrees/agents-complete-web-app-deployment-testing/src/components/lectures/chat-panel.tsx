import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type Msg = { id: string; role: string; content: string };

export function ChatPanel({
  messages,
  loading,
  sending,
  onSend,
  onClear,
  disabled,
}: {
  messages: Msg[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
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

  return (
    <div className="flex h-[540px] flex-col rounded-2xl border border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">
          Ask anything about this lecture
        </p>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
            <Trash2 className="mr-1.5 h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium">Chat with your lecture</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Try "Explain this in simple terms" or "What are the key formulas?"
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role !== "user" && (
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
              {m.role === "user" && (
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-muted text-primary">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-border/60 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? "Transcript required first…" : "Ask a question…"}
            disabled={disabled || sending}
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          <Button type="submit" size="sm" disabled={disabled || sending || !input.trim()}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
