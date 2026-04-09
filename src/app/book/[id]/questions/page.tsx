import Header from '@/components/common/Header';
import { getBookById, getStudentActivity } from '@/lib/queries/books';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import QuestionsPageContent from './QuestionsPageContent';

export default async function QuestionsPage({
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/book/${id}/questions?lang=${language}`);
  }

  const [book, activity] = await Promise.all([
    getBookById(id),
    getStudentActivity(user.id, id),
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

  // Load any existing questions from chat_logs
  const { data: existingLog } = await supabase
    .from('chat_logs')
    .select('*')
    .eq('student_id', user.id)
    .eq('book_id', id)
    .eq('chat_type', 'questions')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <QuestionsPageContent
          book={book}
          language={language}
          userId={user.id}
          initialActivity={activity}
          existingLog={existingLog}
        />
      </main>
    </>
  );
}
