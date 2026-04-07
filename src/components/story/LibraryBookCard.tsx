/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';
import type { LibraryStoryItem } from './LibraryGrid';

interface LibraryBookCardProps {
  item: LibraryStoryItem;
  index: number;
  isLiked: boolean;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike: (storyId: string) => void;
}

export default function LibraryBookCard({
  item,
  index,
  isLiked,
  onItemClick,
  onLike,
}: LibraryBookCardProps) {
  const coverImage = item.story.scene_images?.[0] || null;
  const title = item.story.final_text?.[0]?.slice(0, 30) || '이야기';
  const authorName = item.story.author?.nickname || '작성자';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <button
        onClick={() => onItemClick(item)}
        className="w-full text-left bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all group"
        style={{ boxShadow: '-3px 0 6px -3px rgba(141,110,76,0.15)' }}
      >
        {/* Cover image with 3D book perspective */}
        <div className="relative overflow-hidden" style={{ perspective: '800px' }}>
          {coverImage ? (
            <div className="aspect-[3/4]">
              <img
                src={coverImage}
                alt="Story cover"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] bg-gradient-to-br from-secondary/20 via-primary/10 to-accent/15 flex items-center justify-center">
              <span className="text-5xl opacity-60">📖</span>
            </div>
          )}
          {/* Book spine shadow overlay on left */}
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-foreground/10 to-transparent" />
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-sm font-heading text-foreground line-clamp-1 mb-1">
            {title}
          </p>
          <p className="text-xs text-muted mb-2">
            {authorName}
          </p>

          {/* Heart + views */}
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLike(item.story_id);
              }}
              className={`flex items-center gap-1 text-xs transition-colors ${
                isLiked
                  ? 'text-error'
                  : 'text-muted hover:text-error'
              }`}
            >
              <motion.svg
                className="w-4 h-4"
                fill={isLiked ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                whileTap={{ scale: 1.4 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </motion.svg>
              <span className="font-medium">{item.likes}</span>
            </button>
            <span className="text-xs text-muted">
              {item.views}회
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
