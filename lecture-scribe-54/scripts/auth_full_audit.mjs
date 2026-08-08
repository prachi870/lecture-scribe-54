import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let v = m[2] || '';
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  });
}
loadEnv(path.resolve(process.cwd(), '.env'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const PUB = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !PUB) { console.error('Missing SUPABASE_URL or publishable key'); process.exit(1); }

const client = createClient(SUPABASE_URL, PUB, { auth: { persistSession: false } });
const admin = SERVICE ? createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } }) : null;

function uid(prefix='user') { return `${prefix}_${Date.now()}_${Math.floor(Math.random()*1000)}` }

(async () => {
  console.log('Starting comprehensive auth audit');

  if (!admin) { console.log('No service role key available, aborting admin-level tests'); }

  // Create three users via admin: adminUser, instructorUser, studentUser
  const users = [];
  if (admin) {
    for (const role of ['admin','faculty','student']) {
      const email = `${uid(role)}@example.com`;
      try {
        const { data, error } = await admin.auth.admin.createUser({ email, password: 'Test1234!', email_confirm: true, user_metadata: { full_name: `${role} user` } });
        console.log(`[Admin] createUser ${role}:`, error ? `ERROR ${error.message}` : `OK id=${data.id}`);
        users.push({ role, email, id: data?.id });
      } catch (err) {
        console.log('[Admin] createUser threw:', err && err.message ? err.message : err);
      }
    }

    // Assign roles in user_roles table
    for (const u of users) {
      if (!u.id) continue;
      try {
        const { data, error } = await admin.from('user_roles').insert({ user_id: u.id, role: u.role }).select('*').maybeSingle();
        console.log(`[Admin] insert role ${u.role} for ${u.email}:`, error ? `ERROR ${error.message}` : `OK`);
      } catch (err) {
        console.log('[Admin] insert role threw:', err && err.message ? err.message : err);
      }
    }
  }

  // Sign in as each user using client and test operations
  for (const u of users) {
    console.log('\n--- Testing user:', u.email, 'role=', u.role);
    try {
      const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({ email: u.email, password: 'Test1234!' });
      console.log('signIn result error:', signInErr ? JSON.stringify(signInErr) : 'null');
      const session = signInData?.session;
      if (!session) {
        console.log('No session returned; skipping auth tests for this user');
        continue;
      }
      // set session
      await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      const s = await client.auth.getSession();
      console.log('Session user id:', s?.data?.session?.user?.id);

      // Try to create a course (courses policy allows own user)
      try {
        const { data: courseData, error: courseErr } = await client.from('courses').insert({ user_id: s.data.session.user.id, title: `Course by ${u.role}` }).select('id').maybeSingle();
        console.log('create course:', courseErr ? `ERROR ${courseErr.message}` : `OK id=${courseData?.id}`);
      } catch (err) { console.log('create course threw:', err && err.message ? err.message : err); }

      // Try to insert into user_roles (should only be allowed for admin)
      try {
        const { data: rr, error: rrErr } = await client.from('user_roles').insert({ user_id: s.data.session.user.id, role: 'faculty' }).select('*').maybeSingle();
        console.log('insert user_roles as user:', rrErr ? `ERROR ${rrErr.message}` : `OK`);
      } catch (err) { console.log('insert user_roles threw:', err && err.message ? err.message : err); }

      // sign out
      await client.auth.signOut();
    } catch (err) {
      console.log('User test threw:', err && err.message ? err.message : err);
    }
  }

  // Test refresh token presence and basic format for one user
  if (users.length) {
    const test = users[0];
    console.log('\n--- Refresh token check for', test.email);
    try {
      const { data: signInData } = await client.auth.signInWithPassword({ email: test.email, password: 'Test1234!' });
      const session = signInData?.session;
      console.log('refresh token present?', !!session?.refresh_token);
    } catch (err) { console.log('refresh token check threw:', err && err.message ? err.message : err); }
  }

  // Cleanup: delete created users and roles
  if (admin) {
    for (const u of users) {
      if (!u.id) continue;
      try {
        const { error } = await admin.auth.admin.deleteUser(u.id);
        console.log(`[Admin] deleteUser ${u.email}:`, error ? `ERROR ${error.message}` : 'OK');
      } catch (err) { console.log('[Admin] deleteUser threw:', err && err.message ? err.message : err); }
    }
  }

  console.log('\nAuth full audit complete');
})();