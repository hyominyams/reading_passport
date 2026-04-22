'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import BackToActivity from '@/components/book/BackToActivity';
import type { Book, Activity, ChatLog } from '@/types/database';
import { buildQuestionRequirements } from '@/lib/question-requirements';
import {
  normalizeQuestionValidation,
  type QuestionCategoryKey,
  type QuestionFeedbackItem,
  type QuestionThinkingType,
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
  inference: string[];
}

interface QuestionsPageContentProps {
  book: Book;
  language: string;
  userId: string;
  initialActivity: Activity | null;
  existingLog: ChatLog | null;
  requiredQuestionCount: number;
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'content', icon: '📖', title: '내용이해', helper: '이야기에 있던 일을 묻는 질문을 만들어 보세요', max: 3 },
  { key: 'character', icon: '👤', title: '인물이해', helper: '등장인물의 마음, 성격, 관계, 변화를 묻는 질문을 만들어 보세요', max: 3 },
  { key: 'world', icon: '🌍', title: '배경이해', helper: '시간, 장소, 문화적 배경과 이야기의 연결을 묻는 질문을 만들어 보세요', max: 3 },
  { key: 'inference', icon: '💡', title: '추론', helper: '글에 직접 쓰이지 않은 것을 상상하거나 생각해 보는 질문을 만들어 보세요', max: 2 },
];

const EXAMPLE_PLACEHOLDERS: Record<CategoryKey, string> = {
  content: '예) 주인공은 왜 여행을 떠났나요?',
  character: '예) 주인공의 마음은 어떻게 변했나요?',
  world: '예) 이 이야기의 배경이 되는 나라는 어떤 곳인가요?',
  inference: '예) 주인공이 다른 선택을 했다면 어떻게 됐을까?',
};

const THINKING_TYPE_LABELS: Record<QuestionThinkingType, string> = {
  fact: '보이는 것',
  inference: '짐작',
  feeling: '생각/느낌',
  application: '바꾸면?',
  unknown: '질문 다듬기',
};

const THINKING_TYPE_BADGE_CLASS: Record<QuestionThinkingType, string> = {
  fact: 'bg-sky-100 text-sky-700',
  inference: 'bg-violet-100 text-violet-700',
  feeling: 'bg-rose-100 text-rose-700',
  application: 'bg-amber-100 text-amber-700',
  unknown: 'bg-slate-100 text-slate-700',
};

function clearValidationForQuestion(
  current: QuestionValidationResult,
  category: CategoryKey,
  index: number,
): QuestionValidationResult {
  const updatedCategory = current[category];
  const invalidIndices = updatedCategory.invalidIndices.filter((item) => item !== index);
  const questionFeedback = updatedCategory.questionFeedback.filter((item) => item.index !== index);

  const next = {
    ...current,
    [category]: {
      ...updatedCategory,
      valid: invalidIndices.length === 0,
      invalidIndices,
      questionFeedback,
      feedback: invalidIndices.length === 0
        ? '수정한 질문은 다시 제출하면 확인해 줄게.'
        : updatedCategory.feedback,
    },
  };

  const overall = CATEGORIES.every((item) => next[item.key].valid);

  return {
    ...next,
    overall,
    overallFeedback: overall
      ? '수정한 질문을 다시 확인할 준비가 됐어.'
      : '좋은 질문 씨앗이 보여. 힌트를 보고 한 문장씩 더 또렷하게 바꿔 보자.',
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
  const supabase = useMemo(() => createClient(), []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logIdRef = useRef<string | null>(existingLog?.id ?? null);
  const latestQuestionsRef = useRef<QuestionsData | null>(null);
  const saveQuestionsRef = useRef<((data: QuestionsData) => Promise<void>) | null>(null);
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
    inference: Array.from({ length: requiredByCategory.inference }, () => ''),
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
          inference: pad(parsed.inference, requiredByCategory.inference),
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<QuestionValidationResult | null>(parseExistingFeedback);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [showFeedbackScreen, setShowFeedbackScreen] = useState(false);

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
    async (data: QuestionsData) => {
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
          await supabase.from('chat_logs').update({ messages: chatMessages }).eq('id', logIdRef.current);
        } else {
          const { data: inserted } = await supabase
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
            .single();

          if (inserted) {
            logIdRef.current = inserted.id;
          }
        }
      } catch (err) {
        console.error('Error saving questions:', err);
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
      setValidation((prev) => (prev ? clearValidationForQuestion(prev, category, index) : prev));
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
      setDirtyAfterValidation(true);
    }
  };

  const saveFeedbackToLog = async (result: QuestionValidationResult) => {
    if (!logIdRef.current) return;

    try {
      const { data: currentLog } = await supabase
        .from('chat_logs')
        .select('messages')
        .eq('id', logIdRef.current)
        .single();

      if (currentLog) {
        const feedbackMessage = {
          role: 'assistant',
          content: JSON.stringify(result),
          timestamp: new Date().toISOString(),
        };
        const baseMessages = (currentLog.messages as Array<{ role: string; content: string; timestamp: string }>)
          .filter((message) => !(message.role === 'assistant' && message.content.startsWith('{')));
        const updatedMessages = [...baseMessages, feedbackMessage];
        await supabase.from('chat_logs')
          .update({ messages: updatedMessages })
          .eq('id', logIdRef.current);
      }
    } catch (err) {
      console.error('Error saving feedback:', err);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || validating || completing) return;

    setValidating(true);
    setValidation(null);
    setDirtyAfterValidation(false);
    setErrorMessage(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [, res] = await Promise.all([
        saveQuestions(questions),
        fetch('/api/story/validate-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions,
            book_title: book.title,
            country_id: book.country_id,
          }),
          signal: controller.signal,
        }),
      ]);
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Validation request failed');

      const result = normalizeQuestionValidation(await res.json());
      setValidation(result);

      if (!result.overall) {
        setValidating(false);
        return;
      }

      setCompleting(true);

      await saveFeedbackToLog(result);
      setSavedFeedback(result);

      if (!stampAlreadyEarned) {
        const { data: existing } = await supabase
          .from('activities')
          .select('*')
          .eq('student_id', userId)
          .eq('book_id', book.id)
          .maybeSingle();

        if (existing) {
          const activity = existing as Activity;
          if (!(activity.stamps_earned as string[]).includes('questions')) {
            await supabase.from('activities').update({
              completed_tabs: [...activity.completed_tabs, 'questions'],
              stamps_earned: [...(activity.stamps_earned as string[]), 'questions'],
            }).eq('id', activity.id);
          }
        } else {
          await supabase.from('activities').insert({
            student_id: userId,
            book_id: book.id,
            country_id: book.country_id,
            language,
            completed_tabs: ['questions'],
            stamps_earned: ['questions'],
          });
        }

        setShowStampAnimation(true);
        setTimeout(() => {
          setShowStampAnimation(false);
          setShowFeedbackScreen(true);
          setValidating(false);
          setCompleting(false);
        }, 2500);
      } else {
        setShowFeedbackScreen(true);
        setValidating(false);
        setCompleting(false);
      }
    } catch (err) {
      console.error('Error:', err);
      setErrorMessage('질문 검증 중 오류가 발생했어요. 다시 시도해 주세요.');
      setValidating(false);
      setCompleting(false);
    }
  };

  const FeedbackCards = ({ feedback }: { feedback: QuestionValidationResult }) => (
    <div className="space-y-4">
      <div className={`rounded-2xl border px-4 py-4 ${
        feedback.overall
          ? 'border-blue-100 bg-blue-50/60'
          : 'border-amber-200 bg-amber-50'
      }`}>
        <p className="text-sm font-semibold text-foreground">{feedback.overallFeedback}</p>
        <p className="mt-1 text-xs text-muted">{feedback.nextStep}</p>
      </div>

      {CATEGORIES.map((category) => {
        const categoryResult = feedback[category.key];
        if (!categoryResult.feedback && categoryResult.questionFeedback.length === 0) return null;

        return (
          <div key={category.key} className={`border rounded-xl p-4 ${
            categoryResult.valid
              ? 'bg-blue-50/40 border-blue-100'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{category.icon}</span>
              <span className="font-bold text-sm text-foreground">{category.title}</span>
              <span className={`ml-auto rounded-full px-2 py-1 text-[11px] font-semibold ${
                categoryResult.valid
                  ? 'bg-white text-blue-700 border border-blue-100'
                  : 'bg-white text-red-600 border border-red-100'
              }`}>
                {categoryResult.valid ? '좋은 질문' : '다듬어 보기'}
              </span>
            </div>

            {categoryResult.feedback && (
              <p className="text-sm text-muted">{categoryResult.feedback}</p>
            )}

            {categoryResult.questionFeedback.length > 0 && (
              <div className="mt-3 space-y-2">
                {categoryResult.questionFeedback.map((item) => (
                  <div
                    key={`${category.key}-${item.index}`}
                    className="rounded-xl border border-white/80 bg-white/80 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {item.index + 1}번 질문
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${THINKING_TYPE_BADGE_CLASS[item.thinkingType]}`}>
                        {THINKING_TYPE_LABELS[item.thinkingType]}
                      </span>
                    </div>

                    {item.question && (
                      <p className="mt-2 text-sm font-medium text-foreground">{item.question}</p>
                    )}
                    {item.praise && (
                      <p className="mt-2 text-xs text-slate-700">좋은 점: {item.praise}</p>
                    )}
                    {item.problem && (
                      <p className="mt-1 text-xs text-red-600">더 또렷하게: {item.problem}</p>
                    )}
                    {item.hint && (
                      <p className="mt-1 text-xs text-muted">힌트: {item.hint}</p>
                    )}
                    {item.example && (
                      <p className="mt-1 text-xs text-foreground">예시: {item.example}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (showFeedbackScreen && validation) {
    return (
      <div className="flex flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-6"
        >
          <div className="text-center py-4">
            <div className="text-5xl mb-3">❓</div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              {stampAlreadyEarned ? '질문을 다시 만들었어요!' : '질문 만들기 스탬프 획득!'}
            </h2>
            <p className="text-sm text-muted">AI 선생님이 질문마다 피드백을 남겼어요</p>
          </div>

          <FeedbackCards feedback={validation} />

          <div className="flex justify-center pb-8">
            <BackToActivity bookId={book.id} language={language} />
          </div>
        </motion.div>
      </div>
    );
  }

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
                  className={`h-2 rounded-full bg-border overflow-hidden ${category.key === 'inference' ? 'w-12' : 'flex-1'}`}
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
        <section className="rounded-[24px] border border-[#dcc8ad] bg-[#fffaf1] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-[#8a5d2f]">QUESTION SEEDS</p>
              <h2 className="mt-2 text-lg font-bold text-foreground">
                질문 씨앗
              </h2>
              <p className="mt-1 text-sm text-[#6d573d]">
                읽기와 탐색 단계에서 모은 생각을 질문으로 이어갑니다
              </p>
            </div>
            <span className="rounded-full border border-[#dfcfb7] bg-white px-3 py-1 text-[11px] font-semibold text-[#8a5d2f]">
              {questionSeedCount}개 단서
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {readQuestionSeed && (
              <div className="rounded-2xl border border-[#e4d4be] bg-white px-4 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-[#fbf2e1] px-2.5 py-1 text-[11px] font-semibold text-[#8a5d2f]">
                    읽기
                  </span>
                  <span className="text-sm font-semibold text-foreground">더 알고 싶은 점</span>
                </div>
                <p className="text-sm text-[#4f3d28]">{readQuestionSeed}</p>
              </div>
            )}

            {exploreChallenges.length > 0 && (
              <div className="space-y-3">
                {exploreChallenges.map((note) => (
                  <div
                    key={note.content_id}
                    className="rounded-2xl border border-[#e4d4be] bg-white px-4 py-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-[#fbf2e1] px-2.5 py-1 text-[11px] font-semibold text-[#8a5d2f]">
                        탐색
                      </span>
                      <span className="text-sm font-semibold text-foreground">{note.content_title}</span>
                    </div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-[#8a5d2f]">자료 한 줄 정리</p>
                    <p className="mt-1 text-sm text-[#4f3d28]">{note.summary}</p>
                    <p className="mt-3 text-xs font-semibold tracking-[0.12em] text-[#8a5d2f]">새로 생긴 궁금증</p>
                    <p className="mt-1 text-sm text-[#4f3d28]">{note.curiosity}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
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

            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/80 border border-emerald-200 shadow-sm"
              >
                <span className="text-lg">✅</span>
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-700">스탬프를 획득했어요!</p>
                <p className="text-xs text-emerald-600/70 mt-0.5">질문 만들기를 완료했어요</p>
              </div>
              {savedFeedback && (
                <button
                  onClick={() => setShowSavedFeedback(!showSavedFeedback)}
                  className="shrink-0 text-xs px-3 py-1.5 bg-white/80 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-white hover:shadow-sm transition-all font-medium backdrop-blur-sm"
                >
                  {showSavedFeedback ? '피드백 숨기기' : 'AI 피드백 보기'}
                </button>
              )}
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
        <div className="px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <p className="text-sm font-medium text-amber-800">{validation.overallFeedback}</p>
          <div className="space-y-1">
            {CATEGORIES.map((category) => {
              const categoryResult = validation[category.key];
              if (categoryResult.valid || !categoryResult.feedback) return null;

              return (
                <p key={category.key} className="text-sm text-amber-700">
                  <span className="font-medium">{category.icon} {category.title}:</span> {categoryResult.feedback}
                </p>
              );
            })}
          </div>
          <p className="text-xs text-amber-700/80">질문은 지우지 않았어요. 힌트를 보고 같은 자리에서 다듬어 보세요.</p>
          <p className="text-xs text-amber-700/80">{validation.nextStep}</p>
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

                return (
                  <div key={questionIndex} className="flex items-start gap-2">
                    <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0 text-center">
                      {questionIndex + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <input
                          type="text"
                          value={question}
                          onChange={(e) => handleQuestionChange(category.key, questionIndex, e.target.value)}
                          readOnly={isReadOnly}
                          placeholder={questionIndex === 0
                            ? EXAMPLE_PLACEHOLDERS[category.key]
                            : `${category.title}에 대한 질문을 입력하세요...`}
                          className={`flex-1 px-3 py-2 border rounded-lg text-sm text-foreground placeholder:text-muted/60 focus:outline-none transition-all ${
                            isReadOnly
                              ? 'bg-gray-50 border-border cursor-default'
                              : isInvalid
                                ? 'border-amber-400 focus:ring-2 focus:ring-amber-200 focus:border-amber-400 bg-amber-50'
                                : 'bg-white border-border focus:ring-2 focus:ring-primary/30 focus:border-primary'
                          }`}
                        />
                        {!isReadOnly && (questions[category.key] ?? []).length > requiredByCategory[category.key] && (
                          <button
                            onClick={() => handleRemoveQuestion(category.key, questionIndex)}
                            className="mt-1.5 p-1 text-muted hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {showInlineCoach && questionFeedback && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${THINKING_TYPE_BADGE_CLASS[questionFeedback.thinkingType]}`}>
                              {THINKING_TYPE_LABELS[questionFeedback.thinkingType]}
                            </span>
                          </div>
                          {questionFeedback.praise && (
                            <p className="mt-2 text-xs text-slate-700">좋은 점: {questionFeedback.praise}</p>
                          )}
                          {questionFeedback.problem && (
                            <p className="mt-1 text-xs text-amber-900">더 또렷하게: {questionFeedback.problem}</p>
                          )}
                          {questionFeedback.hint && (
                            <p className="mt-1 text-xs text-amber-800/90">힌트: {questionFeedback.hint}</p>
                          )}
                          {questionFeedback.example && (
                            <p className="mt-1 text-xs text-foreground">예시: {questionFeedback.example}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!isReadOnly && (questions[category.key] ?? []).length < category.max && (
              <button
                onClick={() => handleAddQuestion(category.key)}
                className="mt-3 text-sm text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1"
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
                    <span>완료하기</span>
                  </>
                )}
              </motion.button>
            )}
            {!allMinMet && (
              <p className="text-center text-xs text-muted mt-2">
                내용 {requiredByCategory.content}개, 인물 {requiredByCategory.character}개, 배경 {requiredByCategory.world}개, 추론 {requiredByCategory.inference}개를 작성하면 제출할 수 있어요
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
              initial={{ scale: 4, opacity: 0, rotate: -25 }}
              animate={{ scale: 1, opacity: 1, rotate: -14 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 250, damping: 18 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="w-32 h-32 rounded-full border-[4px] border-red-700/80 bg-white/95 flex items-center justify-center relative shadow-xl">
                <div className="absolute inset-[5px] rounded-full border-[2px] border-red-700/50" />
                <div className="flex flex-col items-center z-10">
                  <span className="text-red-700/80 text-[9px] font-bold tracking-[0.18em] uppercase leading-none">WORLD STORY</span>
                  <span className="text-red-700 text-2xl font-black tracking-[0.1em] uppercase leading-tight mt-1">SUCCESS</span>
                  <span className="text-red-700/70 text-[8px] font-semibold tracking-[0.25em] uppercase leading-none mt-0.5">APPROVED</span>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center rotate-[14deg]"
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
