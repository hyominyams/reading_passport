/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';
import type { LibraryStoryItem } from './LibraryGrid';

interface LibraryHeroProps {
  item: LibraryStoryItem;
  onItemClick: (item: LibraryStoryItem) => void;
}

export default function LibraryHero({ item, onItemClick }: LibraryHeroProps) {
  const coverImage =
    item.story.scene_images?.[0] || item.book?.cover_url || null;
  const authorName = item.story.author?.nickname || '작성자';
  const bookTitle = item.book?.title?.trim() || '';

  // Use first page as synopsis, truncated
  const synopsis = item.story.final_text?.[0]?.slice(0, 60) || '';

  return (
    <section className="px-4 sm:px-8 mt-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full h-[400px] sm:h-[460px] rounded-3xl overflow-hidden group cursor-pointer"
        onClick={() => onItemClick(item)}
      >
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10 z-10" />

        {/* Background image */}
        {coverImage ? (
          <img
            src={coverImage}
            alt={bookTitle}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 via-primary/20 to-accent/20" />
        )}

        {/* Content overlay */}
        <div className="relative z-20 h-full flex flex-col justify-end px-8 sm:px-12 pb-10 sm:pb-12 max-w-lg">
          <span className="inline-block w-fit px-3 py-1 bg-stamp-gold text-white rounded-full text-[10px] font-bold tracking-widest mb-4 uppercase">
            이 주의 이야기
          </span>

          {bookTitle && (
            <p className="text-white/50 text-xs tracking-widest uppercase mb-2">
              {bookTitle}
            </p>
          )}

          <h1 className="text-white text-2xl sm:text-4xl font-bold leading-snug mb-3">
            {authorName}의 이야기
          </h1>

          {synopsis && (
            <p className="text-white/60 text-sm leading-relaxed mb-6 line-clamp-2">
              {synopsis}...
            </p>
          )}

          <div className="flex items-center gap-4">
            <button className="px-6 py-2.5 bg-white text-foreground rounded-full text-sm font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
              읽어보기
            </button>
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {item.likes}
              </span>
              <span className="text-white/40">|</span>
              <span>{item.views}회</span>
            </div>
          </div>
        </div>

        {/* Floating book cover (desktop only) */}
        {coverImage && (
          <div className="absolute right-16 bottom-8 z-30 hidden xl:block w-48 h-64 bg-white shadow-2xl rounded-xl p-2.5 transform rotate-2 group-hover:rotate-0 transition-transform duration-500">
            <img
              src={coverImage}
              alt={bookTitle}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}
      </motion.div>
    </section>
  );
}
