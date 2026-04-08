'use client';

import { motion, AnimatePresence } from 'framer-motion';
import BookShelf from './BookShelf';
import type { LibraryBookShelf, LibraryStoryItem } from './LibraryGrid';

interface BookshelfRowProps {
  countryId: string;
  countryName: string;
  countryFlag: string;
  items?: LibraryStoryItem[];
  bookShelves?: LibraryBookShelf[];
  isExpanded: boolean;
  onToggle: () => void;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike: (storyId: string) => void;
  likedStories: Set<string>;
}

function resolveBookShelves(
  bookShelves: LibraryBookShelf[] | undefined,
  items: LibraryStoryItem[] | undefined,
  countryName: string
): LibraryBookShelf[] {
  if (bookShelves && bookShelves.length > 0) {
    return bookShelves;
  }

  if (!items || items.length === 0) {
    return [];
  }

  return [
    {
      bookId: `${countryName}-legacy`,
      bookTitle: '원작 책',
      items,
    },
  ];
}

export default function BookshelfRow({
  countryName,
  countryFlag,
  bookShelves,
  items,
  isExpanded,
  onToggle,
  onItemClick,
  onLike,
  likedStories,
}: BookshelfRowProps) {
  const shelves = resolveBookShelves(bookShelves, items, countryName);
  const totalStories = shelves.reduce((sum, shelf) => sum + shelf.items.length, 0);
  const shelfPreviewItems = shelves.slice(0, 8);

  return (
    <div className="mb-2">
      {/* Country header - clickable */}
      <button onClick={onToggle} className="w-full group">
        <div className="relative">
          {/* Book spines peeking above shelf (when collapsed) */}
          {!isExpanded && shelves.length > 0 && (
            <div className="flex gap-1.5 px-6 pb-0 justify-start overflow-hidden h-10">
              {shelfPreviewItems.map((shelf, i) => {
                const colors = [
                  'bg-[#8B6914]', 'bg-[#2D5016]', 'bg-[#8B0000]',
                  'bg-[#1E3A5F]', 'bg-[#B8860B]', 'bg-[#D2691E]',
                  'bg-[#8B6914]/80', 'bg-[#2D5016]/80',
                ];
                return (
                  <div
                    key={shelf.bookId}
                    className={`w-5 rounded-t-sm ${colors[i % colors.length]} shadow-sm`}
                    style={{ height: `${24 + (i % 3) * 6}px`, marginTop: 'auto' }}
                  />
                );
              })}
            </div>
          )}

          {/* Shelf header bar */}
          <div className="shelf-plank rounded-lg px-6 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl drop-shadow-sm">{countryFlag}</span>
              <span className="font-heading text-white text-base drop-shadow-sm">
                {countryName}
              </span>
              <span className="text-xs text-white/70 bg-white/15 px-2 py-0.5 rounded-full">
                {shelves.length}권 / {totalStories}편
              </span>
            </div>

            {/* Expand/collapse arrow */}
            <motion.svg
              className="w-5 h-5 text-white/80"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </motion.svg>
          </div>

          {/* Shelf shadow underneath */}
          <div className="h-2 bg-gradient-to-b from-black/15 to-transparent mx-2" />
        </div>
      </button>

      {/* Expanded bookshelves */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-2 px-2 space-y-4">
              {shelves.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">
                  아직 이 나라의 이야기가 없어요
                </p>
              ) : (
                shelves.map((shelf, shelfIndex) => (
                  <BookShelf
                    key={shelf.bookId}
                    shelf={shelf}
                    shelfIndex={shelfIndex}
                    onItemClick={onItemClick}
                    onLike={onLike}
                    likedStories={likedStories}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
