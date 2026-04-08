/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';
import type { LibraryStoryItem } from './LibraryGrid';

const SPINE_COLORS: Record<string, string> = {
  colombia: '#8B6914',
  tanzania: '#2D5016',
  cambodia: '#8B0000',
  nepal: '#1E3A5F',
  peru: '#B8860B',
  kenya: '#D2691E',
};

interface ShelfBookProps {
  item: LibraryStoryItem;
  index: number;
  isLiked: boolean;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike: (storyId: string) => void;
  bookCoverUrl?: string | null;
}

export default function ShelfBook({
  item,
  index,
  isLiked,
  onItemClick,
  onLike,
  bookCoverUrl,
}: ShelfBookProps) {
  const coverImage =
    item.story.scene_images?.[0] || bookCoverUrl || item.book?.cover_url || null;
  const title =
    item.story.final_text?.[0]?.slice(0, 20) || '이야기';
  const authorName = item.story.author?.nickname || '작성자';
  const spineColor = SPINE_COLORS[item.country_id] || '#4f5b73';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex-shrink-0 w-[80px] sm:w-[96px] lg:w-[112px]"
      style={{ perspective: '600px' }}
    >
      <motion.button
        onClick={() => onItemClick(item)}
        className="relative w-full group cursor-pointer"
        whileHover={{ y: -8, scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Book body */}
        <div
          className="relative rounded-sm overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-200"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateY(-6deg)',
          }}
        >
          {/* Spine (left edge) */}
          <div
            className="absolute inset-y-0 left-0 w-3 z-10"
            style={{
              background: `linear-gradient(90deg, ${spineColor} 0%, ${spineColor}dd 60%, ${spineColor}99 100%)`,
            }}
          />

          {/* Cover image */}
          {coverImage ? (
            <div className="aspect-[2/3]">
              <img
                src={coverImage}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[2/3] bg-gradient-to-br from-secondary/20 via-primary/10 to-accent/15 flex items-center justify-center">
              <span className="text-3xl opacity-50">📖</span>
            </div>
          )}

          {/* Bottom overlay with title */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-1.5 pt-6">
            <p className="text-[10px] sm:text-[11px] text-white font-medium leading-tight line-clamp-2 drop-shadow-sm">
              {title}
            </p>
          </div>

          {/* Top-right page edge effect */}
          <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-l from-white/20 to-transparent" />
        </div>

        {/* Bottom shadow on shelf */}
        <div className="h-1 mx-1 bg-black/10 rounded-b-full blur-[1px]" />

        {/* Meta row below book */}
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike(item.story_id);
            }}
            className={`flex items-center gap-0.5 text-[10px] transition-colors ${
              isLiked ? 'text-error' : 'text-muted hover:text-error'
            }`}
          >
            <motion.svg
              className="w-3 h-3"
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
            <span>{item.likes}</span>
          </button>
          <span className="text-[10px] text-muted truncate max-w-[50px]">
            {authorName}
          </span>
        </div>
      </motion.button>
    </motion.div>
  );
}
