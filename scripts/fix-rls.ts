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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fixRLS() {
  console.log('Fixing RLS policies...');

  // Step 1: Create a SECURITY DEFINER function to check user role without RLS recursion
  const { error: fnError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION public.get_my_role()
      RETURNS text
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = ''
      AS $$
        SELECT role::text FROM public.users WHERE id = auth.uid()
      $$;
    `
  });

  if (fnError) {
    console.log('exec_sql not available, trying alternative approach...');
    // Try using raw REST endpoint
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        sql: `SELECT 1`
      }),
    });
    console.log('REST response:', response.status, await response.text());
  } else {
    console.log('Function created successfully');
  }
}

fixRLS().catch(console.error);
