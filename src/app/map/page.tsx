import Header from '@/components/common/Header';
import MapPageClient from '@/components/book/MapPageClient';
import { getMapBooksData } from '@/lib/queries/books';
import type { MapBookProgress } from '@/lib/queries/books';
import type { Book } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  let booksByCountry: Record<string, Book[]> = {};
  let bookProgressById: Record<string, MapBookProgress> = {};

  try {
    const mapData = await getMapBooksData();
    booksByCountry = mapData.booksByCountry;
    bookProgressById = mapData.bookProgressById;
  } catch (error) {
    console.error('Failed to fetch books:', error);
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-passport-map passport-border-top">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-muted font-heading font-medium mb-1">
            Select a Country
          </p>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
            세계의 이야기
          </h1>
        </div>

        <MapPageClient
          booksByCountry={booksByCountry}
          bookProgressById={bookProgressById}
        />
        </div>
      </main>
    </>
  );
}
