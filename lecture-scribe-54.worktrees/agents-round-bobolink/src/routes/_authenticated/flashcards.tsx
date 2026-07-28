import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

import { listAllFlashcards } from "@/lib/lectures.functions";
import { Button } from "@/components/ui/button";

const q = queryOptions({ queryKey: ["all-flashcards"], queryFn: () => listAllFlashcards() });

export const Route = createFileRoute("/_authenticated/flashcards")({
  head: () => ({
    meta: [
      { title: "Flashcards — ALIP" },
      { name: "description", content: "Study flashcards generated from your lectures." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: FlashcardsPage,
});

type Row = {
  id: string;
  question: string;
  answer: string;
  difficulty: string;
  lecture_id: string;
  lectures: { title: string } | { title: string }[] | null;
};

function FlashcardsPage() {
  const { data } = useSuspenseQuery(q);
  const cards = data as unknown as Row[];
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Flashcards</h1>
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">No cards yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Open a lecture and generate flashcards to study here.
          </p>
          <Button asChild size="sm" className="mt-5"><Link to="/lectures">Go to lectures</Link></Button>
        </div>
      </div>
    );
  }

  const card = cards[Math.min(idx, cards.length - 1)];
  const title = Array.isArray(card.lectures) ? card.lectures[0]?.title : card.lectures?.title;
  const next = () => { setFlipped(false); setIdx((i) => (i + 1) % cards.length); };
  const prev = () => { setFlipped(false); setIdx((i) => (i - 1 + cards.length) % cards.length); };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Study</p>
      <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Flashcards</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Card {idx + 1} of {cards.length}
        {title && <> · from <Link to="/lectures/$id" params={{ id: card.lecture_id }} className="text-primary hover:underline">{title}</Link></>}
      </p>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="group relative mt-6 flex min-h-[320px] w-full items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-10 text-center transition-all hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
      >
        <div className="absolute left-4 top-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {flipped ? "Answer" : "Question"} · {card.difficulty}
        </div>
        <p className="max-w-2xl text-xl font-medium leading-relaxed">
          {flipped ? card.answer : card.question}
        </p>
        <div className="absolute bottom-3 right-4 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Click to flip
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prev}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
        </Button>
        <Button size="sm" onClick={next}>Got it → Next</Button>
      </div>
    </div>
  );
}
