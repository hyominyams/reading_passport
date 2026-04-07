'use client';

import { motion } from 'framer-motion';
import type { Book } from '@/types/database';

interface BookCardProps {
  book: Book;
  onClick: () => void;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="flex gap-4 p-4 rounded-xl bg-card border border-border
                 hover:shadow-md transition-shadow text-left w-full"
    >
      {/* Cover image */}
      <div className="w-20 h-28 rounded-lg bg-muted-light overflow-hidden flex-shrink-0">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            📚
          </div>
        )}
      </div>

      {/* Book info */}
      <div className="flex flex-col justify-center gap-2 min-w-0">
        <h4 className="text-base font-semibold text-foreground truncate">
          {book.title}
        </h4>

        {/* Language badges */}
        <div className="flex gap-2">
          {book.languages_available.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                         bg-accent/10 text-accent-dark"
            >
              {lang === 'ko' ? '🇰🇷 한국어' : '🇺🇸 English'}
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  );
}
