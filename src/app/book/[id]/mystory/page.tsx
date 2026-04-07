import { redirect } from 'next/navigation';
import Header from '@/components/common/Header';
import MyStoryPageContent from './MyStoryPageContent';
import { createClient } from '@/lib/supabase/server';
import type { Activity, Book } from '@/types/database';

const REQUIRED_STAMPS: Activity['stamps_earned'] = ['read', 'hidden', 'character'];
export default async function MyStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id: bookId } = await params;
  const { lang } = await searchParams;
  const language = lang === 'en' ? 'en' : 'ko';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/book/${bookId}/mystory?lang=${language}`);
  }

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
    .single();

  const currentActivity = (activityData as Pick<Activity, 'stamps_earned'> | null) ?? null;
  const hasRequiredStamps = REQUIRED_STAMPS.every((stamp) =>
    currentActivity?.stamps_earned.includes(stamp)
  );

  if (!hasRequiredStamps) {
    redirect(`/book/${bookId}/activity?lang=${language}`);
  }

  return (
    <>
      <Header />
      <MyStoryPageContent book={book} bookId={bookId} language={language} />
    </>
  );
}
