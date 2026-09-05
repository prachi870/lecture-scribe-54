import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  Mic, Upload, Sparkles, Clock, Brain, ArrowRight, BookOpen, Zap, MessagesSquare, CheckCircle2,
  Network, Flame, Target, ChevronRight, GraduationCap, ShieldCheck
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/lectures.functions";
import { StatusBadge } from "@/components/lectures/status-badge";

const q = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboardStats() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AuraLearn AI" },
      { name: "description", content: "Your AI Learning Operating System cockpit — lectures, concepts, and adaptive study." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(q);

  const stats = [
    { label: "Lectures Ingested", value: String(data.lectureCount), suffix: "", icon: Mic, tint: "text-primary" },
    { label: "Hours Processed", value: String(data.hours), suffix: "h", icon: Clock, tint: "text-warning" },
    { label: "Structured Notes", value: String(data.notesCount), suffix: "", icon: BookOpen, tint: "text-success" },
    { label: "Flashcard Decks", value: String(data.flashcardsCount ?? 0), suffix: "", icon: Zap, tint: "text-info" },
    { label: "Knowledge Ready", value: String(data.readyCount), suffix: "", icon: CheckCircle2, tint: "text-chart-2" },
  ];

  const quickActions = [
    { icon: BookOpen, title: "7-Format Notes", desc: "Executive, exam, bullet & ELI5 notes", href: "/notes" as const },
    { icon: Zap, title: "Spaced Flashcards", desc: "SM-2 algorithm quiz decks", href: "/flashcards" as const },
    { icon: MessagesSquare, title: "AI Tutor (RAG)", desc: "Citation-backed doubt solver", href: "/chat" as const },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* ── Top Header Strip ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-brand">
              <Brain className="h-3.5 w-3.5" />
              AI Learning Operating System
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-warning">
              <Flame className="h-3.5 w-3.5 text-warning fill-warning" /> 7 Day Streak
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Learning Cockpit</h1>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" className="border-border/60 bg-card/40 backdrop-blur" asChild>
            <Link to="/lectures/new"><Upload className="mr-2 h-4 w-4" />Upload PDF / Media</Link>
          </Button>
          <Button asChild className="shadow-lg shadow-primary/20">
            <Link to="/lectures/new"><Mic className="mr-2 h-4 w-4" />Record Live Lecture</Link>
          </Button>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="feature-card relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.tint}`} />
            </div>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight">
              {s.value}
              <span className="ml-1 text-sm font-medium text-muted-foreground">{s.suffix}</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── Main Dashboard Layout ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent Lectures */}
        <section className="lg:col-span-2">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Recent Lecture Knowledge Hubs</h2>
            </div>
            <Link to="/lectures" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              View all lectures <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
            {data.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                  <Mic className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">No lectures ingested yet</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Record live audio, upload files, or import YouTube links — AuraLearn AI builds structured knowledge automatically.
                </p>
                <Button asChild size="sm" className="mt-5 shadow-md">
                  <Link to="/lectures/new"><Mic className="mr-2 h-3.5 w-3.5" />Start live recording</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {data.recent.map((l) => (
                  <li key={l.id}>
                    <Link
                      to="/lectures/$id"
                      params={{ id: l.id }}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-card/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{l.title}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <span>{new Date(l.created_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="text-primary/90">Knowledge Graph Active</span>
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

        {/* AI Knowledge Assistant & Weak Topics Radar */}
        <aside className="space-y-6">
          <div className="glass relative overflow-hidden rounded-2xl border border-border/60 p-5">
            <div className="aurora-subtle pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/30">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-bold">Knowledge Engine Status</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Every lecture permanently enhances your personal learning model. Answers are backed by RAG citations with exact timestamps.
              </p>
              
              <div className="mt-4 rounded-xl border border-border/50 bg-background/50 p-3 font-mono text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between text-foreground">
                  <span>Knowledge Graph</span>
                  <span className="text-success font-semibold">Online</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Prerequisite Checking</span>
                  <span className="text-primary font-semibold">Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Concept Mastery Radar</h3>
              <Target className="h-4 w-4 text-warning" />
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between font-medium">
                  <span>Gradient Descent</span>
                  <span className="font-mono text-warning">45% (Needs Review)</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-border/50 overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: "45%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between font-medium">
                  <span>Convolutional Layers</span>
                  <span className="font-mono text-success">82% (Mastered)</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-border/50 overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: "82%" }} />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Quick Action Cards ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {quickActions.map((c) => (
          <Link key={c.title} to={c.href} className="feature-card group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur transition-all hover:border-primary/40 hover:bg-card/80">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <c.icon className="h-4.5 w-4.5" />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
            </div>
            <h4 className="mt-4 text-sm font-bold tracking-tight">{c.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
