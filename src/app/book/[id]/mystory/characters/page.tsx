import Header from '@/components/common/Header';
import CharactersPageContent from './CharactersPageContent';

export default async function MyStoryCharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { storyId } = await searchParams;

  return (
    <>
      <Header />
      <CharactersPageContent storyId={storyId ?? null} />
    </>
  );
}
