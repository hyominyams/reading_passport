/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getTranslationLanguageLabel } from '@/lib/story-translations';

/* ─── Types ─── */

interface Comment {
  author: string;
  text: string;
  date: string;
}

interface BookViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: string[];
  sceneImages: string[];
  translatedPages?: string[];
  translatedPagesByLanguage?: Record<string, string[]>;
  comments?: Comment[];
  canComment?: boolean;
  commentLockMessage?: string;
  onReadingComplete?: (totalPages: number) => void;
  commentText?: string;
  onCommentChange?: (text: string) => void;
  onSubmitComment?: () => void;
  submittingComment?: boolean;
  // Social feature props
  likeCount?: number;
  isLiked?: boolean;
  onLike?: () => void;
  commentCount?: number;
  storyFontFamily?: string;
  storyFontSize?: number;
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

/* ─── Icons ─── */

function ChevronLeft() {
  return (
    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

/* ─── Component ─── */

export default function BookViewerModal({
  isOpen,
  onClose,
  pages,
  sceneImages,
  translatedPages,
  translatedPagesByLanguage,
  comments = [],
  canComment = false,
  commentLockMessage = '이 책을 끝까지 읽은 뒤 댓글을 남길 수 있어요.',
  onReadingComplete,
  commentText = '',
  onCommentChange,
  onSubmitComment,
  submittingComment = false,
  likeCount,
  isLiked = false,
  onLike,
  commentCount,
  storyFontFamily,
  storyFontSize,
}: BookViewerModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedLanguage, setSelectedLanguage] = useState<'original' | string>('original');
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const hasReportedReadRef = useRef(false);
  const touchStartX = useRef(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const isMobile = useMediaQuery('(max-width: 639px)');
  const isShortLandscapeTablet = useMediaQuery('(max-width: 1199px) and (max-height: 700px) and (orientation: landscape)');
  const useBottomCommentsPanel = isMobile || isShortLandscapeTablet;

  const isLastPage = currentPage === pages.length - 1;
  const normalizedTranslatedPagesByLanguage =
    translatedPagesByLanguage && Object.keys(translatedPagesByLanguage).length > 0
      ? translatedPagesByLanguage
      : translatedPages
        ? { en: translatedPages }
        : {};
  const availableLanguages = Object.keys(normalizedTranslatedPagesByLanguage).filter(
    (languageCode) => (normalizedTranslatedPagesByLanguage[languageCode] ?? []).length > 0
  );
  const currentPages =
    selectedLanguage === 'original'
      ? pages
      : normalizedTranslatedPagesByLanguage[selectedLanguage] ?? pages;

  const goNext = () => {
    if (currentPage < pages.length - 1) {
      setDirection(1);
      setCurrentPage((p) => p + 1);
    }
  };

  const goPrev = () => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage((p) => p - 1);
    }
  };

  const goToPage = (idx: number) => {
    setDirection(idx > currentPage ? 1 : -1);
    setCurrentPage(idx);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentPage, pages.length]);

  // Reading completion tracking
  useEffect(() => {
    if (!isOpen || !isLastPage || hasReportedReadRef.current) return;
    onReadingComplete?.(pages.length);
    hasReportedReadRef.current = true;
  }, [isLastPage, isOpen, onReadingComplete, pages.length]);

  useEffect(() => {
    if (!isOpen) hasReportedReadRef.current = false;
  }, [isOpen]);

  // Scroll to bottom when new comment added
  useEffect(() => {
    if (commentsPanelOpen) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, commentsPanelOpen]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  if (!isOpen) return null;

  const variants = isMobile ? slideVariants : flipVariants;
  const animKey = `page-${currentPage}`;
  const displayedCommentCount = comments.length || commentCount || 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[96vh]"
        >
          {/* ── Book Frame ── */}
          <div className="flex-1 min-h-0 rounded-none sm:rounded-[28px] border-0 sm:border border-[#d9c7ae] bg-[radial-gradient(circle_at_top,#fffaf1_0%,#f4e6d1_42%,#e2c7a6_100%)] p-0 sm:p-3 shadow-none sm:shadow-[0_34px_90px_rgba(94,63,34,0.25)] flex flex-col overflow-hidden">

            {/* ── Page Area (open book) ── */}
            <div
              className="relative flex-1 min-h-0 overflow-hidden rounded-none sm:rounded-[22px] border-0 sm:border border-[#ddc7a8] bg-[#f0e4d0] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col"
              style={{ perspective: 1800 }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Overlay: page counter */}
              <div className="absolute top-3 left-3 z-40 rounded-full bg-black/35 backdrop-blur-sm px-3 py-1">
                <span className="text-xs font-medium text-white/90">
                  {currentPage + 1} / {pages.length}
                </span>
              </div>

              {/* Overlay: language selector + close */}
              <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
                {availableLanguages.length > 0 && (
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="min-h-11 rounded-full bg-black/35 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white/90 border-none outline-none appearance-none cursor-pointer"
                  >
                    <option value="original">원문</option>
                    {availableLanguages.map((lc) => (
                      <option key={lc} value={lc}>
                        {getTranslationLanguageLabel(lc)}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Animated page content */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={animKey}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  style={!isMobile ? { transformStyle: 'preserve-3d' } : undefined}
                  className={isMobile ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0 grid grid-cols-2'}
                >
                  {/* Left page: Scene image */}
                  <div className={isMobile
                    ? 'flex-1 min-h-0 flex items-center justify-center bg-[#2a1d10]'
                    : 'relative flex items-center justify-center bg-[#f0e4d0] overflow-hidden'
                  }>
                    {sceneImages[currentPage] ? (
                      <img
                        src={sceneImages[currentPage]}
                        alt={`장면 ${currentPage + 1}`}
                        className={isMobile ? 'w-full h-full object-contain' : 'w-full h-full object-contain'}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#f4e6d1] via-[#e8d5b8] to-[#d9c7ae] flex items-center justify-center">
                        <span className="text-6xl opacity-20">📖</span>
                      </div>
                    )}
                  </div>

                  {/* Right page: Text (desktop) / Below text (mobile) */}
                  <div className={isMobile
                    ? 'bg-[#fffaf1] px-5 py-4 border-t border-[#e8dcc8]'
                    : 'relative bg-[#fffaf1] border-l border-[#e2d5c2] flex flex-col items-center justify-center overflow-y-auto'
                  }>
                    {/* Spine shadow on desktop */}
                    {!isMobile && (
                      <div
                        className="absolute inset-y-0 left-0 w-6 pointer-events-none z-10"
                        style={{ background: 'linear-gradient(90deg, rgba(60,35,15,0.15) 0%, rgba(60,35,15,0.05) 40%, transparent 100%)' }}
                      />
                    )}
                    <div className={isMobile ? '' : 'w-full px-8 lg:px-12'}>
                      <p
                        className="text-[#3d2a17] text-sm sm:text-base lg:text-lg leading-relaxed sm:leading-loose whitespace-pre-wrap font-medium text-center"
                        style={{
                          fontFamily: storyFontFamily ? `'${storyFontFamily}', sans-serif` : undefined,
                          fontSize: storyFontSize ? `${storyFontSize}px` : undefined,
                        }}
                      >
                        {(currentPages[currentPage] || pages[currentPage] || '').trim()}
                      </p>
                    </div>
                    {/* Page number on text page (desktop) */}
                    {!isMobile && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-[#c4ae92]">
                        — {currentPage + 1} —
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Tap zones for navigation */}
              <button
                type="button"
                aria-label="이전 페이지"
                onClick={goPrev}
                disabled={currentPage === 0}
                className="coarse-pointer-visible absolute inset-y-0 left-0 z-30 w-[12%] cursor-w-resize opacity-0 transition hover:opacity-100 disabled:cursor-default disabled:opacity-0"
              >
                <div className="flex h-full items-center justify-start pl-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
                    <ChevronLeft />
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label="다음 페이지"
                onClick={goNext}
                disabled={currentPage === pages.length - 1}
                className="coarse-pointer-visible absolute inset-y-0 right-0 z-30 w-[12%] cursor-e-resize opacity-0 transition hover:opacity-100 disabled:cursor-default disabled:opacity-0"
              >
                <div className="flex h-full items-center justify-end pr-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm">
                    <ChevronRight />
                  </div>
                </div>
              </button>

              {/* Social buttons - floating at bottom of image side */}
              <div className={`absolute z-40 flex items-center gap-2 ${isMobile ? 'bottom-3 right-3' : 'bottom-3 left-3'}`}>
                {onLike && (
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); onLike(); }}
                    whileTap={{ scale: 1.3 }}
	                    className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium shadow-md backdrop-blur-sm transition-colors ${
                      isLiked
                        ? 'bg-red-500/90 text-white'
                        : 'bg-white/85 text-gray-700 hover:bg-white'
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill={isLiked ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    {likeCount != null && <span>{likeCount}</span>}
                  </motion.button>
                )}
                <motion.button
                  onClick={(e) => { e.stopPropagation(); setCommentsPanelOpen((v) => !v); }}
                  whileTap={{ scale: 1.1 }}
	                  className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium shadow-md backdrop-blur-sm transition-colors ${
                    commentsPanelOpen
                      ? 'bg-[#8c5d35] text-white'
                      : 'bg-white/85 text-gray-700 hover:bg-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>{displayedCommentCount}</span>
                </motion.button>
              </div>
            </div>

            {/* ── Controls Bar ── */}
            <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 sm:py-3 mt-1">
              <button
                type="button"
                onClick={goPrev}
                disabled={currentPage === 0}
                className="flex min-h-11 items-center gap-1 rounded-full border border-[#d8c5a8] bg-[#fffaf1] px-4 py-2 text-sm font-semibold text-[#7d6243] transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-30 disabled:hover:translate-y-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">이전</span>
              </button>

              {/* Dot indicators */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {pages.length <= 10 ? (
                  pages.map((_, idx) => (
                    <button
                      type="button"
                      key={idx}
                      aria-label={`${idx + 1}쪽`}
                      onClick={() => goToPage(idx)}
	                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#f7ead7]"
	                    >
	                      <span
	                        className={`block h-2 rounded-full transition-all ${
	                          idx === currentPage
	                            ? 'w-6 bg-[#8c5d35]'
	                            : 'w-2 bg-[#d9c7ae]'
	                        }`}
	                      />
	                    </button>
                  ))
                ) : (
                  <>
                    {Array.from({ length: Math.min(4, pages.length) }, (_, i) => i).map((idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => goToPage(idx)}
	                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#f7ead7]"
	                      >
	                        <span
	                          className={`block h-2 rounded-full transition-all ${
	                            idx === currentPage ? 'w-6 bg-[#8c5d35]' : 'w-2 bg-[#d9c7ae]'
	                          }`}
	                        />
	                      </button>
                    ))}
                    <span className="text-[10px] text-[#b8a48c] px-0.5">···</span>
                    {Array.from({ length: Math.min(3, pages.length) }, (_, i) => pages.length - 3 + i)
                      .filter((idx) => idx >= 4)
                      .map((idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => goToPage(idx)}
	                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#f7ead7]"
	                        >
	                          <span
	                            className={`block h-2 rounded-full transition-all ${
	                              idx === currentPage ? 'w-6 bg-[#8c5d35]' : 'w-2 bg-[#d9c7ae]'
	                            }`}
	                          />
	                        </button>
                      ))}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={goNext}
                disabled={currentPage === pages.length - 1}
                className="flex min-h-11 items-center gap-1 rounded-full border border-[#d8c5a8] bg-[#fffaf1] px-4 py-2 text-sm font-semibold text-[#7d6243] transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-30 disabled:hover:translate-y-0"
              >
                <span className="hidden sm:inline">다음</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Comments Panel ── */}
          <AnimatePresence>
            {commentsPanelOpen && (
              <motion.div
                initial={useBottomCommentsPanel ? { y: '100%' } : { x: '100%', opacity: 0 }}
                animate={useBottomCommentsPanel ? { y: 0 } : { x: 0, opacity: 1 }}
                exit={useBottomCommentsPanel ? { y: '100%' } : { x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                onClick={(e) => e.stopPropagation()}
                className={
                  useBottomCommentsPanel
                    ? 'fixed inset-x-0 bottom-0 z-[60] max-h-[70vh] rounded-t-2xl bg-[#fffaf1] border-t border-[#d9c7ae] shadow-[0_-10px_40px_rgba(94,63,34,0.2)] flex flex-col'
                    : 'fixed top-1/2 -translate-y-1/2 right-4 z-[60] w-[340px] max-h-[80vh] rounded-2xl bg-[#fffaf1] border border-[#d9c7ae] shadow-[0_20px_60px_rgba(94,63,34,0.25)] flex flex-col'
                }
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2d5c2]">
                  <h3 className="font-bold text-sm text-[#5d3b22] flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#8c5d35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    감상 ({comments.length})
                  </h3>
                  <button
                    onClick={() => setCommentsPanelOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e2d5c2] text-[#7d6243] transition-colors hover:bg-[#d9c7ae]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Comment list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <span className="text-3xl mb-2 opacity-30">💬</span>
                      <p className="text-sm text-[#b8a48c]">아직 감상이 없어요.</p>
                      <p className="text-xs text-[#c4ae92] mt-1">첫 번째 감상을 남겨보세요!</p>
                    </div>
                  ) : (
                    comments.map((comment, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white/70 rounded-xl p-3 border border-[#e8dcc8]"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-[#e2d5c2] flex items-center justify-center text-[10px] text-[#7d6243] font-bold">
                            {comment.author.charAt(0)}
                          </div>
                          <span className="text-xs font-semibold text-[#5d3b22]">
                            {comment.author}
                          </span>
                          <span className="text-[10px] text-[#b8a48c]">
                            {comment.date}
                          </span>
                        </div>
                        <p className="text-sm text-[#5d3b22] pl-7">{comment.text}</p>
                      </motion.div>
                    ))
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Comment input */}
                {canComment ? (
                  <div className="border-t border-[#e2d5c2] p-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => onCommentChange?.(e.target.value)}
                        placeholder="감상을 남겨보세요..."
                        className="min-h-11 flex-1 rounded-xl border border-[#d9c7ae] bg-white px-3 py-2 text-sm text-[#5d3b22] placeholder-[#c4ae92] focus:outline-none focus:ring-2 focus:ring-[#8c5d35]/30 focus:border-[#8c5d35]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSubmitComment?.();
                          }
                        }}
                      />
                      <button
                        onClick={onSubmitComment}
                        disabled={!commentText?.trim() || submittingComment}
                        className="min-h-11 rounded-xl bg-[#8c5d35] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7a5130] disabled:opacity-40"
                      >
                        {submittingComment ? '...' : '등록'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-[#e2d5c2] p-3">
                    <p className="text-xs text-[#b8a48c] text-center">
                      {commentLockMessage}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
