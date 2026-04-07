/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  comments?: Comment[];
  canComment?: boolean;
  commentLockMessage?: string;
  onReadingComplete?: (totalPages: number) => void;
  commentText?: string;
  onCommentChange?: (text: string) => void;
  onSubmitComment?: () => void;
  submittingComment?: boolean;
}

export default function BookViewerModal({
  isOpen,
  onClose,
  pages,
  sceneImages,
  translatedPages,
  comments = [],
  canComment = false,
  commentLockMessage = '이 책을 끝까지 읽은 뒤 댓글을 남길 수 있어요.',
  onReadingComplete,
  commentText = '',
  onCommentChange,
  onSubmitComment,
  submittingComment = false,
}: BookViewerModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const hasReportedReadRef = useRef(false);
  const isLastPage = currentPage === pages.length - 1;

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

  useEffect(() => {
    if (!isOpen || !isLastPage || hasReportedReadRef.current) {
      return;
    }

    onReadingComplete?.(pages.length);
    hasReportedReadRef.current = true;
  }, [isLastPage, isOpen, onReadingComplete, pages.length]);

  useEffect(() => {
    if (!isOpen) {
      hasReportedReadRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-4">
              <span className="text-sm font-heading text-foreground">
                {currentPage + 1} / {pages.length}
              </span>
              {translatedPages && translatedPages.length > 0 && (
                <div className="flex bg-muted-light rounded-full p-0.5">
                  <button
                    onClick={() => setShowTranslation(false)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      !showTranslation
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted'
                    }`}
                  >
                    원문
                  </button>
                  <button
                    onClick={() => setShowTranslation(true)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      showTranslation
                        ? 'bg-card text-foreground shadow-sm'
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

            {/* Comments section - visible on last page */}
            {isLastPage && (
              <div className="px-6 pb-6">
                {/* Existing comments */}
                {comments.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-heading text-foreground mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      감상 ({comments.length})
                    </h4>
                    <div className="space-y-2">
                      {comments.map((comment, idx) => (
                        <div key={idx} className="bg-muted-light rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-foreground">
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

                {/* Comment input */}
                {canComment && isLastPage && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-heading text-muted mb-2">감상 남기기</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => onCommentChange?.(e.target.value)}
                        placeholder="이 이야기에 대한 감상을 남겨주세요..."
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-heading hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        {submittingComment ? '...' : '등록'}
                      </button>
                    </div>
                  </div>
                )}

                {!canComment && isLastPage && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-heading text-muted mb-2">감상 남기기</p>
                    <p className="text-sm text-muted">
                      {commentLockMessage}
                    </p>
                  </div>
                )}
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
                    currentPage === idx ? 'bg-secondary' : 'bg-border'
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
