'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, CheckCircle2, CirclePlus, Clock, History, RotateCcw } from 'lucide-react';
import { DETAIL_STEP_META, getDetailStepProgressLabel, getStepRouteWithLang } from '@/lib/mystory-steps';
import BackToActivity from '@/components/book/BackToActivity';
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

const STEP_SHORT_LABELS: Record<number, string> = {
  1: '대화',
  3: '초안',
  4: '장면',
  5: '주인공',
  6: '표지',
  7: '제작',
  8: '완성',
};

const STEP_DOT_LABELS = DETAIL_STEP_META.map((item, index) => ({
  ...item,
  displayIndex: index + 1,
  shortLabel: STEP_SHORT_LABELS[item.step] ?? item.label,
}));

/* ── Helpers ── */

function getStepLabel(step: number) {
  return getDetailStepProgressLabel(step);
}

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

function getDraftStatusLabel(draft: DraftSummary) {
  if (draft.current_step >= 7) {
    if (draft.production_status === 'completed') return '그림책 완성';
    if (draft.production_status === 'failed') return '제작 멈춤';
    if (draft.production_status === 'processing') return `제작 중 ${draft.production_progress}%`;
  }

  return getStepLabel(draft.current_step);
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

/* ── Component ── */

interface MyStoryEntryHubProps {
  bookId: string;
  language: Language;
  activeDraft: DraftSummary | null;
  completedStories: CompletedStorySummary[];
}

export default function MyStoryEntryHub({
  bookId,
  language,
  activeDraft,
  completedStories,
}: MyStoryEntryHubProps) {
  const router = useRouter();
  const [startingFresh, setStartingFresh] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDraftTitle = activeDraft?.cover_design?.title?.trim() || '진행 중인 새 이야기';
  const activeDraftDate = activeDraft ? formatKoreanDate(activeDraft.started_at) : null;
  const activeDraftStepLabel = activeDraft ? getDraftStatusLabel(activeDraft) : null;

  const navigateToStep = (targetRoute: string) => {
    router.push(targetRoute);
  };

  const handleContinue = async () => {
    if (!activeDraft) return;
    setContinuing(true);
    setError(null);
    try {
      navigateToStep(getDraftResumeHref(bookId, activeDraft));
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

      navigateToStep(getStepRouteWithLang(bookId, 1, data.storyId, data.language ?? language));
    } catch (err) {
      console.error('Failed to start a fresh story:', err);
      setError(err instanceof Error ? err.message : '새 이야기를 시작하지 못했어요. 다시 시도해 주세요.');
      setStartingFresh(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 px-4 py-8">
      <motion.header {...fadeUp(0)} className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-heading font-semibold tracking-[0.15em] text-muted">
            STEP 4
          </span>
          <h1 className="mt-3 text-2xl font-heading font-bold text-foreground sm:text-3xl">
            My World
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            책의 작가 도슨트와 이야기하고, 다음 활동을 골라 새 그림책으로 이어가요.
          </p>
        </div>
        <div className="shrink-0">
          <BackToActivity bookId={bookId} language={language} />
        </div>
      </motion.header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <motion.article
          {...fadeUp(0.06)}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-white">
              <CirclePlus className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.2em] text-muted">
                새 작업
              </p>
              <h2 className="mt-1.5 text-xl font-heading font-bold leading-snug text-foreground">
                책의 작가 도슨트가 기다리고 있어요
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                작가에게 책 속 장면을 묻고, 추천 활동을 골라 나만의 그림책으로 이어가요.
              </p>
            </div>
          </div>

          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['그림책 작가', '책을 더 깊게 봐요'],
              ['활동 선택', '이어갈 방향을 골라요'],
              ['토리 대화', '새 이야기를 들려줘요'],
            ].map(([title, description], index) => (
              <li
                key={title}
                className="rounded-xl border border-border bg-muted-light/50 px-4 py-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-[11px] font-bold text-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
              </li>
            ))}
          </ol>

          <motion.button
            type="button"
            onClick={() => void handleStartFresh()}
            disabled={startingFresh || continuing}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {startingFresh ? '그림책 작가에게 가는 중...' : '그림책 작가 만나러 가기'}
            <ArrowRight className="h-4 w-4" />
          </motion.button>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-4 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.article>

        {activeDraft ? (
          <motion.article
            {...fadeUp(0.12)}
            className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.2em] text-muted">
                  진행 중
                </p>
                <h2 className="mt-1.5 line-clamp-2 text-xl font-heading font-bold leading-snug text-foreground">
                  {activeDraftTitle}
                </h2>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted-light/70 px-3 py-1 text-[11px] font-medium text-muted">
                <Clock className="h-3.5 w-3.5" />
                {activeDraftDate}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {activeDraftStepLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-muted-light/60 px-2.5 py-1 text-[11px] text-muted">
                저장된 진행본
              </span>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-1">
                {STEP_DOT_LABELS.map((stepMeta, index) => {
                  const isCompleted = activeDraft.current_step > stepMeta.step;
                  const isCurrent = activeDraft.current_step === stepMeta.step;

                  return (
                    <Fragment key={stepMeta.step}>
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                          isCompleted
                            ? 'bg-foreground text-white'
                            : isCurrent
                              ? 'border border-foreground bg-card text-foreground ring-4 ring-foreground/10'
                              : 'border border-border bg-muted-light text-muted'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepMeta.displayIndex}
                      </div>
                      {index < STEP_DOT_LABELS.length - 1 && (
                        <div className={`h-0.5 flex-1 rounded-full ${isCompleted ? 'bg-foreground/35' : 'bg-border'}`} />
                      )}
                    </Fragment>
                  );
                })}
              </div>
              <div className="mt-2.5 flex justify-between">
                {STEP_DOT_LABELS.map((stepMeta) => {
                  const isCurrent = activeDraft.current_step === stepMeta.step;
                  return (
                    <span
                      key={stepMeta.step}
                      className={`w-9 text-center text-[10px] leading-tight ${
                        isCurrent ? 'font-semibold text-foreground' : 'text-muted'
                      }`}
                    >
                      {stepMeta.shortLabel}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto pt-6 flex flex-col gap-2.5 sm:flex-row">
              <motion.button
                type="button"
                onClick={() => void handleContinue()}
                disabled={continuing || startingFresh}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {continuing ? '이동 중...' : getDraftActionLabel(activeDraft)}
                <ArrowRight className="h-4 w-4" />
              </motion.button>
              <button
                type="button"
                onClick={() => void handleStartFresh()}
                disabled={startingFresh || continuing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                처음부터
              </button>
            </div>
          </motion.article>
        ) : (
          <motion.article
            {...fadeUp(0.12)}
            className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
              <BookOpen className="h-5 w-5 text-muted" />
            </span>
            <h2 className="mt-4 text-base font-heading font-bold text-foreground">
              진행 중인 이야기가 없어요
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              새 이야기를 열면 그림책 작가와 바로 만나요.
            </p>
          </motion.article>
        )}
      </section>

      {completedStories.length > 0 && (
        <motion.section {...fadeUp(0.2)} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-heading font-semibold uppercase tracking-[0.18em] text-muted">
                완성본
              </p>
              <h2 className="mt-2 text-lg font-heading font-bold text-foreground">
                이전에 완성한 이야기
              </h2>
              <p className="mt-1 text-sm text-muted">
                완성한 이야기는 기록으로 남아 있어요.
              </p>
            </div>
            <History className="h-5 w-5 text-muted" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completedStories.map((story, index) => {
              const storyTitle =
                story.cover_design?.title?.trim() || STORY_TYPE_LABELS[story.story_type];

              return (
                <motion.article
                  key={story.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24 + index * 0.05 }}
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
                    onClick={() => {
                      router.push(getStepRouteWithLang(bookId, 8, story.id, story.language));
                    }}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted-light"
                  >
                    완성본 보기
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.article>
              );
            })}
          </div>
        </motion.section>
      )}
    </main>
  );
}
