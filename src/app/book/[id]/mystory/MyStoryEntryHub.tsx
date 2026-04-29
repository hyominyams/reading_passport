'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  CirclePlus,
  Clock,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DETAIL_STEP_META, getStepRouteWithLang } from '@/lib/mystory-steps';
import BackToActivity from '@/components/book/BackToActivity';
import BookCoverImage from '@/components/book/BookCoverImage';
import type { Language, ProductionStatus, StoryStatus, StoryType } from '@/types/database';

/* ── Types ── */

type DraftSummary = {
  id: string;
  language: Language;
  current_step: number;
  started_at: string;
  story_status?: StoryStatus;
  production_status: ProductionStatus;
  production_progress: number;
  cover_design: { title?: string } | null;
};

type CompletedStorySummary = {
  id: string;
  language: Language;
  story_type: StoryType;
  completed_at: string | null;
  created_at: string;
  cover_design: { title?: string } | null;
};

/* ── Constants ── */

const STORY_TYPE_LABELS: Record<StoryType, string> = {
  continue: '이야기 이어쓰기',
  new_protagonist: '주인공으로 새 이야기',
  extra_backstory: '엑스트라 뒷이야기',
  change_ending: '결말 바꾸기',
  custom: '자유 주제',
};

const TOTAL_STEPS = DETAIL_STEP_META.length;

/* ── Helpers ── */

function formatKoreanDate(value: string | null | undefined) {
  if (!value) return '날짜 정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getDraftResumeHref(bookId: string, draft: DraftSummary) {
  if (draft.current_step >= 7) {
    const suffix = draft.production_status === 'completed' ? '/finish' : '/creating';
    return `/book/${bookId}/mystory${suffix}?storyId=${draft.id}&lang=${draft.language}`;
  }
  const targetStep = draft.current_step > 1 ? draft.current_step : 1;
  return getStepRouteWithLang(bookId, targetStep, draft.id, draft.language);
}

function getDraftActionLabel(draft: DraftSummary) {
  if (draft.current_step >= 7) {
    if (draft.production_status === 'completed') return '완성본 확인하기';
    if (draft.production_status === 'failed') return '다시 시도하기';
    return '제작 화면 열기';
  }
  return '이어서 하기';
}

function getProductionBadge(draft: DraftSummary): {
  label: string;
  tone: 'info' | 'success' | 'warning' | 'error';
} | null {
  if (draft.current_step < 7) return null;
  if (draft.production_status === 'completed') return { label: '그림책 완성', tone: 'success' };
  if (draft.production_status === 'failed') return { label: '제작 멈춤', tone: 'error' };
  if (draft.production_status === 'processing') {
    return { label: `제작 중 ${draft.production_progress}%`, tone: 'warning' };
  }
  return { label: '제작 대기', tone: 'info' };
}

function getStepInfo(currentStep: number) {
  const index = DETAIL_STEP_META.findIndex((m) => m.step === currentStep);
  const safeIndex = index >= 0 ? index : 0;
  return {
    label: DETAIL_STEP_META[safeIndex]?.label ?? '진행 중',
    displayIndex: safeIndex + 1,
    progress: ((safeIndex + 1) / TOTAL_STEPS) * 100,
  };
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

/* ── Component ── */

interface MyStoryEntryHubProps {
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  language: Language;
  activeDraft: DraftSummary | null;
  completedStories: CompletedStorySummary[];
}

export default function MyStoryEntryHub({
  bookId,
  bookTitle,
  bookCoverUrl,
  language,
  activeDraft,
  completedStories,
}: MyStoryEntryHubProps) {
  const router = useRouter();
  const [startingFresh, setStartingFresh] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When there's an active draft, completed stories collapse by default.
  const [showCompleted, setShowCompleted] = useState(!activeDraft);

  const handleContinue = async () => {
    if (!activeDraft) return;
    setContinuing(true);
    setError(null);
    try {
      router.push(getDraftResumeHref(bookId, activeDraft));
    } catch (err) {
      console.error('Failed to continue story:', err);
      setError('진행 중인 이야기를 열지 못했어요. 다시 시도해 주세요.');
      setContinuing(false);
    }
  };

  const handleStartFresh = async () => {
    setStartingFresh(true);
    setError(null);
    try {
      const response = await fetch('/api/story/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, language }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        storyId?: string;
        language?: Language;
        error?: string;
      };

      if (!response.ok || !data.storyId) {
        throw new Error(data.error || '새 이야기를 만들지 못했습니다.');
      }

      router.push(getStepRouteWithLang(bookId, 1, data.storyId, data.language ?? language));
    } catch (err) {
      console.error('Failed to start a fresh story:', err);
      setError(err instanceof Error ? err.message : '새 이야기를 시작하지 못했어요. 다시 시도해 주세요.');
      setStartingFresh(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <motion.header {...fadeUp(0)} className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-heading font-semibold tracking-[0.15em] text-muted">
            STEP 4
          </span>
          <h1 className="mt-3 text-2xl font-heading font-bold text-foreground sm:text-3xl">
            My World
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            나만의 그림책으로 이어가요.
          </p>
        </div>
        <div className="shrink-0">
          <BackToActivity bookId={bookId} language={language} />
        </div>
      </motion.header>

      {activeDraft ? (
        <ActiveDraftHero
          activeDraft={activeDraft}
          bookTitle={bookTitle}
          bookCoverUrl={bookCoverUrl}
          continuing={continuing}
          startingFresh={startingFresh}
          onContinue={handleContinue}
          onStartFresh={handleStartFresh}
        />
      ) : (
        <FreshStartHero
          isFirstTime={completedStories.length === 0}
          startingFresh={startingFresh}
          onStartFresh={handleStartFresh}
        />
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {completedStories.length > 0 && (
        <CompletedToggle
          stories={completedStories}
          isOpen={showCompleted}
          onToggle={() => setShowCompleted((v) => !v)}
          onView={(story) =>
            router.push(getStepRouteWithLang(bookId, 8, story.id, story.language))
          }
        />
      )}
    </main>
  );
}

/* ── Sub-components ── */

function ActiveDraftHero({
  activeDraft,
  bookTitle,
  bookCoverUrl,
  continuing,
  startingFresh,
  onContinue,
  onStartFresh,
}: {
  activeDraft: DraftSummary;
  bookTitle: string;
  bookCoverUrl: string | null;
  continuing: boolean;
  startingFresh: boolean;
  onContinue: () => void;
  onStartFresh: () => void;
}) {
  const draftTitle = activeDraft.cover_design?.title?.trim() || '진행 중인 새 이야기';
  const draftDate = formatKoreanDate(activeDraft.started_at);
  const stepInfo = getStepInfo(activeDraft.current_step);
  const ctaLabel = getDraftActionLabel(activeDraft);
  const productionBadge = getProductionBadge(activeDraft);

  return (
    <motion.section
      {...fadeUp(0.06)}
      className="relative overflow-hidden rounded-3xl border border-amber-100/70 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-6 shadow-sm sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-200/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-orange-200/25 blur-3xl"
      />

      <div className="relative grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-7">
        {/* Cover thumbnail (handles PDF first-page or image URLs) */}
        <div className="relative mx-auto h-40 w-32 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-md sm:mx-0 sm:h-48 sm:w-36">
          <BookCoverImage
            title={bookTitle}
            coverUrl={bookCoverUrl}
            sizes="(max-width: 640px) 128px, 144px"
            imageClassName="object-cover"
            fallbackClassName="flex h-full w-full items-center justify-center bg-amber-50"
            iconClassName="h-8 w-8 text-amber-500/60"
          />
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-white shadow-sm">
              <Sparkles className="h-3 w-3" />
              진행 중
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-muted">
              <Clock className="h-3.5 w-3.5" />
              {draftDate}
            </span>
            {productionBadge && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  productionBadge.tone === 'success'
                    ? 'bg-emerald-100 text-emerald-800'
                    : productionBadge.tone === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : productionBadge.tone === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-white/70 text-muted'
                }`}
              >
                {productionBadge.label}
              </span>
            )}
          </div>

          <h2 className="mt-3 line-clamp-2 text-2xl font-heading font-bold leading-snug text-foreground sm:text-[28px]">
            {draftTitle}
          </h2>
          <p className="mt-1.5 truncate text-sm text-muted">
            『{bookTitle}』에서 시작한 이야기
          </p>

          {/* Compact progress */}
          <div className="mt-5 rounded-2xl border border-amber-100/80 bg-white/80 px-4 py-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-700">
                  My World {stepInfo.displayIndex}/{TOTAL_STEPS}
                </span>
                <span className="text-muted/60">·</span>
                <span>{stepInfo.label}</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100/80">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stepInfo.progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              />
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <motion.button
              type="button"
              onClick={onContinue}
              disabled={continuing || startingFresh}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-900/15 transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-8 sm:text-base"
            >
              {continuing ? '이동 중...' : ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </motion.button>
            <button
              type="button"
              onClick={onStartFresh}
              disabled={startingFresh || continuing}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {startingFresh ? '새 이야기 만드는 중...' : '다른 이야기 새로 만들기'}
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function FreshStartHero({
  isFirstTime,
  startingFresh,
  onStartFresh,
}: {
  isFirstTime: boolean;
  startingFresh: boolean;
  onStartFresh: () => void;
}) {
  return (
    <motion.section
      {...fadeUp(0.06)}
      className="relative overflow-hidden rounded-3xl border border-amber-100/70 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-6 shadow-sm sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-200/30 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-white shadow-md">
            <CirclePlus className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.2em] text-amber-700">
              새 이야기
            </p>
            <h2 className="mt-1.5 text-2xl font-heading font-bold leading-snug text-foreground sm:text-3xl">
              {isFirstTime
                ? '책의 작가 도슨트가 기다리고 있어요'
                : '새 이야기를 시작해 볼까요?'}
            </h2>
            {isFirstTime && (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                작가에게 책 속 장면을 묻고, 추천 활동을 골라 나만의 그림책으로 이어가요.
              </p>
            )}
          </div>
        </div>

        {isFirstTime && (
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['그림책 작가', '책을 더 깊게 봐요'],
              ['활동 선택', '이어갈 방향을 골라요'],
              ['토리 대화', '새 이야기를 들려줘요'],
            ].map(([title, description], index) => (
              <li
                key={title}
                className="rounded-xl border border-amber-100/80 bg-white/70 px-4 py-3.5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
              </li>
            ))}
          </ol>
        )}

        <motion.button
          type="button"
          onClick={onStartFresh}
          disabled={startingFresh}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-900/15 transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8 sm:text-base"
        >
          {startingFresh ? '그림책 작가에게 가는 중...' : '그림책 작가 만나러 가기'}
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.section>
  );
}

function CompletedToggle({
  stories,
  isOpen,
  onToggle,
  onView,
}: {
  stories: CompletedStorySummary[];
  isOpen: boolean;
  onToggle: () => void;
  onView: (story: CompletedStorySummary) => void;
}) {
  return (
    <motion.section
      {...fadeUp(0.18)}
      className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted-light/40"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted-light">
            <History className="h-4 w-4 text-muted" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">
              이전에 완성한 이야기{' '}
              <span className="font-medium text-muted">{stories.length}개</span>
            </p>
            <p className="text-xs text-muted">완성한 이야기는 기록으로 남아 있어요.</p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-4 border-t border-border px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story, index) => {
                const storyTitle =
                  story.cover_design?.title?.trim() || STORY_TYPE_LABELS[story.story_type];

                return (
                  <motion.article
                    key={story.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-xl border border-border bg-muted-light/40 p-4"
                  >
                    <span className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-muted">
                      {STORY_TYPE_LABELS[story.story_type]}
                    </span>
                    <h3 className="mt-3 line-clamp-2 text-base font-bold text-foreground">
                      {storyTitle}
                    </h3>
                    <p className="mt-2 text-xs text-muted">
                      {formatKoreanDate(story.completed_at ?? story.created_at)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onView(story)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted-light"
                    >
                      완성본 보기
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
