// Integration-managed protected layout: ssr:false, gates every child route.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Search, Command } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

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
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="hidden text-xs text-muted-foreground sm:block">
              Welcome back, <span className="text-foreground">{displayName}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button className="hidden items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted md:inline-flex">
                <Search className="h-3.5 w-3.5" />
                <span>Search lectures, notes…</span>
                <kbd className="ml-6 inline-flex items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px]">
                  <Command className="h-2.5 w-2.5" /> K
                </kbd>
              </button>
            </div>
          </header>

          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
