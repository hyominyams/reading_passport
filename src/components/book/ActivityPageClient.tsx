'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ActivityCard from '@/components/book/ActivityCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Book, Activity, StampType } from '@/types/database';

interface ActivityPageClientProps {
  book: Book;
  language: string;
}

interface CardConfig {
  icon: string;
  title: string;
  stampLabel: string;
  stampType: StampType;
  route: string;
}

export default function ActivityPageClient({
  book,
  language,
}: ActivityPageClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  const stampsEarned: StampType[] = (activity?.stamps_earned as StampType[]) ?? [];

  // Extract character name from character_analysis if available
  const charAnalysis = book.character_analysis as Record<string, unknown> | null;
  const characterName =
    (charAnalysis?.name as string) ??
    (charAnalysis?.character_name as string) ??
    '등장인물';

  const cards: CardConfig[] = [
    {
      icon: '📖',
      title: 'Story Read',
      stampLabel: '도장 1',
      stampType: 'read',
      route: `/book/${book.id}/read?lang=${language}`,
    },
    {
      icon: '🌍',
      title: 'Hidden Stories',
      stampLabel: '도장 2',
      stampType: 'hidden',
      route: `/book/${book.id}/explore?lang=${language}`,
    },
    {
      icon: '💬',
      title: `Talk with ${characterName}`,
      stampLabel: '도장 3',
      stampType: 'character',
      route: `/book/${book.id}/chat?lang=${language}`,
    },
  ];

  const allThreeCompleted =
    stampsEarned.includes('read') &&
    stampsEarned.includes('hidden') &&
    stampsEarned.includes('character');

  if (authLoading || loadingActivity) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" message="활동 정보를 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Page title */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {book.title}
        </h1>
        <p className="text-muted">활동을 선택하세요</p>
      </div>

      {/* 3 Activity cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-3xl">
        {cards.map((card, index) => (
          <ActivityCard
            key={card.stampType}
            icon={card.icon}
            title={card.title}
            stampLabel={card.stampLabel}
            stampType={card.stampType}
            isCompleted={stampsEarned.includes(card.stampType)}
            isHovered={hoveredIndex === index}
            anyHovered={hoveredIndex !== null}
            onClick={() => router.push(card.route)}
            onHoverStart={() => setHoveredIndex(index)}
            onHoverEnd={() => setHoveredIndex(null)}
            index={index}
          />
        ))}
      </div>

      {/* My Story button - appears only when all 3 stamps earned */}
      <AnimatePresence>
        {allThreeCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-full max-w-md"
          >
            <motion.button
              onClick={() =>
                router.push(`/book/${book.id}/mystory?lang=${language}`)
              }
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(245,158,11,0.3)',
                  '0 0 0 12px rgba(245,158,11,0)',
                ],
              }}
              transition={{
                boxShadow: { duration: 1.5, repeat: Infinity },
              }}
              className="w-full py-5 rounded-2xl font-bold text-white
                         bg-gradient-to-r from-secondary to-stamp-gold
                         shadow-lg text-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">&#9997;&#65039;</span>
              <span>My Story (도장 4)</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
