import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Mic,
  BookOpen,
  MessagesSquare,
  Library,
  Sparkles,
  BarChart3,
  Settings,
  LogOut,
  Network,
  Zap,
  GraduationCap,
  Calendar,
  ChevronRight,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { AuraLearnLogo } from "@/routes/index";

/* ──────────────── Navigation structure ──────────────── */
const workspace = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, live: true },
  { title: "Courses", url: "/courses", icon: Library, live: true },
] as const;

const learn = [
  { title: "Lectures", url: "/lectures", icon: Mic, live: true },
  { title: "AI Tutor", url: "/chat", icon: Bot, live: true },
  { title: "Knowledge Graph", url: "/knowledge-graph", icon: Network, live: true },
] as const;

const studyTools = [
  { title: "Notes", url: "/notes", icon: BookOpen, live: true },
  { title: "Flashcards", url: "/flashcards", icon: Sparkles, live: true },
  { title: "Quizzes", url: "/quizzes", icon: GraduationCap, live: true },
  { title: "Revision Plan", url: "/revision", icon: Calendar, live: true },
] as const;

const insights = [
  { title: "Analytics", url: "/analytics", icon: BarChart3, live: true },
] as const;

/* ──────────────── Types ──────────────── */
type NavItem =
  | { title: string; url: string; icon: React.ComponentType<{ className?: string }>; live: true; badge?: string }
  | { title: string; url: null; icon: React.ComponentType<{ className?: string }>; live: false; badge: string };

/* ──────────────── Component ──────────────── */
export function AppSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auralearn_demo_mode");
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/auth", replace: true, search: { signout: "1" } });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* ── Logo / Brand ── */}
      <SidebarHeader className="px-3 py-3.5">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-1">
          <AuraLearnLogo size="sm" />
          <span className="font-display text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            AuraLearn <span className="text-primary">AI</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {/* ── Workspace ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspace.map((item) => (
                <NavMenuItem key={item.title} item={item} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Learn ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
            Learn
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {learn.map((item) => (
                <NavMenuItem key={item.title} item={item as NavItem} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Study Tools ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
            Study Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studyTools.map((item) => (
                <NavMenuItem key={item.title} item={item as NavItem} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Insights ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
            Insights
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {insights.map((item) => (
                <NavMenuItem key={item.title} item={item} isActive={isActive} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── AI Models coming soon promo ── */}
        <div className="mx-2 mt-2 hidden rounded-xl border border-primary/15 bg-primary/5 p-3 group-data-[collapsible=icon]:hidden">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">Knowledge Graph</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Visual concept map across all lectures — coming in the next update.
          </p>
        </div>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="border-t border-sidebar-border pb-2 pt-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip="Settings"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Sign out"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/* ──────────────── NavMenuItem subcomponent ──────────────── */
function NavMenuItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: (path: string) => boolean;
}) {
  if (!item.live) {
    // Coming soon — render a disabled button
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={`${item.title} — coming soon`}
          className="cursor-default text-muted-foreground/50 hover:bg-transparent hover:text-muted-foreground/50"
          disabled
        >
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.title}</span>
          <span className="ml-auto hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/70 group-data-[collapsible=icon]:hidden">
            {item.badge}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        tooltip={item.title}
      >
        <Link to={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
          {"badge" in item && item.badge && (
            <span className="ml-auto hidden rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success group-data-[collapsible=icon]:hidden">
              {item.badge}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
