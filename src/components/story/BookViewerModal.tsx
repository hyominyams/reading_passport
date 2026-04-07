/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: string[];
  sceneImages: string[];
  translatedPages?: string[];
  teacherComments?: { author: string; text: string; date: string }[];
}

export default function BookViewerModal({
  isOpen,
  onClose,
  pages,
  sceneImages,
  translatedPages,
  teacherComments = [],
}: BookViewerModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      setShowTranslation(false);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentPage < pages.length - 1) {
        setCurrentPage((p) => p + 1);
      } else if (e.key === 'ArrowLeft' && currentPage > 0) {
        setCurrentPage((p) => p - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, currentPage, pages.length, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-foreground">
                {currentPage + 1} / {pages.length}
              </span>
              {translatedPages && translatedPages.length > 0 && (
                <div className="flex bg-muted-light rounded-full p-0.5">
                  <button
                    onClick={() => setShowTranslation(false)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      !showTranslation
                        ? 'bg-white text-foreground shadow-sm'
                        : 'text-muted'
                    }`}
                  >
                    원문
                  </button>
                  <button
                    onClick={() => setShowTranslation(true)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      showTranslation
                        ? 'bg-white text-foreground shadow-sm'
                        : 'text-muted'
                    }`}
                  >
                    번역
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted-light flex items-center justify-center text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
              >
                {sceneImages[currentPage] && (
                  <div className="aspect-[16/9]">
                    <img
                      src={sceneImages[currentPage]}
                      alt={`장면 ${currentPage + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                    {showTranslation && translatedPages
                      ? translatedPages[currentPage] || pages[currentPage]
                      : pages[currentPage]}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Teacher comments */}
            {teacherComments.length > 0 && currentPage === pages.length - 1 && (
              <div className="px-6 pb-6">
                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  선생님 코멘트
                </h4>
                <div className="space-y-3">
                  {teacherComments.map((comment, idx) => (
                    <div key={idx} className="bg-muted-light rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-foreground">
                          {comment.author}
                        </span>
                        <span className="text-xs text-muted">
                          {comment.date}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{comment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer navigation */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-border">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground disabled:opacity-30 transition-colors"
            >
              이전
            </button>
            <div className="flex gap-1.5">
              {pages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    currentPage === idx ? 'bg-primary' : 'bg-border'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(pages.length - 1, p + 1))
              }
              disabled={currentPage === pages.length - 1}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground disabled:opacity-30 transition-colors"
            >
              다음
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
