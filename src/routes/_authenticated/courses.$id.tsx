import { Suspense, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Loader2,
  Mic,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/lectures/status-badge";
import { deleteCourse, getCourse, updateCourse } from "@/lib/courses.functions";
import { listLectures } from "@/lib/lectures.functions";

const courseQuery = (id: string) =>
  queryOptions({
    queryKey: ["course", id],
    queryFn: () => getCourse({ data: { id } }),
  });

const lecturesQuery = queryOptions({
  queryKey: ["lectures"],
  queryFn: () => listLectures(),
});

export const Route = createFileRoute("/_authenticated/courses/$id")({
  head: () => ({
    meta: [{ title: "Course — AuraLearn AI" }],
  }),
  loader: ({ context, params }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(courseQuery(params.id)),
      context.queryClient.ensureQueryData(lecturesQuery),
    ]);
  },
  component: () => (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <CourseDetail />
    </Suspense>
  ),
});

const COLORS = ["#8B5CF6", "#EC4899", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#A855F7"];

function fmtDuration(sec: number | null | undefined) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CourseDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  
  const updateFn = useServerFn(updateCourse);
  const deleteFn = useServerFn(deleteCourse);

  const { data: course } = useSuspenseQuery(courseQuery(id));
  const { data: allLectures } = useSuspenseQuery(lecturesQuery);

  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  const lectures = allLectures.filter((l) => l.course_id === id);

  const openEdit = () => {
    setTitle(course?.title ?? "");
    setCode(course?.code ?? "");
    setDescription(course?.description ?? "");
    setColor(course?.color ?? COLORS[0]);
    setEditOpen(true);
  };

  const save = useMutation({
    mutationFn: () =>
      updateFn({ data: { id, title: title.trim(), code: code.trim() || null, description: description.trim() || null, color } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["course", id] });
      await qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course updated");
      setEditOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted");
      navigate({ to: "/courses" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!course) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link to="/courses" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All courses
        </Link>
        <div className="mt-16 text-center">
          <h2 className="text-lg font-semibold">Course not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">It may have been deleted.</p>
          <Button asChild size="sm" className="mt-6"><Link to="/courses">Back to courses</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/courses" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All courses
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur">
        <div className="h-2 w-full" style={{ background: course.color }} />
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="min-w-0">
            {course.code && (
              <span className="inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {course.code}
              </span>
            )}
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{course.title}</h1>
            {course.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{course.description}</p>
            )}
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-primary/70" />
                {lectures.length} lecture{lectures.length !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {Math.round(lectures.reduce((a, l) => a + (l.duration_seconds ?? 0), 0) / 60)} min total
              </span>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" className="border-border/60" onClick={openEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm(`Delete "${course.title}"? Lectures will remain unassigned.`)) del.mutate();
              }}
              disabled={del.isPending}
            >
              {del.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Lectures in this course
          </h2>
          <Button asChild size="sm" className="shadow-md shadow-primary/20">
            <Link to="/lectures/new" search={{ courseId: id }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add lecture
            </Link>
          </Button>
        </div>

        {lectures.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-16 text-center backdrop-blur">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Mic className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold">No lectures in this course yet</h3>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Record or upload a lecture and assign it to <span className="font-medium text-foreground">{course.title}</span>.
            </p>
            <Button asChild size="sm" className="mt-5">
              <Link to="/lectures/new" search={{ courseId: id }}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New lecture
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
            {lectures.map((l) => (
              <li key={l.id}>
                <Link
                  to="/lectures/$id"
                  params={{ id: l.id }}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-card/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDuration(l.duration_seconds)}
                      </span>
                      <span>{new Date(l.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <StatusBadge status={l.transcript_status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Edit Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="e-title" className="text-xs font-semibold text-muted-foreground">Course Name</Label>
              <Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="e-code" className="text-xs font-semibold text-muted-foreground">Course Code</Label>
              <Input id="e-code" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1.5 font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="e-desc" className="text-xs font-semibold text-muted-foreground">Overview</Label>
              <Textarea id="e-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 text-xs" rows={3} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Theme Color</Label>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColor(col)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${color === col ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
                    style={{ background: col }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending} className="shadow-md">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
