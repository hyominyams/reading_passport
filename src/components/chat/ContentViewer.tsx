'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ContentType } from '@/types/database';

interface ContentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  type: ContentType;
  title: string;
  url: string;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
  );
  return match?.[1] ?? null;
}

export default function ContentViewer({
  isOpen,
  onClose,
  type,
  title,
  url,
}: ContentViewerProps) {
  const videoId = type === 'video' ? extractYouTubeId(url) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-bold text-foreground truncate pr-4">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-muted-light hover:bg-border flex items-center justify-center text-muted hover:text-foreground transition-colors text-lg"
                aria-label="닫기"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {type === 'video' && videoId && (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              )}

              {type === 'pdf' && (
                <iframe
                  src={url}
                  title={title}
                  className="w-full h-[70vh]"
                />
              )}

              {type === 'image' && (
                <div className="flex items-center justify-center p-4 bg-muted-light min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
              )}

              {type === 'link' && (
                <div className="flex flex-col items-center justify-center py-16 px-4 gap-4">
                  <span className="text-5xl">🔗</span>
                  <p className="text-sm text-muted text-center">
                    외부 링크는 새 탭에서 열립니다
                  </p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    링크 열기 &rarr;
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
