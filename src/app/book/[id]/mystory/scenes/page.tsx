import Header from '@/components/common/Header';
import ScenesPageContent from './ScenesPageContent';

export default async function ScenesPage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { storyId } = await searchParams;

  return (
    <>
      <Header />
      <ScenesPageContent storyId={storyId ?? null} />
    </>
  );
}
