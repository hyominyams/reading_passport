'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { Book, Activity, ChatLog } from '@/types/database';

type CategoryKey = 'content' | 'character' | 'world' | 'inference';

interface CategoryConfig {
  key: CategoryKey;
  icon: string;
  title: string;
  helper: string;
  min: number;
  max: number;
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'content', icon: '📖', title: '내용이해', helper: '이야기에 있던 일을 묻는 질문을 만들어 보세요', min: 2, max: 3 },
  { key: 'character', icon: '👤', title: '인물이해', helper: '등장인물의 마음, 성격, 관계, 변화를 묻는 질문을 만들어 보세요', min: 2, max: 3 },
  { key: 'world', icon: '🌍', title: '배경이해', helper: '시간, 장소, 문화적 배경과 이야기의 연결을 묻는 질문을 만들어 보세요', min: 2, max: 3 },
  { key: 'inference', icon: '💡', title: '추론', helper: '글에 직접 쓰이지 않은 것을 상상하거나 생각해 보는 질문을 만들어 보세요', min: 1, max: 2 },
];

const EXAMPLE_PLACEHOLDERS: Record<string, string> = {
  content: '예) 주인공은 왜 여행을 떠났나요?',
  character: '예) 주인공의 마음은 어떻게 변했나요?',
  world: '예) 이 이야기의 배경이 되는 나라는 어떤 곳인가요?',
  inference: '예) 주인공이 다른 선택을 했다면 어떻게 됐을까?',
};

const EMPTY_QUESTIONS: QuestionsData = { content: ['', ''], character: ['', ''], world: ['', ''], inference: [''] };

interface QuestionsData {
  content: string[];
  character: string[];
  world: string[];
  inference: string[];
}

interface CategoryValidation {
  valid: boolean;
  feedback: string;
  invalidIndices: number[];
}

interface ValidationResult {
  content: CategoryValidation;
  character: CategoryValidation;
  world: CategoryValidation;
  inference: CategoryValidation;
  overall: boolean;
}

interface QuestionsPageContentProps {
  book: Book;
  language: string;
  userId: string;
  initialActivity: Activity | null;
  existingLog: ChatLog | null;
}

export default function QuestionsPageContent({
  book,
  language,
  userId,
  initialActivity,
  existingLog,
}: QuestionsPageContentProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logIdRef = useRef<string | null>(existingLog?.id ?? null);
  const latestQuestionsRef = useRef<QuestionsData | null>(null);
  const saveQuestionsRef = useRef<((data: QuestionsData) => Promise<void>) | null>(null);

  const parseExistingQuestions = useCallback((): QuestionsData => {
    if (!existingLog?.messages) return EMPTY_QUESTIONS;

    const dataMsg = existingLog.messages.find(
      (m) => m.role === 'system' && m.content.startsWith('{')
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
          content: pad(parsed.content, 2),
          character: pad(parsed.character, 2),
          world: pad(parsed.world, 2),
          inference: pad(parsed.inference, 1),
        };
      } catch { /* fall through */ }
    }
    return EMPTY_QUESTIONS;
  }, [existingLog]);

  const parseExistingFeedback = useCallback((): ValidationResult | null => {
    if (!existingLog?.messages) return null;
    const feedbackMsg = [...existingLog.messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.content.startsWith('{'));
    if (!feedbackMsg) return null;
    try {
      return JSON.parse(feedbackMsg.content) as ValidationResult;
    } catch {
      return null;
    }
  }, [existingLog]);

  const [questions, setQuestions] = useState<QuestionsData>(parseExistingQuestions);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showStampAnimation, setShowStampAnimation] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dirtyAfterValidation, setDirtyAfterValidation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<ValidationResult | null>(parseExistingFeedback);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [isRecreating, setIsRecreating] = useState(false);
  const [showFeedbackScreen, setShowFeedbackScreen] = useState(false);

  const stampAlreadyEarned = initialActivity?.stamps_earned?.includes('questions') ?? false;
  const isReadOnly = stampAlreadyEarned && !isRecreating;

  // Count filled questions per category
  const filledPerCategory = CATEGORIES.map((cat) =>
    (questions[cat.key] ?? []).filter((q) => q.trim().length > 0).length
  );
  const totalFilled = filledPerCategory.reduce((a, b) => a + b, 0);
  const allMinMet = CATEGORIES.every((cat, idx) => filledPerCategory[idx] >= cat.min);

  const canSubmit = allMinMet && (!stampAlreadyEarned || isRecreating) && (!validation || validation.overall || dirtyAfterValidation);

  // Auto-save
  const saveQuestions = useCallback(
    async (data: QuestionsData) => {
      try {
        const chatMessages = [
          { role: 'system', content: JSON.stringify(data), timestamp: new Date().toISOString() },
          ...CATEGORIES.flatMap((cat) =>
            data[cat.key]
              .filter((q) => q.trim().length > 0)
              .map((q) => ({ role: 'user', content: `[${cat.title}] ${q}`, timestamp: new Date().toISOString() }))
          ),
        ];

        if (logIdRef.current) {
          await supabase.from('chat_logs').update({ messages: chatMessages }).eq('id', logIdRef.current);
        } else {
          const { data: inserted } = await supabase
            .from('chat_logs')
            .insert({
              student_id: userId, book_id: book.id,
              character_id: null, character_name: null,
              chat_type: 'questions', messages: chatMessages,
              language, flagged: false,
            })
            .select('id').single();
          if (inserted) logIdRef.current = inserted.id;
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

  // Flush pending save on unmount so questions persist when navigating away
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
    if (validation && !validation.overall) {
      setDirtyAfterValidation(true);
    }
  };

  const handleAddQuestion = (category: CategoryKey) => {
    if (isReadOnly) return;
    const cat = CATEGORIES.find(c => c.key === category);
    if (!cat) return;
    setQuestions((prev) => {
      if (prev[category].length >= cat.max) return prev;
      const updated = { ...prev, [category]: [...prev[category], ''] };
      debouncedSave(updated);
      return updated;
    });
  };

  const handleRemoveQuestion = (category: CategoryKey, index: number) => {
    if (isReadOnly) return;
    const cat = CATEGORIES.find(c => c.key === category);
    if (!cat) return;
    setQuestions((prev) => {
      if (prev[category].length <= cat.min) return prev;
      const updated = { ...prev, [category]: prev[category].filter((_, i) => i !== index) };
      debouncedSave(updated);
      return updated;
    });
  };

  const handleRecreate = () => {
    const resetQuestions = { content: ['', ''], character: ['', ''], world: ['', ''], inference: [''] };
    setQuestions(resetQuestions);
    setValidation(null);
    setSavedFeedback(null);
    setShowSavedFeedback(false);
    setIsRecreating(true);
    setDirtyAfterValidation(false);
    setErrorMessage(null);
    setShowFeedbackScreen(false);
    logIdRef.current = null;
    debouncedSave(resetQuestions);
  };

  const saveFeedbackToLog = async (result: ValidationResult) => {
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
      const result = await res.json() as ValidationResult;
      setValidation(result);

      if (!result.overall) {
        setQuestions((prev) => {
          const updated = { ...prev };
          for (const cat of CATEGORIES) {
            const catResult = result[cat.key];
            if (catResult?.invalidIndices?.length) {
              updated[cat.key] = [...prev[cat.key]];
              for (const idx of catResult.invalidIndices) {
                if (idx < updated[cat.key].length) {
                  updated[cat.key][idx] = '';
                }
              }
            }
          }
          debouncedSave(updated);
          return updated;
        });
        setValidating(false);
        return;
      }

      // Validation passed
      setCompleting(true);

      // Save feedback to chat_log
      await saveFeedbackToLog(result);
      setSavedFeedback(result);

      // Award stamp only if not already earned
      if (!stampAlreadyEarned) {
        const { data: existing } = await supabase
          .from('activities').select('*')
          .eq('student_id', userId).eq('book_id', book.id).maybeSingle();

        if (existing) {
          const act = existing as Activity;
          if (!(act.stamps_earned as string[]).includes('questions')) {
            await supabase.from('activities').update({
              completed_tabs: [...act.completed_tabs, 'questions'],
              stamps_earned: [...(act.stamps_earned as string[]), 'questions'],
            }).eq('id', act.id);
          }
        } else {
          await supabase.from('activities').insert({
            student_id: userId, book_id: book.id, country_id: book.country_id,
            language, completed_tabs: ['questions'], stamps_earned: ['questions'],
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
        // Re-create mode: skip stamp, go straight to feedback
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

  // Feedback card component used in both success screen and saved feedback panel
  const FeedbackCards = ({ feedback }: { feedback: ValidationResult }) => (
    <div className="space-y-3">
      {CATEGORIES.map((cat) => {
        const catResult = feedback[cat.key];
        if (!catResult?.feedback) return null;
        return (
          <div key={cat.key} className={`border rounded-xl p-4 ${
            catResult.valid
              ? 'bg-blue-50/50 border-blue-100'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{cat.icon}</span>
              <span className="font-bold text-sm text-foreground">{cat.title}</span>
              {catResult.valid && <span className="text-success ml-auto text-sm">✓</span>}
            </div>
            <p className="text-sm text-muted">{catResult.feedback}</p>
          </div>
        );
      })}
    </div>
  );

  // --- Feedback screen after successful submission ---
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
            <p className="text-sm text-muted">AI 선생님의 피드백이에요</p>
          </div>

          <FeedbackCards feedback={validation} />

          <div className="flex gap-3 pb-8">
            <button
              onClick={() => router.push(`/book/${book.id}/activity?lang=${language}`)}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-sm"
            >
              활동 페이지로 돌아가기
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>❓</span> 질문 만들기
          </h1>
          <p className="text-sm text-muted mt-1">
            {book.title} — 책에 대한 질문을 만들어 보세요
          </p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-foreground transition-colors">
          돌아가기
        </button>
      </div>

      {/* Progress */}
      {!isReadOnly && (
        <div className="flex items-center gap-2 px-4 py-3 bg-card border border-border rounded-xl">
          <span className="text-sm font-medium text-foreground">진행 상황</span>
          <div className="flex-1 flex gap-1.5">
            {CATEGORIES.map((cat, idx) => {
              const pct = (filledPerCategory[idx] / cat.min) * 100;
              return (
                <div key={cat.key} className={`h-2 rounded-full bg-border overflow-hidden ${cat.key === 'inference' ? 'w-12' : 'flex-1'}`}>
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              );
            })}
          </div>
          <span className="text-sm text-muted">{totalFilled}/7 질문 작성</span>
        </div>
      )}

      {/* Already earned banner + feedback toggle */}
      {stampAlreadyEarned && !isRecreating && (
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 px-5 py-4"
          >
            {/* Sparkle decorations */}
            <div className="pointer-events-none absolute inset-0">
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-2 right-8 w-2 h-2 bg-yellow-400 rounded-full"
              />
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.3, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-4 right-20 w-1.5 h-1.5 bg-emerald-400 rounded-full"
              />
              <motion.div
                animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-3 right-14 w-1.5 h-1.5 bg-yellow-300 rounded-full"
              />
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.2, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                className="absolute top-3 left-[60%] w-1 h-1 bg-teal-400 rounded-full"
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
                  className="shrink-0 text-xs px-3 py-1.5 bg-white/80 border border-emerald-200 text-emerald-700 rounded-lg
                    hover:bg-white hover:shadow-sm transition-all font-medium backdrop-blur-sm"
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

      {/* Validation feedback (when failed) */}
      {validation && !validation.overall && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
          <p className="text-sm font-medium text-red-700">일부 질문을 수정해야 해요:</p>
          {CATEGORIES.map((cat) => {
            const catResult = validation[cat.key];
            if (catResult.valid || !catResult.feedback) return null;
            return (
              <p key={cat.key} className="text-sm text-red-600">
                <span className="font-medium">{cat.icon} {cat.title}:</span> {catResult.feedback}
              </p>
            );
          })}
          <p className="text-xs text-red-500 mt-1">빨간색으로 표시된 질문을 다시 작성한 후 제출해 주세요.</p>
        </div>
      )}

      {/* Question categories */}
      {CATEGORIES.map((cat, catIndex) => {
        const catValidation = validation?.[cat.key];
        const invalidSet = new Set(catValidation?.invalidIndices ?? []);

        return (
          <motion.div
            key={cat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.1, duration: 0.3 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{cat.icon}</span>
              <h2 className="text-lg font-bold text-foreground">{cat.title}</h2>
              <span className="ml-auto text-xs text-muted">
                {filledPerCategory[catIndex]}/{(questions[cat.key] ?? []).length}
              </span>
            </div>
            <p className="text-sm text-muted mb-4">{cat.helper}</p>

            <div className="space-y-3">
              {(questions[cat.key] ?? []).map((q, qIndex) => {
                const isInvalid = invalidSet.has(qIndex);
                return (
                  <div key={qIndex} className="flex items-start gap-2">
                    <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0 text-center">
                      {qIndex + 1}
                    </span>
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => handleQuestionChange(cat.key, qIndex, e.target.value)}
                      readOnly={isReadOnly}
                      placeholder={qIndex === 0 ? EXAMPLE_PLACEHOLDERS[cat.key] : `${cat.title}에 대한 질문을 입력하세요...`}
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm text-foreground placeholder:text-muted/60
                        focus:outline-none transition-all
                        ${isReadOnly
                          ? 'bg-gray-50 border-border cursor-default'
                          : isInvalid
                            ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-red-50'
                            : 'bg-white border-border focus:ring-2 focus:ring-primary/30 focus:border-primary'}`}
                    />
                    {!isReadOnly && (questions[cat.key] ?? []).length > cat.min && (
                      <button
                        onClick={() => handleRemoveQuestion(cat.key, qIndex)}
                        className="mt-1.5 p-1 text-muted hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {!isReadOnly && (questions[cat.key] ?? []).length < cat.max && (
              <button
                onClick={() => handleAddQuestion(cat.key)}
                className="mt-3 text-sm text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                <span>+</span><span>질문 추가</span>
              </button>
            )}
          </motion.div>
        );
      })}

      {/* Error message */}
      {errorMessage && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          {errorMessage}
        </div>
      )}

      {/* Submit or Recreate */}
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
                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2
                  transition-all ${canSubmit
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                {completing ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>저장 중...</span></>
                ) : (
                  <><span>✅</span><span>완료하기</span></>
                )}
              </motion.button>
            )}
            {!allMinMet && (
              <p className="text-center text-xs text-muted mt-2">
                영역별 2개씩, 추론 1개 — 총 7개 질문을 작성하면 제출할 수 있어요
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
              className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-gray-200 text-gray-500 cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              <span>제출완료</span>
            </button>
          </div>
        )}
      </div>

      {/* Stamp Animation — passport style */}
      <AnimatePresence>
        {showStampAnimation && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <p className="text-base text-red-300 font-medium">질문 만들기</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
