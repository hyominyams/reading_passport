/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';
import LibraryCard from './LibraryCard';
import type { LibraryStoryItem } from './LibraryGrid';

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

export default function LibraryCountrySection({
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
        </div>

        {/* Horizontal scrolling cards */}
        <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-4 scrollbar-hide">
          {items.map((item, index) => (
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
    </motion.section>
  );
}
