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
      className="flex flex-col items-center gap-8"
    >
      {/* Cover image */}
      <div className="relative w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden shadow-xl bg-muted-light">
        <BookCoverImage
          key={book.cover_url}
          title={book.title}
          coverUrl={book.cover_url}
          sizes="(max-width: 640px) 100vw, 320px"
          fallbackClassName="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20"
          iconClassName="h-12 w-12 text-primary/40"
        />
      </div>

      {/* Book info */}
      <div className="text-center max-w-lg">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          {book.title}
        </h1>

        {country && (
          <p className="text-base text-muted mb-4">
            {country.flag} {country.name} &middot; {country.description}
          </p>
        )}
      </div>

      {/* Stamp progress */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-sm font-medium text-foreground">
            도장 현황
          </span>
          <span className="text-sm text-muted">
            ({stampCount}/4)
          </span>
        </div>
        <div className="flex justify-center gap-6">
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
        className="w-full max-w-sm py-4 rounded-xl font-bold text-white
                   bg-primary hover:bg-primary-dark shadow-lg
                   transition-colors text-lg"
      >
        탐험 시작하기
      </motion.button>
    </motion.div>
  );
}
