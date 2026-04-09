'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { Book, StampType } from '@/types/database';
import type { MapBookProgress } from '@/lib/queries/books';
import { countries } from '@/lib/data/countries';
import BookCoverImage from '@/components/book/BookCoverImage';

interface ContinueBannerProps {
  booksByCountry: Record<string, Book[]>;
  bookProgressById: Record<string, MapBookProgress>;
}

const STAMP_ORDER: StampType[] = ['read', 'hidden', 'questions', 'mystory'];

const STAMP_ICONS: Record<StampType, string> = {
  read: '📖',
  hidden: '🔍',
  questions: '❓',
  mystory: '✍️',
};

const NEXT_ACTIVITY_LABEL: Record<StampType, string> = {
  read: 'Story Read',
  hidden: 'Hidden Stories',
  questions: 'Make Questions',
  mystory: 'My Story',
};

const NEXT_ACTIVITY_ROUTE: Record<StampType, string> = {
  read: 'read',
  hidden: 'explore',
  questions: 'questions',
  mystory: 'mystory',
};

function getNextStamp(stampsEarned: StampType[]): StampType | null {
  for (const stamp of STAMP_ORDER) {
    if (!stampsEarned.includes(stamp)) {
      return stamp;
    }
  }
  return null;
}

export default function ContinueBanner({
  booksByCountry,
  bookProgressById,
}: ContinueBannerProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Find the most recently active in-progress book
  const allBooks = Object.values(booksByCountry).flat();
  const inProgressEntries = Object.entries(bookProgressById)
    .filter(([, p]) => p.hasStarted && !p.isCompleted)
    .sort((a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime());

  const lastProgress = inProgressEntries[0]?.[1] ?? null;
  const lastBook = lastProgress
    ? allBooks.find((b) => b.id === lastProgress.bookId) ?? null
    : null;

  const country = lastBook
    ? countries.find((c) => c.id === lastBook.country_id) ?? null
    : null;

  const nextStamp = lastProgress ? getNextStamp(lastProgress.stampsEarned) : null;

  if (!lastBook || !lastProgress || !nextStamp) {
    return null;
  }

  const lang = lastProgress.language ?? 'ko';
  const targetUrl = `/book/${lastBook.id}/${NEXT_ACTIVITY_ROUTE[nextStamp]}?lang=${lang}`;

  const handleContinue = () => {
    router.push(targetUrl);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <AnimatePresence mode="wait">
        {collapsed ? (
          /* ── Collapsed: small pill button ── */
          <motion.button
            key="pill"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 bg-white border border-border shadow-lg rounded-full px-4 py-2.5 cursor-pointer hover:shadow-xl active:scale-95 transition-all"
          >
            <span className="text-base">{country?.flag}</span>
            <span className="text-xs font-medium text-foreground whitespace-nowrap">
              이어하기
            </span>
            <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </motion.button>
        ) : (
          /* ── Expanded: full banner ── */
          <motion.div
            key="banner"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.5 }}
            className="w-[calc(100vw-2rem)] max-w-lg"
          >
            <div className="relative bg-white rounded-2xl border border-border shadow-xl overflow-hidden">
              {/* Gold accent top bar */}
              <div className="h-1 bg-gradient-to-r from-stamp-gold via-secondary to-stamp-gold" />

              <div className="p-4 flex items-center gap-4">
                {/* Book cover thumbnail */}
                <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-border bg-muted-light">
                  <BookCoverImage
                    title={lastBook.title}
                    coverUrl={lastBook.cover_url}
                    sizes="56px"
                    imageClassName="object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted mb-0.5 flex items-center gap-1">
                    {country?.flag} {country?.name}
                    <span className="text-border mx-1">&middot;</span>
                    도장 {lastProgress.stampCount}/4
                  </p>
                  <p className="text-sm font-heading font-semibold text-foreground truncate">
                    {lastBook.title}
                  </p>

                  {/* Mini stamps row */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {STAMP_ORDER.map((stamp) => {
                      const earned = lastProgress.stampsEarned.includes(stamp);
                      return (
                        <span
                          key={stamp}
                          className={`text-sm ${earned ? '' : 'grayscale opacity-40'}`}
                          title={NEXT_ACTIVITY_LABEL[stamp]}
                        >
                          {STAMP_ICONS[stamp]}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* CTA button */}
                <button
                  onClick={handleContinue}
                  className="shrink-0 bg-primary hover:bg-primary-dark active:scale-95 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  이어하기 &rarr;
                </button>
              </div>

              {/* Bottom row: next activity hint + collapse toggle */}
              <div className="px-4 pb-3 -mt-1 flex items-center justify-between">
                <p className="text-[11px] text-muted">
                  다음 활동: <span className="font-medium text-foreground">{NEXT_ACTIVITY_LABEL[nextStamp]}</span>
                </p>
                <button
                  onClick={() => setCollapsed(true)}
                  className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground cursor-pointer transition-colors"
                >
                  숨기기
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
