'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { DETAIL_STEP_META, getStepRouteWithLang } from '@/lib/mystory-steps';
import BackToActivity from '@/components/book/BackToActivity';
import type { Language, StoryStatus, StoryType } from '@/types/database';

/* ── Types ── */

type DraftSummary = {
  id: string;
  language: Language;
  current_step: number;
  started_at: string;
  story_status?: StoryStatus;
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
  1: '채팅',
  3: '초안',
  4: '장면',
  5: '주인공',
  6: '표지',
  7: '제작',
  8: '완성',
};

/* ── Helpers ── */

function getStepLabel(step: number) {
  return DETAIL_STEP_META.find((item) => item.step === step)?.label ?? '이야기 채팅';
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

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

/* ── Component ── */

interface MyStoryEntryHubProps {
  bookId: string;
  countryId: string;
  language: Language;
  userId: string;
  activeDraft: DraftSummary | null;
  completedStories: CompletedStorySummary[];
}

export default function MyStoryEntryHub({
  bookId,
  countryId,
  language,
  userId,
  activeDraft,
  completedStories,
}: MyStoryEntryHubProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [startingFresh, setStartingFresh] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDraftTitle = activeDraft?.cover_design?.title?.trim() || '진행 중인 새 이야기';
  const activeDraftDate = activeDraft ? formatKoreanDate(activeDraft.started_at) : null;
  const activeDraftStepLabel = activeDraft ? getStepLabel(activeDraft.current_step) : null;

  const navigateToStep = (targetRoute: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(targetRoute);
      return;
    }
    router.replace(targetRoute);
    router.refresh();
  };

  const handleContinue = async () => {
    if (!activeDraft) return;
    setContinuing(true);
    setError(null);
    try {
      const targetStep = activeDraft.current_step > 1 ? activeDraft.current_step : 1;
      navigateToStep(getStepRouteWithLang(bookId, targetStep, activeDraft.id, activeDraft.language));
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
      if (activeDraft && activeDraft.story_status === 'draft') {
        const { error: archiveError } = await supabase
          .from('stories')
          .update({ story_status: 'archived' })
          .eq('id', activeDraft.id);
        if (archiveError) throw archiveError;
      }

      const { data, error: createError } = await supabase
        .from('stories')
        .insert({
          student_id: userId,
          book_id: bookId,
          country_id: countryId,
          language,
          story_type: 'continue',
          current_step: 1,
          chat_log: [],
          all_student_messages: null,
          gauge_final: 0,
          visibility: 'public',
        })
        .select('id')
        .single();

      if (createError || !data?.id) {
        throw createError ?? new Error('새 이야기를 만들지 못했습니다.');
      }

      navigateToStep(getStepRouteWithLang(bookId, 1, data.id, language));
    } catch (err) {
      console.error('Failed to start a fresh story:', err);
      setError('새 이야기를 시작하지 못했어요. 다시 시도해 주세요.');
      setStartingFresh(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">

      {/* ── A. Compact Header ── */}
      <motion.div {...fadeUp(0)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-border bg-muted-light px-3 py-1 text-xs font-heading font-semibold tracking-[0.15em] text-muted">
                STEP 4
              </span>
              <h1 className="text-xl font-heading font-bold text-foreground sm:text-2xl">
                My World
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              이야기를 이어서 쓰거나, 새로 시작하거나, 완성본을 확인할 수 있어요.
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <BackToActivity bookId={bookId} language={language} />
          </div>
        </div>
      </motion.div>

      {/* ── B. Draft Hero Card / Empty State ── */}
      {activeDraft ? (
        <motion.article
          {...fadeUp(0.08)}
          className="rounded-3xl border border-border bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-heading font-semibold uppercase tracking-[0.2em] text-muted">
            현재 진행 중인 이야기
          </p>

          <h2 className="mt-3 text-xl font-heading font-bold text-foreground sm:text-2xl">
            {activeDraftTitle}
          </h2>

          {/* Metadata pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-foreground/[0.06] px-3 py-1 text-xs font-medium text-foreground">
              {activeDraftStepLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted-light px-3 py-1 text-xs text-muted">
              시작일 {activeDraftDate}
            </span>
          </div>

          {/* Step Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center gap-1">
              {DETAIL_STEP_META.map((stepMeta, index) => {
                const isCompleted = activeDraft.current_step > stepMeta.step;
                const isCurrent = activeDraft.current_step === stepMeta.step;
                return (
                  <Fragment key={stepMeta.step}>
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isCompleted
                          ? 'bg-foreground text-white'
                          : isCurrent
                            ? 'bg-foreground/10 text-foreground ring-2 ring-foreground/30'
                            : 'bg-muted-light text-muted'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    {index < DETAIL_STEP_META.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 rounded-full ${
                          isCompleted ? 'bg-foreground/30' : 'bg-border'
                        }`}
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>

            {/* Step short labels */}
            <div className="mt-1.5 flex justify-between">
              {DETAIL_STEP_META.map((stepMeta) => {
                const isCurrent = activeDraft.current_step === stepMeta.step;
                return (
                  <span
                    key={stepMeta.step}
                    className={`w-7 text-center text-[10px] leading-tight ${
                      isCurrent ? 'font-semibold text-foreground' : 'text-muted'
                    }`}
                  >
                    {STEP_SHORT_LABELS[stepMeta.step] ?? ''}
                  </span>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <motion.button
            type="button"
            onClick={() => void handleContinue()}
            disabled={continuing || startingFresh}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="mt-6 w-full rounded-xl bg-foreground py-3.5 text-center text-sm font-bold text-white shadow-sm transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-10"
          >
            {continuing ? '이동 중...' : '이어서 하기'}
          </motion.button>
        </motion.article>
      ) : (
        <motion.div
          {...fadeUp(0.08)}
          className="rounded-3xl border border-dashed border-border bg-white px-6 py-14 text-center"
        >
          <div className="text-4xl">✏️</div>
          <h2 className="mt-4 text-lg font-heading font-bold text-foreground">
            아직 진행 중인 이야기가 없어요
          </h2>
          <p className="mt-2 text-sm text-muted">
            새 이야기를 시작해서 나만의 그림책을 만들어 보세요.
          </p>
          <motion.button
            type="button"
            onClick={() => void handleStartFresh()}
            disabled={startingFresh}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-6 rounded-xl bg-foreground px-8 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {startingFresh ? '만드는 중...' : '새 이야기 시작하기'}
          </motion.button>
        </motion.div>
      )}

      {/* ── C. Start Fresh (secondary, only when draft exists) ── */}
      {activeDraft && (
        <motion.div {...fadeUp(0.16)}>
          <button
            type="button"
            onClick={() => void handleStartFresh()}
            disabled={startingFresh || continuing}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-white px-5 py-4 text-left transition-colors hover:bg-muted-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div>
              <p className="text-sm font-bold text-foreground">처음부터 새로 시작하기</p>
              <p className="mt-0.5 text-xs text-muted">
                현재 진행본을 보관하고 새 이야기를 시작합니다.
              </p>
            </div>
            <svg
              className="h-5 w-5 shrink-0 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </motion.div>
      )}

      {/* ── Error Toast ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── D. Completed Stories Grid ── */}
      <motion.section {...fadeUp(0.24)}>
        <div className="mb-4">
          <p className="text-xs font-heading font-semibold uppercase tracking-[0.2em] text-muted">
            완성본 이력
          </p>
          <h2 className="mt-1 text-lg font-heading font-bold text-foreground">
            완성한 이야기 다시 열기
          </h2>
          <p className="mt-1 text-sm text-muted">
            완성한 작품도 다시 열어서 수정할 수 있어요.
          </p>
        </div>

        {completedStories.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completedStories.map((story, index) => {
              const storyTitle =
                story.cover_design?.title?.trim() || STORY_TYPE_LABELS[story.story_type];

              return (
                <motion.article
                  key={story.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 + index * 0.06 }}
                  whileHover={{ y: -4 }}
                  className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="inline-flex rounded-full bg-muted-light px-2.5 py-0.5 text-[11px] font-medium text-muted">
                    {STORY_TYPE_LABELS[story.story_type]}
                  </span>

                  <h3 className="mt-2.5 text-base font-bold text-foreground line-clamp-2">
                    {storyTitle}
                  </h3>

                  <p className="mt-1.5 text-xs text-muted">
                    {formatKoreanDate(story.completed_at ?? story.created_at)}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      router.push(getStepRouteWithLang(bookId, 7, story.id, story.language));
                    }}
                    className="mt-4 w-full rounded-xl border border-border bg-white py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted-light"
                  >
                    다시 수정하기
                  </button>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted">아직 완성된 이야기가 없습니다.</p>
          </div>
        )}
      </motion.section>
    </main>
  );
}
