import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { basename, resolve } from 'path';

type ContentType = 'video' | 'pdf' | 'image' | 'link';

interface SeedCard {
  title: string;
  type: ContentType;
  url: string;
  summary: string;
}

interface CountrySeed {
  html: {
    title: string;
    file: string;
    summary: string;
  };
  cards: SeedCard[];
}

type SeedData = Record<string, CountrySeed>;

const ROOT = resolve(__dirname, '..');
const HTML_DIR = resolve(ROOT, 'output/virtual-picture-books/hidden-stories-html');
const PUBLIC_HTML_BASE = '/virtual-picture-books/hidden-stories-html';
const BUCKET = process.env.SUPABASE_TEACHER_ASSETS_BUCKET || 'teacher-assets';
const APPLY = process.argv.includes('--apply');
const COUNTRY_BOOK_TITLES: Record<string, string> = {
  kenya: '비가 오기 전에 꿀벌이 알려준 것',
  tanzania: '진짜 영웅을 찾는 북소리',
  nepal: '구름 위 학교의 빨간 공책',
  cambodia: '메콩강에 띄운 파란 연',
  rwanda: 'Who is a real hero?',
};

function readEnvFile() {
  const envPath = resolve(ROOT, '.env.local');
  const env: Record<string, string> = {};

  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    env[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }

  return env;
}

async function uploadTextAsset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  storagePath: string,
  localFile: string,
  contentType: string
) {
  if (!APPLY) {
    return;
  }

  const content = readFileSync(localFile);
  const bucket = supabase.storage.from(BUCKET);

  const { error } = await bucket
    .upload(storagePath, content, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    throw error;
  }
}

async function upsertHiddenContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  payload: {
    book_id: string;
    country_id: string;
    type: ContentType;
    title: string;
    url: string;
    order: number;
    created_by: string;
  }
): Promise<string | null> {
  if (!APPLY) {
    return null;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('hidden_content')
    .select('id, title, url')
    .eq('book_id', payload.book_id)
    .order('order', { ascending: true });

  if (existingError) {
    throw existingError;
  }
  const existingRow = ((existingRows ?? []) as Array<{ id: string; title: string; url: string }>)
    .find((item) => item.title === payload.title || item.url === payload.url) ?? null;

  const row = {
    ...payload,
    scope: 'global',
    class_id: null,
    approved: true,
  };

  if (existingRow?.id) {
    // Supabase table types are not generated in this project, so script writes use a local cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hiddenContentTable = supabase.from('hidden_content') as any;
    const { error } = await hiddenContentTable
      .update(row)
      .eq('id', existingRow.id);
    if (error) throw error;
    return existingRow.id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hiddenContentTable = supabase.from('hidden_content') as any;
  const { data, error } = await hiddenContentTable
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function hideStaleHiddenContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bookId: string,
  activeIds: string[]
) {
  if (!APPLY || activeIds.length === 0) {
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hiddenContentTable = supabase.from('hidden_content') as any;
  const { data, error } = await hiddenContentTable
    .update({ approved: false })
    .eq('book_id', bookId)
    .eq('scope', 'global')
    .not('id', 'in', `(${activeIds.join(',')})`)
    .select('id');

  if (error) throw error;
  return (data ?? []).length;
}

async function main() {
  const env = { ...readEnvFile(), ...process.env };
  const projectUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.');
  }

  const supabase = createClient(projectUrl, serviceRoleKey);
  const seed = JSON.parse(
    readFileSync(resolve(HTML_DIR, 'hidden-stories-seed.json'), 'utf-8')
  ) as SeedData;

  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('id, email')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (adminError) throw adminError;
  if (!admin?.id) {
    throw new Error('admin 권한 사용자를 찾지 못했습니다.');
  }

  const countryIds = Object.keys(seed);
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, country_id, title, approved, scope')
    .in('country_id', countryIds)
    .in('title', countryIds.map((countryId) => COUNTRY_BOOK_TITLES[countryId]))
    .order('country_id');

  if (booksError) throw booksError;

  const bookByCountry = new Map<string, { id: string; country_id: string; title: string }>();
  for (const book of books ?? []) {
    if (book.title === COUNTRY_BOOK_TITLES[book.country_id] && !bookByCountry.has(book.country_id)) {
      bookByCountry.set(book.country_id, book);
    }
  }

  const report: string[] = [];

  for (const countryId of countryIds) {
    const countrySeed = seed[countryId];
    const book = bookByCountry.get(countryId);

    if (!book) {
      report.push(`[skip] ${countryId}: 등록된 책이 없습니다.`);
      continue;
    }

    const htmlLocalPath = resolve(HTML_DIR, countrySeed.html.file);
    const htmlStoragePath = `hidden-content/virtual-picture-books/${countryId}/${basename(countrySeed.html.file)}`;
    const cssStoragePath = `hidden-content/virtual-picture-books/${countryId}/style.css`;

    await uploadTextAsset(
      supabase,
      cssStoragePath,
      resolve(HTML_DIR, 'style.css'),
      'text/css; charset=utf-8'
    );

    await uploadTextAsset(
      supabase,
      htmlStoragePath,
      htmlLocalPath,
      'text/html; charset=utf-8'
    );

    const htmlUrl = `${PUBLIC_HTML_BASE}/${countrySeed.html.file}`;
    const entries: SeedCard[] = [
      {
        title: countrySeed.html.title,
        type: 'link',
        url: htmlUrl,
        summary: countrySeed.html.summary,
      },
      ...countrySeed.cards,
    ];

    const activeIds: string[] = [];
    for (const [index, entry] of entries.entries()) {
      const savedId = await upsertHiddenContent(supabase, {
        book_id: book.id,
        country_id: countryId,
        type: entry.type,
        title: entry.title,
        url: entry.url,
        order: index + 1,
        created_by: admin.id,
      });
      if (savedId) {
        activeIds.push(savedId);
      }
      report.push(`${APPLY ? '[saved]' : '[dry-run]'} ${countryId}: ${book.title} → ${entry.title}`);
    }

    const hiddenCount = await hideStaleHiddenContent(supabase, book.id, activeIds);
    if (hiddenCount > 0) {
      report.push(`[hidden stale] ${countryId}: ${hiddenCount}개 기존 글로벌 자료 승인 해제`);
    }
  }

  console.log(report.join('\n'));
  if (!APPLY) {
    console.log('\n실제 업로드/등록은 --apply 옵션을 붙여 실행하세요.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
