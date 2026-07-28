import { useState } from "react";
import { Bell, Check, Sparkles, Mic, Zap, BookOpen, Clock, Flame, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: "lecture" | "flashcard" | "streak" | "revision";
  read: boolean;
}

const initialNotifications: NotificationItem[] = [
  {
    id: "n1",
    title: "Lecture Processing Complete",
    desc: "Neural Networks & Deep Learning — Lecture 4 has been transcribed and key concepts indexed.",
    time: "10m ago",
    type: "lecture",
    read: false,
  },
  {
    id: "n2",
    title: "Flashcard Deck Ready",
    desc: "12 new spaced repetition flashcards generated for Machine Learning.",
    time: "1h ago",
    type: "flashcard",
    read: false,
  },
  {
    id: "n3",
    title: "7-Day Learning Streak Active! 🔥",
    desc: "Keep up the momentum by reviewing weak concepts in Linear Algebra.",
    time: "3h ago",
    type: "streak",
    read: false,
  },
  {
    id: "n4",
    title: "Weak Topic Alert: Gradient Descent",
    desc: "Concept mastery is at 45%. Review flashcards before the upcoming quiz.",
    time: "1d ago",
    type: "revision",
    read: true,
  },
];

export function NotificationsPopover() {
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications);
  const unreadCount = items.filter((i) => !i.read).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "lecture": return <Mic className="h-4 w-4 text-primary" />;
      case "flashcard": return <Zap className="h-4 w-4 text-info" />;
      case "streak": return <Flame className="h-4 w-4 text-warning" />;
      case "revision": return <AlertCircle className="h-4 w-4 text-destructive" />;
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
          {items.map((item) => (
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
          ))}
        </div>

        <div className="p-2.5 border-t border-border/40 bg-card/40 text-center">
          <span className="font-mono text-[10px] text-muted-foreground">Real-time Telemetry & Reminders Active</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
