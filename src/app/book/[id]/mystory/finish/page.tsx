import Header from '@/components/common/Header';
import FinishPageContent from './FinishPageContent';

export default async function FinishPage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { storyId } = await searchParams;

  return (
    <>
      <Header />
      <FinishPageContent storyId={storyId ?? null} />
    </>
  );
}
