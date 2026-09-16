import { useState, useMemo } from "react";
import { Bell, Check, Mic, Zap, Flame, AlertCircle, CheckCircle2, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/lectures.functions";

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: "lecture" | "flashcard" | "streak" | "revision" | "success";
  read: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsPopover() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardStats(),
    staleTime: 30000,
  });

  const generated = useMemo<NotificationItem[]>(() => {
    if (!data) return [];
    const items: NotificationItem[] = [];

    // Streak notification
    if (data.streak > 0) {
      items.push({
        id: "streak",
        title: `${data.streak}-Day Learning Streak Active! 🔥`,
        desc: `Keep up the momentum — you've been learning for ${data.streak} consecutive days.`,
        time: "now",
        type: "streak",
        read: false,
      });
    }

    // Recent lecture completions
    const recent = (data.recent ?? []) as Array<{ id: string; title: string; transcript_status: string; created_at: string }>;
    const completed = recent.filter((l) => l.transcript_status === "completed");
    const processing = recent.filter((l) => l.transcript_status === "processing" || l.transcript_status === "pending");
    const failed = recent.filter((l) => l.transcript_status === "failed");

    for (const l of completed.slice(0, 2)) {
      items.push({
        id: `done-${l.id}`,
        title: "Lecture Processing Complete",
        desc: `"${l.title}" has been transcribed and key concepts indexed.`,
        time: timeAgo(l.created_at),
        type: "success",
        read: false,
      });
    }

    for (const l of processing.slice(0, 1)) {
      items.push({
        id: `proc-${l.id}`,
        title: "Lecture Processing…",
        desc: `"${l.title}" is being transcribed. Notes will be generated automatically.`,
        time: timeAgo(l.created_at),
        type: "lecture",
        read: false,
      });
    }

    for (const l of failed.slice(0, 1)) {
      items.push({
        id: `fail-${l.id}`,
        title: "Transcription Failed",
        desc: `"${l.title}" — open the lecture to retry transcription.`,
        time: timeAgo(l.created_at),
        type: "revision",
        read: false,
      });
    }

    // Flashcard deck notification
    if (data.flashcardsCount > 0) {
      items.push({
        id: "flashcards",
        title: "Flashcard Decks Available",
        desc: `${data.flashcardsCount} flashcards ready across your lectures. Study them in the Flashcards tab.`,
        time: "recent",
        type: "flashcard",
        read: true,
      });
    }

    // Knowledge stats
    if (data.notesCount > 0) {
      items.push({
        id: "notes",
        title: "AI Notes Generated",
        desc: `${data.notesCount} lecture${data.notesCount > 1 ? "s" : ""} summarized with key points and glossary.`,
        time: "recent",
        type: "lecture",
        read: true,
      });
    }

    return items;
  }, [data]);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const items = generated.map((i) => ({ ...i, read: i.read || dismissed.has(i.id) }));
  const unreadCount = items.filter((i) => !i.read).length;

  const markAllRead = () => {
    setDismissed(new Set(items.map((i) => i.id)));
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "lecture": return <Mic className="h-4 w-4 text-primary" />;
      case "flashcard": return <Zap className="h-4 w-4 text-info" />;
      case "streak": return <Flame className="h-4 w-4 text-warning" />;
      case "revision": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "success": return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary font-mono text-[9px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="glass-card w-80 sm:w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border/50 p-3.5">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold tracking-tight">Notifications</h4>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[320px] overflow-y-auto divide-y divide-border/30">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <BookOpen className="mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No activity yet. Add a lecture to get started!</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 flex items-start gap-3 transition-colors ${
                  !item.read ? "bg-primary/5" : "hover:bg-card/40"
                }`}
              >
                <div className="p-2 rounded-lg bg-card border border-border/50 shrink-0 mt-0.5">
                  {getIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                    <span className="font-mono text-[9px] text-muted-foreground shrink-0">{item.time}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-2.5 border-t border-border/40 bg-card/40 text-center">
          <span className="font-mono text-[10px] text-muted-foreground">Real-time Activity Feed</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
