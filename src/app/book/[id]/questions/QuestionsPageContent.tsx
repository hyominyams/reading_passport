'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import BackToActivity from '@/components/book/BackToActivity';
import type { Book, Activity, ChatLog } from '@/types/database';
import { buildQuestionRequirements } from '@/lib/question-requirements';
import {
  normalizeQuestionValidation,
  type QuestionCategoryKey,
  type QuestionFeedbackItem,
  type QuestionValidationResult,
} from '@/lib/question-validation';

type CategoryKey = QuestionCategoryKey;

interface CategoryConfig {
  key: CategoryKey;
  icon: string;
  title: string;
  helper: string;
  max: number;
}

interface QuestionsData {
  content: string[];
  character: string[];
  world: string[];
}

type QuestionDirtyKey = `${CategoryKey}:${number}`;

interface QuestionsPageContentProps {
  book: Book;
  language: string;
  userId: string;
  initialActivity: Activity | null;
  existingLog: ChatLog | null;
  requiredQuestionCount: number;
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'content', icon: '📚', title: '이야기', helper: '이야기와 관련된 질문을 만들어 보세요', max: 3 },
  { key: 'character', icon: '👤', title: '인물', helper: '인물에 대한 질문을 만들어 보세요', max: 3 },
  { key: 'world', icon: '🌍', title: '세계(배경)', helper: '세계와 배경에 대한 질문을 만들어 보세요', max: 3 },
];

const EXAMPLE_PLACEHOLDERS: Record<CategoryKey, string> = {
  content: '예) 이야기에서 더 알고 싶은 장면은 무엇인가요?',
  character: '예) 이 인물의 마음은 왜 바뀌었나요?',
  world: '예) 이 나라와 배경은 이야기와 어떻게 이어지나요?',
};

const CATEGORY_FEEDBACK_SHELL_CLASS: Record<CategoryKey, string> = {
  content: 'border-sky-200 bg-sky-50/70',
  character: 'border-rose-200 bg-rose-50/70',
  world: 'border-emerald-200 bg-emerald-50/70',
};

const CATEGORY_FEEDBACK_ACCENT_CLASS: Record<CategoryKey, string> = {
  content: 'bg-sky-600',
  character: 'bg-rose-500',
  world: 'bg-emerald-600',
};

const FEEDBACK_SECTION_TITLES = {
  praise: '좋았던 점',
  problem: '다듬을 점',
  hint: '힌트',
  example: '예시 질문',
} as const;
const SAVE_TIMEOUT_MS = 15000;

type SupabaseErrorLike = { message: string; code?: string };
type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseErrorLike | null;
};

function appendUnique(values: unknown, value: string): string[] {
  const existing = Array.isArray(values)
    ? values.filter((item): item is string => typeof item === 'string')
    : [];

  return Array.from(new Set([...existing, value]));
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = SAVE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);

    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function getQuestionDirtyKey(category: CategoryKey, index: number): QuestionDirtyKey {
  return `${category}:${index}`;
}

function mergeValidationForEditedQuestions(
  previous: QuestionValidationResult | null,
  current: QuestionValidationResult,
  dirtyKeys: Set<QuestionDirtyKey>,
): QuestionValidationResult {
  if (!previous || dirtyKeys.size === 0) {
    return current;
  }

  const next: QuestionValidationResult = {
    ...current,
    content: current.content,
    character: current.character,
    world: current.world,
  };

  for (const category of CATEGORIES) {
    const previousByIndex = new Map(
      previous[category.key].questionFeedback.map((item) => [item.index, item]),
    );
    const mergedQuestionFeedback = current[category.key].questionFeedback.map((item) => {
      const key = getQuestionDirtyKey(category.key, item.index);
      const previousItem = previousByIndex.get(item.index);

      return previousItem && !dirtyKeys.has(key)
        ? previousItem
        : item;
    });
    const invalidIndices = mergedQuestionFeedback
      .filter((item) => !item.valid)
      .map((item) => item.index);

    next[category.key] = {
      ...current[category.key],
      valid: invalidIndices.length === 0,
      invalidIndices,
      questionFeedback: mergedQuestionFeedback,
    };
  }

  const overall = CATEGORIES.every((category) => next[category.key].valid);

  return {
    ...next,
    overall,
    overallFeedback: overall
      ? current.overallFeedback
      : '표시된 질문만 조금 더 또렷하게 고치면 제출할 수 있어요.',
    nextStep: overall
      ? current.nextStep
      : '고쳐 볼 질문의 조언을 보고 다시 확인해 주세요.',
  };
}

function buildQuestionFeedbackLookup(feedback: QuestionValidationResult | null) {
  return CATEGORIES.reduce((acc, category) => {
    acc[category.key] = new Map(
      (feedback?.[category.key].questionFeedback ?? []).map((item) => [item.index, item]),
    );
    return acc;
  }, {} as Record<CategoryKey, Map<number, QuestionFeedbackItem>>);
}

export default function QuestionsPageContent({
  book,
  language,
  userId,
  initialActivity,
  existingLog,
  requiredQuestionCount,
}: QuestionsPageContentProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logIdRef = useRef<string | null>(existingLog?.id ?? null);
  const latestQuestionsRef = useRef<QuestionsData | null>(null);
  const saveQuestionsRef = useRef<((data: QuestionsData) => Promise<void>) | null>(null);
  const submittingRef = useRef(false);
  const questionRequirements = useMemo(
    () => buildQuestionRequirements(requiredQuestionCount),
    [requiredQuestionCount]
  );
  const requiredByCategory = useMemo(() => Object.fromEntries(
    questionRequirements.map((item) => [item.key, item.required])
  ) as Record<CategoryKey, number>, [questionRequirements]);
  const requiredTotal = useMemo(
    () => questionRequirements.reduce((sum, item) => sum + item.required, 0),
    [questionRequirements]
  );
  const buildInitialQuestions = useCallback((): QuestionsData => ({
    content: Array.from({ length: requiredByCategory.content }, () => ''),
    character: Array.from({ length: requiredByCategory.character }, () => ''),
    world: Array.from({ length: requiredByCategory.world }, () => ''),
  }), [requiredByCategory]);

  const parseExistingQuestions = useCallback((): QuestionsData => {
    if (!existingLog?.messages) return buildInitialQuestions();

    const dataMsg = existingLog.messages.find(
      (message) => message.role === 'system' && message.content.startsWith('{')
    );
    if (dataMsg) {
      try {
        const parsed = JSON.parse(dataMsg.content) as QuestionsData;
        const pad = (arr: string[] | undefined, min: number) => {
          const result = [...(arr ?? [])];
          while (result.length < min) result.push('');
          return result;
        };

        return {
          content: pad(parsed.content, requiredByCategory.content),
          character: pad(parsed.character, requiredByCategory.character),
          world: pad(parsed.world, requiredByCategory.world),
        };
      } catch {
        return buildInitialQuestions();
      }
    }

    return buildInitialQuestions();
  }, [buildInitialQuestions, existingLog, requiredByCategory]);

  const parseExistingFeedback = useCallback((): QuestionValidationResult | null => {
    if (!existingLog?.messages) return null;

    const feedbackMsg = [...existingLog.messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.content.startsWith('{'));
    if (!feedbackMsg) return null;

    try {
      return normalizeQuestionValidation(JSON.parse(feedbackMsg.content));
    } catch {
      return null;
    }
  }, [existingLog]);

  const [questions, setQuestions] = useState<QuestionsData>(parseExistingQuestions);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<QuestionValidationResult | null>(null);
  const [showStampAnimation, setShowStampAnimation] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dirtyAfterValidation, setDirtyAfterValidation] = useState(false);
  const [dirtyQuestionKeys, setDirtyQuestionKeys] = useState<Set<QuestionDirtyKey>>(() => new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<QuestionValidationResult | null>(parseExistingFeedback);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [questionSeedsOpen, setQuestionSeedsOpen] = useState(true);

  const stampAlreadyEarned = initialActivity?.stamps_earned?.includes('questions') ?? false;
  const isRecreating = false;
  const isReadOnly = stampAlreadyEarned && !isRecreating;
  const readQuestionSeed = initialActivity?.read_question_seed?.trim() ?? '';
  const exploreChallenges = initialActivity?.explore_challenges ?? [];
  const questionSeedCount = (readQuestionSeed ? 1 : 0) + exploreChallenges.length;
  const hasQuestionSeeds = Boolean(readQuestionSeed) || exploreChallenges.length > 0;

  const filledPerCategory = CATEGORIES.map((category) =>
    (questions[category.key] ?? []).filter((question) => question.trim().length > 0).length
  );
  const totalFilled = filledPerCategory.reduce((sum, count) => sum + count, 0);
  const allMinMet = CATEGORIES.every(
    (category, index) => filledPerCategory[index] >= requiredByCategory[category.key]
  );
  const canSubmit = allMinMet
    && (!stampAlreadyEarned || isRecreating)
    && (!validation || validation.overall || dirtyAfterValidation);

  const questionFeedbackLookup = useMemo(
    () => buildQuestionFeedbackLookup(validation),
    [validation]
  );

  const saveQuestions = useCallback(
    async (data: QuestionsData, options?: { throwOnError?: boolean }) => {
      try {
        const chatMessages = [
          { role: 'system', content: JSON.stringify(data), timestamp: new Date().toISOString() },
          ...CATEGORIES.flatMap((category) =>
            data[category.key]
              .filter((question) => question.trim().length > 0)
              .map((question) => ({
                role: 'user',
                content: `[${category.title}] ${question}`,
                timestamp: new Date().toISOString(),
              }))
          ),
        ];

        if (logIdRef.current) {
          const { error } = await withTimeout<SupabaseResult<null>>(
            supabase.from('chat_logs').update({ messages: chatMessages }).eq('id', logIdRef.current)
          );

          if (error) {
            throw error;
          }
        } else {
          const { data: inserted, error } = await withTimeout<SupabaseResult<{ id: string }>>(
            supabase
              .from('chat_logs')
              .insert({
                student_id: userId,
                book_id: book.id,
                character_id: null,
                character_name: null,
                chat_type: 'questions',
                messages: chatMessages,
                language,
                flagged: false,
              })
              .select('id')
              .single()
          );

          if (error) {
            throw error;
          }

          if (inserted) {
            logIdRef.current = inserted.id;
          }
        }
      } catch (err) {
        console.error('Error saving questions:', err);
        if (options?.throwOnError) {
          throw err;
        }
      }
    },
    [supabase, userId, book.id, language]
  );

  saveQuestionsRef.current = saveQuestions;

  const debouncedSave = useCallback(
    (data: QuestionsData) => {
      latestQuestionsRef.current = data;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        latestQuestionsRef.current = null;
        void saveQuestions(data);
      }, 1000);
    },
    [saveQuestions]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (latestQuestionsRef.current && saveQuestionsRef.current) {
          void saveQuestionsRef.current(latestQuestionsRef.current);
        }
      }
    };
  }, []);

  const handleQuestionChange = (category: CategoryKey, index: number, value: string) => {
    if (isReadOnly) return;

    setQuestions((prev) => {
      const updated = { ...prev, [category]: [...prev[category]] };
      updated[category][index] = value;
      debouncedSave(updated);
      return updated;
    });

    if (validation) {
      setDirtyQuestionKeys((prev) => {
        const next = new Set(prev);
        next.add(getQuestionDirtyKey(category, index));
        return next;
      });
      setDirtyAfterValidation(true);
    }
  };

  const handleAddQuestion = (category: CategoryKey) => {
    if (isReadOnly) return;

    const categoryConfig = CATEGORIES.find((item) => item.key === category);
    if (!categoryConfig) return;

    setQuestions((prev) => {
      if (prev[category].length >= categoryConfig.max) return prev;
      const updated = { ...prev, [category]: [...prev[category], ''] };
      debouncedSave(updated);
      return updated;
    });

    if (validation) {
      setValidation(null);
      setDirtyQuestionKeys(() => new Set());
      setDirtyAfterValidation(true);
    }
  };

  const handleRemoveQuestion = (category: CategoryKey, index: number) => {
    if (isReadOnly) return;

    setQuestions((prev) => {
      if (prev[category].length <= requiredByCategory[category]) return prev;
      const updated = { ...prev, [category]: prev[category].filter((_, itemIndex) => itemIndex !== index) };
      debouncedSave(updated);
      return updated;
    });

    if (validation) {
      setValidation(null);
      setDirtyQuestionKeys(() => new Set());
      setDirtyAfterValidation(true);
    }
  };

  const saveFeedbackToLog = async (result: QuestionValidationResult) => {
    if (!logIdRef.current) return;

    try {
      const { data: currentLog, error: selectError } = await withTimeout<SupabaseResult<Pick<ChatLog, 'messages'>>>(
        supabase
          .from('chat_logs')
          .select('messages')
          .eq('id', logIdRef.current)
          .single()
      );

      if (selectError) {
        throw selectError;
      }

      if (currentLog) {
        const feedbackMessage = {
          role: 'assistant',
          content: JSON.stringify(result),
          timestamp: new Date().toISOString(),
        };
        const baseMessages = (currentLog.messages as Array<{ role: string; content: string; timestamp: string }>)
          .filter((message) => !(message.role === 'assistant' && message.content.startsWith('{')));
        const updatedMessages = [...baseMessages, feedbackMessage];
        const { error: updateError } = await withTimeout<SupabaseResult<null>>(
          supabase.from('chat_logs')
            .update({ messages: updatedMessages })
            .eq('id', logIdRef.current)
        );

        if (updateError) {
          throw updateError;
        }
      }
    } catch (err) {
      console.error('Error saving feedback:', err);
      throw err;
    }
  };

  const syncQuestionsToWorldSmart = async (data: QuestionsData) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);

    const response = await fetch('/api/world-smart/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: book.id,
        chatLogId: logIdRef.current,
        questions: data,
      }),
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timeoutId));

    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? '질문 게시글을 저장하지 못했습니다.');
    }
  };

  const awardQuestionsStamp = async () => {
    const { data: existing, error: selectError } = await withTimeout<SupabaseResult<Activity>>(
      supabase
        .from('activities')
        .select('*')
        .eq('student_id', userId)
        .eq('book_id', book.id)
        .maybeSingle()
    );

    if (selectError) {
      throw selectError;
    }

    if (existing) {
      const completedTabs = appendUnique(existing.completed_tabs, 'questions');
      const stampsEarned = appendUnique(existing.stamps_earned, 'questions');

      const { error: updateError } = await withTimeout<SupabaseResult<null>>(
        supabase
          .from('activities')
          .update({
            completed_tabs: completedTabs,
            stamps_earned: stampsEarned,
          })
          .eq('id', existing.id)
      );

      if (updateError) {
        throw updateError;
      }
      return;
    }

    const { error: insertError } = await withTimeout<SupabaseResult<null>>(
      supabase.from('activities').insert({
        student_id: userId,
        book_id: book.id,
        country_id: book.country_id,
        language,
        completed_tabs: ['questions'],
        stamps_earned: ['questions'],
      })
    );

    if (insertError) {
      throw insertError;
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || validating || completing || submittingRef.current) return;

    submittingRef.current = true;
    const previousValidation = validation;
    const dirtyKeysSnapshot = new Set(dirtyQuestionKeys);

    setValidating(true);
    setErrorMessage(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);

      const [, res] = await Promise.all([
        saveQuestions(questions, { throwOnError: true }),
        fetch('/api/story/validate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions,
            bookId: book.id,
            book_title: book.title,
            country_id: book.country_id,
            language,
          }),
          signal: controller.signal,
        }),
      ]);
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Validation request failed');

      const result = mergeValidationForEditedQuestions(
        previousValidation,
        normalizeQuestionValidation(await res.json()),
        dirtyKeysSnapshot,
      );
      setValidation(result);
      setDirtyQuestionKeys(() => new Set());
      setDirtyAfterValidation(false);

      if (!result.overall) {
        setValidating(false);
        submittingRef.current = false;
        return;
      }

      setCompleting(true);

      await saveFeedbackToLog(result);
      setSavedFeedback(result);
      await syncQuestionsToWorldSmart(questions);

      if (!stampAlreadyEarned) {
        await awardQuestionsStamp();

        setShowStampAnimation(true);
        setTimeout(() => {
          setShowStampAnimation(false);
          setValidating(false);
          setCompleting(false);
          submittingRef.current = false;
          router.push(`/book/${book.id}/world-smart?lang=${language}&posted=1`);
        }, 2500);
      } else {
        setValidating(false);
        setCompleting(false);
        submittingRef.current = false;
        router.push(`/book/${book.id}/world-smart?lang=${language}&posted=1`);
      }
    } catch (err) {
      console.error('Error:', err);
      setErrorMessage('질문 검증 중 오류가 발생했어요. 다시 시도해 주세요.');
      setValidating(false);
      setCompleting(false);
      submittingRef.current = false;
    }
  };

  const QuestionFeedbackBody = ({
    item,
    compact = false,
  }: {
    item: QuestionFeedbackItem;
    compact?: boolean;
  }) => {
    const sectionClass = compact
      ? 'rounded-xl border border-amber-300 bg-white px-4 py-3 shadow-sm'
      : 'rounded-2xl border border-[#d6c8b7] bg-white px-4 py-3 shadow-sm';
    const textClass = compact
      ? 'mt-1.5 text-sm font-medium leading-6 text-[#2f261b]'
      : 'mt-1.5 text-sm font-medium leading-6 text-[#33291f]';
    const titleClass = compact
      ? 'text-[11px] font-black tracking-[0.12em] text-[#92400e]'
      : 'text-[11px] font-black tracking-[0.12em] text-[#6f4e26]';

    return (
      <div className={compact ? 'mt-3 space-y-2' : 'mt-4 space-y-3'}>
        {item.praise && (
          <div className={sectionClass}>
            <p className={titleClass}>{FEEDBACK_SECTION_TITLES.praise}</p>
            <p className={textClass}>{item.praise}</p>
          </div>
        )}
        {item.problem && (
          <div className={sectionClass}>
            <p className={titleClass}>{FEEDBACK_SECTION_TITLES.problem}</p>
            <p className={textClass}>{item.problem}</p>
          </div>
        )}
        {item.hint && (
          <div className={sectionClass}>
            <p className={titleClass}>{FEEDBACK_SECTION_TITLES.hint}</p>
            <p className={textClass}>{item.hint}</p>
          </div>
        )}
        {item.example && (
          <div className={compact ? 'rounded-xl border border-[#b45309] bg-[#fff8e8] px-4 py-3 shadow-sm' : 'rounded-2xl border border-[#c9b79e] bg-[#fffaf1] px-4 py-3 shadow-sm'}>
            <p className={titleClass}>{FEEDBACK_SECTION_TITLES.example}</p>
            <p className={textClass}>{item.example}</p>
          </div>
        )}
      </div>
    );
  };

  const FeedbackCards = ({ feedback }: { feedback: QuestionValidationResult }) => (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#d9d2c6] bg-[#faf7f0] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.12em] text-[#6f4e26]">질문 코치</p>
            <h3 className="mt-2 text-xl font-bold text-foreground">질문 피드백</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b4f41]">{feedback.overallFeedback}</p>
          </div>
          <div className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
            feedback.overall
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            <span>{feedback.overall ? '✓' : '!'}</span>
            <span>{feedback.overall ? '질문 준비 완료' : '조금 더 다듬기'}</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#e5ddd0] bg-white px-4 py-4">
          <p className="text-[11px] font-black tracking-[0.12em] text-[#6f4e26]">다음 단계</p>
          <p className="mt-2 text-sm leading-6 text-[#5b4f41]">{feedback.nextStep}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {CATEGORIES.map((category) => {
          const categoryResult = feedback[category.key];
          if (!categoryResult.feedback && categoryResult.questionFeedback.length === 0) return null;

          return (
            <section
              key={category.key}
              className={`relative overflow-hidden rounded-[28px] border p-5 ${CATEGORY_FEEDBACK_SHELL_CLASS[category.key]}`}
            >
              <div className={`absolute left-0 top-0 h-full w-1.5 ${CATEGORY_FEEDBACK_ACCENT_CLASS[category.key]}`} />
              <div className="pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-2xl">{category.icon}</span>
                  <h3 className="text-lg font-bold text-foreground">{category.title}</h3>
                  <span className={`ml-auto rounded-full px-3 py-1 text-[11px] font-semibold ${
                    categoryResult.valid
                      ? 'border border-emerald-200 bg-white text-emerald-700'
                      : 'border border-amber-200 bg-white text-amber-700'
                  }`}>
                    {categoryResult.valid ? '좋은 질문' : '다듬어 보기'}
                  </span>
                </div>

                {categoryResult.feedback && (
                  <div className="mt-4 rounded-2xl border border-white/80 bg-white/90 px-4 py-4">
                    <p className="text-[11px] font-black tracking-[0.12em] text-[#6f4e26]">분야 조언</p>
                    <p className="mt-2 text-sm leading-6 text-[#55493a]">{categoryResult.feedback}</p>
                  </div>
                )}

                {categoryResult.questionFeedback.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {categoryResult.questionFeedback.map((item) => (
                      <article
                        key={`${category.key}-${item.index}`}
                        className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_8px_24px_rgba(85,73,58,0.06)]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#ddd4c7] bg-[#faf7f0] px-2.5 py-1 text-[11px] font-semibold text-[#6d5e4d]">
                            {item.index + 1}번 질문
                          </span>
                        </div>

                        {item.question && (
                          <div className="mt-3 rounded-2xl border border-[#ece5d9] bg-[#fcfaf6] px-4 py-3">
                            <p className="text-[11px] font-black tracking-[0.12em] text-[#6f4e26]">내 질문</p>
                            <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{item.question}</p>
                          </div>
                        )}

                        <QuestionFeedbackBody item={item} />
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>❓</span> 질문 만들기
          </h1>
          <p className="text-sm text-muted mt-1">
            {book.title} - 책에 대한 질문을 만들어 보세요
          </p>
        </div>
        <div className="shrink-0 pt-1">
          <BackToActivity bookId={book.id} language={language} />
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex items-center gap-2 px-4 py-3 bg-card border border-border rounded-xl">
          <span className="text-sm font-medium text-foreground">진행 상황</span>
          <div className="flex-1 flex gap-1.5">
            {CATEGORIES.map((category, index) => {
              const pct = (filledPerCategory[index] / requiredByCategory[category.key]) * 100;
              return (
                <div
                  key={category.key}
                  className="h-2 flex-1 rounded-full bg-border overflow-hidden"
                >
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <span className="text-sm text-muted">{totalFilled}/{requiredTotal} 질문 작성</span>
        </div>
      )}

      {hasQuestionSeeds && (
        <section className="rounded-[24px] border border-[#dcc8ad] bg-[#fffaf1]">
          <button
            type="button"
            aria-expanded={questionSeedsOpen}
            aria-controls="question-seeds-panel"
            onClick={() => setQuestionSeedsOpen((open) => !open)}
            className="flex w-full items-start justify-between gap-3 p-4 text-left sm:p-5"
          >
            <div className="min-w-0 flex-1 [word-break:keep-all]">
              <p className="text-[11px] font-black tracking-[0.12em] text-[#8a5d2f]">질문 씨앗</p>
              <h2 className="mt-2 text-lg font-bold text-foreground">
                질문 씨앗
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#6d573d]">
                읽기와 탐색 단계에서 모은 생각을 질문으로 이어갑니다
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <span className="inline-flex flex-col items-center justify-center rounded-full border border-[#dfcfb7] bg-white px-3 py-1 text-center text-[11px] font-semibold leading-4 text-[#8a5d2f] sm:flex-row sm:gap-x-1">
                <span className="whitespace-nowrap">{questionSeedCount}개</span>
                <span className="whitespace-nowrap">단서</span>
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#dfcfb7] bg-white text-[#8a5d2f]">
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 transition-transform ${questionSeedsOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {questionSeedsOpen && (
              <motion.div
                id="question-seeds-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                  {readQuestionSeed && (
                    <div className="rounded-2xl border border-[#e4d4be] bg-white px-4 py-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2 [word-break:keep-all]">
                        <span className="rounded-full bg-[#fbf2e1] px-2.5 py-1 text-[11px] font-semibold text-[#8a5d2f]">
                          읽기
                        </span>
                        <span className="text-sm font-semibold text-foreground">더 알고 싶은 점</span>
                      </div>
                      <p className="text-sm leading-6 text-[#4f3d28] [word-break:keep-all]">{readQuestionSeed}</p>
                    </div>
                  )}

                  {exploreChallenges.length > 0 && (
                    <div className="space-y-3">
                      {exploreChallenges.map((note) => (
                        <div
                          key={note.content_id}
                          className="rounded-2xl border border-[#e4d4be] bg-white px-4 py-4"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2 [word-break:keep-all]">
                            <span className="rounded-full bg-[#fbf2e1] px-2.5 py-1 text-[11px] font-semibold text-[#8a5d2f]">
                              탐색
                            </span>
                            <span className="min-w-0 text-sm font-semibold leading-6 text-foreground [word-break:keep-all]">{note.content_title}</span>
                          </div>
                          <p className="text-xs font-semibold tracking-[0.12em] text-[#8a5d2f] [word-break:keep-all]">자료 한 줄 정리</p>
                          <p className="mt-1 text-sm leading-6 text-[#4f3d28] [word-break:keep-all]">{note.summary}</p>
                          <p className="mt-3 text-xs font-semibold tracking-[0.12em] text-[#8a5d2f] [word-break:keep-all]">새로 생긴 궁금증</p>
                          <p className="mt-1 text-sm leading-6 text-[#4f3d28] [word-break:keep-all]">{note.curiosity}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {stampAlreadyEarned && !isRecreating && (
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4"
          >
            <div className="pointer-events-none absolute inset-0">
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-2 right-8 h-2 w-2 rounded-full bg-yellow-400"
              />
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.3, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-4 right-20 h-1.5 w-1.5 rounded-full bg-emerald-400"
              />
              <motion.div
                animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-3 right-14 h-1.5 w-1.5 rounded-full bg-yellow-300"
              />
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.2, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                className="absolute top-3 left-[60%] h-1 w-1 rounded-full bg-teal-400"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white/80 shadow-sm"
                >
                  <span className="text-lg">✅</span>
                </motion.div>
                <div className="min-w-0 flex-1 [word-break:keep-all]">
                  <p className="text-sm font-bold leading-5 text-emerald-700">스탬프를 획득했어요!</p>
                  <p className="mt-0.5 text-xs leading-5 text-emerald-600/70">질문 만들기를 완료했어요</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
                <Link
                  href={`/book/${book.id}/world-smart?lang=${language}`}
                  className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  생각 나누기
                </Link>
                {savedFeedback && (
                  <button
                    onClick={() => setShowSavedFeedback(!showSavedFeedback)}
                    className="shrink-0 text-xs px-3 py-1.5 bg-white/80 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-white hover:shadow-sm transition-all font-medium backdrop-blur-sm"
                  >
                    {showSavedFeedback ? '피드백 숨기기' : '질문 피드백 보기'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {showSavedFeedback && savedFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <FeedbackCards feedback={savedFeedback} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {validation && !validation.overall && (
        <div className="rounded-2xl border-2 border-amber-400 bg-[#fff4d6] px-5 py-4 shadow-[0_10px_28px_rgba(180,83,9,0.12)]">
          <p className="text-base font-black text-[#7c2d12]">{validation.overallFeedback}</p>
          <div className="space-y-1">
            {CATEGORIES.map((category) => {
              const categoryResult = validation[category.key];
              if (categoryResult.valid || !categoryResult.feedback) return null;

              return (
                <p key={category.key} className="text-sm font-semibold leading-6 text-[#7c2d12]">
                  <span className="font-medium">{category.icon} {category.title}:</span> {categoryResult.feedback}
                </p>
              );
            })}
          </div>
          <p className="mt-2 text-sm font-semibold text-[#92400e]">
            질문은 그대로 있어요. 표시된 질문만 고쳐 다시 확인해 주세요.
          </p>
          {dirtyAfterValidation && (
            <p className="mt-1 text-sm font-semibold text-[#92400e]">
              수정한 질문은 다시 확인하면 새 조언으로 바뀝니다.
            </p>
          )}
          <p className="mt-1 text-sm font-medium text-[#92400e]">{validation.nextStep}</p>
        </div>
      )}

      {CATEGORIES.map((category, categoryIndex) => {
        const categoryValidation = validation?.[category.key];
        const invalidSet = new Set(categoryValidation?.invalidIndices ?? []);

        return (
          <motion.div
            key={category.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: categoryIndex * 0.1, duration: 0.3 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{category.icon}</span>
              <h2 className="text-lg font-bold text-foreground">{category.title}</h2>
              <span className="rounded-full bg-muted-light px-2 py-1 text-[11px] font-medium text-muted">
                필수 {requiredByCategory[category.key]}개
              </span>
              <span className="ml-auto text-xs text-muted">
                {filledPerCategory[categoryIndex]}/{(questions[category.key] ?? []).length}
              </span>
            </div>
            <p className="text-sm text-muted mb-4">{category.helper}</p>

            <div className="space-y-3">
              {(questions[category.key] ?? []).map((question, questionIndex) => {
                const isInvalid = invalidSet.has(questionIndex);
                const questionFeedback = questionFeedbackLookup[category.key].get(questionIndex);
                const showInlineCoach = Boolean(questionFeedback && !questionFeedback.valid && !isReadOnly);
                const dirtyKey = getQuestionDirtyKey(category.key, questionIndex);
                const feedbackIsStale = dirtyQuestionKeys.has(dirtyKey);

                return (
                  <div key={questionIndex} className="flex items-start gap-2">
                    <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0 text-center">
                      {questionIndex + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          value={question}
                          onChange={(e) => handleQuestionChange(category.key, questionIndex, e.target.value)}
                          readOnly={isReadOnly}
                          placeholder={questionIndex === 0
                            ? EXAMPLE_PLACEHOLDERS[category.key]
                            : `${category.title}에 대한 질문을 입력하세요...`}
                          className={`min-h-11 flex-1 resize-y rounded-lg border px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted/60 focus:outline-none transition-all ${
                            isReadOnly
                              ? 'bg-gray-50 border-border cursor-default'
                              : isInvalid
                                ? 'border-amber-500 focus:ring-2 focus:ring-amber-300 focus:border-amber-600 bg-[#fffaf0]'
                                : 'bg-white border-border focus:ring-2 focus:ring-primary/30 focus:border-primary'
                          }`}
                        />
                        {!isReadOnly && (questions[category.key] ?? []).length > requiredByCategory[category.key] && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(category.key, questionIndex)}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label={`${category.title} ${questionIndex + 1}번 질문 삭제`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {showInlineCoach && questionFeedback && (
                        <div className="mt-3 rounded-2xl border-2 border-amber-400 border-l-[6px] border-l-amber-600 bg-[#fff3cf] px-4 py-4 shadow-[0_10px_24px_rgba(180,83,9,0.14)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-500 bg-white px-3 py-1 text-xs font-black text-[#92400e]">
                              {feedbackIsStale ? '이전 조언' : '고쳐 볼 질문'}
                            </span>
                          </div>
                          <QuestionFeedbackBody item={questionFeedback} compact />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!isReadOnly && (questions[category.key] ?? []).length < category.max && (
              <button
                type="button"
                onClick={() => handleAddQuestion(category.key)}
                className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:text-primary/80"
              >
                <span>+</span><span>질문 추가</span>
              </button>
            )}
          </motion.div>
        );
      })}

      {errorMessage && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          {errorMessage}
        </div>
      )}

      <div className="pb-8">
        {(!stampAlreadyEarned || isRecreating) ? (
          <>
            {validating ? (
              <div className="w-full py-4 rounded-2xl bg-gray-100 text-center">
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin" />
                  <span className="text-sm font-medium">질문을 검토하고 있어요...</span>
                </div>
              </div>
            ) : (
              <motion.button
                onClick={handleSubmit}
                disabled={!canSubmit || completing}
                whileHover={canSubmit ? { scale: 1.02 } : {}}
                whileTap={canSubmit ? { scale: 0.98 } : {}}
                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
                  canSubmit
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {completing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>저장 중...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>{validation && dirtyAfterValidation ? '다시 확인하기' : '완료하기'}</span>
                  </>
                )}
              </motion.button>
            )}
            {!allMinMet && (
              <p className="text-center text-xs text-muted mt-2">
                이야기 {requiredByCategory.content}개, 인물 {requiredByCategory.character}개, 세계(배경) {requiredByCategory.world}개를 작성하면 제출할 수 있어요
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="w-full h-px bg-border" />
            <p className="text-xs text-muted">이미 제출이 완료된 질문이에요</p>
            <button
              type="button"
              disabled
              className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-gray-200 text-gray-500 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>제출완료</span>
            </button>
          </div>
        )}
      </div>

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
                <div className="flex flex-col items-center z-10">
                  <span className="text-red-700/80 text-[9px] font-bold tracking-[0.18em] uppercase leading-none">WORLD STORY</span>
                  <span className="text-red-700 text-2xl font-black tracking-[0.1em] uppercase leading-tight mt-1">SUCCESS</span>
                  <span className="text-red-700/70 text-[8px] font-semibold tracking-[0.25em] uppercase leading-none mt-0.5">APPROVED</span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <p className="text-2xl font-bold text-white mb-1">스탬프 획득!</p>
                <p className="text-base text-red-300 font-medium">질문 만들기</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
