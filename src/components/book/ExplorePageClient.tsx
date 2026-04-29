'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ContentCard from '@/components/chat/ContentCard';
import ContentViewer from '@/components/chat/ContentViewer';
import ExplorationProgress from '@/components/chat/ExplorationProgress';
import BackToActivity from '@/components/book/BackToActivity';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type {
  HiddenContent,
  Activity,
  Book,
  ContentType,
  ExploreChallengeNote,
} from '@/types/database';

const MIN_DWELL_SECONDS: Record<string, number> = {
  image: 10,
  link: 0,
  pdf: 60,
  video: 0,
};
const SAVE_TIMEOUT_MS = 15000;

type SupabaseErrorLike = { message: string };
type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseErrorLike | null;
};

function getRequiredSeconds(type: string): number {
  return MIN_DWELL_SECONDS[type] ?? 30;
}

function getUnreadBadge(type: string): string {
  if (type === 'image') return '10초';
  if (type === 'video') return '80%';
  if (type === 'link') return '열기';
  return '1분';
}

function buildChallengeNotes(
  notes: ExploreChallengeNote[] | null | undefined,
  contents: HiddenContent[],
) {
  const orderMap = new Map(contents.map((content, index) => [content.id, index]));

  return [...(notes ?? [])].sort((left, right) => {
    const leftOrder = orderMap.get(left.content_id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderMap.get(right.content_id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = SAVE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('timeout'));
    }, timeoutMs);

    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
  });
}

interface ExplorePageClientProps {
  book: Book;
  language: string;
  initialContents: HiddenContent[];
  initialCompleted: boolean;
  initialActivity: Activity | null;
}

export default function ExplorePageClient({
  book,
  language,
  initialContents,
  initialCompleted,
  initialActivity,
}: ExplorePageClientProps) {
  const { user } = useAuth();
  const [contents] = useState<HiddenContent[]>(initialContents);
  const supabase = useMemo(() => createClient(), []);
  const activityIdRef = useRef<string | null>(initialActivity?.id ?? null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeContentIdRef = useRef<string | null>(null);

  const initialChallengeNotes = useMemo(
    () => buildChallengeNotes(initialActivity?.explore_challenges, initialContents),
    [initialActivity?.explore_challenges, initialContents]
  );

  const [challengeNotes, setChallengeNotes] = useState<ExploreChallengeNote[]>(initialChallengeNotes);
  const challengeNoteMap = useMemo(
    () => new Map(challengeNotes.map((note) => [note.content_id, note])),
    [challengeNotes]
  );

  const [viewedIds, setViewedIds] = useState<Set<string>>(() => {
    const baseIds = initialCompleted
      ? initialContents.map((content) => content.id)
      : initialChallengeNotes.map((note) => note.content_id);

    return new Set(baseIds);
  });
  const [storedViewsLoaded, setStoredViewsLoaded] = useState(false);

  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});
  const [isCompleting, setIsCompleting] = useState(false);
  const [explorationCompleted, setExplorationCompleted] = useState(initialCompleted);
  const [showStampAnimation, setShowStampAnimation] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeContent, setActiveContent] = useState<HiddenContent | null>(null);
  const [currentDwell, setCurrentDwell] = useState(0);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeContent, setChallengeContent] = useState<HiddenContent | null>(null);
  const [challengeSummary, setChallengeSummary] = useState('');
  const [challengeCuriosity, setChallengeCuriosity] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [savingChallenge, setSavingChallenge] = useState(false);

  useEffect(() => {
    const storageKey = `explore-viewed-${book.id}`;
    const contentIds = new Set(contents.map((content) => content.id));

    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          setViewedIds((prev) => {
            const next = new Set(prev);
            for (const id of parsed) {
              if (typeof id === 'string' && contentIds.has(id)) {
                next.add(id);
              }
            }
            return next;
          });
        }
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    } finally {
      setStoredViewsLoaded(true);
    }
  }, [book.id, contents]);

  useEffect(() => {
    if (!storedViewsLoaded) return;

    if (viewedIds.size > 0) {
      sessionStorage.setItem(
        `explore-viewed-${book.id}`,
        JSON.stringify([...viewedIds])
      );
    } else {
      sessionStorage.removeItem(`explore-viewed-${book.id}`);
    }
  }, [viewedIds, book.id, storedViewsLoaded]);

  const startTimer = useCallback((contentId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    activeContentIdRef.current = contentId;

    const startElapsed = activeTimers[contentId] ?? 0;
    setCurrentDwell(startElapsed);

    timerRef.current = setInterval(() => {
      setCurrentDwell((prev) => prev + 1);
    }, 1000);
  }, [activeTimers]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const contentId = activeContentIdRef.current;
    if (contentId) {
      setActiveTimers((prev) => ({
        ...prev,
        [contentId]: currentDwell,
      }));

      const content = contents.find((item) => item.id === contentId);
      if (content) {
        const required = getRequiredSeconds(content.type);
        if (currentDwell >= required) {
          setViewedIds((prev) => new Set(prev).add(contentId));
        }
      }
    }

    activeContentIdRef.current = null;
    setCurrentDwell(0);
  }, [currentDwell, contents]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const markContentViewed = useCallback((contentId: string) => {
    setViewedIds((prev) => {
      if (prev.has(contentId)) return prev;
      return new Set(prev).add(contentId);
    });
  }, []);

  const ensureActivityId = useCallback(async () => {
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    if (activityIdRef.current) {
      return activityIdRef.current;
    }

    const { data: existing, error: selectError } = await withTimeout<SupabaseResult<{ id: string }>>(
      supabase
        .from('activities')
        .select('id')
        .eq('student_id', user.id)
        .eq('book_id', book.id)
        .maybeSingle()
    );

    if (selectError) {
      throw new Error(selectError.message);
    }

    if (existing?.id) {
      activityIdRef.current = existing.id;
      return existing.id;
    }

    const { data: inserted, error } = await withTimeout<SupabaseResult<{ id: string }>>(
      supabase
        .from('activities')
        .insert({
          student_id: user.id,
          book_id: book.id,
          country_id: book.country_id,
          language,
          explore_challenges: challengeNotes,
        })
        .select('id')
        .single()
    );

    if (error || !inserted?.id) {
      throw new Error(error?.message ?? '활동을 저장하지 못했습니다.');
    }

    activityIdRef.current = inserted.id;
    return inserted.id;
  }, [book.country_id, book.id, challengeNotes, language, supabase, user]);

  const handleContentClick = (content: HiddenContent) => {
    if (content.type === 'link') {
      window.open(content.url, '_blank', 'noopener,noreferrer');
      markContentViewed(content.id);
      setActiveContent(content);
      setViewerOpen(true);
      return;
    }

    setActiveContent(content);
    setViewerOpen(true);
    startTimer(content.id);
  };

  const handleCloseViewer = () => {
    stopTimer();
    setViewerOpen(false);
    setActiveContent(null);
  };

  const handleOpenChallenge = (content: HiddenContent) => {
    if (activeContentIdRef.current === content.id) {
      stopTimer();
    }

    const note = challengeNoteMap.get(content.id);
    setChallengeContent(content);
    setChallengeSummary(note?.summary ?? '');
    setChallengeCuriosity(note?.curiosity ?? '');
    setChallengeError(null);
    setChallengeOpen(true);
  };

  const handleCloseChallenge = () => {
    setChallengeOpen(false);
    setChallengeContent(null);
    setChallengeSummary('');
    setChallengeCuriosity('');
    setChallengeError(null);
  };

  const handleSaveChallenge = async () => {
    if (!user || !challengeContent || savingChallenge) return;

    const summary = challengeSummary.trim();
    const curiosity = challengeCuriosity.trim();

    if (!summary || !curiosity) {
      setChallengeError('자료 정리와 궁금증을 모두 남겨 주세요.');
      return;
    }

    setSavingChallenge(true);
    setChallengeError(null);

    try {
      const nextNote: ExploreChallengeNote = {
        content_id: challengeContent.id,
        content_title: challengeContent.title,
        summary,
        curiosity,
        completed_at: new Date().toISOString(),
      };
      const nextNotes = buildChallengeNotes(
        [
          ...challengeNotes.filter((note) => note.content_id !== challengeContent.id),
          nextNote,
        ],
        contents,
      );
      const activityId = await ensureActivityId();

      const { error } = await withTimeout<SupabaseResult<null>>(
        supabase
          .from('activities')
          .update({ explore_challenges: nextNotes })
          .eq('id', activityId)
      );

      if (error) {
        throw error;
      }

      setChallengeNotes(nextNotes);
      setViewedIds((prev) => new Set(prev).add(challengeContent.id));
      handleCloseChallenge();
    } catch (error) {
      console.error('Error saving challenge:', error);
      setChallengeError(
        error instanceof Error && error.message === 'timeout'
          ? '저장 시간이 길어지고 있어요. 다시 시도해 주세요.'
          : '챌린지를 저장하지 못했습니다.'
      );
    } finally {
      setSavingChallenge(false);
    }
  };

  const handleComplete = async () => {
    if (!user || isCompleting) return;
    setIsCompleting(true);

    try {
      const activityId = await ensureActivityId();
      const { data: existing, error: selectError } = await withTimeout<
        SupabaseResult<Pick<Activity, 'completed_tabs' | 'stamps_earned'>>
      >(
        supabase
          .from('activities')
          .select('completed_tabs, stamps_earned')
          .eq('id', activityId)
          .single()
      );

      if (selectError) {
        throw selectError;
      }

      if (!existing) {
        throw new Error('활동 정보를 찾지 못했습니다.');
      }

      const activity = existing as Pick<Activity, 'completed_tabs' | 'stamps_earned'>;
      const completedTabs = activity.completed_tabs.includes('hidden')
        ? activity.completed_tabs
        : [...activity.completed_tabs, 'hidden'];
      const stampsEarned = activity.stamps_earned.includes('hidden')
        ? activity.stamps_earned
        : [...activity.stamps_earned, 'hidden'];

      const { error: updateError } = await withTimeout<SupabaseResult<null>>(
        supabase
          .from('activities')
          .update({
            completed_tabs: completedTabs,
            stamps_earned: stampsEarned,
            explore_challenges: challengeNotes,
          })
          .eq('id', activityId)
      );

      if (updateError) {
        throw updateError;
      }

      setExplorationCompleted(true);
      setShowStampAnimation(true);
      setViewedIds(new Set(contents.map((content) => content.id)));
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
  const challengeCount = challengeNotes.length;
  const canComplete =
    totalCount > 0 &&
    viewedCount >= totalCount &&
    challengeCount >= totalCount &&
    !explorationCompleted;

  const activeRequired = activeContent ? getRequiredSeconds(activeContent.type) : 0;
  const activeIsComplete = activeContent ? viewedIds.has(activeContent.id) : false;
  const activeProgress = activeRequired > 0 ? Math.min(currentDwell / activeRequired, 1) : 0;

  return (
    <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <span>🔍</span> 숨겨진 이야기
          </h1>
          <p className="mt-1 text-sm text-muted">
            자료를 읽고 핵심과 궁금증을 모아 보세요
          </p>
        </div>
        <div className="shrink-0 pt-1">
          <BackToActivity bookId={book.id} language={language} />
        </div>
      </div>

      {totalCount > 0 && (
        <div className="mb-6">
          <ExplorationProgress
            viewed={viewedCount}
            total={totalCount}
            challenged={challengeCount}
            canComplete={canComplete}
            completed={explorationCompleted}
            onComplete={handleComplete}
            isCompleting={isCompleting}
          />
        </div>
      )}

      {totalCount === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="text-center">
            <span className="mb-4 block text-4xl">📭</span>
            <p className="text-sm text-muted">
              아직 등록된 콘텐츠가 없어요
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contents.map((content, index) => {
            const required = getRequiredSeconds(content.type);
            const elapsed = activeTimers[content.id] ?? 0;
            const isViewed = viewedIds.has(content.id);
            const challengeDone = challengeNoteMap.has(content.id);

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

                  {isViewed && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenChallenge(content);
                      }}
                      className={`absolute left-2 top-2 inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-xs font-black tracking-[0.12em] transition-colors ${
                        challengeDone
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-[#d0b189] bg-[#fbf2e1] text-[#8a5d2f]'
                      }`}
                    >
                      {challengeDone ? '기록 완료' : 'CHALLENGE'}
                    </button>
                  )}

                  {!isViewed && (
                    <div className="absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      {getUnreadBadge(content.type)}
                    </div>
                  )}

                  {!isViewed && elapsed > 0 && required > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl bg-gray-200">
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

      {activeContent && (
        <>
          <ContentViewer
            isOpen={viewerOpen}
            onClose={handleCloseViewer}
            type={activeContent.type as ContentType}
            title={activeContent.title}
            url={activeContent.url}
            onOpenExternal={() => markContentViewed(activeContent.id)}
          />

          {viewerOpen && !activeIsComplete && (
            <div className="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                <motion.div
                  className="h-full rounded-full bg-indigo-500"
                  animate={{ width: `${activeProgress * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="whitespace-nowrap text-xs text-gray-600">
                {currentDwell}초 / {activeRequired}초
              </span>
              {currentDwell >= activeRequired && (
                <span className="text-xs font-medium text-green-600">완료</span>
              )}
            </div>
          )}

          {viewerOpen && activeIsComplete && (
            <div className="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-3xl border border-[#dcc8ad] bg-[#fffaf1] px-4 py-3 shadow-lg">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[#8a5d2f]">CHALLENGE</p>
                <p className="mt-1 text-xs text-[#6d573d]">
                  자료 한 줄 정리와 궁금증을 남깁니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenChallenge(activeContent)}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#8a5d2f] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#734a22]"
              >
                {challengeNoteMap.has(activeContent.id) ? '다시 기록하기' : '기록 열기'}
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {challengeOpen && challengeContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4"
            onClick={handleCloseChallenge}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[28px] border border-[#dcc8ad] bg-[#fffaf1] p-5 shadow-[0_30px_90px_rgba(67,43,17,0.22)] sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#8a5d2f]">CHALLENGE</p>
                  <h2 className="mt-2 text-xl font-bold text-foreground">
                    {challengeContent.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#6d573d]">
                    자료를 읽고 남길 핵심과 궁금증
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseChallenge}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dfcfb7] bg-white text-lg text-[#7a6247] transition-colors hover:text-foreground"
                  aria-label="닫기"
                >
                  &times;
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    자료 한 줄 정리
                  </label>
                  <textarea
                    value={challengeSummary}
                    onChange={(event) => setChallengeSummary(event.target.value)}
                    rows={4}
                    maxLength={220}
                    placeholder="자료에서 가장 중요하게 남길 내용을 적습니다"
                    className="w-full resize-none rounded-2xl border border-[#dcc8ad] bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-[#b78559] focus:outline-none focus:ring-2 focus:ring-[#b78559]/20"
                  />
                  <p className="mt-1 text-right text-xs text-muted">
                    {challengeSummary.length}/220
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    새로 생긴 궁금증
                  </label>
                  <textarea
                    value={challengeCuriosity}
                    onChange={(event) => setChallengeCuriosity(event.target.value)}
                    rows={3}
                    maxLength={220}
                    placeholder="더 알고 싶은 점이나 이어서 묻고 싶은 질문을 적습니다"
                    className="w-full resize-none rounded-2xl border border-[#dcc8ad] bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-[#b78559] focus:outline-none focus:ring-2 focus:ring-[#b78559]/20"
                  />
                  <p className="mt-1 text-right text-xs text-muted">
                    {challengeCuriosity.length}/220
                  </p>
                </div>

                {challengeError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {challengeError}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseChallenge}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d8c6ac] bg-white px-4 py-2 text-sm font-medium text-[#6d573d] transition-colors hover:border-[#b78559] hover:text-foreground"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveChallenge()}
                    disabled={savingChallenge}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#8a5d2f] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#734a22] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingChallenge ? '저장 중...' : '기록 저장'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStampAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 250, damping: 18 }}
              className="flex flex-col items-center gap-5"
            >
              <motion.div
                initial={{ rotate: -25 }}
                animate={{ rotate: -14 }}
                transition={{ type: 'spring', stiffness: 250, damping: 18 }}
                className="relative flex h-32 w-32 origin-center items-center justify-center rounded-full border-[4px] border-red-700/80 bg-white/95 shadow-xl"
              >
                <div className="absolute inset-[5px] rounded-full border-[2px] border-red-700/50" />
                <div className="z-10 flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-red-700/80">WORLD STORY</span>
                  <span className="mt-1 text-2xl font-black uppercase leading-tight tracking-[0.1em] text-red-700">SUCCESS</span>
                  <span className="mt-0.5 text-[8px] font-semibold uppercase leading-none tracking-[0.25em] text-red-700/70">APPROVED</span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <p className="mb-1 text-2xl font-bold text-white">스탬프 획득!</p>
                <p className="text-base font-medium text-red-300">탐험</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
