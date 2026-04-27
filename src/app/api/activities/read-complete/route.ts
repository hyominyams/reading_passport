import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ReadCompleteBody {
  bookId?: unknown;
  emotion?: unknown;
  oneLine?: unknown;
  questionSeed?: unknown;
  language?: unknown;
}

interface ExistingActivity {
  id: string;
  completed_tabs: unknown;
  stamps_earned: unknown;
}

interface BookRecord {
  id: string;
  country_id: string;
  languages_available: unknown;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function appendUnique(values: unknown, value: string): string[] {
  const existing = Array.isArray(values)
    ? values.filter((item): item is string => typeof item === 'string')
    : [];

  return Array.from(new Set([...existing, value]));
}

async function updateActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  activity: ExistingActivity,
  payload: {
    emotion: string;
    oneLine: string;
    questionSeed: string;
    language: string;
  }
) {
  return supabase
    .from('activities')
    .update({
      emotion: payload.emotion,
      one_line: payload.oneLine,
      read_question_seed: payload.questionSeed || null,
      language: payload.language,
      completed_tabs: appendUnique(activity.completed_tabs, 'read'),
      stamps_earned: appendUnique(activity.stamps_earned, 'read'),
    })
    .eq('id', activity.id);
}

export async function POST(request: Request) {
  let body: ReadCompleteBody;

  try {
    body = (await request.json()) as ReadCompleteBody;
  } catch {
    return NextResponse.json({ error: '필수 항목을 입력해 주세요.' }, { status: 400 });
  }

  const bookId = cleanText(body.bookId);
  const emotion = cleanText(body.emotion);
  const oneLine = cleanText(body.oneLine);
  const questionSeed = cleanText(body.questionSeed);
  const language = cleanText(body.language) || 'ko';

  if (!bookId || !emotion || !oneLine) {
    return NextResponse.json({ error: '감정과 한 줄 감상을 입력해 주세요.' }, { status: 400 });
  }

  if (oneLine.length > 200 || questionSeed.length > 240) {
    return NextResponse.json({ error: '입력한 글이 너무 길어요.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, country_id, languages_available')
    .eq('id', bookId)
    .single<BookRecord>();

  if (bookError || !book) {
    console.error('Failed to load book for reading completion:', bookError);
    return NextResponse.json({ error: '책을 찾을 수 없습니다.' }, { status: 404 });
  }

  const availableLanguages = Array.isArray(book.languages_available)
    ? book.languages_available.filter((item): item is string => typeof item === 'string')
    : [];

  if (availableLanguages.length > 0 && !availableLanguages.includes(language)) {
    return NextResponse.json({ error: '선택한 언어로 저장할 수 없습니다.' }, { status: 400 });
  }

  const { data: existing, error: selectError } = await supabase
    .from('activities')
    .select('id, completed_tabs, stamps_earned')
    .eq('student_id', user.id)
    .eq('book_id', book.id)
    .maybeSingle<ExistingActivity>();

  if (selectError) {
    console.error('Failed to load reading activity:', selectError);
    return NextResponse.json({ error: '읽기 기록을 저장하지 못했습니다.' }, { status: 500 });
  }

  if (existing) {
    const { error: updateError } = await updateActivity(supabase, existing, {
      emotion,
      oneLine,
      questionSeed,
      language,
    });

    if (updateError) {
      console.error('Failed to update reading activity:', updateError);
      return NextResponse.json({ error: '읽기 기록을 저장하지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const { error: insertError } = await supabase.from('activities').insert({
    student_id: user.id,
    book_id: book.id,
    country_id: book.country_id,
    language,
    emotion,
    one_line: oneLine,
    read_question_seed: questionSeed || null,
    completed_tabs: ['read'],
    stamps_earned: ['read'],
  });

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retryExisting, error: retrySelectError } = await supabase
        .from('activities')
        .select('id, completed_tabs, stamps_earned')
        .eq('student_id', user.id)
        .eq('book_id', book.id)
        .maybeSingle<ExistingActivity>();

      if (!retrySelectError && retryExisting) {
        const { error: retryUpdateError } = await updateActivity(supabase, retryExisting, {
          emotion,
          oneLine,
          questionSeed,
          language,
        });

        if (!retryUpdateError) {
          return NextResponse.json({ success: true });
        }

        console.error('Failed to update reading activity after conflict:', retryUpdateError);
      } else {
        console.error('Failed to reload reading activity after conflict:', retrySelectError);
      }
    } else {
      console.error('Failed to insert reading activity:', insertError);
    }

    return NextResponse.json({ error: '읽기 기록을 저장하지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
