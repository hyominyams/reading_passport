import { redirect } from 'next/navigation';
import Header from '@/components/common/Header';
import MyStoryPageContent from './MyStoryPageContent';
import { getStudentClassSetting } from '@/lib/classroom';
import { createClient } from '@/lib/supabase/server';
import type { Activity, Book, Story } from '@/types/database';

const REQUIRED_STAMPS: Activity['stamps_earned'] = ['read', 'hidden', 'questions'];

// Step 2 (자유 작성) removed — 토리 chat handles brainstorming, jumps to step 3
const STEP_ROUTES: Record<number, string> = {
  3: 'draft',
  4: 'scenes',
  5: 'characters',
  6: 'style',
  7: 'creating',
  8: 'finish',
};

export default async function MyStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; storyId?: string }>;
}) {
  const { id: bookId } = await params;
  const { lang, storyId: requestedStoryId } = await searchParams;
  const language = lang === 'en' ? 'en' : 'ko';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/book/${bookId}/mystory?lang=${language}`);
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('teacher_id, class')
    .eq('id', user.id)
    .single();

  /* ── Fetch book ── */
  const { data: bookData } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single();

  const book = (bookData as Book | null) ?? null;
  if (!book) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">책을 찾을 수 없습니다.</p>
        </main>
      </>
    );
  }

  /* ── Check required stamps ── */
  const { data: activityData } = await supabase
    .from('activities')
    .select('stamps_earned')
    .eq('student_id', user.id)
    .eq('book_id', bookId)
    .maybeSingle();

  const currentActivity = (activityData as Pick<Activity, 'stamps_earned'> | null) ?? null;
  const hasRequiredStamps = REQUIRED_STAMPS.every((stamp) =>
    currentActivity?.stamps_earned.includes(stamp)
  );

  if (!hasRequiredStamps) {
    redirect(`/book/${bookId}/activity?lang=${language}`);
  }

  /* ── Get or create story ── */
  const { data: existingStory } = await supabase
    .from('stories')
    .select('*')
    .eq('student_id', user.id)
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let story = existingStory as Story | null;

  if (!story) {
    const { data: newStory, error: insertError } = await supabase
      .from('stories')
      .insert({
        student_id: user.id,
        book_id: bookId,
        country_id: book.country_id,
        language,
        story_type: 'continue',
        current_step: 1,
        chat_log: [],
        all_student_messages: null,
        gauge_final: 0,
        visibility: 'public',
      })
      .select('*')
      .single();

    if (insertError) {
      return (
        <>
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-muted">이야기를 시작할 수 없습니다. 다시 시도해 주세요.</p>
          </main>
        </>
      );
    }

    story = newStory as Story;
  }

  /* ── Redirect if past step 1 ── */
  const isRevisitingStepOne = requestedStoryId === story.id;

  if (story.current_step > 1 && !isRevisitingStepOne) {
    const route = STEP_ROUTES[story.current_step];
    if (route) {
      redirect(`/book/${bookId}/mystory/${route}?storyId=${story.id}&lang=${language}`);
    }
  }

  const classSetting = await getStudentClassSetting(supabase, {
    teacher_id: userProfile?.teacher_id ?? null,
    class: userProfile?.class ?? null,
  });
  const requiredTurns = classSetting?.mystory_required_turns ?? 5;

  return (
    <>
      <Header />
      <MyStoryPageContent
        book={book}
        bookId={bookId}
        language={language}
        userId={user.id}
        storyId={story.id}
        initialStoryType={story.story_type}
        initialCurrentStep={story.current_step}
        requiredTurns={requiredTurns}
        hasExistingDraft={Array.isArray(story.ai_draft) && story.ai_draft.length > 0}
        initialChatLog={
          Array.isArray(story.chat_log) && story.chat_log.length > 0
            ? (story.chat_log as { role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }[])
            : null
        }
      />
    </>
  );
}
