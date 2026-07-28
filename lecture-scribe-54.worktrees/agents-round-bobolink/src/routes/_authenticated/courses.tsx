import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Pencil, Trash2, Library } from "lucide-react";
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
      { title: "Courses — ALIP" },
      { name: "description", content: "Organize your lectures by course." },
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Library</p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Courses</h1>
        </div>
        <Button onClick={openNew} className="shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> New course
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-muted text-primary">
            <Library className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">No courses yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Create a course to group related lectures by subject or semester.
          </p>
          <Button className="mt-5" size="sm" onClick={openNew}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Create your first course
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div
              key={c.id}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 transition-colors hover:bg-card/70"
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {c.code && (
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.code}
                    </p>
                  )}
                  <h3 className="mt-1 truncate text-base font-semibold">{c.title}</h3>
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
                      if (confirm(`Delete "${c.title}"? Lectures inside will not be deleted.`)) del.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {c.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                {c.lectureCount} lecture{c.lectureCount === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="c-title">Title</Label>
              <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Machine Learning" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="c-code">Code (optional)</Label>
              <Input id="c-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS229" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="c-desc">Description (optional)</Label>
              <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" rows={3} />
            </div>
            <div>
              <Label>Color</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColor(col)}
                    className={`h-7 w-7 rounded-full border-2 transition ${color === col ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: col }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
