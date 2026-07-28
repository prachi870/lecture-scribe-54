import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Mic,
  Brain,
  BookOpen,
  MessagesSquare,
  Zap,
  Network,
  BarChart3,
  CheckCircle,
  Play,
  Upload,
  Youtube,
  FileText,
  Clock,
  Target,
  TrendingUp,
  Shield,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AuraLearn AI — The AI Learning Operating System" },
      {
        name: "description",
        content:
          "Transform every lecture into structured knowledge. AuraLearn AI extracts concepts, builds a Knowledge Graph, and gives you a citation-backed AI tutor — not just a transcript.",
      },
      { property: "og:title", content: "AuraLearn AI — The AI Learning Operating System" },
      {
        property: "og:description",
        content:
          "Beyond transcription. AuraLearn AI understands your lectures, builds knowledge, and continuously improves your learning outcomes.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Brain,
    title: "Knowledge Extraction",
    desc: "Every concept, formula, definition, and learning objective extracted and structured — not buried in a transcript.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    desc: "Concepts connect across lectures. See how Linear Algebra links to Neural Networks and why you need one before the other.",
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/20",
  },
  {
    icon: MessagesSquare,
    title: "AI Tutor with Citations",
    desc: "Ask anything. Every answer is grounded in your lecture materials — with exact timestamps, slide numbers, and document references.",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
  },
  {
    icon: BarChart3,
    title: "Adaptive Learning Profile",
    desc: "Concept mastery scores, weak topics radar, learning velocity. The system gets smarter every time you engage.",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
  },
  {
    icon: Zap,
    title: "Smart Study Tools",
    desc: "Flashcards, MCQs, viva questions, and a spaced repetition engine — all generated from your exact lecture content.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  {
    icon: Target,
    title: "Prerequisite Intelligence",
    desc: "Before Neural Networks, do you know Gradient Descent? AuraLearn checks and recommends what to revise first.",
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/20",
  },
];

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload or Record",
    desc: "Audio, video, PDFs, slides, or YouTube links. Record live with waveform visualization and auto-save.",
    tags: ["Audio", "Video", "PDF", "Slides", "YouTube"],
  },
  {
    number: "02",
    icon: Brain,
    title: "AI Understands",
    desc: "Transcription, speaker separation, OCR, concept extraction, formula detection, and Knowledge Graph building — automatically.",
    tags: ["Whisper", "OCR", "NLP", "Knowledge Graph"],
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "You Learn Faster",
    desc: "Structured notes in 5 formats, flashcards, quizzes, AI tutor, revision schedule, and mastery tracking — all from one lecture.",
    tags: ["Notes", "Flashcards", "AI Tutor", "Revision"],
  },
];

const comparison = [
  { feature: "Transcription", others: true, aura: true },
  { feature: "AI-generated notes", others: "basic", aura: true },
  { feature: "Citation-backed answers", others: false, aura: true },
  { feature: "Knowledge Graph", others: false, aura: true },
  { feature: "Prerequisite checking", others: false, aura: true },
  { feature: "Concept mastery scoring", others: false, aura: true },
  { feature: "Spaced repetition", others: false, aura: true },
  { feature: "Adaptive learning profile", others: false, aura: true },
];

const inputModes = [
  { icon: Mic, label: "Record live" },
  { icon: Upload, label: "Upload audio/video" },
  { icon: FileText, label: "Upload PDF/slides" },
  { icon: Youtube, label: "YouTube import" },
];

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* ── Background effects ── */}
      <div className="aurora pointer-events-none absolute inset-x-0 top-0 h-[900px] opacity-65" />
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[900px]" />

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 header-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <AuraLearnLogo />
            <span className="font-display text-base font-semibold tracking-tight">
              AuraLearn <span className="text-primary">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#vs-others" className="transition-colors hover:text-foreground">
              vs. Others
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden rounded-lg px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="group inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-primary/35 hover:-translate-y-px"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-20 text-center sm:pt-28">
        {/* Badge */}
        <div className="badge-brand mx-auto w-fit">
          <Sparkles className="h-3 w-3" />
          <span>Beyond transcription — an AI Learning OS</span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto mt-7 max-w-4xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <span className="text-gradient">Stop taking notes.</span>
          <br />
          <span className="text-foreground">Start building knowledge.</span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          AuraLearn AI transforms every lecture into a structured knowledge base — with
          AI-extracted concepts, a citation-backed tutor, a living Knowledge Graph, and
          a learning profile that continuously adapts to you.
        </p>

        {/* CTA buttons */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:shadow-primary/40 hover:-translate-y-0.5"
          >
            Start learning free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-6 py-3 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-card/70"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            See how it works
          </a>
        </div>

        {/* Input modes */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {inputModes.map((mode) => (
            <div
              key={mode.label}
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/30 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
            >
              <mode.icon className="h-3 w-3" />
              {mode.label}
            </div>
          ))}
        </div>

        {/* Hero UI mockup */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl opacity-60" />
          <div className="glass relative overflow-hidden rounded-2xl border border-border/60 p-1 shadow-2xl">
            {/* Mockup header */}
            <div className="rounded-xl bg-card/70 p-5">
              <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/40 px-2.5 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    CS229 · Lecture 07 · Deep Learning
                  </span>
                  <span>00:42:18</span>
                </div>
              </div>

              {/* Three-column mockup */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Transcript */}
                <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-left">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    AI Transcript
                  </p>
                  <div className="space-y-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    <div>
                      <span className="font-semibold text-primary">10:42</span>{" "}
                      Introduction to CNN architecture — why convolutions work for spatial data...
                    </div>
                    <div>
                      <span className="font-semibold text-primary">11:05</span>{" "}
                      Backpropagation with a 3×3 kernel — numerical walkthrough...
                    </div>
                    <div>
                      <span className="font-semibold text-primary">14:18</span>{" "}
                      Pooling layers: max vs average, spatial invariance...
                    </div>
                  </div>
                </div>

                {/* Concepts */}
                <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-left">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Extracted Concepts
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: "Convolutional Layer", mastery: 82, color: "bg-primary" },
                      { label: "Backpropagation", mastery: 71, color: "bg-success" },
                      { label: "Max Pooling", mastery: 64, color: "bg-warning" },
                      { label: "ReLU Activation", mastery: 90, color: "bg-info" },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-foreground/80">{c.label}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-border/50">
                            <div
                              className={`h-full rounded-full ${c.color}`}
                              style={{ width: `${c.mastery}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {c.mastery}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Tutor */}
                <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-left">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    AI Tutor Chat
                  </p>
                  <div className="space-y-2.5">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <p className="text-[11px] text-primary/90">
                        Why do we use ReLU over sigmoid?
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5">
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Prof. Chen explained at{" "}
                        <span className="font-semibold text-primary">14:32</span>:{" "}
                        ReLU avoids vanishing gradients by keeping gradients constant for positive inputs...
                      </p>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">
                      📎 Source: Lecture 07, Slide 23
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="mt-4 grid grid-cols-4 gap-3 rounded-xl border border-border/40 bg-background/20 p-3">
                {[
                  { label: "Words transcribed", value: "12,481", color: "text-primary" },
                  { label: "Concepts extracted", value: "9", color: "text-success" },
                  { label: "Flashcards generated", value: "24", color: "text-warning" },
                  { label: "Quiz questions", value: "18", color: "text-info" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust / Stats strip ── */}
      <section className="relative z-10 border-y border-border/40 bg-card/20 py-10 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              { value: "100%", label: "Citation-backed answers", icon: Shield },
              { value: "7", label: "Note formats per lecture", icon: FileText },
              { value: "∞", label: "Knowledge Graph growth", icon: Network },
              { value: "SM-2", label: "Spaced repetition algorithm", icon: Clock },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <s.icon className="mb-1 h-4 w-4 text-primary/60" />
                <p className="font-display text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            The Platform
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Six systems. One intelligent OS.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Not a note-taker. Not a chatbot. AuraLearn AI is a complete learning operating
            system that understands, connects, and builds on every lecture you consume.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="feature-card group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div
                className={`relative mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${f.border} ${f.bg}`}
              >
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="relative text-base font-semibold text-foreground">{f.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="relative z-10 border-y border-border/40 bg-card/10 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              The Workflow
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              One lecture. Infinite intelligence.
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="absolute left-full top-8 hidden w-full -translate-x-1/2 items-center md:flex">
                    <div className="h-px w-full bg-gradient-to-r from-border/60 to-transparent" />
                    <ChevronRight className="h-4 w-4 -ml-2 text-border/40" />
                  </div>
                )}
                <div className="glass rounded-2xl border border-border/50 p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-mono text-3xl font-bold text-border/40">{step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {step.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── vs Others comparison ── */}
      <section id="vs-others" className="relative z-10 mx-auto max-w-4xl px-6 py-24">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            The Difference
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Not just a better transcript tool.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
            Otter AI and NotebookLM are great at transcription. AuraLearn AI goes three levels deeper.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border/60">
          {/* Header */}
          <div className="grid grid-cols-3 border-b border-border/60 bg-card/60 px-6 py-4">
            <p className="text-sm font-medium text-muted-foreground">Feature</p>
            <p className="text-center text-sm font-medium text-muted-foreground">Others</p>
            <p className="text-center text-sm font-semibold text-primary">AuraLearn AI</p>
          </div>
          {comparison.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 items-center border-b border-border/40 px-6 py-3.5 text-sm ${
                i % 2 === 0 ? "bg-card/20" : "bg-card/40"
              }`}
            >
              <p className="text-foreground/80">{row.feature}</p>
              <div className="flex justify-center">
                {row.others === true ? (
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                ) : row.others === false ? (
                  <span className="text-lg text-border/60">—</span>
                ) : (
                  <span className="rounded-full border border-border/50 bg-card/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {row.others}
                  </span>
                )}
              </div>
              <div className="flex justify-center">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <div className="glass relative overflow-hidden rounded-3xl border border-border/60 p-12 text-center">
          <div className="aurora pointer-events-none absolute inset-0 opacity-40" />
          <div className="absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="badge-brand mx-auto mb-6 w-fit">
              <Sparkles className="h-3 w-3" />
              Free while in early access
            </div>
            <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Your lectures deserve{" "}
              <span className="text-gradient-brand">real intelligence.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
              Join students who are building knowledge instead of taking notes. No credit card required.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-primary/50 hover:-translate-y-0.5"
              >
                Start learning free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-card/60"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2.5">
            <AuraLearnLogo />
            <span className="font-display font-semibold text-foreground/80">
              AuraLearn AI
            </span>
            <span className="ml-1">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <span>The AI Learning Operating System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function AuraLearnLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-9 w-9" : "h-7 w-7";
  const inner = size === "sm" ? "h-2 w-2" : size === "lg" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div
      className={`relative flex ${dims} items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary/80 to-primary/50`}
    >
      <div className="absolute inset-[1.5px] rounded-[5px] bg-background" />
      {/* A stylised "A" neural node */}
      <div className="relative flex items-center justify-center">
        <div className={`${inner} rounded-sm bg-gradient-to-br from-primary to-primary/70`} />
        <div className="absolute -top-0.5 left-1/2 h-1 w-px -translate-x-1/2 bg-primary/80" />
        <div className="absolute -left-1 top-1/2 h-px w-1 -translate-y-1/2 bg-primary/60" />
        <div className="absolute -right-1 top-1/2 h-px w-1 -translate-y-1/2 bg-primary/60" />
      </div>
    </div>
  );
}
