import Header from '@/components/common/Header';
import { getBookById, getStudentActivity } from '@/lib/queries/books';
import { getHiddenContent } from '@/lib/queries/explore';
import { createClient } from '@/lib/supabase/server';
import { resolveUserClassId } from '@/lib/classroom';
import ExplorePageClient from '@/components/book/ExplorePageClient';

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let classId: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('teacher_id, class, role')
      .eq('id', user.id)
      .single();
    classId = (await resolveUserClassId(supabase, profile)) ?? undefined;
  }

  const [book, contents, activity] = await Promise.all([
    getBookById(id),
    getHiddenContent(id, classId),
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
          </div>
        </main>
      </>
    );
  }

  const explorationCompleted = activity?.completed_tabs?.includes('hidden') ?? false;

  return (
    <>
      <Header />
      <ExplorePageClient
        book={book}
        initialContents={contents}
        initialCompleted={explorationCompleted}
      />
    </>
  );
}
