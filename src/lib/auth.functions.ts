import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

/**
 * Custom fetch for ALL new-format Supabase keys (sb_publishable_ AND sb_secret_).
 *
 * New-format keys authenticate via the `apikey` header ONLY — they are opaque
 * strings, not JWTs, so sending them as `Authorization: Bearer` causes an
 * "Invalid API key" error. This mirrors the behavior in the auto-generated
 * client.ts (createSupabaseFetch).
 */
function makeSupabaseFetch(key: string): typeof fetch {
  const isNewFormat = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    // Strip auto-added Bearer for new-format keys — they use apikey header only
    if (isNewFormat && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input instanceof Request ? input.url : input, { ...init, headers });
  };
}

/**
 * Server-side function: provision a demo user without admin API.
 * This attempts to sign in first, and if that fails, creates a new account.
 */
export const provisionDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    return { error: "Supabase environment variables missing" };
  }

  const demoEmail = "demo@auralearn.io";
  const demoPw = "AuraLearnDemo2026!";

  // Use regular publishable key client
  const regular = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { fetch: makeSupabaseFetch(PUBLISHABLE_KEY) },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Try to sign in first
  const { data: signInData, error: signInErr } = await regular.auth.signInWithPassword({
    email: demoEmail,
    password: demoPw,
  });

  if (signInData?.session) {
    return {
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      expiresAt: signInData.session.expires_at,
      user: {
        id: signInData.session.user.id,
        email: signInData.session.user.email,
        metadata: signInData.session.user.user_metadata,
      },
    };
  }

  // If sign-in failed, try to sign up
  const { data: signUpData, error: signUpErr } = await regular.auth.signUp({
    email: demoEmail,
    password: demoPw,
    options: { 
      data: { full_name: "Demo Student" },
      emailRedirectTo: `${SUPABASE_URL}/auth/v1/verify`
    },
  });

  if (signUpData?.session) {
    return {
      accessToken: signUpData.session.access_token,
      refreshToken: signUpData.session.refresh_token,
      expiresAt: signUpData.session.expires_at,
      user: {
        id: signUpData.session.user.id,
        email: signUpData.session.user.email,
        metadata: signUpData.session.user.user_metadata,
      },
    };
  }

  // If we get here, email confirmation is required
  if (signUpData?.user && !signUpData.session) {
    return {
      error:
        "Demo account created! Please check the email demo@auralearn.io to confirm, " +
        "then click ⚡ Quick Demo Sign In again. " +
        "Or use 'Sign Up' below to create your own account.",
    };
  }

  if (signUpErr) return { error: signUpErr.message };
  if (signInErr) return { error: `Unable to access demo account: ${signInErr.message}` };
  
  return { error: "Unable to create or access demo account. Please try signing up with your own email." };
});
