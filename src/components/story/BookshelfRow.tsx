'use client';

import { motion, AnimatePresence } from 'framer-motion';
import LibraryBookCard from './LibraryBookCard';
import type { LibraryStoryItem } from './LibraryGrid';

interface BookshelfRowProps {
  countryId: string;
  countryName: string;
  countryFlag: string;
  items: LibraryStoryItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike: (storyId: string) => void;
  likedStories: Set<string>;
}

export default function BookshelfRow({
  countryName,
  countryFlag,
  items,
  isExpanded,
  onToggle,
  onItemClick,
  onLike,
  likedStories,
}: BookshelfRowProps) {
  return (
    <div className="mb-4">
      {/* Shelf bar - clickable */}
      <button
        onClick={onToggle}
        className="w-full group"
      >
        <div className="relative">
          {/* Book spines peeking above shelf (when collapsed) */}
          {!isExpanded && items.length > 0 && (
            <div className="flex gap-1.5 px-6 pb-0 justify-start overflow-hidden h-8">
              {items.slice(0, 8).map((item, i) => {
                const colors = [
                  'bg-secondary/60', 'bg-primary/50', 'bg-accent/50',
                  'bg-secondary-dark/40', 'bg-primary/40', 'bg-accent/40',
                  'bg-secondary/50', 'bg-primary/60',
                ];
                return (
                  <div
                    key={item.id}
                    className={`w-5 rounded-t-sm ${colors[i % colors.length]} shadow-sm`}
                    style={{ height: `${20 + (i % 3) * 4}px`, marginTop: 'auto' }}
                  />
                );
              })}
            </div>
          )}

          {/* Wooden shelf surface */}
          <div className="bg-gradient-to-r from-[#8B7355] via-[#A08760] to-[#8B7355] rounded-lg px-6 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{countryFlag}</span>
              <span className="font-heading text-white text-base drop-shadow-sm">
                {countryName}
              </span>
              <span className="text-xs text-white/70 bg-white/15 px-2 py-0.5 rounded-full">
                {items.length}권
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
          <div className="h-2 bg-gradient-to-b from-[#6B5B3E]/30 to-transparent rounded-b-lg mx-2" />
        </div>
      </button>

      {/* Expanded books grid */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-2 px-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">
                  아직 이 나라의 이야기가 없어요
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {items.map((item, index) => (
                    <LibraryBookCard
                      key={item.id}
                      item={item}
                      index={index}
                      isLiked={likedStories.has(item.story_id)}
                      onItemClick={onItemClick}
                      onLike={onLike}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
