'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string;
  onLastPage: () => void;
}

type FlipDirection = 1 | -1;

interface FlipState {
  direction: FlipDirection;
  fromStart: number;
  toStart: number;
}

type PageSide = 'left' | 'right' | 'single';

const PAGE_LABEL_HEIGHT = 44;

function normalizePageStart(page: number, total: number, showSpread: boolean) {
  const cappedPage = Math.max(1, Math.min(page, Math.max(total, 1)));

  if (!showSpread || cappedPage <= 1) {
    return cappedPage;
  }

  return cappedPage % 2 === 0 ? cappedPage - 1 : cappedPage;
}

function getVisiblePages(start: number, total: number, showSpread: boolean): [number, number | null] {
  if (!showSpread) {
    return [start, null];
  }

  return [start, start + 1 <= total ? start + 1 : null];
}

interface PdfPageCardProps {
  pageNumber: number | null;
  width: number;
  side: PageSide;
  pageAspect: number;
  onPageReady?: (page: { width: number; height: number; originalWidth?: number; originalHeight?: number }) => void;
}

function PdfPageCard({
  pageNumber,
  width,
  side,
  pageAspect,
  onPageReady,
}: PdfPageCardProps) {
  const pageHeight = Math.round(width * pageAspect);
  const totalHeight = pageHeight + PAGE_LABEL_HEIGHT;
  const roundedClass =
    side === 'left'
      ? 'rounded-l-[26px] rounded-r-[10px]'
      : side === 'right'
        ? 'rounded-r-[26px] rounded-l-[10px]'
        : 'rounded-[24px]';
  const gutterShadowClass =
    side === 'left'
      ? 'right-0 bg-gradient-to-l from-[#6a4d2d]/12 to-transparent'
      : side === 'right'
        ? 'left-0 bg-gradient-to-r from-[#6a4d2d]/12 to-transparent'
        : 'left-0 bg-gradient-to-r from-[#6a4d2d]/10 to-transparent';

  return (
    <div
      className={`relative overflow-hidden border border-[#e2d4bf] bg-white shadow-[0_18px_42px_rgba(93,64,37,0.14)] ${roundedClass}`}
      style={{ width, height: totalHeight }}
    >
      <div className={`pointer-events-none absolute inset-y-0 z-10 w-7 ${gutterShadowClass}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white/40 to-transparent" />

      <div className="overflow-hidden bg-white" style={{ height: pageHeight }}>
        {pageNumber ? (
          <div className="storybook-page bg-white">
            <Page
              pageNumber={pageNumber}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={(page) =>
                onPageReady?.(page as { width: number; height: number; originalWidth?: number; originalHeight?: number })
              }
            />
          </div>
        ) : (
          <div
            className="h-full w-full bg-[linear-gradient(180deg,#fffdf7,#f8f0e3)]"
          />
        )}
      </div>

      <div className="border-t border-[#efe4d5] px-4 py-3 text-center text-xs font-medium tracking-[0.18em] text-[#8a7457]">
        {pageNumber ? `PAGE ${pageNumber}` : 'END'}
      </div>
    </div>
  );
}

export default function PdfViewer({ pdfUrl, onLastPage }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageWidth, setPageWidth] = useState(440);
  const [pageAspect, setPageAspect] = useState(0.78);
  const [showSpread, setShowSpread] = useState(false);
  const [flipState, setFlipState] = useState<FlipState | null>(null);
  const [singleDirection, setSingleDirection] = useState<FlipDirection | 0>(0);

  useEffect(() => {
    const updateWidth = () => {
      const nextShowSpread = window.innerWidth >= 980;
      const availableWidth = Math.max(280, window.innerWidth - 120);
      const nextWidth = nextShowSpread
        ? Math.floor(Math.min(1120, availableWidth) / 2)
        : Math.min(640, availableWidth);

      setShowSpread(nextShowSpread);
      setPageWidth(nextWidth);
      setFlipState(null);
      setCurrentPage((prev) => normalizePageStart(prev, numPages, nextShowSpread));
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [numPages]);

  useEffect(() => {
    if (!flipState) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCurrentPage(flipState.toStart);
      setFlipState(null);
    }, 820);

    return () => window.clearTimeout(timeout);
  }, [flipState]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setLoading(false);
      setCurrentPage((prev) => normalizePageStart(prev, total, showSpread));
    },
    [showSpread]
  );

  const handlePageReady = useCallback(
    (page: { width: number; height: number; originalWidth?: number; originalHeight?: number }) => {
      const sourceWidth = page.originalWidth ?? page.width;
      const sourceHeight = page.originalHeight ?? page.height;

      if (!sourceWidth || !sourceHeight) {
        return;
      }

      const nextAspect = sourceHeight / sourceWidth;
      setPageAspect((prev) => (Math.abs(prev - nextAspect) > 0.01 ? nextAspect : prev));
    },
    []
  );

  const pageStep = showSpread ? 2 : 1;
  const currentSpread = useMemo(
    () => getVisiblePages(currentPage, numPages, showSpread),
    [currentPage, numPages, showSpread]
  );
  const lastVisiblePage = showSpread
    ? currentSpread[1] ?? currentSpread[0]
    : currentPage;
  const isAtLastPage = numPages > 0 && lastVisiblePage === numPages;

  const targetSpread = useMemo(() => {
    if (!flipState) {
      return currentSpread;
    }

    return getVisiblePages(flipState.toStart, numPages, true);
  }, [currentSpread, flipState, numPages]);

  const baseLeftPage = showSpread
    ? flipState
      ? flipState.direction === 1
        ? currentSpread[0]
        : targetSpread[0]
      : currentSpread[0]
    : currentPage;
  const baseRightPage = showSpread
    ? flipState
      ? flipState.direction === 1
        ? targetSpread[1]
        : currentSpread[1]
      : currentSpread[1]
    : null;
  const flipFrontPage = flipState
    ? flipState.direction === 1
      ? currentSpread[1]
      : currentSpread[0]
    : null;
  const flipBackPage = flipState
    ? flipState.direction === 1
      ? targetSpread[0]
      : targetSpread[1]
    : null;

  const goToPrev = useCallback(() => {
    if (flipState) {
      return;
    }

    if (showSpread) {
      if (currentPage > 1) {
        const previousStart = normalizePageStart(currentPage - pageStep, numPages, true);
        setFlipState({
          direction: -1,
          fromStart: currentPage,
          toStart: previousStart,
        });
      }
      return;
    }

    if (currentPage > 1) {
      setSingleDirection(-1);
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage, flipState, numPages, pageStep, showSpread]);

  const goToNext = useCallback(() => {
    if (flipState) {
      return;
    }

    if (showSpread) {
      if (lastVisiblePage < numPages) {
        const nextStart = normalizePageStart(currentPage + pageStep, numPages, true);
        setFlipState({
          direction: 1,
          fromStart: currentPage,
          toStart: nextStart,
        });
      } else if (isAtLastPage) {
        onLastPage();
      }
      return;
    }

    if (currentPage < numPages) {
      setSingleDirection(1);
      setCurrentPage((prev) => prev + 1);
    } else if (isAtLastPage) {
      onLastPage();
    }
  }, [currentPage, flipState, isAtLastPage, lastVisiblePage, numPages, onLastPage, pageStep, showSpread]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrev();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToNext, goToPrev]);

  const singlePageVariants = {
    enter: (direction: FlipDirection | 0) => ({
      opacity: 0.72,
      rotateY: direction > 0 ? -16 : 16,
      scale: 0.985,
    }),
    center: {
      opacity: 1,
      rotateY: 0,
      scale: 1,
    },
    exit: (direction: FlipDirection | 0) => ({
      opacity: 0.42,
      rotateY: direction > 0 ? 18 : -18,
      scale: 0.985,
    }),
  };

  const spreadWidth = showSpread ? pageWidth * 2 : pageWidth;
  const cardHeight = Math.round(pageWidth * pageAspect) + PAGE_LABEL_HEIGHT;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        className="relative w-full max-w-7xl overflow-hidden rounded-[32px] border border-[#d9ccb5] bg-[#f7f0e4] shadow-[0_24px_60px_rgba(79,53,27,0.16)]"
        style={{ minHeight: showSpread ? cardHeight + 80 : cardHeight + 56 }}
      >
        <div className="pointer-events-none absolute inset-y-0 inset-x-0 z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.62),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_16%,transparent_84%,rgba(110,81,44,0.08))]" />
        {showSpread && (
          <div className="pointer-events-none absolute inset-y-10 left-1/2 z-20 w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7c5b34]/20 via-[#fff8ed] to-[#7c5b34]/20 blur-md" />
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted-light">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-muted-light border-t-primary" />
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => console.error('PDF load error:', err)}
          loading={null}
          className="flex justify-center px-4 py-5 sm:px-6 sm:py-6"
        >
          {showSpread ? (
            <div
              className="relative"
              style={{
                width: spreadWidth,
                height: cardHeight,
                perspective: 2600,
              }}
            >
              <div className="absolute inset-0 flex">
                <PdfPageCard
                  pageNumber={baseLeftPage}
                  width={pageWidth}
                  side="left"
                  pageAspect={pageAspect}
                  onPageReady={handlePageReady}
                />
                <PdfPageCard
                  pageNumber={baseRightPage}
                  width={pageWidth}
                  side="right"
                  pageAspect={pageAspect}
                  onPageReady={handlePageReady}
                />
              </div>

              <AnimatePresence initial={false}>
                {flipState && flipFrontPage && (
                  <motion.div
                    key={`${flipState.fromStart}-${flipState.toStart}-${flipState.direction}`}
                    className="absolute top-0 z-30"
                    style={{
                      width: pageWidth,
                      height: cardHeight,
                      left: flipState.direction === 1 ? pageWidth : 0,
                      transformStyle: 'preserve-3d',
                      transformOrigin:
                        flipState.direction === 1 ? 'left center' : 'right center',
                    }}
                    initial={{ rotateY: 0 }}
                    animate={{ rotateY: flipState.direction === 1 ? -180 : 180 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.82,
                      ease: [0.32, 0.72, 0, 1],
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <PdfPageCard
                        pageNumber={flipFrontPage}
                        width={pageWidth}
                        side={flipState.direction === 1 ? 'right' : 'left'}
                        pageAspect={pageAspect}
                        onPageReady={handlePageReady}
                      />
                    </div>

                    <div
                      className="absolute inset-0"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <PdfPageCard
                        pageNumber={flipBackPage}
                        width={pageWidth}
                        side={flipState.direction === 1 ? 'left' : 'right'}
                        pageAspect={pageAspect}
                        onPageReady={handlePageReady}
                      />
                    </div>

                    <motion.div
                      className={`pointer-events-none absolute inset-y-0 z-40 w-10 ${
                        flipState.direction === 1
                          ? 'left-0 bg-gradient-to-r from-[#5b4227]/24 to-transparent'
                          : 'right-0 bg-gradient-to-l from-[#5b4227]/24 to-transparent'
                      }`}
                      animate={{ opacity: [0.15, 0.45, 0.1] }}
                      transition={{ duration: 0.82, times: [0, 0.45, 1] }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <AnimatePresence initial={false} mode="wait" custom={singleDirection}>
              <motion.div
                key={currentPage}
                custom={singleDirection}
                variants={singlePageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  perspective: 1800,
                  transformStyle: 'preserve-3d',
                  transformOrigin:
                    singleDirection > 0
                      ? 'left center'
                      : singleDirection < 0
                        ? 'right center'
                        : 'center center',
                }}
              >
                <PdfPageCard
                  pageNumber={currentPage}
                  width={pageWidth}
                  side="single"
                  pageAspect={pageAspect}
                  onPageReady={handlePageReady}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </Document>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={goToPrev}
          disabled={currentPage <= 1 || !!flipState}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-xl shadow-sm transition-all hover:bg-card-hover disabled:opacity-30"
          aria-label="이전 페이지"
        >
          &#8592;
        </button>

        <span className="min-w-[120px] text-center text-sm font-medium text-muted">
          {showSpread && currentSpread[1]
            ? `${currentSpread[0]}-${currentSpread[1]} / ${numPages || '...'}`
            : `${currentSpread[0]} / ${numPages || '...'}`
          }
        </span>

        <button
          onClick={goToNext}
          disabled={numPages === 0 || !!flipState}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-xl shadow-sm transition-all hover:bg-card-hover disabled:opacity-30"
          aria-label={isAtLastPage ? '감상 단계로 이동' : '다음 페이지'}
        >
          {isAtLastPage ? '완료' : '→'}
        </button>
      </div>

      {isAtLastPage && (
        <p className="text-center text-sm text-muted">
          마지막 페이지예요. 한 번 더 넘기면 감상 단계로 이동해요.
        </p>
      )}

      <p className="text-center text-xs text-muted">
        {showSpread
          ? '두 페이지를 펼쳐 놓은 그림책 모드예요.'
          : '화면이 좁을 때는 한 페이지씩 읽을 수 있어요.'}
      </p>
    </div>
  );
}
