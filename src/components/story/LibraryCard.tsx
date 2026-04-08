/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';
import type { LibraryStoryItem } from './LibraryGrid';

interface LibraryCardProps {
  item: LibraryStoryItem;
  index: number;
  isLiked: boolean;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike: (storyId: string) => void;
  bookCoverUrl?: string | null;
}

export default function LibraryCard({
  item,
  index,
  isLiked,
  onItemClick,
  onLike,
  bookCoverUrl,
}: LibraryCardProps) {
  const coverImage =
    item.story.scene_images?.[0] || bookCoverUrl || item.book?.cover_url || null;
  const firstPage = item.story.final_text?.[0] || '';
  const title = firstPage.includes(' — ')
    ? firstPage.split(' — ')[0]
    : firstPage.slice(0, 30) || '이야기';
  const authorName = item.story.author?.nickname || '작성자';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex-shrink-0 w-[160px] sm:w-[200px] lg:w-[220px] group cursor-pointer"
      onClick={() => onItemClick(item)}
    >
      {/* Cover */}
      <div className="aspect-[2/3] rounded-xl overflow-hidden mb-3 shadow-sm bg-muted-light transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-2">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary/20 via-primary/10 to-accent/15 flex items-center justify-center">
            <span className="text-4xl opacity-40">📖</span>
          </div>
        )}
      </div>

      {/* Title & Author */}
      <h3 className="font-heading text-sm sm:text-base font-bold text-foreground mb-0.5 line-clamp-2 group-hover:text-secondary transition-colors">
        {title}
      </h3>
      <p className="text-xs text-muted mb-2">
        {authorName}
      </p>

      {/* Like + Views row */}
      <div className="flex items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(item.story_id);
          }}
          className={`flex items-center gap-1 text-xs transition-colors ${
            isLiked ? 'text-error' : 'text-muted hover:text-error'
          }`}
        >
          <motion.svg
            className="w-3.5 h-3.5"
            fill={isLiked ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            whileTap={{ scale: 1.4 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </motion.svg>
          <span className="font-medium">{item.likes}</span>
        </button>
        <span className="text-[11px] text-muted">{item.views}회</span>
      </div>
    </motion.div>
  );
}
