import { redirect } from 'next/navigation';
import Header from '@/components/common/Header';
import MyStoryPageContent from './MyStoryPageContent';
import MyStoryEntryHub from './MyStoryEntryHub';
import { getStudentClassSetting } from '@/lib/classroom';
import { createClient } from '@/lib/supabase/server';
import type { Activity, Book, Story } from '@/types/database';

const REQUIRED_STAMPS: Activity['stamps_earned'] = ['read', 'hidden', 'questions'];

export const dynamic = 'force-dynamic';

export default async function MyStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; storyId?: string }>;
}) {
  const { id: bookId } = await params;
  const { lang, storyId: requestedStoryId } = await searchParams;
  const language = lang || 'ko';

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

  let story: Story | null = null;

  if (requestedStoryId) {
    const { data: requestedStoryData } = await supabase
      .from('stories')
      .select('*')
      .eq('id', requestedStoryId)
      .eq('student_id', user.id)
      .eq('book_id', bookId)
      .maybeSingle();

    story = (requestedStoryData as Story | null) ?? null;

    if (story?.story_status === 'archived') {
      redirect(`/book/${bookId}/mystory?lang=${story.language}`);
    }
  }

  const { data: activeDraftData } = await supabase
    .from('stories')
    .select('id, language, current_step, started_at, cover_design, story_status')
    .eq('student_id', user.id)
    .eq('book_id', bookId)
    .eq('story_status', 'draft')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeDraft = (activeDraftData as Pick<
    Story,
    'id' | 'language' | 'current_step' | 'started_at' | 'cover_design' | 'story_status'
  > | null) ?? null;

  const { data: completedStoriesData } = await supabase
    .from('stories')
    .select('id, language, story_type, completed_at, created_at, cover_design')
    .eq('student_id', user.id)
    .eq('book_id', bookId)
    .eq('story_status', 'completed')
    .order('completed_at', { ascending: false });

  const completedStories = (completedStoriesData as Pick<
    Story,
    'id' | 'language' | 'story_type' | 'completed_at' | 'created_at' | 'cover_design'
  >[] | null) ?? [];

  if (!story) {
    return (
      <>
        <Header />
        <MyStoryEntryHub
          bookId={bookId}
          countryId={book.country_id}
          language={language}
          userId={user.id}
          activeDraft={activeDraft}
          completedStories={completedStories}
        />
      </>
    );
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
