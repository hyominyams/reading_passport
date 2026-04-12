import Header from '@/components/common/Header';
import StylePageContent from './StylePageContent';

export default async function StylePage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { storyId } = await searchParams;

  return (
    <>
      <Header />
      <StylePageContent storyId={storyId ?? null} />
    </>
  );
}
