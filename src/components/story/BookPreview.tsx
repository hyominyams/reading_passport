/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BookPreviewProps {
  pages: string[];
  sceneImages: string[];
  coverImage?: string;
  title?: string;
  translatedPages?: string[];
}

export default function BookPreview({
  pages,
  sceneImages,
  coverImage,
  title,
  translatedPages,
}: BookPreviewProps) {
  const [currentPage, setCurrentPage] = useState(-1); // -1 = cover
  const [showTranslation, setShowTranslation] = useState(false);

  const totalPages = pages.length;

  const goNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goPrev = () => {
    if (currentPage >= -1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Language toggle */}
      {translatedPages && translatedPages.length > 0 && (
        <div className="flex justify-center mb-4">
          <div className="flex bg-muted-light rounded-full p-1">
            <button
              onClick={() => setShowTranslation(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !showTranslation
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted'
              }`}
            >
              원문
            </button>
            <button
              onClick={() => setShowTranslation(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                showTranslation
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted'
              }`}
            >
              번역
            </button>
          </div>
        </div>
      )}

      {/* Book display */}
      <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
        <AnimatePresence mode="wait">
          {currentPage === -1 ? (
            // Cover page
            <motion.div
              key="cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="aspect-[3/4] relative flex items-center justify-center bg-gradient-to-b from-primary/10 to-primary/5"
            >
              {coverImage ? (
                <img
                  src={coverImage}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">📖</div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {title || '나만의 이야기'}
                  </h2>
                </div>
              )}
            </motion.div>
          ) : (
            // Content pages
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col"
            >
              {/* Scene image */}
              {sceneImages[currentPage] && (
                <div className="aspect-[16/9] relative">
                  <img
                    src={sceneImages[currentPage]}
                    alt={`장면 ${currentPage + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Text */}
              <div className="p-6">
                <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                  {showTranslation && translatedPages
                    ? translatedPages[currentPage] || pages[currentPage]
                    : pages[currentPage]}
                </p>
                <p className="text-xs text-muted mt-4">
                  {currentPage + 1} / {totalPages}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-border">
          <button
            onClick={goPrev}
            disabled={currentPage === -1}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground disabled:opacity-30 transition-colors"
          >
            이전
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCurrentPage(-1)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                currentPage === -1 ? 'bg-primary' : 'bg-border'
              }`}
            />
            {pages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  currentPage === idx ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={currentPage === totalPages - 1}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground disabled:opacity-30 transition-colors"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
