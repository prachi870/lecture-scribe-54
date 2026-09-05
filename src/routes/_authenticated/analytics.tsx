import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Mic, BookOpen, Zap, PieChart as PieIcon, TrendingUp, Brain, Target, Award, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

import { getAnalyticsData } from "@/lib/lectures.functions";

const analyticsQ = queryOptions({
  queryKey: ["analytics"],
  queryFn: () => getAnalyticsData(),
});

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Learning Analytics — AuraLearn AI" },
      { name: "description", content: "Concept mastery, study streaks, and lecture coverage." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(analyticsQ),
  component: AnalyticsPage,
});

const PIE_COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"];

const mockConceptMastery = [
  { concept: "Linear Algebra & Vectors", score: 88 },
  { concept: "Backpropagation", score: 76 },
  { concept: "Convolutional Neural Nets", score: 62 },
  { concept: "Gradient Descent Optimization", score: 45 },
  { concept: "Probability Distributions", score: 92 },
];

function AnalyticsPage() {
  const { data } = useSuspenseQuery(analyticsQ);

  const kpis = [
    { label: "Lectures Processed", value: data.totalLectures, icon: Mic, color: "text-primary", tag: "Live Knowledge Base" },
    { label: "Study Time", value: `${data.totalHours}h`, icon: Clock, color: "text-warning", tag: "Time Spent" },
    { label: "Notes & Summaries", value: data.notesCount, icon: BookOpen, color: "text-success", tag: "7 Note Formats" },
    { label: "Flashcards Active", value: data.flashcardsCount, icon: Zap, color: "text-info", tag: "Spaced Repetition" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* ── Top Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-brand">
              <Brain className="h-3.5 w-3.5" />
              Adaptive Learning Profile
            </span>
            <span className="rounded-full bg-success/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-success">
              Mastery Engine v2.4
            </span>
          </div>
          <h1 className="mt-2.5 font-display text-3xl font-bold tracking-tight">Learning Analytics & Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time telemetry on concept mastery, study velocity, lecture processing, and weak topics.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-2 text-xs backdrop-blur">
          <Award className="h-4 w-4 text-warning" />
          <span className="font-semibold">7 Day Study Streak</span>
          <span className="rounded-md bg-warning/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-warning">🔥 Active</span>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="feature-card relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight">{kpi.value}</p>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">{kpi.tag}</p>
          </div>
        ))}
      </div>

      {/* ── Concept Mastery Radar & Weak Topics Alert ── */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4.5 w-4.5 text-primary" />
            <h2 className="text-sm font-bold">Concept Mastery Scores</h2>
          </div>
          <span className="text-xs text-muted-foreground">Updated automatically per lecture</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {mockConceptMastery.map((c) => (
            <div key={c.concept} className="rounded-xl border border-border/50 bg-background/40 p-3.5 text-left">
              <p className="truncate text-xs font-semibold text-foreground">{c.concept}</p>
              <div className="mt-2 flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">Mastery</span>
                <span className={`font-bold ${c.score < 50 ? "text-destructive" : c.score < 75 ? "text-warning" : "text-success"}`}>
                  {c.score}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                <div
                  className={`h-full rounded-full transition-all ${
                    c.score < 50 ? "bg-destructive" : c.score < 75 ? "bg-warning" : "bg-success"
                  }`}
                  style={{ width: `${c.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts Grid ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Timeline Chart */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Lecture Timeline (Minutes Recorded)</h2>
            </div>
          </div>
          {data.activityTimeline.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
              No lecture recordings logged yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.activityTimeline}>
                  <defs>
                    <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="durationMinutes"
                    name="Minutes"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMinutes)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Status Distribution Pie */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-success" />
              <h2 className="text-sm font-semibold">AI Ingestion Pipeline Status</h2>
            </div>
          </div>
          {data.statusCounts.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
              No pipeline status data.
            </div>
          ) : (
            <div className="flex flex-col items-center sm:flex-row sm:justify-around">
              <div className="h-56 w-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.statusCounts}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {data.statusCounts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2 text-xs sm:mt-0">
                {data.statusCounts.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}:</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lectures per Course */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-warning" />
              <h2 className="text-sm font-semibold">Course Coverage Breakdown</h2>
            </div>
          </div>
          {data.courseDistribution.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
              No course lectures registered yet.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.courseDistribution} layout="vertical">
                  <XAxis type="number" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" name="Lectures" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Flashcard Difficulty */}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-info" />
              <h2 className="text-sm font-semibold">Spaced Repetition Difficulty Profile</h2>
            </div>
          </div>
          {data.flashcardsCount === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
              No flashcards generated yet.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.difficultyBreakdown}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" name="Cards" radius={[4, 4, 0, 0]}>
                    {data.difficultyBreakdown.map((entry, index) => (
                      <Cell key={`cell-diff-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
