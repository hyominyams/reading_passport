import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim();
}

async function check() {
  // 1. Check with service role (bypasses RLS)
  const serviceClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: serviceBooks, error: serviceErr } = await serviceClient
    .from('books')
    .select('*');
  console.log('=== Service Role (bypasses RLS) ===');
  console.log('Books:', serviceBooks?.length, serviceErr ? `Error: ${JSON.stringify(serviceErr)}` : 'OK');
  serviceBooks?.forEach(b => console.log(`  - [${b.country_id}] ${b.title} (approved: ${b.approved})`));

  // 2. Check with anon key (subject to RLS)
  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: anonBooks, error: anonErr } = await anonClient
    .from('books')
    .select('*')
    .eq('approved', true);
  console.log('\n=== Anon Key (with RLS) ===');
  console.log('Books:', anonBooks?.length, anonErr ? `Error: ${JSON.stringify(anonErr)}` : 'OK');
  anonBooks?.forEach(b => console.log(`  - [${b.country_id}] ${b.title}`));
}

check().catch(console.error);
