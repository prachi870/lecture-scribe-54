import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — ALIP" },
      { name: "description", content: "Choose a new password for your ALIP account." },
      { property: "og:title", content: "Reset password — ALIP" },
      { property: "og:description", content: "Choose a new password for your ALIP account." },
    ],
  }),
  component: ResetPassword,
});

const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase drops a recovery session in the URL hash; the client picks it up.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pw = passwordSchema.parse(password);
      if (pw !== confirm) throw new Error("Passwords don't match");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password updated. Signing you in…");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0]?.message ?? "Invalid");
      else if (err instanceof Error) toast.error(err.message);
      else toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="aurora pointer-events-none absolute inset-0 opacity-50" />
      <Link to="/auth" className="absolute left-6 top-6 z-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {ready ? "Choose a new password for your account." : "Waiting for your recovery link…"}
          </p>
        </div>

        <div className="glass rounded-2xl border border-border/60 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs text-muted-foreground">New password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw" type="password" autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} className="bg-background/40 pl-9"
                  placeholder="At least 8 characters" disabled={!ready}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf" className="text-xs text-muted-foreground">Confirm password</Label>
              <Input
                id="cf" type="password" autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required minLength={8} className="bg-background/40"
                disabled={!ready}
              />
            </div>
            <Button type="submit" disabled={loading || !ready} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
