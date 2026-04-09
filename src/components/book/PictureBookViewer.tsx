'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPdfJs, createLoadParams } from '@/lib/pdfjs-loader';
import type { PdfDocument } from '@/lib/pdfjs-loader';
import { getCachedDocument, setCachedDocument } from '@/lib/pdf-document-cache';

/* ─── Types ─── */

interface PictureBookViewerProps {
  pdfUrl: string;
  onLastPage: () => void;
  /** Callback reporting the maximum page number the reader has visited */
  onMaxPageChange?: (maxPage: number, totalPages: number) => void;
}

/* ─── Mobile detection (SSR-safe) ─── */

const MQ = '(max-width: 639px)';
function subscribeMedia(cb: () => void) {
  const mql = window.matchMedia(MQ);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
function getIsMobile() {
  return window.matchMedia(MQ).matches;
}
function getIsMobileServer() {
  return false;
}

/* ─── Animation variants ─── */

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.4, 0, 0.2, 1];

const flipVariants = {
  enter: (dir: number) => ({
    rotateY: dir > 0 ? 90 : -90,
    opacity: 0.5,
  }),
  center: {
    rotateY: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: EASE },
  },
  exit: (dir: number) => ({
    rotateY: dir < 0 ? 90 : -90,
    opacity: 0.5,
    transition: { duration: 0.5, ease: EASE },
  }),
};

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 300 : -300,
    opacity: 0,
    transition: { duration: 0.35, ease: EASE },
  }),
};

/* ─── Page Canvas Component ─── */

function PageCanvas({
  doc,
  pageNum,
  side,
}: {
  doc: PdfDocument;
  pageNum: number;
  side: 'left' | 'right' | 'single';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      setLoaded(false);

      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const dpr = window.devicePixelRatio || 1;
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        const baseViewport = page.getViewport({ scale: 1 });
        // Fit within container preserving aspect ratio
        const scaleW = containerW / baseViewport.width;
        const scaleH = containerH / baseViewport.height;
        const scale = Math.min(scaleW, scaleH) * dpr;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoaded(true);
      } catch (e) {
        console.error(`Failed to render page ${pageNum}:`, e);
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center bg-white"
    >
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#faf6ef]">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#e8dcc8] border-t-[#8c5d35]" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <span
        className={`absolute bottom-2 text-[11px] text-[#b8a48c] select-none ${
          side === 'left' ? 'left-3' : 'right-3'
        }`}
      >
        {pageNum}
      </span>
    </div>
  );
}

function BlankPage() {
  return (
    <div className="flex h-full items-center justify-center bg-[#faf6ef]">
      <div className="h-16 w-16 rounded-full bg-[#f0e6d6] opacity-30" />
    </div>
  );
}

/* ─── Main Viewer ─── */

export default function PictureBookViewer({
  pdfUrl,
  onLastPage,
  onMaxPageChange,
}: PictureBookViewerProps) {
  const isMobile = useSyncExternalStore(
    subscribeMedia,
    getIsMobile,
    getIsMobileServer,
  );

  const [pdfDoc, setPdfDoc] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageAspect, setPageAspect] = useState<number>(4 / 3); // width/height
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPageVisited, setMaxPageVisited] = useState(1);
  const [direction, setDirection] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const touchStartX = useRef(0);

  /* ── Derived state ── */
  const spreadOf = (pg: number) => (pg === 1 ? 0 : Math.ceil((pg - 1) / 2));
  const currentSpread = spreadOf(currentPage);
  const totalSpreadCount = pageCount
    ? 1 + Math.ceil((pageCount - 1) / 2)
    : 1;

  const spreadLeft = currentSpread === 0 ? null : currentSpread * 2;
  const spreadRight =
    currentSpread === 0
      ? 1
      : currentSpread * 2 + 1 <= (pageCount ?? 0)
        ? currentSpread * 2 + 1
        : null;

  const canGoNext =
    pageCount !== null &&
    (isMobile
      ? currentPage < pageCount
      : currentSpread < totalSpreadCount - 1);
  const canGoPrev = isMobile ? currentPage > 1 : currentSpread > 0;

  /* ── Track max page visited ── */
  useEffect(() => {
    // On desktop, the right page of the spread is the furthest reached
    const furthest = isMobile
      ? currentPage
      : Math.max(spreadLeft ?? 1, spreadRight ?? 1);
    setMaxPageVisited((prev) => {
      const next = Math.max(prev, furthest);
      if (next !== prev && pageCount && onMaxPageChange) {
        onMaxPageChange(next, pageCount);
      }
      return next;
    });
  }, [currentPage, isMobile, spreadLeft, spreadRight, pageCount, onMaxPageChange]);

  /* ── Load PDF document (with cache + range requests) ── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Check cache first — avoids re-downloading on back-navigation
        const cached = getCachedDocument(pdfUrl);
        if (cached) {
          setPdfDoc(cached);
          setPageCount(cached.numPages);
          try {
            const firstPage = await cached.getPage(1);
            const vp = firstPage.getViewport({ scale: 1 });
            if (!cancelled) setPageAspect(vp.width / vp.height);
          } catch { /* use default aspect */ }
          return;
        }

        const pdfjsLib = await getPdfJs();
        const loadingTask = pdfjsLib.getDocument(createLoadParams(pdfUrl));
        const doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        setCachedDocument(pdfUrl, doc);
        setPdfDoc(doc);
        setPageCount(doc.numPages);

        // Read first page aspect ratio to size the viewer correctly
        try {
          const firstPage = await doc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1 });
          if (!cancelled) setPageAspect(vp.width / vp.height);
        } catch { /* use default aspect */ }
      } catch (e) {
        console.error('Failed to load PDF:', e);
        if (!cancelled) setError('PDF를 불러올 수 없습니다');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  /* ── Prefetch next pages (data parsing only) ── */
  useEffect(() => {
    if (!pdfDoc || pageCount === null) return;
    const nextPages = isMobile
      ? [currentPage + 1]
      : [currentPage + 2, currentPage + 3];

    for (const p of nextPages) {
      if (p >= 1 && p <= pageCount) {
        pdfDoc.getPage(p); // fire-and-forget; PDF.js caches page data internally
      }
    }
  }, [pdfDoc, currentPage, pageCount, isMobile]);

  /* ── Navigation ── */
  const goNext = useCallback(() => {
    if (!canGoNext || pageCount === null) return;
    setDirection(1);
    if (isMobile) {
      setCurrentPage((p) => Math.min(p + 1, pageCount));
    } else {
      const nextSpread = currentSpread + 1;
      setCurrentPage(nextSpread === 0 ? 1 : nextSpread * 2);
    }
  }, [canGoNext, pageCount, isMobile, currentSpread]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    setDirection(-1);
    if (isMobile) {
      setCurrentPage((p) => Math.max(p - 1, 1));
    } else {
      const prevSpread = currentSpread - 1;
      setCurrentPage(prevSpread === 0 ? 1 : prevSpread * 2);
    }
  }, [canGoPrev, isMobile, currentSpread]);

  const goToSpread = useCallback(
    (idx: number) => {
      setDirection(idx > currentSpread ? 1 : -1);
      setCurrentPage(idx === 0 ? 1 : idx * 2);
    },
    [currentSpread],
  );

  /* ── Keyboard ── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  /* ── Touch swipe ── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 50) {
        if (dx < 0) goNext();
        else goPrev();
      }
    },
    [goNext, goPrev],
  );

  /* ── Loading / Error ── */
  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-4 rounded-3xl border border-[#e8dcc8] bg-[#faf6ef] py-20">
        <span className="text-4xl">📖</span>
        <p className="text-sm font-medium text-[#7d6243]">{error}</p>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[#d8c5a8] bg-white px-5 py-2 text-sm font-semibold text-[#7d6243] transition hover:bg-[#fffaf1]"
        >
          새 ��으로 열기
        </a>
      </div>
    );
  }

  if (!pdfDoc || pageCount === null) {
    return (
      <div
        className="mx-auto flex w-full max-w-5xl items-center justify-center rounded-3xl border border-[#e8dcc8] bg-[#faf6ef]"
        style={{ minHeight: 480 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#e8dcc8] border-t-[#8c5d35]" />
          <p className="text-xs font-medium text-[#7d6243]">책을 여는 중...</p>
        </div>
      </div>
    );
  }

  const animKey = isMobile ? currentPage : currentSpread;

  // Desktop: two pages side-by-side → aspect = singlePageAspect * 2
  // Mobile: single page → aspect = singlePageAspect
  const spreadAspect = isMobile ? pageAspect : pageAspect * 2;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* ── Book body ── */}
      <div className="overflow-hidden rounded-[28px] border border-[#d9c7ae] bg-[radial-gradient(circle_at_top,#fffaf1_0%,#f4e6d1_42%,#e2c7a6_100%)] p-2.5 shadow-[0_34px_90px_rgba(94,63,34,0.2)] sm:rounded-[32px] sm:p-5">
        <div
          className="relative overflow-hidden rounded-[20px] border border-[#ddc7a8] bg-[#5d3b22] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_60px_rgba(50,28,10,0.28)] sm:rounded-[24px]"
          style={{ perspective: 1800, aspectRatio: `${spreadAspect}` }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Spine shadow (desktop) */}
          {!isMobile && (
            <div
              className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-8 -translate-x-1/2"
              style={{
                background:
                  'linear-gradient(90deg, rgba(60,35,15,0.25) 0%, rgba(60,35,15,0.08) 30%, transparent 50%, rgba(60,35,15,0.08) 70%, rgba(60,35,15,0.25) 100%)',
              }}
            />
          )}

          {/* Pages area */}
          <AnimatePresence mode="wait" custom={direction}>
            {isMobile ? (
              <motion.div
                key={animKey}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="h-full w-full"
              >
                <PageCanvas
                  doc={pdfDoc}
                  pageNum={currentPage}
                  side="single"
                />
              </motion.div>
            ) : (
              <motion.div
                key={animKey}
                custom={direction}
                variants={flipVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ transformStyle: 'preserve-3d' }}
                className="grid h-full grid-cols-2"
              >
                <div className="overflow-hidden border-r border-[#e2d5c2]/30">
                  {spreadLeft ? (
                    <PageCanvas
                      doc={pdfDoc}
                      pageNum={spreadLeft}
                      side="left"
                    />
                  ) : (
                    <BlankPage />
                  )}
                </div>
                <div className="overflow-hidden">
                  {spreadRight ? (
                    <PageCanvas
                      doc={pdfDoc}
                      pageNum={spreadRight}
                      side="right"
                    />
                  ) : (
                    <BlankPage />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tap zones */}
          <button
            type="button"
            aria-label="이전 페이지"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="absolute inset-y-0 left-0 z-30 w-1/4 cursor-w-resize opacity-0 transition hover:opacity-100 disabled:cursor-default disabled:opacity-0 sm:w-[15%]"
          >
            <div className="flex h-full items-center justify-start pl-3">
              <div className="rounded-full bg-black/20 p-2 backdrop-blur-sm">
                <ChevronLeft />
              </div>
            </div>
          </button>
          <button
            type="button"
            aria-label="다음 페이지"
            onClick={goNext}
            disabled={!canGoNext}
            className="absolute inset-y-0 right-0 z-30 w-1/4 cursor-e-resize opacity-0 transition hover:opacity-100 disabled:cursor-default disabled:opacity-0 sm:w-[15%]"
          >
            <div className="flex h-full items-center justify-end pr-3">
              <div className="rounded-full bg-black/20 p-2 backdrop-blur-sm">
                <ChevronRight />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#eadcca] bg-white/90 px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="flex items-center gap-1 rounded-full border border-[#d8c5a8] bg-[#fffaf1] px-3 py-1.5 text-sm font-semibold text-[#7d6243] transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-30 disabled:hover:translate-y-0 sm:px-4 sm:py-2"
          >
            <ChevronLeft />
            <span className="hidden sm:inline">이전</span>
          </button>

          {isMobile ? (
            <span className="text-sm font-medium text-[#7d6243]">
              {currentPage} / {pageCount}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {Array.from({ length: totalSpreadCount }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  aria-label={`${i === 0 ? '표지' : `${i * 2}-${i * 2 + 1}쪽`}`}
                  onClick={() => goToSpread(i)}
                  className={`h-2 shrink-0 rounded-full transition-all ${
                    i === currentSpread
                      ? 'w-6 bg-[#8c5d35]'
                      : 'w-2 bg-[#d9c7ae] hover:bg-[#c4ae92]'
                  }`}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="flex items-center gap-1 rounded-full border border-[#d8c5a8] bg-[#fffaf1] px-3 py-1.5 text-sm font-semibold text-[#7d6243] transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-30 disabled:hover:translate-y-0 sm:px-4 sm:py-2"
          >
            <span className="hidden sm:inline">다음</span>
            <ChevronRight />
          </button>
        </div>

        <p className="text-center text-xs text-[#b8a48c]">
          {isMobile
            ? `${currentPage}쪽 / 전체 ${pageCount}쪽`
            : currentSpread === 0
              ? `표지 — 전체 ${pageCount}쪽`
              : `${spreadLeft ?? ''}${spreadLeft && spreadRight ? ' - ' : ''}${spreadRight ?? ''}쪽 / ${pageCount}쪽`}
          <span className="mx-2 text-[#d9c7ae]">·</span>
          {isMobile
            ? '스와이프로 넘기세요'
            : '화살표 키 또는 스와이프로 넘기세요'}
        </p>

        {pageCount && maxPageVisited >= pageCount ? (
          <motion.button
            type="button"
            onClick={onLastPage}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center self-center rounded-full bg-[#8c5d35] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7b512d]"
          >
            읽기 완료
          </motion.button>
        ) : (
          <p className="self-center text-xs text-[#b8a48c]">
            마지막 페이지까지 읽으면 완료 버튼이 나타나요
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Icons ── */

function ChevronLeft() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}
