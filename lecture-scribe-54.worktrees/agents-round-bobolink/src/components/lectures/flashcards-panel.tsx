import { useState } from "react";
import { Loader2, Sparkles, RefreshCcw, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type Card = { id: string; question: string; answer: string; difficulty: string };

export function FlashcardsPanel({
  cards,
  loading,
  onGenerate,
  generating,
  hasTranscript,
}: {
  cards: Card[];
  loading: boolean;
  onGenerate: () => void;
  generating: boolean;
  hasTranscript: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card/40 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <p className="text-base font-semibold">No flashcards yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Generate quiz cards to test your understanding of this lecture.
        </p>
        <Button
          className="mt-5"
          size="sm"
          onClick={onGenerate}
          disabled={!hasTranscript || generating}
        >
          {generating ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-3.5 w-3.5" />
          )}
          {generating ? "Generating…" : "Generate flashcards"}
        </Button>
      </div>
    );
  }

  const card = cards[Math.min(idx, cards.length - 1)];
  const next = () => {
    setFlipped(false);
    setIdx((i) => (i + 1) % cards.length);
  };
  const prev = () => {
    setFlipped(false);
    setIdx((i) => (i - 1 + cards.length) % cards.length);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Card {idx + 1} of {cards.length}
        </p>
        <Button size="sm" variant="ghost" onClick={onGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          )}
          Regenerate
        </Button>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="group relative flex min-h-[220px] w-full items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-8 text-center transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
      >
        <div className="absolute left-4 top-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {flipped ? "Answer" : "Question"} · {card.difficulty}
        </div>
        <p className="max-w-xl text-lg font-medium leading-relaxed">
          {flipped ? card.answer : card.question}
        </p>
        <div className="absolute bottom-3 right-4 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Click to flip
        </div>
      </button>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prev}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
        </Button>
        <div className="flex gap-1.5">
          {cards.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={next}>
          Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
