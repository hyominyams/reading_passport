import Header from '@/components/common/Header';
import CreatingPageContent from './CreatingPageContent';

export default async function CreatingPage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string; lang?: string }>;
}) {
  const { storyId, lang } = await searchParams;

  return (
    <>
      <Header />
      <CreatingPageContent storyId={storyId ?? null} lang={lang ?? 'ko'} />
    </>
  );
}
