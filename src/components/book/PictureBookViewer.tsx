'use client';

import '@/lib/pdf-worker-setup';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PictureBookViewerProps {
  pdfUrl: string;
  onLastPage: () => void;
}

function getSpreadPages(
  spreadIndex: number,
  numPages: number,
  isMobile: boolean
): { left: number | null; right: number | null } {
  if (isMobile) {
    const pageNum = spreadIndex + 1;
    return { left: null, right: pageNum <= numPages ? pageNum : null };
  }
  if (spreadIndex === 0) {
    return { left: null, right: 1 };
  }
  const leftPage = spreadIndex * 2;
  const rightPage = spreadIndex * 2 + 1;
  return {
    left: leftPage <= numPages ? leftPage : null,
    right: rightPage <= numPages ? rightPage : null,
  };
}

function getTotalSpreads(numPages: number, isMobile: boolean): number {
  if (isMobile) return numPages;
  if (numPages <= 1) return 1;
  return 1 + Math.ceil((numPages - 1) / 2);
}

const pageVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -200 : 200,
    opacity: 0,
  }),
};

export default function PictureBookViewer({
  pdfUrl,
  onLastPage,
}: PictureBookViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentSpread, setCurrentSpread] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [direction, setDirection] = useState(1);
  const [pdfError, setPdfError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobile = containerWidth < 768;
  const totalSpreads = numPages ? getTotalSpreads(numPages, isMobile) : 0;
  const isLastSpread = totalSpreads > 0 && currentSpread === totalSpreads - 1;
  const spread = numPages
    ? getSpreadPages(currentSpread, numPages, isMobile)
    : { left: null, right: null };

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSpreads, currentSpread]);

  const goNext = useCallback(() => {
    setCurrentSpread((prev) => {
      if (prev < totalSpreads - 1) {
        setDirection(1);
        return prev + 1;
      }
      return prev;
    });
  }, [totalSpreads]);

  const goPrev = useCallback(() => {
    setCurrentSpread((prev) => {
      if (prev > 0) {
        setDirection(-1);
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Calculate page width
  const framePadding = isMobile ? 12 : 16;
  const innerPadding = framePadding * 2;
  const spineWidth = isMobile ? 0 : 2;
  const availableWidth = Math.max(containerWidth - innerPadding - 24, 100);
  const pageWidth = isMobile
    ? availableWidth
    : Math.floor((availableWidth - spineWidth) / 2);

  // Page indicator text
  const getPageIndicator = () => {
    if (!numPages) return '';
    if (isMobile) {
      return `${currentSpread + 1} / ${numPages}`;
    }
    if (spread.left && spread.right) {
      return `${spread.left}-${spread.right} / ${numPages}`;
    }
    const page = spread.left || spread.right;
    return page ? `${page} / ${numPages}` : '';
  };

  if (pdfError) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-[#d9c7ae] bg-[linear-gradient(180deg,#fbf6ec_0%,#efe1ca_100%)] p-8 shadow-[0_28px_90px_rgba(94,63,34,0.16)]">
          <span className="text-5xl">📖</span>
          <p className="text-sm font-semibold text-[#7d6243]">
            PDF를 불러올 수 없습니다
          </p>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-[#d8c5a8] bg-white px-4 py-2 text-sm font-semibold text-[#7d6243] transition hover:-translate-y-0.5 hover:bg-[#fffaf1]"
          >
            새 탭으로 열기
          </a>
        </div>
        <div className="flex items-center justify-center">
          <motion.button
            type="button"
            onClick={onLastPage}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center rounded-full bg-[#8c5d35] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7b512d]"
          >
            읽기 완료
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* Book frame */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[28px] border border-[#d9c7ae] bg-[linear-gradient(180deg,#fbf6ec_0%,#efe1ca_100%)] p-3 shadow-[0_28px_90px_rgba(94,63,34,0.16)] sm:p-4"
      >
        <div className="overflow-hidden rounded-[22px] border border-[#e7d7c1] bg-white shadow-inner">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setPdfError(true)}
            loading={
              <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#d9c7ae] border-t-[#8c5d35]" />
                  <p className="text-xs text-[#8f7759]">책을 펼치는 중...</p>
                </div>
              </div>
            }
          >
            {numPages && containerWidth > 0 && (
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentSpread}
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="relative"
                >
                  {/* Desktop: two-page spread */}
                  {!isMobile ? (
                    <div className="flex min-h-[60vh]">
                      {/* Left page area */}
                      <div
                        className="flex flex-1 cursor-pointer items-center justify-center bg-[#faf7f2]"
                        onClick={goPrev}
                        role="button"
                        tabIndex={-1}
                        aria-label="이전 페이지"
                      >
                        {spread.left ? (
                          <div className="storybook-page">
                            <Page
                              pageNumber={spread.left}
                              width={pageWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              loading={
                                <div
                                  className="animate-pulse bg-[#f0e8db]"
                                  style={{
                                    width: pageWidth,
                                    height: pageWidth * 1.4,
                                  }}
                                />
                              }
                            />
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            {currentSpread === 0 && (
                              <div className="flex flex-col items-center gap-2 text-[#c4a882]">
                                <svg
                                  className="h-12 w-12"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Spine divider */}
                      <div className="w-[2px] bg-gradient-to-b from-transparent via-[#d9c7ae] to-transparent" />

                      {/* Right page area */}
                      <div
                        className="flex flex-1 cursor-pointer items-center justify-center bg-white"
                        onClick={goNext}
                        role="button"
                        tabIndex={-1}
                        aria-label="다음 페이지"
                      >
                        {spread.right ? (
                          <div className="storybook-page">
                            <Page
                              pageNumber={spread.right}
                              width={pageWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              loading={
                                <div
                                  className="animate-pulse bg-[#f0e8db]"
                                  style={{
                                    width: pageWidth,
                                    height: pageWidth * 1.4,
                                  }}
                                />
                              }
                            />
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-center"
                            style={{
                              width: pageWidth,
                              minHeight: pageWidth * 1.2,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Mobile: single page */
                    <div
                      className="flex min-h-[50vh] items-center justify-center"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        if (clickX > rect.width / 2) goNext();
                        else goPrev();
                      }}
                      role="button"
                      tabIndex={-1}
                    >
                      {spread.right && (
                        <div className="storybook-page">
                          <Page
                            pageNumber={spread.right}
                            width={pageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={
                              <div
                                className="animate-pulse bg-[#f0e8db]"
                                style={{
                                  width: pageWidth,
                                  height: pageWidth * 1.4,
                                }}
                              />
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </Document>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#eadcca] bg-white/90 px-5 py-4 shadow-sm">
        {/* Navigation row */}
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentSpread === 0}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-[#7d6243] transition hover:bg-[#f5ede0] disabled:opacity-30"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            이전
          </button>

          <span className="text-sm font-semibold text-[#7d6243]">
            {getPageIndicator()}
          </span>

          <button
            type="button"
            onClick={goNext}
            disabled={isLastSpread}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-[#7d6243] transition hover:bg-[#f5ede0] disabled:opacity-30"
          >
            다음
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Page dots (show for small page counts) */}
        {totalSpreads > 0 && totalSpreads <= 20 && (
          <div className="flex gap-1.5">
            {Array.from({ length: totalSpreads }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDirection(i > currentSpread ? 1 : -1);
                  setCurrentSpread(i);
                }}
                className={`h-2 w-2 rounded-full transition-all ${
                  currentSpread === i
                    ? 'scale-125 bg-[#8c5d35]'
                    : 'bg-[#d9c7ae] hover:bg-[#c4a882]'
                }`}
                aria-label={`스프레드 ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Reading complete button */}
        <motion.button
          type="button"
          onClick={onLastPage}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition ${
            isLastSpread
              ? 'bg-[#8c5d35] text-white hover:bg-[#7b512d]'
              : 'bg-[#e8ddd0] text-[#a08768] cursor-default'
          }`}
          disabled={!isLastSpread}
        >
          {isLastSpread ? '읽기 완료' : '끝까지 읽어주세요'}
        </motion.button>
      </div>
    </div>
  );
}
