'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ActivityCard from '@/components/book/ActivityCard';
import type { Book, Activity, StampType } from '@/types/database';

interface ActivityPageClientProps {
  book: Book;
  language: string;
  initialActivity: Activity | null;
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
  initialActivity,
}: ActivityPageClientProps) {
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const stampsEarned: StampType[] = (initialActivity?.stamps_earned as StampType[]) ?? [];

  const mainCards: CardConfig[] = [
    {
      icon: '📖',
      title: 'Story Read',
      stampLabel: 'Step 1',
      stampType: 'read',
      route: `/book/${book.id}/read?lang=${language}`,
    },
    {
      icon: '🌍',
      title: 'Hidden Stories',
      stampLabel: 'Step 2',
      stampType: 'hidden',
      route: `/book/${book.id}/explore?lang=${language}`,
    },
    {
      icon: '❓',
      title: '질문 만들기',
      stampLabel: 'Step 3',
      stampType: 'questions',
      route: `/book/${book.id}/questions?lang=${language}`,
    },
  ];

  const myStoryCard: CardConfig = {
    icon: '✏️',
    title: 'My World',
    stampLabel: 'Step 4',
    stampType: 'mystory',
    route: `/book/${book.id}/mystory?lang=${language}`,
  };

  const allThreeCompleted =
    stampsEarned.includes('read') &&
    stampsEarned.includes('hidden') &&
    stampsEarned.includes('questions');
  const worldSmartUnlocked = stampsEarned.includes('questions');

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
        {mainCards.map((card, index) => (
          <ActivityCard
            key={card.stampType}
            icon={card.icon}
            title={card.title}
            stampLabel={card.stampLabel}
            stampType={card.stampType}
            isCompleted={stampsEarned.includes(card.stampType)}
            isHovered={hoveredIndex === index}
            onClick={() => router.push(card.route)}
            onHoverStart={() => setHoveredIndex(index)}
            onHoverEnd={() => setHoveredIndex(null)}
            index={index}
          />
        ))}
      </div>

      <section className="w-full max-w-3xl rounded-[28px] border border-border bg-[#fbf7ef] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.18em] text-[#7f6246]">WORLD SMART</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">질문게시판</h2>
            <p className="mt-1 text-sm text-[#6d5e4c]">
              Step 3 질문은 완료와 동시에 게시판에 올라가고, 여기서 다시 확인할 수 있어요.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (worldSmartUnlocked) {
                router.push(`/book/${book.id}/world-smart?lang=${language}`);
              }
            }}
            disabled={!worldSmartUnlocked}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
              worldSmartUnlocked
                ? 'bg-foreground text-white hover:bg-foreground/90'
                : 'border border-border bg-white text-muted'
            }`}
          >
            {worldSmartUnlocked ? 'World Smart 열기' : 'Step 3 완료 후 열려요'}
          </button>
        </div>
      </section>

      {/* 4th card: My World — always visible, locked until 1-3 completed */}
      <div className="w-full max-w-xs">
        <ActivityCard
          icon={myStoryCard.icon}
          title={myStoryCard.title}
          stampLabel={myStoryCard.stampLabel}
          stampType={myStoryCard.stampType}
          isCompleted={stampsEarned.includes('mystory')}
          isLocked={!allThreeCompleted}
          isHovered={hoveredIndex === 3}
          onClick={() => router.push(myStoryCard.route)}
          onHoverStart={() => setHoveredIndex(3)}
          onHoverEnd={() => setHoveredIndex(null)}
          index={3}
        />
      </div>
    </div>
  );
}
