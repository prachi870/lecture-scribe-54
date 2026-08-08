import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let v = m[2] || '';
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  });
}

const envPath = path.resolve(process.cwd(), '.env');
loadEnv(envPath);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !PUBLISHABLE) {
  console.error('Missing SUPABASE_URL or publishable key in environment. Aborting.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
const admin = SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } }) : null;

function uid() { return 'auth_test_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

(async function run() {
  console.log('Starting Auth E2E tests');

  // 1. Admin create user (if admin available)
  let testEmail = `${uid()}@example.com`;
  let testPassword = 'Test1234!';
  let createdUserId = null;

  if (admin) {
    console.log('\n[Admin] Creating pre-confirmed user via admin.createUser for', testEmail);
    try {
      const { data, error } = await admin.auth.admin.createUser({ email: testEmail, password: testPassword, email_confirm: true, user_metadata: { full_name: 'Auth E2E' } });
      if (error) {
        console.log('[Admin] createUser error:', error);
      } else {
        console.log('[Admin] createUser data:', data);
        createdUserId = data?.id || null;
      }
    } catch (err) {
      console.log('[Admin] createUser threw:', err && err.message ? err.message : err);
    }
  } else {
    console.log('\n[Admin] No service role key present, skipping admin user creation.');
  }

  // 2. Public signup (client.signUp)
  console.log('\n[Public] Attempting client.signUp for', testEmail);
  try {
    const res = await client.auth.signUp({ email: testEmail, password: testPassword });
    console.log('[Public] signUp result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.log('[Public] signUp threw:', err && err.message ? err.message : err);
  }

  // 3. Sign-in with password
  console.log('\n[Auth] Signing in with password for', testEmail);
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: testEmail, password: testPassword });
    console.log('[Auth] signInWithPassword data:', JSON.stringify(data, null, 2));
    console.log('[Auth] signInWithPassword error:', JSON.stringify(error, null, 2));
    const session = data?.session || null;
    if (session) {
      console.log('[Auth] session obtained. Access token length:', session.access_token ? session.access_token.length : 0);
      // set session into client to simulate persistence
      await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      const got = await client.auth.getSession();
      console.log('[Auth] getSession after setSession:', JSON.stringify(got, null, 2));

      // 4. Protected insert to lectures (with auth)
      console.log('\n[Protected] Inserting into lectures as authenticated user');
      try {
        const insertRes = await client.from('lectures').insert({ title: 'Auth Test Lecture', user_id: session.user.id, status: 'processing', audio_path: null }).select('id').maybeSingle();
        console.log('[Protected] Insert result:', JSON.stringify(insertRes, null, 2));
      } catch (iErr) {
        console.log('[Protected] Insert threw:', iErr && iErr.message ? iErr.message : iErr);
      }

      // 5. Sign out
      console.log('\n[Auth] Signing out');
      const so = await client.auth.signOut();
      console.log('[Auth] signOut result:', JSON.stringify(so, null, 2));
    } else {
      console.log('[Auth] No session from sign-in (possibly confirmation required or rate-limited).');
    }
  } catch (err) {
    console.log('[Auth] signInWithPassword threw:', err && err.message ? err.message : err);
  }

  // 6. Protected insert without auth
  console.log('\n[Protected] Attempting insert without auth (should be denied by RLS)');
  try {
    // new anonymous client
    const anon = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
    // Insert with a valid UUID but without auth; RLS should deny this (auth.uid() != user_id for anon)
    const insertAnon = await anon.from('lectures').insert({ title: 'Unauth Lecture', user_id: '00000000-0000-0000-0000-000000000000', status: 'processing' }).select('id').maybeSingle();
    console.log('[Protected anon] Insert result:', JSON.stringify(insertAnon, null, 2));
  } catch (err) {
    console.log('[Protected anon] Insert threw:', err && err.message ? err.message : err);
  }

  // 7. Password reset request
  console.log('\n[Auth] Requesting password reset for', testEmail);
  try {
    const { data, error } = await client.auth.resetPasswordForEmail(testEmail, { redirectTo: 'https://example.com/reset' });
    console.log('[Auth] resetPasswordForEmail data:', JSON.stringify(data, null, 2));
    console.log('[Auth] resetPasswordForEmail error:', JSON.stringify(error, null, 2));
  } catch (err) {
    console.log('[Auth] resetPasswordForEmail threw:', err && err.message ? err.message : err);
  }

  // 8. Admin: get user by id and delete user (cleanup)
  if (admin && createdUserId) {
    console.log('\n[Admin] Fetching user by id', createdUserId);
    try {
      const { data, error } = await admin.auth.admin.getUserById(createdUserId);
      console.log('[Admin] getUserById:', JSON.stringify(data, null, 2), JSON.stringify(error, null, 2));
    } catch (err) {
      console.log('[Admin] getUserById threw:', err && err.message ? err.message : err);
    }

    console.log('\n[Admin] Deleting user', createdUserId);
    try {
      const { error } = await admin.auth.admin.deleteUser(createdUserId);
      console.log('[Admin] deleteUser error:', JSON.stringify(error, null, 2));
    } catch (err) {
      console.log('[Admin] deleteUser threw:', err && err.message ? err.message : err);
    }
  }

  console.log('\nAuth E2E tests completed');
})();