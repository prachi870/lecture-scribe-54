import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ALIP" }, { name: "description", content: "Manage your ALIP profile." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-primary">
          <SettingsIcon className="h-4 w-4" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your ALIP account.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-6">
        <h2 className="text-sm font-semibold">Profile</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This is how ALIP addresses you in the app.
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
    </div>
  );
}
