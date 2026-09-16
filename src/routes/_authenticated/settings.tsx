import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, Loader2, Lock, Shield, Activity, LogOut, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { checkAIProvider } from "@/lib/lectures.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — AuraLearn AI" }, { name: "description", content: "Manage your AuraLearn AI profile and account." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // AI provider status
  const aiStatus = useQuery({
    queryKey: ["ai-provider-status"],
    queryFn: () => checkAIProvider(),
    staleTime: 60000,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (active) {
        setFullName(data?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user.id, user.user_metadata]);

  const save = async () => {
    setSaving(true);
    const trimmed = fullName.trim().slice(0, 80);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: trimmed });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password updated successfully");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setChangingPw(false);
    }
  };

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auralearn_demo_mode");
    }
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/auth", replace: true, search: { signout: "1" } });
  };

  const isDemo = typeof window !== "undefined" && localStorage.getItem("auralearn_demo_mode") === "true";
  const providerData = aiStatus.data as { ok?: boolean; provider?: string; reason?: string } | undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-primary">
          <SettingsIcon className="h-4 w-4" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your AuraLearn AI account.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Profile Section ── */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
          <h2 className="text-sm font-semibold">Profile</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This is how AuraLearn AI addresses you in the app.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input id="email" value={user.email ?? ""} disabled className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                maxLength={80}
                className="bg-background/40"
              />
            </div>
            <div className="pt-2">
              <Button onClick={save} disabled={saving || loading}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Password Section ── */}
        {!isDemo && (
          <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Change Password</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Update your account password.</p>

            <form onSubmit={changePassword} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-xs text-muted-foreground">New password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8}
                  required
                  placeholder="At least 8 characters"
                  className="bg-background/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-xs text-muted-foreground">Confirm new password</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  minLength={8}
                  required
                  className="bg-background/40"
                />
              </div>
              <Button type="submit" variant="outline" disabled={changingPw}>
                {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          </div>
        )}

        {/* ── AI Provider Status ── */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">AI Provider Status</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            AuraLearn AI uses Groq (primary) with Gemini as fallback for transcription, notes, and chat.
          </p>

          <div className="mt-4 rounded-xl border border-border/50 bg-background/50 p-4 font-mono text-xs">
            {aiStatus.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking AI provider…
              </div>
            ) : providerData?.ok ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Status</span>
                  <span className="font-semibold text-success">Online ✓</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Provider</span>
                  <span className="text-primary">{providerData.provider}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">Status</span>
                  <span className="font-semibold text-destructive">Offline ✗</span>
                </div>
                {providerData?.reason && (
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{providerData.reason}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-4">
            <div>
              <p className="text-sm font-medium">Sign out of AuraLearn AI</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You will be redirected to the sign-in page.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>

        {/* ── About ── */}
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">About</h2>
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p><span className="text-foreground font-medium">AuraLearn AI</span> — The AI Learning Operating System</p>
            <p>Built with TanStack Start, React, Supabase, Groq & Gemini AI</p>
            <p className="font-mono text-[10px]">User ID: {user.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
