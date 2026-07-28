import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  Mic, Upload, Sparkles, Clock, Brain, ArrowRight, BookOpen, Zap, MessagesSquare, CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/lectures.functions";
import { StatusBadge } from "@/components/lectures/status-badge";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboardStats() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ALIP" },
      { name: "description", content: "Your learning cockpit — lectures, notes, and AI insights." },
      { property: "og:title", content: "Dashboard — ALIP" },
      { property: "og:description", content: "Your lecture intelligence dashboard." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(q);

  const stats = [
    { label: "Lectures", value: String(data.lectureCount), suffix: "", icon: Mic, tint: "text-primary" },
    { label: "Hours recorded", value: String(data.hours), suffix: "h", icon: Clock, tint: "text-warning" },
    { label: "Notes generated", value: String(data.notesCount), suffix: "", icon: BookOpen, tint: "text-success" },
    { label: "Ready to study", value: String(data.readyCount), suffix: "", icon: CheckCircle2, tint: "text-chart-2" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Overview</p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Your learning cockpit</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border/60 bg-background/40" asChild>
            <Link to="/lectures/new"><Upload className="mr-2 h-4 w-4" />Upload / URL</Link>
          </Button>
          <Button asChild className="shadow-lg shadow-primary/20">
            <Link to="/lectures/new"><Mic className="mr-2 h-4 w-4" />New recording</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card/60 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.tint}`} />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight">
              {s.value}
              <span className="ml-1 text-base font-medium text-muted-foreground">{s.suffix}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent lectures</h2>
            <Link to="/lectures" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40">
            {data.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
                  <Mic className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">No lectures yet</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                  Record, upload, or paste a YouTube link — ALIP transcribes and generates notes automatically.
                </p>
                <Button asChild size="sm" className="mt-5">
                  <Link to="/lectures/new"><Mic className="mr-2 h-3.5 w-3.5" />Start recording</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {data.recent.map((l) => (
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
                      <StatusBadge status={l.transcript_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass rounded-2xl border border-border/60 p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-muted">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">AI insights</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every lecture becomes a summary, key points, glossary, flashcards, and a chat you can ask anything.
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3">
        {[
          { icon: BookOpen, title: "Notes", desc: "Structured notes from every lecture", href: "/notes" as const },
          { icon: Zap, title: "Flashcards", desc: "Quiz cards generated for you", href: "/flashcards" as const },
          { icon: MessagesSquare, title: "AI Chat", desc: "Ask anything about your lectures", href: "/chat" as const },
        ].map((c) => (
          <Link key={c.title} to={c.href} className="group relative bg-card/60 p-5 transition-colors hover:bg-card">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-muted text-primary">
                <c.icon className="h-4 w-4" />
              </div>
              <Brain className="h-4 w-4 text-muted-foreground opacity-40" />
            </div>
            <h4 className="mt-4 text-sm font-semibold">{c.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
