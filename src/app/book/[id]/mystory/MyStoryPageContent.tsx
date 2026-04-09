'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import StoryTypeSelector from '@/components/story/StoryTypeSelector';
import { createClient } from '@/lib/supabase/client';
import type { Book, StoryType, GuideAnswers } from '@/types/database';

/* ── Guide question definitions ── */

interface GuideQuestion {
  key: keyof GuideAnswers;
  icon: string;
  label: string;
  question: string;
  example: string;
  placeholder: string;
}

const GUIDE_QUESTIONS: GuideQuestion[] = [
  {
    key: 'content',
    icon: '\uD83D\uDCD6', // book emoji
    label: '\uB0B4\uC6A9',
    question: '\uC774 \uC774\uC57C\uAE30\uC5D0\uC11C \uC5B4\uB5A4 \uBD80\uBD84\uC774 \uAC00\uC7A5 \uAE30\uC5B5\uC5D0 \uB0A8\uC558\uB098\uC694?',
    example: '\uC608\uC2DC: \uC8FC\uC778\uACF5\uC774 \uC6A9\uAE30\uB97C \uB0B4\uC5B4 \uCE5C\uAD6C\uB97C \uB3C4\uC640\uC8FC\uB294 \uC7A5\uBA74\uC774 \uAC00\uC7A5 \uAE30\uC5B5\uC5D0 \uB0A8\uC558\uC5B4\uC694.',
    placeholder: '\uAC00\uC7A5 \uAE30\uC5B5\uC5D0 \uB0A8\uB294 \uC7A5\uBA74\uC744 \uC801\uC5B4\uBCF4\uC138\uC694...',
  },
  {
    key: 'character',
    icon: '\uD83E\uDDD1\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1', // people holding hands emoji
    label: '\uC778\uBB3C',
    question: '\uB0B4 \uC774\uC57C\uAE30\uC5D0\uB294 \uB204\uAC00 \uB098\uC624\uB098\uC694? \uC5B4\uB5A4 \uC131\uACA9\uC778\uC9C0\uB3C4 \uC801\uC5B4\uBCF4\uC138\uC694.',
    example: '\uC608\uC2DC: \uC6A9\uAC10\uD55C \uC18C\uB140 \uC544\uB9AC\uC640 \uC7A5\uB09C\uAFB8\uB7EC\uAE30 \uC6D0\uC22D\uC774 \uB9C8\uC778\uB4DC\uAC00 \uB098\uC640\uC694.',
    placeholder: '\uB4F1\uC7A5\uC778\uBB3C\uACFC \uC131\uACA9\uC744 \uC801\uC5B4\uBCF4\uC138\uC694...',
  },
  {
    key: 'world',
    icon: '\uD83C\uDF0D', // globe emoji
    label: '\uC138\uACC4',
    question: '\uC774\uC57C\uAE30\uAC00 \uC5B4\uB514\uC5D0\uC11C \uC77C\uC5B4\uB098\uB098\uC694? \uADF8\uACF3\uC740 \uC5B4\uB5A4 \uACF3\uC778\uAC00\uC694?',
    example: '\uC608\uC2DC: \uB9D0\uD558\uB294 \uB3D9\uBB3C\uB4E4\uC774 \uC0AC\uB294 \uC2E0\uBE44\uB85C\uC6B4 \uC232 \uC18D \uB9C8\uC744\uC774\uC5D0\uC694.',
    placeholder: '\uC774\uC57C\uAE30\uC758 \uBC30\uACBD\uC744 \uC801\uC5B4\uBCF4\uC138\uC694...',
  },
];

/* ── Props ── */

interface MyStoryPageContentProps {
  book: Book;
  bookId: string;
  language: 'ko' | 'en';
  storyId: string;
  initialStoryType: StoryType;
  initialGuideAnswers: GuideAnswers | null;
}

/* ── Component ── */

export default function MyStoryPageContent({
  book,
  bookId,
  language,
  storyId,
  initialStoryType,
  initialGuideAnswers,
}: MyStoryPageContentProps) {
  const router = useRouter();

  // Phase: 'type' = selecting story type, 'questions' = answering guide questions
  const [phase, setPhase] = useState<'type' | 'questions'>(
    initialStoryType !== 'continue' || initialGuideAnswers ? 'questions' : 'type'
  );
  const [storyType, setStoryType] = useState<StoryType>(initialStoryType);
  const [customInput, setCustomInput] = useState<string | null>(null);

  const [answers, setAnswers] = useState<GuideAnswers>(
    initialGuideAnswers ?? { content: '', character: '', world: '' }
  );
  const [currentQuestion, setCurrentQuestion] = useState<number>(() => {
    if (!initialGuideAnswers) return 0;
    if (!initialGuideAnswers.character) return 1;
    if (!initialGuideAnswers.world) return 2;
    return 2;
  });

  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounced save ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Save answer to DB (debounced) ── */
  const saveAnswerToDB = useCallback(
    (updatedAnswers: GuideAnswers) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveError(null);

      saveTimerRef.current = setTimeout(async () => {
        try {
          const supabase = createClient();
          const { error } = await supabase
            .from('stories')
            .update({ guide_answers: updatedAnswers })
            .eq('id', storyId);

          if (error) {
            console.error('Failed to save guide answer:', error);
            setSaveError('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.');
          }
        } catch (err) {
          console.error('Save error:', err);
          setSaveError('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.');
        }
      }, 600);
    },
    [storyId]
  );

  /* ── Handle story type selection ── */
  const handleTypeSelect = async (type: StoryType, custom?: string) => {
    setSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({
          story_type: type,
          custom_input: custom ?? null,
        })
        .eq('id', storyId);

      if (error) throw error;

      setStoryType(type);
      setCustomInput(custom ?? null);
      setPhase('questions');
    } catch (err) {
      console.error('Type select error:', err);
      setSaveError('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.');
    }

    setSaving(false);
  };

  /* ── Handle answer change ── */
  const handleAnswerChange = (key: keyof GuideAnswers, value: string) => {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    saveAnswerToDB(updated);
  };

  /* ── Navigate between questions ── */
  const goToNextQuestion = () => {
    if (currentQuestion < GUIDE_QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const goToPrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  /* ── Navigate to step 2 ── */
  const handleProceed = async () => {
    setNavigating(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({
          guide_answers: answers,
          current_step: 2,
        })
        .eq('id', storyId);

      if (error) throw error;

      router.push(`/book/${bookId}/mystory/write?storyId=${storyId}&lang=${language}`);
    } catch (err) {
      console.error('Proceed error:', err);
      setSaveError('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.');
      setNavigating(false);
    }
  };

  const currentQ = GUIDE_QUESTIONS[currentQuestion];
  const currentAnswer = answers[currentQ.key];
  const allAnswered = answers.content.trim() !== '' && answers.character.trim() !== '' && answers.world.trim() !== '';

  /* ── Story type label ── */
  const typeLabels: Record<StoryType, string> = {
    continue: '\uC774\uC57C\uAE30 \uC774\uC5B4\uC4F0\uAE30',
    new_protagonist: '\uC8FC\uC778\uACF5\uC73C\uB85C \uC0C8 \uC774\uC57C\uAE30',
    extra_backstory: '\uC5D1\uC2A4\uD2B8\uB77C \uB4B7\uC774\uC57C\uAE30',
    change_ending: '\uACB0\uB9D0 \uBC14\uAFB8\uAE30',
    custom: '\uAE30\uD0C0',
  };

  return (
    <main className="flex-1 px-4 py-6">
      <AnimatePresence mode="wait">
        {phase === 'type' ? (
          <motion.div
            key="type-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="py-8"
          >
            {saving ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 rounded-full border-muted-light border-t-primary animate-spin" />
                  <p className="text-sm text-muted">\uC800\uC7A5 \uC911...</p>
                </div>
              </div>
            ) : (
              <StoryTypeSelector onSelect={handleTypeSelect} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="questions-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-2xl mx-auto py-6"
          >
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setPhase('type')}
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  &larr; \uC720\uD615 \uB2E4\uC2DC \uC120\uD0DD
                </button>
                <span className="text-xs text-muted px-2 py-1 bg-muted-light rounded-full">
                  {storyType === 'custom' && customInput
                    ? `\uAE30\uD0C0: ${customInput}`
                    : typeLabels[storyType]}
                </span>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-1">
                \uC9C8\uBB38 \uB9CC\uB4E4\uAE30
              </h1>
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{book.title}</span>
                \uC744(\uB97C) \uC77D\uACE0 \uB290\uB08C \uC810\uC744 \uC801\uC5B4\uBCF4\uC138\uC694.
                {' '}\uC774 \uB2F5\uBCC0\uC744 \uBC14\uD0D5\uC73C\uB85C \uB098\uB9CC\uC758 \uC774\uC57C\uAE30\uB97C \uB9CC\uB4E4\uC5B4\uC694!
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-6">
              {GUIDE_QUESTIONS.map((q, i) => (
                <button
                  key={q.key}
                  onClick={() => setCurrentQuestion(i)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${
                      i === currentQuestion
                        ? 'bg-foreground text-white'
                        : answers[q.key].trim()
                          ? 'bg-accent/10 text-accent border border-accent/30'
                          : 'bg-muted-light text-muted'
                    }
                  `}
                >
                  <span>{q.icon}</span>
                  <span>{q.label}</span>
                  {answers[q.key].trim() && i !== currentQuestion && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
              <span className="text-xs text-muted ml-auto">
                {currentQuestion + 1}/{GUIDE_QUESTIONS.length}
              </span>
            </div>

            {/* Question card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ.key}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
                className="bg-card border-2 border-border rounded-2xl p-6 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl leading-none">{currentQ.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {currentQ.question}
                    </h2>
                    <p className="text-xs text-muted mt-1">{currentQ.example}</p>
                  </div>
                </div>

                <textarea
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(currentQ.key, e.target.value)}
                  placeholder={currentQ.placeholder}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border bg-white focus:border-primary focus:outline-none text-foreground text-sm resize-none transition-colors placeholder:text-muted/50"
                />

                {/* Nav buttons */}
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={goToPrevQuestion}
                    disabled={currentQuestion === 0}
                    className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    &larr; \uC774\uC804
                  </button>

                  {currentQuestion < GUIDE_QUESTIONS.length - 1 ? (
                    <button
                      onClick={goToNextQuestion}
                      disabled={!currentAnswer.trim()}
                      className="px-5 py-2.5 bg-foreground text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      \uB2E4\uC74C &rarr;
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Error message */}
            {saveError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-error text-center mt-4"
              >
                {saveError}
              </motion.p>
            )}

            {/* Proceed button */}
            <div className="mt-8 flex justify-center">
              <motion.button
                whileHover={allAnswered ? { scale: 1.02 } : {}}
                whileTap={allAnswered ? { scale: 0.98 } : {}}
                onClick={handleProceed}
                disabled={!allAnswered || navigating}
                className="px-8 py-3.5 bg-primary text-white rounded-xl text-base font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {navigating ? '\uC800\uC7A5 \uC911...' : '\uC774\uC57C\uAE30 \uC4F0\uB7EC \uAC00\uAE30 \u2192'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
