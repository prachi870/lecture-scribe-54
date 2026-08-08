import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// load .env
const envPath = new URL('../.env', import.meta.url).pathname;
if (fs.existsSync(envPath)) {
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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

(async () => {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);
  const email = 'e2e_test_1786062521.70679@example.com';
  console.log('Attempting supabase.auth.signUp with email:', JSON.stringify(email));
  const res = await client.auth.signUp({ email, password: 'Test1234!' });
  console.log('Result object:');
  console.log(JSON.stringify(res, null, 2));
})();