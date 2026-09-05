import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Mic, Library, BookOpen, Zap, Sparkles, ArrowRight, X, Brain } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  type: "lecture" | "course" | "note" | "flashcard" | "concept";
  title: string;
  subtitle: string;
  url: string;
  badge?: string;
}

const mockConcepts = [
  { id: "c1", title: "Gradient Descent Optimization", subtitle: "Core optimization algorithm in deep learning models", url: "/analytics", badge: "Concept Mastery: 45%" },
  { id: "c2", title: "Backpropagation & Chain Rule", subtitle: "Gradient calculation for neural network parameter updates", url: "/analytics", badge: "Concept Mastery: 76%" },
  { id: "c3", title: "Convolutional Neural Networks (CNNs)", subtitle: "Spatial feature extraction using 2D kernels and pooling", url: "/analytics", badge: "Concept Mastery: 82%" },
  { id: "c4", title: "Linear Algebra & Vector Spaces", subtitle: "Matrix operations, eigenvalues, and coordinate transformations", url: "/analytics", badge: "Concept Mastery: 88%" },
];

export function SearchModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.toLowerCase().trim();
      const items: SearchResult[] = [];

      try {
        // Query lectures
        const { data: lectures } = await supabase
          .from("lectures")
          .select("id, title, transcript, created_at")
          .or(`title.ilike.%${q}%,transcript.ilike.%${q}%`)
          .limit(5);

        if (lectures) {
          lectures.forEach((l) => {
            items.push({
              id: l.id,
              type: "lecture",
              title: l.title,
              subtitle: l.transcript ? `${l.transcript.slice(0, 90)}…` : "Lecture recording",
              url: `/lectures/${l.id}`,
              badge: "Lecture",
            });
          });
        }

        // Query courses
        const { data: courses } = await supabase
          .from("courses")
          .select("id, title, code, description")
          .or(`title.ilike.%${q}%,code.ilike.%${q}%`)
          .limit(4);

        if (courses) {
          courses.forEach((c) => {
            items.push({
              id: c.id,
              type: "course",
              title: c.title,
              subtitle: c.code ? `${c.code} · ${c.description || "Course context"}` : c.description || "Course context",
              url: "/courses",
              badge: "Course",
            });
          });
        }

        // Query flashcards
        const { data: flashcards } = await supabase
          .from("flashcards")
          .select("id, question, answer, lecture_id")
          .or(`question.ilike.%${q}%,answer.ilike.%${q}%`)
          .limit(4);

        if (flashcards) {
          flashcards.forEach((f) => {
            items.push({
              id: f.id,
              type: "flashcard",
              title: f.question,
              subtitle: f.answer,
              url: "/flashcards",
              badge: "Flashcard",
            });
          });
        }

        // Match concepts
        mockConcepts.forEach((c) => {
          if (c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)) {
            items.push({
              id: c.id,
              type: "concept",
              title: c.title,
              subtitle: c.subtitle,
              url: c.url,
              badge: c.badge,
            });
          }
        });
      } catch (e) {
        console.error("Search query error:", e);
      } finally {
        setResults(items);
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (url: string) => {
    onOpenChange(false);
    setQuery("");
    navigate({ to: url });
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "lecture": return <Mic className="h-4 w-4 text-primary" />;
      case "course": return <Library className="h-4 w-4 text-warning" />;
      case "note": return <BookOpen className="h-4 w-4 text-success" />;
      case "flashcard": return <Zap className="h-4 w-4 text-info" />;
      case "concept": return <Brain className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card sm:max-w-xl p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lectures, concepts, formulas, flashcards…"
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
              autoFocus
            />
          </div>
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </DialogHeader>

        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin text-primary" />
              <span>Querying vector store & database index…</span>
            </div>
          ) : query.trim() === "" ? (
            <div className="p-6 text-center">
              <p className="text-xs text-muted-foreground">Type to perform hybrid semantic search across all course materials</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {["Neural Networks", "Gradient Descent", "Machine Learning", "Backpropagation"].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setQuery(sample)}
                    className="rounded-lg border border-border/50 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching results found for "{query}"
            </div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => handleSelect(r.url)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-card/80 transition-colors text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-card border border-border/50">
                    {getIcon(r.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.badge && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-primary">
                      {r.badge}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-2.5 border-t border-border/40 bg-card/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground px-4">
          <span>Hybrid Vector & Keyword Index</span>
          <span>Press ESC to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
