import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { data: books } = await supabase.from('books').select('id, title, country_id').order('country_id');
console.log('=== BOOKS ===');
console.table(books);
const { data: hc } = await supabase.from('hidden_content').select('id, country_id, type, title, url, scope, approved, "order"').order('country_id').order('order');
console.log('\n=== HIDDEN CONTENT ===');
console.table(hc);
