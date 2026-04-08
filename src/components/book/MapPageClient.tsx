'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import CountryCard from '@/components/book/CountryCard';
import BookCard from '@/components/book/BookCard';
import LanguageModal from '@/components/book/LanguageModal';
import WorldMapSection from '@/components/book/WorldMapSection';
import { countries } from '@/lib/data/countries';
import type { MapBookProgress } from '@/lib/queries/books';
import type { Book, Language } from '@/types/database';

interface MapPageClientProps {
  booksByCountry: Record<string, Book[]>;
  bookProgressById: Record<string, MapBookProgress>;
}

interface CountryProgressSummary {
  bookCount: number;
  startedBookCount: number;
  completedBookCount: number;
}

export default function MapPageClient({
  booksByCountry,
  bookProgressById,
}: MapPageClientProps) {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCountryClick = useCallback((countryId: string) => {
    setSelectedCountry((prev) => (prev === countryId ? null : countryId));
  }, []);

  const handleBookClick = useCallback((book: Book) => {
    setSelectedBook(book);
    setIsModalOpen(true);
  }, []);

  const handleLanguageSelect = useCallback(
    (bookId: string, language: Language) => {
      setIsModalOpen(false);
      router.push(`/book/${bookId}?lang=${language}`);
    },
    [router]
  );

  const selectedBooks = selectedCountry
    ? booksByCountry[selectedCountry] ?? []
    : [];

  const selectedCountryData = countries.find((c) => c.id === selectedCountry);

  const countryProgress = useMemo(() => {
    const summary: Record<string, CountryProgressSummary> = {};

    for (const country of countries) {
      const books = booksByCountry[country.id] ?? [];
      const startedBookCount = books.filter((book) => bookProgressById[book.id]?.hasStarted).length;
      const completedBookCount = books.filter((book) => bookProgressById[book.id]?.isCompleted).length;

      summary[country.id] = {
        bookCount: books.length,
        startedBookCount,
        completedBookCount,
      };
    }

    return summary;
  }, [booksByCountry, bookProgressById]);

  const selectedCountryProgress = selectedCountry
    ? countryProgress[selectedCountry]
    : null;

  const renderCountryCard = (country: (typeof countries)[number]) => {
    const progress = countryProgress[country.id];

    return (
      <CountryCard
        key={country.id}
        country={country}
        bookCount={progress.bookCount}
        startedBookCount={progress.startedBookCount}
        completedBookCount={progress.completedBookCount}
        onClick={() => handleCountryClick(country.id)}
        isSelected={selectedCountry === country.id}
      />
    );
  };

  const renderBookCard = (book: Book) => {
    const progress = bookProgressById[book.id];
    const statusLabel = progress?.isCompleted
      ? '완료'
      : progress?.hasStarted
        ? `진행 ${progress.stampCount}/4`
        : '읽기 전';
    const statusClass = progress?.isCompleted
      ? 'bg-stamp-gold text-white'
      : progress?.hasStarted
        ? 'bg-secondary text-white'
        : 'bg-white/90 text-muted';

    return (
      <div key={book.id} className="relative">
        <div className="pointer-events-none absolute right-3 top-3 z-10">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className={progress?.hasStarted ? '' : 'opacity-85'}>
          <BookCard
            book={book}
            onClick={() => handleBookClick(book)}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Country grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        {countries.map(renderCountryCard)}
      </div>

      {/* Books panel for selected country */}
      <AnimatePresence>
        {selectedCountry && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-8 rounded-2xl overflow-hidden border border-border bg-white">
              {/* Panel header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedCountryData?.flag}</span>
                  <div>
                    <h2 className="text-base font-heading font-semibold text-foreground">
                      {selectedCountryData?.name}
                    </h2>
                    <p className="text-xs text-muted">
                      {selectedBooks.length}권의 도서
                      {selectedCountryProgress && selectedCountryProgress.bookCount > 0 && (
                        <span className="ml-2">
                          · 진행 {selectedCountryProgress.startedBookCount}/{selectedCountryProgress.bookCount}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCountry(null)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Books area */}
              <div className="p-4 sm:p-6">
                {selectedBooks.length === 0 ? (
                  <div className="py-8 text-center">
                    <svg className="w-10 h-10 text-border mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <p className="text-sm text-muted">아직 등록된 책이 없습니다</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedBooks.map(renderBookCard)}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* World map with flight routes */}
      <WorldMapSection
        countryProgress={countryProgress}
        onCountryClick={handleCountryClick}
        selectedCountry={selectedCountry}
      />

      {/* Language selection modal */}
      <LanguageModal
        book={selectedBook}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleLanguageSelect}
      />
    </>
  );
}
