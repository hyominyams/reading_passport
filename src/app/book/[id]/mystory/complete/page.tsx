import Header from '@/components/common/Header';
import CompletePageContent from './CompletePageContent';

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { storyId } = await searchParams;

  return (
    <>
      <Header />
      <CompletePageContent storyId={storyId ?? null} />
    </>
  );
}
