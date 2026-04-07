import Header from '@/components/common/Header';
import MapPageClient from '@/components/book/MapPageClient';
import { getBooksByCountry } from '@/lib/queries/books';

export default async function MapPage() {
  let booksByCountry: Record<string, import('@/types/database').Book[]> = {};

  try {
    booksByCountry = await getBooksByCountry();
  } catch (error) {
    console.error('Failed to fetch books:', error);
  }

  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-heading text-foreground mb-2">
            세계 지도
          </h1>
          <p className="text-muted text-sm">
            나라를 선택하여 독서 여행을 시작하세요
          </p>
        </div>

        <MapPageClient booksByCountry={booksByCountry} />
      </main>
    </>
  );
}
