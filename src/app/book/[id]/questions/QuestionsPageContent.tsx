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

const MIN_QUESTIONS = 3; // for main categories
const MAX_QUESTIONS = 5;

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

  const parseExistingQuestions = useCallback((): QuestionsData => {
    const empty = { content: ['', ''], character: ['', ''], world: ['', ''], inference: [''] };
    if (!existingLog?.messages) return empty;

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
    return empty;
  }, [existingLog]);

  const [questions, setQuestions] = useState<QuestionsData>(parseExistingQuestions);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showStampAnimation, setShowStampAnimation] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Track which fields were cleared by validation — they must be re-filled to re-enable submit
  const [dirtyAfterValidation, setDirtyAfterValidation] = useState(false);

  const stampAlreadyEarned = initialActivity?.stamps_earned?.includes('questions') ?? false;

  // Count filled questions per category
  const filledPerCategory = CATEGORIES.map((cat) =>
    (questions[cat.key] ?? []).filter((q) => q.trim().length > 0).length
  );
  const totalFilled = filledPerCategory.reduce((a, b) => a + b, 0);
  const allMinMet = CATEGORIES.every((cat, idx) => filledPerCategory[idx] >= cat.min);

  // Submit is disabled if:
  // 1. Not all categories have minimum questions
  // 2. Validation failed and user hasn't re-filled the cleared fields
  // 3. Already earned stamp
  const canSubmit = allMinMet && !stampAlreadyEarned && (!validation || validation.overall || dirtyAfterValidation);

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

  const debouncedSave = useCallback(
    (data: QuestionsData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void saveQuestions(data), 1000);
    },
    [saveQuestions]
  );

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const handleQuestionChange = (category: CategoryKey, index: number, value: string) => {
    setQuestions((prev) => {
      const updated = { ...prev, [category]: [...prev[category]] };
      updated[category][index] = value;
      debouncedSave(updated);
      return updated;
    });
    // If validation failed previously, mark as dirty so submit can re-enable
    if (validation && !validation.overall) {
      setDirtyAfterValidation(true);
    }
  };

  const handleAddQuestion = (category: CategoryKey) => {
    const cat = CATEGORIES.find(c => c.key === category);
    if (!cat) return;
    setQuestions((prev) => {
      if (prev[category].length >= cat.max) return prev;
      return { ...prev, [category]: [...prev[category], ''] };
    });
  };

  const handleRemoveQuestion = (category: CategoryKey, index: number) => {
    const cat = CATEGORIES.find(c => c.key === category);
    if (!cat) return;
    setQuestions((prev) => {
      if (prev[category].length <= cat.min) return prev;
      const updated = { ...prev, [category]: prev[category].filter((_, i) => i !== index) };
      debouncedSave(updated);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit || validating || completing) return;
    setValidating(true);
    setValidation(null);
    setDirtyAfterValidation(false);

    try {
      // Save and validate in parallel (save is fire-and-forget)
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
        // Clear invalid question fields
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
          return updated;
        });
        setValidating(false);
        return;
      }

      // Validation passed — complete
      setCompleting(true);
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
        router.push(`/book/${book.id}/activity?lang=${language}`);
      }, 2500);
    } catch (err) {
      console.error('Error:', err);
      setValidating(false);
      setCompleting(false);
    }
  };

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
          ← 돌아가기
        </button>
      </div>

      {/* Progress */}
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

      {/* Already earned */}
      {stampAlreadyEarned && (
        <div className="px-4 py-2 bg-success/10 border border-success/30 rounded-xl text-sm text-success font-medium flex items-center gap-2">
          <span>❓</span><span>질문 만들기 스탬프를 이미 획득했어요!</span>
        </div>
      )}

      {/* Validation feedback */}
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
                      placeholder={`${cat.title}에 대한 질문을 입력하세요...`}
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm text-foreground bg-white placeholder:text-muted/60
                        focus:outline-none focus:ring-2 transition-all
                        ${isInvalid
                          ? 'border-red-400 focus:ring-red-300 focus:border-red-400 bg-red-50'
                          : 'border-border focus:ring-primary/30 focus:border-primary'}`}
                    />
                    {(questions[cat.key] ?? []).length > cat.min && (
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

            {(questions[cat.key] ?? []).length < cat.max && (
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

      {/* Submit */}
      <div className="pb-8">
        {!stampAlreadyEarned && (
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
        )}
      </div>

      {/* Stamp Animation */}
      <AnimatePresence>
        {showStampAnimation && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="bg-white rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="text-6xl mb-4">❓</div>
              <h2 className="text-xl font-bold text-foreground mb-2">질문 만들기 스탬프 획득!</h2>
              <p className="text-sm text-muted">멋진 질문을 만들었어요</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
