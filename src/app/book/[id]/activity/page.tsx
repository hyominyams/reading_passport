import Header from '@/components/common/Header';
import { getBookById, getStudentActivity } from '@/lib/queries/books';
import { createClient } from '@/lib/supabase/server';
import ActivityPageClient from '@/components/book/ActivityPageClient';

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const language = lang === 'en' ? 'en' : 'ko';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [book, activity] = await Promise.all([
    getBookById(id),
    user ? getStudentActivity(user.id, id) : Promise.resolve(null),
  ]);

  if (!book) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              책을 찾을 수 없습니다
            </h1>
            <p className="text-muted">요청하신 도서가 존재하지 않습니다.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ActivityPageClient book={book} language={language} initialActivity={activity} />
      </main>
    </>
  );
}
