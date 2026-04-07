'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Book, Language } from '@/types/database';

interface LanguageModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (bookId: string, language: Language) => void;
}

export default function LanguageModal({
  book,
  isOpen,
  onClose,
  onSelect,
}: LanguageModalProps) {
  if (!book) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/40 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-card rounded-2xl shadow-xl max-w-sm w-full p-6 border border-border">
              {/* Title */}
              <h3 className="text-lg font-heading text-foreground text-center mb-2">
                이 책의 언어를 선택해주세요
              </h3>
              <p className="text-sm text-muted text-center mb-6">
                {book.title}
              </p>

              {/* Language buttons */}
              <div className="flex flex-col gap-3">
                {book.languages_available.includes('ko') && (
                  <button
                    onClick={() => onSelect(book.id, 'ko')}
                    className="flex items-center justify-center gap-3 w-full py-4 px-6
                               rounded-xl border-2 border-border bg-card
                               hover:border-primary hover:bg-primary/5
                               transition-all text-base font-medium"
                  >
                    <span className="text-2xl">🇰🇷</span>
                    <span>한국어</span>
                  </button>
                )}
                {book.languages_available.includes('en') && (
                  <button
                    onClick={() => onSelect(book.id, 'en')}
                    className="flex items-center justify-center gap-3 w-full py-4 px-6
                               rounded-xl border-2 border-border bg-card
                               hover:border-primary hover:bg-primary/5
                               transition-all text-base font-medium"
                  >
                    <span className="text-2xl">🇺🇸</span>
                    <span>English</span>
                  </button>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="mt-4 w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                취소
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
