import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Mic,
  Upload,
  Sparkles,
  Flame,
  Clock,
  Brain,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ALIP" },
      {
        name: "description",
        content:
          "Your lecture intelligence dashboard — recent recordings, courses, weekly study, and AI insights.",
      },
      { property: "og:title", content: "Dashboard — ALIP" },
      { property: "og:description", content: "Your lecture intelligence dashboard." },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Study streak", value: "0", suffix: "days", icon: Flame, tint: "text-warning" },
  { label: "Hours this week", value: "0.0", suffix: "h", icon: Clock, tint: "text-primary" },
  { label: "Concepts learned", value: "0", suffix: "", icon: Brain, tint: "text-success" },
  { label: "Cards to review", value: "0", suffix: "", icon: Sparkles, tint: "text-chart-2" },
];

function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Overview
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
            Your learning cockpit
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border/60 bg-background/40" asChild>
            <Link to="/lectures">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Link>
          </Button>
          <Button asChild className="shadow-lg shadow-primary/20">
            <Link to="/lectures">
              <Mic className="mr-2 h-4 w-4" />
              New recording
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat grid */}
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card/60 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <s.icon className={`h-4 w-4 ${s.tint}`} />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight">
              {s.value}
              <span className="ml-1 text-base font-medium text-muted-foreground">
                {s.suffix}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent lectures */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent lectures</h2>
            <Link
              to="/lectures"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40">
            <EmptyState
              icon={Mic}
              title="No lectures yet"
              description="Record your first lecture or upload existing audio. ALIP will transcribe, summarize, and turn it into flashcards automatically."
              cta={
                <Button asChild size="sm" className="shadow-md shadow-primary/20">
                  <Link to="/lectures">
                    <Mic className="mr-2 h-3.5 w-3.5" />
                    Start recording
                  </Link>
                </Button>
              }
            />
          </div>
        </section>

        {/* Side column */}
        <aside className="space-y-6">
          {/* AI insights */}
          <div className="glass rounded-2xl border border-border/60 p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-muted">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">AI insights</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Once you record a few lectures, ALIP will surface weak topics, suggested
              revisions, and cross-lecture connections here.
            </p>
          </div>

          {/* Weekly rhythm */}
          <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <h3 className="mb-4 text-sm font-semibold">This week</h3>
            <div className="flex items-end justify-between gap-2">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="flex h-16 w-6 items-end rounded-md bg-muted/40">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-primary/40 to-primary/80"
                      style={{ height: `${[0, 0, 0, 0, 0, 0, 0][i]}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{d}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No study sessions logged yet.
            </p>
          </div>
        </aside>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3">
        {[
          {
            icon: BookOpen,
            title: "Notes",
            desc: "Structured notes from every lecture",
            href: "/notes",
          },
          {
            icon: Zap,
            title: "Flashcards",
            desc: "Spaced repetition, generated for you",
            href: "/flashcards",
          },
          {
            icon: Brain,
            title: "AI Chat",
            desc: "Ask questions, get cited answers",
            href: "/chat",
          },
        ].map((c) => (
          <Link
            key={c.title}
            to={c.href}
            className="group relative bg-card/60 p-5 transition-colors hover:bg-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-muted text-primary">
                <c.icon className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <h4 className="mt-4 text-sm font-semibold">{c.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: typeof Mic;
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}
