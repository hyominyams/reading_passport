'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Send, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  type ToriCardSet,
  type ToriRenderVars,
  isToriAnswersComplete,
  normalizeToriAnswers,
  renderToriHint,
  renderToriTitle,
} from '@/lib/tori-questions';
import { logClientError } from '@/lib/network-error';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ToriQuestionCardsProps {
  storyId: string;
  cardSet: ToriCardSet;
  vars: ToriRenderVars;
  onSubmit: (answers: Record<string, string>) => void | Promise<void>;
  submitting: boolean;
  submitLabel?: string;
}

export default function ToriQuestionCards({
  storyId,
  cardSet,
  vars,
  onSubmit,
  submitting,
  submitLabel = '이 답으로 그림책 초안 만들기',
}: ToriQuestionCardsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const answersRef = useRef<Record<string, string>>({});
  const saveSeqRef = useRef(0);

  // Load existing answers (resume support)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('stories')
        .select('tori_answers')
        .eq('id', storyId)
        .single();

      if (cancelled) return;

      if (error) {
        logClientError('Tori cards load error:', error);
      }

      const existing = normalizeToriAnswers(data?.tori_answers);
      const seed: Record<string, string> = {};
      // Only restore answers when the saved set matches the current activity.
      // If the student switched activities, start fresh.
      if (existing && existing.activity_id === cardSet.activity_id) {
        for (const [key, value] of Object.entries(existing.answers)) {
          seed[key] = value;
        }
      }

      setAnswers(seed);
      answersRef.current = seed;
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [cardSet.activity_id, storyId]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const saveAnswers = useCallback(
    async (next: Record<string, string>) => {
      const seq = saveSeqRef.current + 1;
      saveSeqRef.current = seq;
      setSaveState('saving');

      const payload = {
        activity_id: cardSet.activity_id,
        answers: Object.fromEntries(
          Object.entries(next).filter(([, value]) => value.trim().length > 0),
        ),
      };

      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({ tori_answers: payload })
        .eq('id', storyId);

      if (seq !== saveSeqRef.current) return;

      if (error) {
        logClientError('Tori cards save error:', error);
        setSaveState('error');
        return;
      }

      setSaveState('saved');
    },
    [cardSet.activity_id, storyId],
  );

  // Debounced auto-save: 800ms after last change.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void saveAnswers(answersRef.current);
    }, 800);
    return () => clearTimeout(timer);
  }, [answers, loaded, saveAnswers]);

  const updateAnswer = useCallback((key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setSaveState('saving');
  }, []);

  const allComplete = useMemo(
    () => isToriAnswersComplete(cardSet, answers),
    [answers, cardSet],
  );

  const filledCount = useMemo(
    () => cardSet.cards.filter((card) => (answers[card.key] ?? '').trim().length > 0).length,
    [answers, cardSet],
  );

  const handleSubmit = useCallback(async () => {
    if (!allComplete || submitting) return;
    await saveAnswers(answersRef.current);
    await onSubmit(answersRef.current);
  }, [allComplete, onSubmit, saveAnswers, submitting]);

  if (!loaded) {
    return (
      <div className="flex justify-center p-12 text-sm text-muted">
        토리가 질문지를 가져오는 중...
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6">
      <ToriHeader
        activityTitle={cardSet.activity_title}
        filled={filledCount}
        total={cardSet.cards.length}
      />

      <div className="mt-6 space-y-4">
        {cardSet.cards.map((card, index) => {
          const renderedTitle = renderToriTitle(card.title, vars);
          const value = answers[card.key] ?? '';
          const hasAnswer = value.trim().length > 0;

          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={`rounded-2xl border p-4 transition-colors sm:p-5 ${
                hasAnswer
                  ? 'border-emerald-200/80 bg-emerald-50/30'
                  : 'border-[#e8dcc6] bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    hasAnswer
                      ? 'bg-emerald-500 text-white'
                      : 'border border-[#e5d7bf] bg-white text-amber-700'
                  }`}
                >
                  {hasAnswer ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <label
                  htmlFor={`tori-${card.key}`}
                  className="block min-w-0 flex-1 text-sm font-bold leading-6 text-gray-950 sm:text-base"
                >
                  {renderedTitle}
                  {card.required && (
                    <span className="ml-1 text-rose-500" aria-hidden>
                      *
                    </span>
                  )}
                </label>
              </div>

              <div className="mt-3 sm:pl-10">
                {card.rows === 1 ? (
                  <input
                    id={`tori-${card.key}`}
                    type="text"
                    value={value}
                    onChange={(event) => updateAnswer(card.key, event.target.value)}
                    maxLength={card.maxLength}
                    className="w-full rounded-xl border border-[#ddcfb7] bg-white px-3 py-2.5 text-sm leading-6 text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                ) : (
                  <textarea
                    id={`tori-${card.key}`}
                    value={value}
                    onChange={(event) => updateAnswer(card.key, event.target.value)}
                    rows={card.rows}
                    maxLength={card.maxLength}
                    className="w-full resize-none rounded-xl border border-[#ddcfb7] bg-white px-3 py-2.5 text-sm leading-6 text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                )}

                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {card.hints.map((hint, hintIndex) => (
                    <li
                      key={hintIndex}
                      className="select-text rounded-full border border-dashed border-gray-200 bg-gray-50/60 px-2.5 py-0.5 text-xs leading-5 text-gray-400"
                    >
                      {renderToriHint(hint, vars)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  ※ 위 예시는 참고만 하고, 자기 답을 직접 써봐.
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SaveStatus saveState={saveState} />
        <motion.button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!allComplete || submitting}
          whileHover={allComplete && !submitting ? { scale: 1.01 } : {}}
          whileTap={allComplete && !submitting ? { scale: 0.98 } : {}}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-900/15 transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none sm:text-base"
        >
          {submitting ? '초안 만드는 중...' : submitLabel}
          {!submitting && <Send className="h-4 w-4" />}
        </motion.button>
      </div>
    </section>
  );
}

function ToriHeader({
  activityTitle,
  filled,
  total,
}: {
  activityTitle: string;
  filled: number;
  total: number;
}) {
  const progress = total === 0 ? 0 : Math.round((filled / total) * 100);

  return (
    <div className="rounded-3xl border border-[#e8dcc6] bg-[#fffaf0] p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow-md">
          🪔
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.2em] text-amber-700">
            이야기 램프 토리
          </p>
          <h2 className="mt-1 text-xl font-heading font-bold leading-snug text-foreground sm:text-2xl">
            안녕! 같이 이야기 만들어볼까?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            네가 고른{' '}
            <span className="font-semibold text-foreground">{activityTitle}</span>{' '}
            활동에 맞는 질문을 준비했어. 천천히 답해줘.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-100/80 bg-white/80 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>
              질문 {filled} / {total} 답함
            </span>
          </span>
          <span className="text-muted">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100/80">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          />
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ saveState }: { saveState: SaveState }) {
  if (saveState === 'saving') {
    return <p className="text-xs font-medium text-amber-700">저장 중...</p>;
  }
  if (saveState === 'saved') {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        저장됨
      </p>
    );
  }
  if (saveState === 'error') {
    return <p className="text-xs font-medium text-red-600">저장되지 않았어요</p>;
  }
  return <p className="text-xs font-medium text-gray-500">입력하면 자동 저장돼요</p>;
}
