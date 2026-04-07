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
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-border">
              {/* Title */}
              <h3 className="text-base font-heading font-semibold text-foreground text-center mb-1">
                언어를 선택하세요
              </h3>
              <p className="text-sm text-muted text-center mb-6">
                {book.title}
              </p>

              {/* Language buttons */}
              <div className="flex flex-col gap-3">
                {book.languages_available.includes('ko') && (
                  <button
                    onClick={() => onSelect(book.id, 'ko')}
                    className="flex items-center justify-center gap-3 w-full py-3.5 px-6
                               rounded-xl border border-border bg-white
                               hover:border-foreground/20 hover:bg-background
                               transition-all text-sm font-medium"
                  >
                    <span className="text-xl">🇰🇷</span>
                    <span>한국어</span>
                  </button>
                )}
                {book.languages_available.includes('en') && (
                  <button
                    onClick={() => onSelect(book.id, 'en')}
                    className="flex items-center justify-center gap-3 w-full py-3.5 px-6
                               rounded-xl border border-border bg-white
                               hover:border-foreground/20 hover:bg-background
                               transition-all text-sm font-medium"
                  >
                    <span className="text-xl">🇺🇸</span>
                    <span>English</span>
                  </button>
                )}
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="mt-4 w-full py-2 text-xs text-muted hover:text-foreground transition-colors"
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
