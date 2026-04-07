'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import StampBadge from '@/components/common/StampBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BookCoverImage from '@/components/book/BookCoverImage';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { countries } from '@/lib/data/countries';
import type { Book, Activity, StampType } from '@/types/database';

interface BookIntroClientProps {
  book: Book;
  language: string;
}

const stampTypes: StampType[] = ['read', 'hidden', 'character', 'mystory'];

export default function BookIntroClient({ book, language }: BookIntroClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const country = countries.find((c) => c.id === book.country_id);

  useEffect(() => {
    async function fetchActivity() {
      if (!user) {
        setLoadingActivity(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', book.id)
        .single();

      if (data) {
        setActivity(data as Activity);
      }
      setLoadingActivity(false);
    }

    if (!authLoading) {
      fetchActivity();
    }
  }, [user, authLoading, book.id]);

  const stampsEarned = activity?.stamps_earned ?? [];
  const stampCount = stampsEarned.length;

  if (authLoading || loadingActivity) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" message="도서 정보를 불러오는 중..." />
      </div>
    );
  }

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
