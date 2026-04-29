'use client';

import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import LibraryCard from './LibraryCard';
import type { LibraryStoryItem } from './LibraryGrid';

type SortMode = 'likes' | 'views' | 'latest';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'likes', label: '인기순' },
  { key: 'views', label: '조회순' },
  { key: 'latest', label: '최신순' },
];

interface LibraryCountrySectionProps {
  countryName: string;
  countryFlag: string;
  items: LibraryStoryItem[];
  storyCount: number;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike: (storyId: string) => void;
  likedStories: Set<string>;
  variant?: 'default' | 'alt';
}

function LibraryCountrySection({
  countryName,
  countryFlag,
  items,
  storyCount,
  onItemClick,
  onLike,
  likedStories,
  variant = 'default',
}: LibraryCountrySectionProps) {
  const isAlt = variant === 'alt';
  const [sortMode, setSortMode] = useState<SortMode>('likes');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    switch (sortMode) {
      case 'likes':
        return sorted.sort((a, b) => b.likes - a.likes);
      case 'views':
        return sorted.sort((a, b) => b.views - a.views);
      case 'latest':
        return sorted.sort(
          (a, b) =>
            new Date(b.story.created_at).getTime() -
            new Date(a.story.created_at).getTime()
        );
    }
  }, [items, sortMode]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      ro.disconnect();
    };
  }, [updateScrollButtons, sortedItems]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className={isAlt ? 'bg-muted-light/50 py-10' : ''}
    >
      <div className="px-4 sm:px-8">
        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-baseline gap-3">
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <span className="text-2xl">{countryFlag}</span>
              {countryName}
            </h2>
            <span className="text-xs text-muted bg-border/40 px-2.5 py-0.5 rounded-md font-medium">
              {storyCount}편
            </span>
          </div>

          {/* Sort chips */}
          <div className="flex items-center gap-1.5">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortMode(opt.key)}
	                className={`inline-flex min-h-10 items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium transition-colors sm:min-h-11 sm:text-xs ${
                  sortMode === opt.key
                    ? 'bg-secondary text-white'
                    : 'bg-border/30 text-muted hover:bg-border/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal scrolling cards with arrows */}
        <div className="relative group/scroll">
          {/* Left arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
	              className="coarse-pointer-visible absolute bottom-4 left-0 top-0 z-10 flex w-11 items-center justify-center bg-gradient-to-r from-white/90 via-white/60 to-transparent opacity-0 transition-opacity group-hover/scroll:opacity-100"
              aria-label="이전으로 스크롤"
            >
	              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground shadow-md">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </span>
            </button>
          )}

          {/* Right arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
	              className="coarse-pointer-visible absolute bottom-4 right-0 top-0 z-10 flex w-11 items-center justify-center bg-gradient-to-l from-white/90 via-white/60 to-transparent opacity-0 transition-opacity group-hover/scroll:opacity-100"
              aria-label="다음으로 스크롤"
            >
	              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-foreground shadow-md">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          )}

          <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-4 sm:gap-6 pb-4 scrollbar-hide"
          >
            {sortedItems.map((item, index) => (
              <LibraryCard
                key={item.id}
                item={item}
                index={index}
                isLiked={likedStories.has(item.story_id)}
                onItemClick={onItemClick}
                onLike={onLike}
                bookCoverUrl={item.book?.cover_url}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

const MemoizedLibraryCountrySection = memo(LibraryCountrySection);

MemoizedLibraryCountrySection.displayName = 'LibraryCountrySection';

export default MemoizedLibraryCountrySection;
