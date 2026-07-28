import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { MessagesSquare, ArrowRight } from "lucide-react";

import { listLectures } from "@/lib/lectures.functions";
import { Button } from "@/components/ui/button";

const q = queryOptions({ queryKey: ["lectures"], queryFn: () => listLectures() });

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "AI Chat — ALIP" },
      { name: "description", content: "Chat with your lectures. Ask anything and get grounded answers." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: ChatIndex,
});

function ChatIndex() {
  const { data } = useSuspenseQuery(q);
  const ready = data.filter((l) => l.transcript_status === "completed");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Ask</p>
      <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Chat with a lecture</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick a lecture to start a conversation.</p>

      {ready.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
            <MessagesSquare className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">No transcribed lectures yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Add a lecture first — once it's transcribed, you can chat with it here.
          </p>
          <Button asChild size="sm" className="mt-5"><Link to="/lectures/new">New lecture</Link></Button>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          {ready.map((l) => (
            <li key={l.id}>
              <Link
                to="/lectures/$id"
                params={{ id: l.id }}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-card/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
