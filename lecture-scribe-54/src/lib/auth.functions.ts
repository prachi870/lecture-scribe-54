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
 * Server-side function: provision a pre-confirmed demo user via Supabase Admin API,
 * then sign in and return tokens to set on the client.
 */
export const provisionDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    return { error: "Supabase environment variables missing" };
  }

  const demoEmail = "demo@auralearn.io";
  const demoPw = "AuraLearnDemo2026!";

  // ── Path 1: Service role key available → bypass email confirmation ──
  if (SERVICE_ROLE_KEY) {
    // Admin client — new-format sb_secret_ keys authenticate via apikey header only
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { fetch: makeSupabaseFetch(SERVICE_ROLE_KEY) },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find or create the demo user
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return { error: `Admin listUsers failed: ${listErr.message}` };

    const existing = listData?.users?.find((u) => u.email === demoEmail);

    if (existing) {
      // Update: ensure confirmed + reset password
      const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        password: demoPw,
      });
      if (updateErr) return { error: `Admin updateUser failed: ${updateErr.message}` };
    } else {
      // Create brand-new pre-confirmed demo user
      const { error: createErr } = await admin.auth.admin.createUser({
        email: demoEmail,
        password: demoPw,
        email_confirm: true,
        user_metadata: { full_name: "Demo Student" },
      });
      if (createErr) return { error: `Admin createUser failed: ${createErr.message}` };
    }

    // Now sign in with the regular (publishable) client
    const regular = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      global: { fetch: makeSupabaseFetch(PUBLISHABLE_KEY) },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: signInData, error: signInErr } = await regular.auth.signInWithPassword({
      email: demoEmail,
      password: demoPw,
    });
    if (signInErr) return { error: `Sign-in failed: ${signInErr.message}` };
    if (!signInData.session) return { error: "Sign-in returned no session. Try again." };

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

  // ── Path 2: No service role key → normal sign-in / sign-up ──
  const regular = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { fetch: makeSupabaseFetch(PUBLISHABLE_KEY) },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signInData } = await regular.auth.signInWithPassword({
    email: demoEmail,
    password: demoPw,
  });
  if (signInData.session) {
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

  const { data: signUpData, error: signUpErr } = await regular.auth.signUp({
    email: demoEmail,
    password: demoPw,
    options: { data: { full_name: "Demo Student" } },
  });
  if (signUpData?.session) {
    return {
      accessToken: signUpData.session.access_token,
      refreshToken: signUpData.session.refresh_token,
      expiresAt: signUpData.session.expires_at,
      user: {
        id: signUpData.session.user!.id,
        email: signUpData.session.user!.email,
        metadata: signUpData.session.user!.user_metadata,
      },
    };
  }

  if (signUpErr) return { error: signUpErr.message };
  return {
    error:
      "EMAIL_CONFIRMATION_REQUIRED: A demo account was created at demo@auralearn.io. " +
      "Please confirm that email address, then click ⚡ Quick Demo Sign In again.",
  };
});
