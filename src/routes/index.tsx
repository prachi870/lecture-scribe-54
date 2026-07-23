import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Mic,
  Brain,
  Search,
  BookOpen,
  MessagesSquare,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ALIP — Your AI Lecture Companion" },
      {
        name: "description",
        content:
          "Record any lecture, get transcripts, structured notes, flashcards, and an AI tutor that cites the exact moment it learned from.",
      },
      { property: "og:title", content: "ALIP — Your AI Lecture Companion" },
      {
        property: "og:description",
        content:
          "Record any lecture, get transcripts, structured notes, flashcards, and an AI tutor that cites the exact moment it learned from.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Mic,
    title: "Record or upload",
    desc: "Capture live lectures or drop in audio and video. Auto-saved as you go.",
  },
  {
    icon: Brain,
    title: "Structured intelligence",
    desc: "Summary, key concepts, formulas, action items — extracted the moment recording ends.",
  },
  {
    icon: MessagesSquare,
    title: "Ask anything",
    desc: "Chat with your lectures. Every answer cites a slide and a timestamp.",
  },
  {
    icon: Search,
    title: "Semantic search",
    desc: "Find that one thing the professor mentioned three weeks ago. Instantly.",
  },
  {
    icon: BookOpen,
    title: "Flashcards & quizzes",
    desc: "Spaced-repetition decks generated from your own material.",
  },
  {
    icon: Zap,
    title: "Personalised revision",
    desc: "Weak-topic radar with a study plan that adapts every week.",
  },
];

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="aurora pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-70" />
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[720px]" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-[15px] font-semibold tracking-tight">ALIP</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-1.5 text-sm font-medium text-background transition-transform hover:-translate-y-px"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-16 text-center sm:pt-24">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>An AI teaching assistant, not a note taker</span>
        </div>

        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <span className="text-gradient">Every lecture,</span>
          <br />
          <span className="text-foreground">understood.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
          ALIP listens to your lectures, extracts the knowledge, and turns it into notes,
          flashcards, quizzes, and an AI tutor that cites the exact moment it learned from.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40"
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-5 py-2.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-muted/40"
          >
            See how it works
          </a>
        </div>

        {/* Preview card */}
        <div className="relative mx-auto mt-20 max-w-4xl">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-2xl" />
          <div className="glass relative overflow-hidden rounded-2xl border border-border/60 p-1">
            <div className="rounded-xl bg-card/60 p-6 text-left">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive/70" />
                  <div className="h-2 w-2 rounded-full bg-warning/70" />
                  <div className="h-2 w-2 rounded-full bg-success/70" />
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  cs229 · lecture 07 · 00:42:18
                </div>
              </div>
              <div className="grid gap-4 pt-5 md:grid-cols-3">
                {[
                  { label: "Transcript", value: "12,481 words", tint: "text-primary" },
                  { label: "Key concepts", value: "9 extracted", tint: "text-success" },
                  { label: "Flashcards", value: "24 generated", tint: "text-warning" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-border/50 bg-background/40 p-4"
                  >
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </p>
                    <p className={`mt-1.5 font-display text-lg font-semibold ${s.tint}`}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 rounded-lg border border-border/50 bg-background/40 p-4 font-mono text-xs text-muted-foreground">
                <div>
                  <span className="text-primary">10:42</span> Introduction of the CNN
                  architecture and why convolutions matter for spatial data...
                </div>
                <div>
                  <span className="text-primary">11:05</span> Backpropagation walkthrough
                  with a concrete numerical example on a 3×3 kernel...
                </div>
                <div className="text-foreground/80">
                  <span className="text-success">✓</span> Summary and 5 practice questions
                  generated
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            The platform
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Six systems, one workflow.
          </h2>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative bg-card/60 p-6 transition-colors hover:bg-card"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-muted text-primary transition-transform group-hover:-translate-y-0.5">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="how" className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <div className="glass relative overflow-hidden rounded-2xl border border-border/60 p-10 text-center">
          <div className="aurora pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Stop taking notes. Start understanding.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Free while in early access. No credit card required.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40"
            >
              Create your account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span>© {new Date().getFullYear()} ALIP</span>
          </div>
          <span>An AI-powered lecture companion.</span>
        </div>
      </footer>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary via-primary/70 to-primary/40">
      <div className="absolute inset-[1px] rounded-[5px] bg-background" />
      <div className="relative h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-primary to-primary/60" />
    </div>
  );
}
