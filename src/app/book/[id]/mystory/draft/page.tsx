import Header from '@/components/common/Header';
import DraftPageContent from './DraftPageContent';

export default async function MyStoryDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { storyId } = await searchParams;

  return (
    <>
      <Header />
      <DraftPageContent storyId={storyId ?? null} />
    </>
  );
}
