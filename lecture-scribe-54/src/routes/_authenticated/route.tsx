import { useState, useEffect } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Search, Command, Sparkles, Bell } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SearchModal } from "@/components/search-modal";
import { NotificationsPopover } from "@/components/notifications-popover";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const { user } = Route.useRouteContext();
  const [searchOpen, setSearchOpen] = useState(false);

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Student";

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span>Welcome back,</span>
              <span className="font-medium text-foreground">{displayName}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary border border-primary/30">
                AuraLearn AI Active
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-card hover:text-foreground md:inline-flex"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search lectures, concepts, notes…</span>
                <kbd className="ml-4 inline-flex items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px]">
                  <Command className="h-2.5 w-2.5" /> K
                </kbd>
              </button>

              <NotificationsPopover />

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary border border-primary/20">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </header>

          <main className="flex-1">
            <Outlet />
          </main>
        </div>

        <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </SidebarProvider>
  );
}
