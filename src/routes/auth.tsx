import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Lock, User, AlertCircle, Sparkles } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { provisionDemoUser } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AuraLearn AI" },
      { name: "description", content: "Sign in or create an AuraLearn AI account to transform your lectures into understanding." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);
const nameSchema = z.string().trim().min(1, "Full name is required").max(80);

type AuthMode = "signin" | "signup" | "forgot";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Only auto-redirect to dashboard if user is already signed in AND
  // did not explicitly navigate to /auth to sign out or switch accounts.
  // Check for ?signout=1 query param which the logout flow appends.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intentionalVisit = params.has("signout") || params.has("switch");
    if (intentionalVisit) return; // user wants to see the auth page

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  // ── Demo login handler ──
  const handleDemoLogin = async () => {
    setLoading(true);
    setStatusMsg("Setting up demo student account…");
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("auralearn_demo_mode", "true");
      }

      const result = await provisionDemoUser();
      if ("error" in result) throw new Error(result.error);

      await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });

      toast.success("Signed in as Demo Student!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign in failed");
      setStatusMsg(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend email confirmation ──
  const handleResend = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { toast.error("Enter your email address first."); return; }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success("Confirmation email resent! Check your inbox.");
      setCanResend(false);
      setStatusMsg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend confirmation email");
    } finally {
      setResendLoading(false);
    }
  };

  // ── Forgot password ──
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedEmail = emailSchema.parse(email);
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent! Check your inbox.");
      setMode("signin");
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.issues[0]?.message ?? "Invalid email");
      else if (err instanceof Error) toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Sign in / Sign up ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      const parsedEmail = emailSchema.parse(email);
      const parsedPassword = passwordSchema.parse(password);

      if (mode === "signup") {
        const parsedName = nameSchema.parse(name);
        const { data, error } = await supabase.auth.signUp({
          email: parsedEmail,
          password: parsedPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: parsedName },
          },
        });
        if (error) throw error;

        if (data.session) {
          if (typeof window !== "undefined") localStorage.removeItem("auralearn_demo_mode");
          toast.success("Account created! Welcome to AuraLearn AI.");
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        // Try immediate sign-in
        const { data: immediateSignIn } = await supabase.auth.signInWithPassword({
          email: parsedEmail,
          password: parsedPassword,
        }).catch(() => ({ data: { session: null }, error: null }));

        if (immediateSignIn?.session) {
          if (typeof window !== "undefined") localStorage.removeItem("auralearn_demo_mode");
          toast.success("Account created and signed in!");
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        setStatusMsg(
          `Account created for ${parsedEmail}. Check your email inbox for a confirmation link, or use ⚡ Quick Demo Sign In for instant access.`
        );
        toast.success("Account created! Confirmation link sent to your email.");
        setMode("signin");
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: parsedEmail,
          password: parsedPassword,
        });

        if (error) {
          if (
            error.message.includes("Invalid login credentials") ||
            error.message.includes("invalid_credentials")
          ) {
            throw new Error("Incorrect email or password. Use ⚡ Quick Demo Sign In for instant access.");
          }
          if (
            error.message.includes("Email not confirmed") ||
            error.message.includes("email_not_confirmed")
          ) {
            setCanResend(true);
            setStatusMsg(
              `"${parsedEmail}" hasn't been confirmed yet. Click "Resend Confirmation Email" below, or use ⚡ Quick Demo Sign In for instant access.`
            );
            throw new Error("Email not confirmed. Check your inbox or use Quick Demo Sign In.");
          }
          throw error;
        }

        if (data.session) {
          if (typeof window !== "undefined") localStorage.removeItem("auralearn_demo_mode");
          toast.success("Signed in successfully!");
          navigate({ to: "/dashboard", replace: true });
        }
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0]?.message ?? "Invalid input");
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth Handler ──
  // Uses supabase.auth.signInWithOAuth directly — bypasses the Lovable OAuth broker
  // whose default URL (/~oauth/initiate) is a relative path that only works on
  // Lovable-hosted infra, not on localhost or custom domains (causes 404).
  const handleGoogle = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      if (typeof window !== "undefined") localStorage.removeItem("auralearn_demo_mode");

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // After Google consent Supabase redirects here; the supabase-js client
          // on that page detects the token in the URL and fires onAuthStateChange.
          redirectTo: window.location.origin,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        if (
          error.message.includes("provider is not enabled") ||
          error.message.includes("validation_failed") ||
          error.message.includes("OAuth") ||
          error.message.includes("missing OAuth secret")
        ) {
          setCanResend(false);
          setStatusMsg(
            "Google Sign-In Setup Required — 2 steps: " +
            "① Supabase Dashboard → Auth → Providers → Google → Enable → add Client ID & Secret. " +
            "② Google Cloud Console → Credentials → OAuth Client → Authorized Redirect URIs → add: " +
            "https://osdsmimrkkyiagalejim.supabase.co/auth/v1/callback  " +
            "Then retry. Use ⚡ Demo Mode below for instant access."
          );
          toast.error("Google sign-in needs one-time setup. See instructions below.", { duration: 8000 });
        } else {
          throw error;
        }
      }
      // On success: the browser is redirecting to Google — nothing more to do here.
      // setLoading stays true during the redirect; it resets on page reload.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg);
      setLoading(false);
    }
    // Note: no finally setLoading(false) — the page navigates away on success.
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="aurora pointer-events-none absolute inset-0 opacity-50" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />

      <Link
        to="/"
        className="absolute left-6 top-6 z-10 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/70 to-primary/40 shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Welcome to AuraLearn AI" : mode === "signup" ? "Create Account" : "Reset Password"}
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {mode === "signin"
              ? "Sign in to access your lecture knowledge hub"
              : mode === "signup"
              ? "Transform your lectures into structured understanding"
              : "We'll send a password reset link to your email"}
          </p>
        </div>

        {/* Status message banner */}
        {statusMsg && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning leading-relaxed">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="leading-relaxed">{statusMsg}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {canResend && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="inline-flex items-center gap-1 font-semibold text-primary underline disabled:opacity-50"
                  >
                    {resendLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "📧"}
                    {resendLoading ? "Sending…" : "Resend Confirmation Email"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  className="inline-flex items-center gap-1 font-semibold text-primary underline"
                >
                  ⚡ Demo Mode →
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="glass-card rounded-2xl border border-border/60 p-6 backdrop-blur">
          {mode !== "forgot" && (
            <div className="mb-5 space-y-2.5">
              {/* Google */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-border/60 bg-background/50 hover:bg-card text-xs font-medium"
                disabled={loading}
                onClick={handleGoogle}
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>

              {/* Demo login */}
              <Button
                type="button"
                variant="secondary"
                className="w-full bg-primary/15 text-primary hover:bg-primary/25 font-semibold text-xs border border-primary/30 shadow-md"
                disabled={loading}
                onClick={handleDemoLogin}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "⚡ "}
                Quick Demo Sign In (Instant Access)
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                  <span className="bg-background px-2 text-muted-foreground">Or with Email</span>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {mode === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/40 pl-9 text-xs"
                    placeholder="student@university.edu"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full text-xs">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
              </Button>

              <button
                type="button"
                onClick={() => setMode("signin")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs text-muted-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-background/40 pl-9 text-xs"
                      placeholder="Alex Rivera"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/40 pl-9 text-xs"
                    placeholder="alex@university.edu"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="bg-background/40 pl-9 text-xs"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full shadow-lg shadow-primary/20 text-xs">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signin" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </Button>

              <div className="pt-2 text-center text-xs">
                {mode === "signin" ? (
                  <span className="text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="font-semibold text-primary hover:underline"
                    >
                      Sign Up
                    </button>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="font-semibold text-primary hover:underline"
                    >
                      Sign In
                    </button>
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
