import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Pencil, Trash2, Library, BookOpen, GraduationCap, Sparkles } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCourse, deleteCourse, listCourses, updateCourse } from "@/lib/courses.functions";

const coursesQ = () =>
  queryOptions({ queryKey: ["courses"], queryFn: () => listCourses() });

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({
    meta: [
      { title: "Courses & Semesters — AuraLearn AI" },
      { name: "description", content: "Organize your lectures and course materials." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQ()),
  component: CoursesPage,
});

const COLORS = ["#8B5CF6", "#EC4899", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#A855F7"];

type Course = {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  color: string;
  lectureCount: number;
};

function CoursesPage() {
  const { data } = useSuspenseQuery(coursesQ());
  const qc = useQueryClient();
  const createFn = useServerFn(createCourse);
  const updateFn = useServerFn(updateCourse);
  const deleteFn = useServerFn(deleteCourse);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [selectedSemester, setSelectedSemester] = useState("Fall 2026");

  const semesters = ["Fall 2026", "Spring 2026", "Fall 2025"];

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setCode("");
    setDescription("");
    setColor(COLORS[0]);
    setDialogOpen(true);
  };
  const openEdit = (c: Course) => {
    setEditing(c);
    setTitle(c.title);
    setCode(c.code ?? "");
    setDescription(c.description ?? "");
    setColor(c.color);
    setDialogOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title: title.trim(), code: code.trim() || null, description: description.trim() || null, color };
      if (editing) await updateFn({ data: { id: editing.id, ...payload } });
      else await createFn({ data: payload });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success(editing ? "Course updated" : "Course created");
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted");
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* ── Top Header & Semester Selector ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-brand">
              <GraduationCap className="h-3.5 w-3.5" />
              Semester Context
            </span>
            <div className="flex gap-1.5 rounded-lg border border-border/50 bg-card/40 p-1">
              {semesters.map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSelectedSemester(sem)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    selectedSemester === sem
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Courses & Syllabus</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Courses in {selectedSemester} form the permanent knowledge context for the AI Tutor.
          </p>
        </div>

        <Button onClick={openNew} className="shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> New Course
        </Button>
      </div>

      {/* ── Main List / Empty State ── */}
      {data.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center backdrop-blur">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
            <Library className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">No courses in {selectedSemester}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add your subjects (e.g. CS229 Machine Learning) and upload course syllabi, textbooks, and past papers.
          </p>
          <Button className="mt-6 shadow-md" size="sm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Create Course Context
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div
              key={c.id}
              className="feature-card group relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur transition-all hover:border-primary/40 hover:bg-card/80"
            >
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.color }} />
              
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {c.code && (
                    <span className="inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {c.code}
                    </span>
                  )}
                  <h3 className="mt-2 truncate font-display text-lg font-bold tracking-tight">{c.title}</h3>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${c.title}"? Lectures will remain unassigned.`)) del.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {c.description ? (
                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
              ) : (
                <p className="mt-2.5 text-xs italic text-muted-foreground/60">No description provided</p>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5 text-primary/70" />
                  <span>{c.lectureCount} lecture{c.lectureCount === 1 ? "" : "s"}</span>
                </div>

                <Link
                  to="/courses/$id"
                  params={{ id: c.id }}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>View course</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              {editing ? "Edit Course" : "Create New Course"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="c-title" className="text-xs font-semibold text-muted-foreground">Course Name</Label>
              <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Artificial Intelligence & Neural Networks" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="c-code" className="text-xs font-semibold text-muted-foreground">Course Code</Label>
              <Input id="c-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CS-401" className="mt-1.5 font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="c-desc" className="text-xs font-semibold text-muted-foreground">Overview & Syllabus Context</Label>
              <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of topics covered this semester..." className="mt-1.5 text-xs" rows={3} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Theme Tag Color</Label>
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
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending} className="shadow-md">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
