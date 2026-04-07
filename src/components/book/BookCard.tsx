'use client';

import { motion } from 'framer-motion';
import type { Book } from '@/types/database';
import BookCoverImage from '@/components/book/BookCoverImage';

interface BookCardProps {
  book: Book;
  onClick: () => void;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="flex gap-4 p-4 rounded-xl bg-white border border-border
                 hover:shadow-md hover:border-foreground/10 transition-all text-left w-full"
    >
      {/* Cover */}
      <div className="relative w-16 h-22 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
        <BookCoverImage
          key={book.cover_url}
          title={book.title}
          coverUrl={book.cover_url}
          sizes="64px"
        />
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center gap-1.5 min-w-0">
        <h4 className="text-sm font-medium text-foreground truncate">
          {book.title}
        </h4>
        <div className="flex gap-1.5">
          {book.languages_available.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-muted"
            >
              {lang === 'ko' ? 'KO' : 'EN'}
            </span>
          ))}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center ml-auto">
        <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </motion.button>
  );
}
