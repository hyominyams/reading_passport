'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const PictureBookViewer = dynamic(() => import('./PictureBookViewer'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-center rounded-[28px] border border-[#d9c7ae] bg-[linear-gradient(180deg,#fbf6ec_0%,#efe1ca_100%)] p-4 shadow-[0_28px_90px_rgba(94,63,34,0.16)]" style={{ minHeight: '500px' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#d9c7ae] border-t-[#8c5d35] rounded-full animate-spin" />
        <p className="text-xs text-[#8f7759]">책을 펼치는 중...</p>
      </div>
    </div>
  ),
});
import EmotionPicker from '@/components/book/EmotionPicker';
import StampAnimation from '@/components/book/StampAnimation';
import { useAuth } from '@/hooks/useAuth';
import BackToActivity from '@/components/book/BackToActivity';
import type { Book, Activity } from '@/types/database';

interface ReadPageClientProps {
  book: Book;
  pdfUrl: string | null;
  language: string;
  initialActivity: Activity | null;
}

type ReadPhase = 'reading' | 'emotion' | 'stamp';

export default function ReadPageClient({
  book,
  pdfUrl,
  language,
  initialActivity,
}: ReadPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState<ReadPhase>('reading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleLastPage = useCallback(() => {
    setPhase('emotion');
  }, []);

  const handleEmotionSubmit = useCallback(
    async (emotion: string, oneLine: string, questionSeed: string) => {
      if (!user) {
        setSaveError('로그인이 필요합니다.');
        return;
      }

      setIsSubmitting(true);
      setSaveError(null);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch('/api/activities/read-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: book.id,
            emotion,
            oneLine,
            questionSeed,
            language,
          }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({})) as {
          success?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? '읽기 기록을 저장하지 못했습니다.');
        }

        // Show stamp animation
        setPhase('stamp');
        setShowStamp(true);
      } catch (error) {
        console.error('Failed to save reading:', error);
        setSaveError(
          error instanceof DOMException && error.name === 'AbortError'
            ? '저장 시간이 길어지고 있어요. 다시 시도해 주세요.'
            : error instanceof Error && error.message
              ? error.message
              : '읽기 기록을 저장하지 못했습니다.'
        );
      } finally {
        window.clearTimeout(timeoutId);
        setIsSubmitting(false);
      }
    },
    [user, book.id, language]
  );

  const handleStampComplete = useCallback(() => {
    setShowStamp(false);
    router.push(`/book/${book.id}/activity?lang=${language}`);
  }, [router, book.id, language]);

  // No PDF available
  if (!pdfUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <span className="text-6xl">📄</span>
        <h2 className="text-xl font-bold text-foreground">
          PDF가 아직 준비되지 않았습니다
        </h2>
        <p className="text-muted text-center">
          {language === 'en'
            ? '영어 PDF가 아직 업로드되지 않았습니다.'
            : '한국어 PDF가 아직 업로드되지 않았습니다.'}
        </p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 rounded-xl bg-primary text-white font-medium
                     hover:bg-primary-dark transition-colors"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Back + Title */}
      <div className="flex w-full items-start gap-3">
        <div className="shrink-0 pt-1">
          <BackToActivity bookId={book.id} language={language} />
        </div>
        <div className="min-w-0 flex-1 text-center pr-[88px]">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 truncate">
            {book.title}
          </h1>
          <p className="text-sm text-muted">
            {language === 'en' ? 'English' : '한국어'}로 읽기
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'reading' && (
          <motion.div
            key="reading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full"
          >
            <PictureBookViewer
              key={pdfUrl}
              pdfUrl={pdfUrl}
              onLastPage={handleLastPage}
            />
          </motion.div>
        )}

        {phase === 'emotion' && (
          <motion.div
            key="emotion"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full py-8"
          >
            <EmotionPicker
              onSubmit={handleEmotionSubmit}
              isSubmitting={isSubmitting}
              initialEmotion={initialActivity?.emotion}
              initialOneLine={initialActivity?.one_line}
              initialQuestionSeed={initialActivity?.read_question_seed}
              errorMessage={saveError}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stamp animation overlay */}
      <StampAnimation
        show={showStamp}
        stampLabel="읽기 도장"
        onComplete={handleStampComplete}
      />
    </div>
  );
}
