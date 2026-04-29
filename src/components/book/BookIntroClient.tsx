'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import StampBadge from '@/components/common/StampBadge';
import BookCoverImage from '@/components/book/BookCoverImage';
import { countries } from '@/lib/data/countries';
import type { Book, Activity, StampType } from '@/types/database';

interface BookIntroClientProps {
  book: Book;
  language: string;
  initialActivity: Activity | null;
}

const stampTypes: StampType[] = ['read', 'hidden', 'questions', 'mystory'];

export default function BookIntroClient({ book, language, initialActivity }: BookIntroClientProps) {
  const router = useRouter();
  const country = countries.find((c) => c.id === book.country_id);
  const stampsEarned = initialActivity?.stamps_earned ?? [];
  const stampCount = stampsEarned.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto grid w-full max-w-3xl grid-cols-1 items-center gap-8 md:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] md:gap-10"
    >
      {/* Cover image */}
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded-2xl bg-muted-light shadow-xl md:mx-0 md:max-w-[260px]">
        <BookCoverImage
          key={book.cover_url}
          title={book.title}
          coverUrl={book.cover_url}
          sizes="(max-width: 640px) 100vw, 320px"
          fallbackClassName="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20"
          iconClassName="h-12 w-12 text-primary/40"
        />
      </div>

      {/* Right column — stacked */}
      <div className="flex flex-col items-center gap-6 md:items-start">
        {/* Book info */}
        <div className="w-full text-center md:text-left">
          <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">
            {book.title}
          </h1>
          {country && (
            <p className="text-base text-muted">
              {country.flag} {country.name} &middot; {country.description}
            </p>
          )}
        </div>

        {/* Stamp progress */}
        <div className="w-full">
          <div className="mb-3 flex items-center justify-center gap-2 md:justify-start">
            <span className="text-sm font-medium text-foreground">
              도장 현황
            </span>
            <span className="text-sm text-muted">
              ({stampCount}/4)
            </span>
          </div>
          <div className="flex justify-center gap-6 md:justify-start">
            {stampTypes.map((type) => (
              <StampBadge
                key={type}
                type={type}
                earned={stampsEarned.includes(type)}
                size="lg"
              />
            ))}
          </div>
        </div>

        {/* Start button */}
        <motion.button
          onClick={() => router.push(`/book/${book.id}/activity?lang=${language}`)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="w-full max-w-xs rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-lg transition-colors hover:bg-primary-dark sm:text-lg"
        >
          탐험 시작하기
        </motion.button>
      </div>
    </motion.div>
  );
}
