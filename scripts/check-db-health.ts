import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type EnvMap = Record<string, string>;

function readEnvFile(): EnvMap {
  const envPath = resolve(__dirname, '../.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  const env: EnvMap = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    env[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }

  return env;
}

async function check() {
  const env = readEnvFile();
  const serviceClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
  const anonClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [
    usersResult,
    classesResult,
    booksResult,
    hiddenContentResult,
    activitiesResult,
    storiesResult,
    anonBooksResult,
    tanzaniaResult,
  ] = await Promise.all([
    serviceClient.from('users').select('id', { count: 'exact', head: true }),
    serviceClient.from('classes').select('id', { count: 'exact', head: true }),
    serviceClient.from('books').select('id, country_id, title, approved, scope'),
    serviceClient.from('hidden_content').select('id', { count: 'exact', head: true }),
    serviceClient.from('activities').select('id', { count: 'exact', head: true }),
    serviceClient.from('stories').select('id', { count: 'exact', head: true }),
    anonClient.from('books').select('id, country_id, title, approved, scope'),
    serviceClient
      .from('books')
      .select('id, title, approved, scope, cover_url, pdf_url_ko, pdf_url_en')
      .eq('country_id', 'tanzania'),
  ]);

  const books = booksResult.data ?? [];
  const booksByCountry = books.reduce<Record<string, number>>((acc, book) => {
    acc[book.country_id] = (acc[book.country_id] ?? 0) + 1;
    return acc;
  }, {});

  console.log('=== Service Role Counts ===');
  console.log('users:', usersResult.count ?? 0, usersResult.error ? `Error: ${usersResult.error.message}` : 'OK');
  console.log('classes:', classesResult.count ?? 0, classesResult.error ? `Error: ${classesResult.error.message}` : 'OK');
  console.log('books:', books.length, booksResult.error ? `Error: ${booksResult.error.message}` : 'OK');
  console.log('hidden_content:', hiddenContentResult.count ?? 0, hiddenContentResult.error ? `Error: ${hiddenContentResult.error.message}` : 'OK');
  console.log('activities:', activitiesResult.count ?? 0, activitiesResult.error ? `Error: ${activitiesResult.error.message}` : 'OK');
  console.log('stories:', storiesResult.count ?? 0, storiesResult.error ? `Error: ${storiesResult.error.message}` : 'OK');

  console.log('\n=== Books By Country ===');
  Object.entries(booksByCountry)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([countryId, count]) => {
      console.log(`${countryId}: ${count}`);
    });

  console.log('\n=== Tanzania Books ===');
  if (tanzaniaResult.error) {
    console.log(`Error: ${tanzaniaResult.error.message}`);
  } else if (!tanzaniaResult.data || tanzaniaResult.data.length === 0) {
    console.log('No Tanzania books found');
  } else {
    tanzaniaResult.data.forEach((book) => {
      console.log(`- ${book.title} | approved=${book.approved} | scope=${book.scope} | cover=${book.cover_url}`);
    });
  }

  console.log('\n=== Anon RLS Check ===');
  if (anonBooksResult.error) {
    console.log(`Error: ${anonBooksResult.error.message}`);
  } else {
    console.log(`visible books: ${anonBooksResult.data?.length ?? 0}`);
    anonBooksResult.data?.forEach((book) => {
      console.log(`- [${book.country_id}] ${book.title} | approved=${book.approved} | scope=${book.scope}`);
    });
  }
}

check().catch((error) => {
  console.error(error);
  process.exit(1);
});
