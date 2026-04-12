'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ContentCard from '@/components/chat/ContentCard';
import ContentViewer from '@/components/chat/ContentViewer';
import ExplorationProgress from '@/components/chat/ExplorationProgress';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { HiddenContent, Activity, Book, ContentType } from '@/types/database';

/** 콘텐츠 타입별 최소 체류 시간 (초) */
const MIN_DWELL_SECONDS: Record<string, number> = {
  image: 10,
  link: 60,
  pdf: 60,
  video: 0, // 영상은 별도 처리 (재생시간 80%)
};

function getRequiredSeconds(type: string): number {
  return MIN_DWELL_SECONDS[type] ?? 30;
}

interface ExplorePageClientProps {
  book: Book;
  initialContents: HiddenContent[];
  initialCompleted: boolean;
}

export default function ExplorePageClient({
  book,
  initialContents,
  initialCompleted,
}: ExplorePageClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [contents] = useState<HiddenContent[]>(initialContents);

  // viewedIds: 체류시간 조건을 충족한 콘텐츠
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`explore-viewed-${book.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // 현재 보고 있는 콘텐츠의 체류 시간 추적
  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeContentIdRef = useRef<string | null>(null);

  const [isCompleting, setIsCompleting] = useState(false);
  const [explorationCompleted, setExplorationCompleted] = useState(initialCompleted);
  const [showStampAnimation, setShowStampAnimation] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeContent, setActiveContent] = useState<HiddenContent | null>(null);
  const [currentDwell, setCurrentDwell] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  // Persist viewed IDs
  useEffect(() => {
    if (viewedIds.size > 0) {
      sessionStorage.setItem(
        `explore-viewed-${book.id}`,
        JSON.stringify([...viewedIds])
      );
    }
  }, [viewedIds, book.id]);

  // Timer: 현재 열린 콘텐츠의 체류 시간 카운트
  const startTimer = useCallback((contentId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    activeContentIdRef.current = contentId;

    const startElapsed = activeTimers[contentId] ?? 0;
    setCurrentDwell(startElapsed);

    timerRef.current = setInterval(() => {
      setCurrentDwell(prev => {
        const next = prev + 1;
        return next;
      });
    }, 1000);
  }, [activeTimers]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const contentId = activeContentIdRef.current;
    if (contentId) {
      setActiveTimers(prev => ({
        ...prev,
        [contentId]: currentDwell,
      }));

      // 체류 조건 충족 시 viewed 처리
      const content = contents.find(c => c.id === contentId);
      if (content) {
        const required = getRequiredSeconds(content.type);
        if (currentDwell >= required) {
          setViewedIds(prev => new Set(prev).add(contentId));
        }
      }
    }

    activeContentIdRef.current = null;
    setCurrentDwell(0);
  }, [currentDwell, contents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleContentClick = (content: HiddenContent) => {
    if (content.type === 'link') {
      // 링크: 새 탭 열기 + 타이머 시작
      window.open(content.url, '_blank', 'noopener,noreferrer');
      startTimer(content.id);

      // 링크는 뷰어를 열지 않으므로 별도 UI로 체류시간 표시
      setActiveContent(content);
      setViewerOpen(true);
    } else {
      // 이미지/PDF/영상: 뷰어 열기 + 타이머 시작
      setActiveContent(content);
      setViewerOpen(true);
      startTimer(content.id);
    }
  };

  const handleCloseViewer = () => {
    stopTimer();
    setViewerOpen(false);
    setActiveContent(null);
  };

  const handleComplete = async () => {
    if (!user || isCompleting) return;
    setIsCompleting(true);

    try {
      const { data: existing } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', book.id)
        .maybeSingle();

      if (existing) {
        const act = existing as Activity;
        const completedTabs = act.completed_tabs.includes('hidden')
          ? act.completed_tabs
          : [...act.completed_tabs, 'hidden'];
        const stampsEarned = (act.stamps_earned as string[]).includes('hidden')
          ? act.stamps_earned
          : [...(act.stamps_earned as string[]), 'hidden'];

        await supabase
          .from('activities')
          .update({ completed_tabs: completedTabs, stamps_earned: stampsEarned })
          .eq('id', act.id);
      } else {
        await supabase.from('activities').insert({
          student_id: user.id,
          book_id: book.id,
          country_id: book.country_id,
          language: 'ko',
          completed_tabs: ['hidden'],
          stamps_earned: ['hidden'],
        });
      }

      setExplorationCompleted(true);
      setShowStampAnimation(true);
      setTimeout(() => setShowStampAnimation(false), 3000);
      sessionStorage.removeItem(`explore-viewed-${book.id}`);
    } catch (err) {
      console.error('Error completing exploration:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  const viewedCount = viewedIds.size;
  const totalCount = contents.length;
  // 도장 2 조건: 전체 콘텐츠 모두 체크
  const canComplete = totalCount > 0 && viewedCount >= totalCount && !explorationCompleted;

  // 현재 보고 있는 콘텐츠의 필요 시간
  const activeRequired = activeContent ? getRequiredSeconds(activeContent.type) : 0;
  const activeIsComplete = activeContent ? viewedIds.has(activeContent.id) : false;
  const activeProgress = activeRequired > 0 ? Math.min(currentDwell / activeRequired, 1) : 0;

  return (
    <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>🔍</span> 숨겨진 이야기
          </h1>
          <p className="text-sm text-muted mt-1">
            이 책에 관련된 다양한 콘텐츠를 탐험해 보세요
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          돌아가기
        </button>
      </div>

      {totalCount > 0 && (
        <div className="mb-6">
          <ExplorationProgress
            viewed={viewedCount}
            total={totalCount}
            canComplete={canComplete}
            completed={explorationCompleted}
            onComplete={handleComplete}
            isCompleting={isCompleting}
          />
        </div>
      )}

      {totalCount === 0 ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <span className="text-4xl block mb-4">📭</span>
            <p className="text-muted text-sm">
              아직 등록된 콘텐츠가 없어요
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contents.map((content, index) => {
            const required = getRequiredSeconds(content.type);
            const elapsed = activeTimers[content.id] ?? 0;
            const isViewed = viewedIds.has(content.id);

            return (
              <motion.div
                key={content.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="relative">
                  <ContentCard
                    id={content.id}
                    type={content.type}
                    title={content.title}
                    url={content.url}
                    viewed={isViewed}
                    onClick={() => handleContentClick(content)}
                  />
                  {/* 체류 시간 힌트 */}
                  {!isViewed && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {content.type === 'image' ? '10초' : content.type === 'video' ? '80%' : '1분'}
                    </div>
                  )}
                  {/* 진행중 표시 (클릭했지만 아직 미완료) */}
                  {!isViewed && elapsed > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-xl overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all duration-1000"
                        style={{ width: `${Math.min((elapsed / required) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Content Viewer with dwell timer */}
      {activeContent && (
        <>
          <ContentViewer
            isOpen={viewerOpen}
            onClose={handleCloseViewer}
            type={activeContent.type as ContentType}
            title={activeContent.title}
            url={activeContent.url}
          />

          {/* Timer overlay */}
          {viewerOpen && !activeIsComplete && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-white/95 backdrop-blur shadow-lg rounded-full px-5 py-3 flex items-center gap-3">
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-500 rounded-full"
                  animate={{ width: `${activeProgress * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs text-gray-600 whitespace-nowrap">
                {currentDwell}초 / {activeRequired}초
              </span>
              {currentDwell >= activeRequired && (
                <span className="text-green-600 text-xs font-medium">완료!</span>
              )}
            </div>
          )}
        </>
      )}

      {/* Stamp animation — passport style */}
      <AnimatePresence>
        {showStampAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 4, opacity: 0, rotate: -25 }}
              animate={{ scale: 1, opacity: 1, rotate: -14 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 250, damping: 18 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="w-32 h-32 rounded-full border-[4px] border-red-700/80 bg-white/95 flex items-center justify-center relative shadow-xl">
                <div className="absolute inset-[5px] rounded-full border-[2px] border-red-700/50" />
                <div className="flex flex-col items-center z-10">
                  <span className="text-red-700/80 text-[9px] font-bold tracking-[0.18em] uppercase leading-none">★ WORLD DOCENT ★</span>
                  <span className="text-red-700 text-2xl font-black tracking-[0.1em] uppercase leading-tight mt-1">SUCCESS</span>
                  <span className="text-red-700/70 text-[8px] font-semibold tracking-[0.25em] uppercase leading-none mt-0.5">APPROVED</span>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center rotate-[14deg]"
              >
                <p className="text-2xl font-bold text-white mb-1">스탬프 획득!</p>
                <p className="text-base text-red-300 font-medium">탐험</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
