import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Activity, Book, User } from '@/types/database';

const REQUIRED_STAMPS: Activity['stamps_earned'] = ['read', 'hidden', 'questions'];

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasRequiredStamps(stamps: unknown): boolean {
  if (!Array.isArray(stamps)) return false;
  return REQUIRED_STAMPS.every((stamp) => stamps.includes(stamp));
}

export async function POST(request: NextRequest) {
  let body: { bookId?: unknown; language?: unknown };

  try {
    body = (await request.json()) as { bookId?: unknown; language?: unknown };
  } catch {
    return NextResponse.json({ error: '새 이야기를 시작할 정보를 확인하지 못했어요.' }, { status: 400 });
  }

  const bookId = cleanText(body.bookId);
  const requestedLanguage = cleanText(body.language) || 'ko';

  if (!bookId) {
    return NextResponse.json({ error: '책 정보를 찾지 못했어요.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle<Pick<User, 'id' | 'role'>>();

  if (profile?.role !== 'student') {
    return NextResponse.json({ error: '학생 계정으로 시작해 주세요.' }, { status: 403 });
  }

  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, country_id, languages_available')
    .eq('id', bookId)
    .maybeSingle<Pick<Book, 'id' | 'country_id' | 'languages_available'>>();

  if (bookError || !book) {
    return NextResponse.json({ error: '책을 찾을 수 없습니다.' }, { status: 404 });
  }

  const availableLanguages = Array.isArray(book.languages_available)
    ? book.languages_available.filter((item): item is string => typeof item === 'string')
    : [];
  const language = availableLanguages.length > 0 && !availableLanguages.includes(requestedLanguage)
    ? availableLanguages[0]
    : requestedLanguage;

  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('stamps_earned')
    .eq('student_id', user.id)
    .eq('book_id', book.id)
    .maybeSingle<Pick<Activity, 'stamps_earned'>>();

  if (activityError) {
    console.error('Failed to load MyStory activity gate:', activityError);
    return NextResponse.json({ error: '활동 진행 상태를 확인하지 못했어요.' }, { status: 500 });
  }

  if (!hasRequiredStamps(activity?.stamps_earned)) {
    return NextResponse.json({ error: 'Step 1부터 Step 3까지 먼저 완료해 주세요.' }, { status: 403 });
  }

  const { error: archiveError } = await supabase
    .from('stories')
    .update({ story_status: 'archived' })
    .eq('student_id', user.id)
    .eq('book_id', book.id)
    .eq('story_status', 'draft');

  if (archiveError) {
    console.error('Failed to archive previous MyStory drafts:', archiveError);
    return NextResponse.json({ error: '기존 진행본을 보관하지 못했어요.' }, { status: 500 });
  }

  const { data: story, error: insertError } = await supabase
    .from('stories')
    .insert({
      student_id: user.id,
      book_id: book.id,
      country_id: book.country_id,
      language,
      story_status: 'draft',
      story_type: 'continue',
      current_step: 1,
      chat_log: [],
      all_student_messages: null,
      gauge_final: 0,
      visibility: 'public',
      production_status: 'pending',
      production_progress: 0,
    })
    .select('id, language')
    .single<{ id: string; language: string }>();

  if (insertError || !story?.id) {
    console.error('Failed to create MyStory draft:', insertError);

    const { data: existingDraft } = await supabase
      .from('stories')
      .select('id, language')
      .eq('student_id', user.id)
      .eq('book_id', book.id)
      .eq('story_status', 'draft')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; language: string }>();

    if (existingDraft?.id) {
      return NextResponse.json({
        storyId: existingDraft.id,
        language: existingDraft.language ?? language,
        reused: true,
      });
    }

    return NextResponse.json({ error: '새 이야기를 만들지 못했어요.' }, { status: 500 });
  }

  return NextResponse.json({
    storyId: story.id,
    language: story.language ?? language,
  });
}
