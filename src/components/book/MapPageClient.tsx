'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import CountryCard from '@/components/book/CountryCard';
import BookCard from '@/components/book/BookCard';
import LanguageModal from '@/components/book/LanguageModal';
import { countries } from '@/lib/data/countries';
import type { Book, Language } from '@/types/database';

interface MapPageClientProps {
  booksByCountry: Record<string, Book[]>;
}

export default function MapPageClient({ booksByCountry }: MapPageClientProps) {
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

  return (
    <>
      {/* Country grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {countries.map((country) => (
          <CountryCard
            key={country.id}
            country={country}
            bookCount={booksByCountry[country.id]?.length ?? 0}
            onClick={() => handleCountryClick(country.id)}
            isSelected={selectedCountry === country.id}
          />
        ))}
      </div>

      {/* Books list for selected country - bookshelf style */}
      <AnimatePresence>
        {selectedCountry && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-8 rounded-2xl overflow-hidden border border-border">
              {/* Shelf header - wood grain effect */}
              <div className="bg-gradient-to-r from-primary/80 via-primary/60 to-primary/80 px-6 py-3">
                <h2 className="text-base font-heading text-white flex items-center gap-2">
                  {countries.find((c) => c.id === selectedCountry)?.flag}{' '}
                  {countries.find((c) => c.id === selectedCountry)?.name}의 책
                </h2>
              </div>

              {/* Books area */}
              <div className="p-6 bg-card">
                {selectedBooks.length === 0 ? (
                  <p className="text-sm text-muted py-4 text-center">
                    아직 등록된 책이 없습니다.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onClick={() => handleBookClick(book)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Shelf bottom edge */}
              <div className="h-3 bg-gradient-to-b from-primary/30 to-primary/10 shadow-inner" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
