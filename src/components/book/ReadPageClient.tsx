'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(() => import('./PdfViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ minHeight: '500px' }}>
      <div className="w-8 h-8 border-3 border-muted-light border-t-primary rounded-full animate-spin" />
    </div>
  ),
});
import EmotionPicker from '@/components/book/EmotionPicker';
import StampAnimation from '@/components/book/StampAnimation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Book, Activity, Language } from '@/types/database';

interface ReadPageClientProps {
  book: Book;
  pdfUrl: string | null;
  language: string;
}

type ReadPhase = 'reading' | 'emotion' | 'stamp';

export default function ReadPageClient({
  book,
  pdfUrl,
  language,
}: ReadPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState<ReadPhase>('reading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStamp, setShowStamp] = useState(false);

  const handleLastPage = useCallback(() => {
    setPhase('emotion');
  }, []);

  const handleEmotionSubmit = useCallback(
    async (emotion: string, oneLine: string) => {
      if (!user) return;
      setIsSubmitting(true);

      try {
        const supabase = createClient();

        // Check for existing activity
        const { data: existing } = await supabase
          .from('activities')
          .select('*')
          .eq('student_id', user.id)
          .eq('book_id', book.id)
          .single();

        if (existing) {
          const activity = existing as Activity;
          const completedTabs = activity.completed_tabs.includes('read')
            ? activity.completed_tabs
            : [...activity.completed_tabs, 'read'];
          const stampsEarned = activity.stamps_earned.includes('read')
            ? activity.stamps_earned
            : [...activity.stamps_earned, 'read'];

          await supabase
            .from('activities')
            .update({
              emotion,
              one_line: oneLine,
              language: language as Language,
              completed_tabs: completedTabs,
              stamps_earned: stampsEarned,
            })
            .eq('id', activity.id);
        } else {
          await supabase.from('activities').insert({
            student_id: user.id,
            book_id: book.id,
            country_id: book.country_id,
            language: language as Language,
            emotion,
            one_line: oneLine,
            completed_tabs: ['read'],
            stamps_earned: ['read'],
          });
        }

        // Show stamp animation
        setPhase('stamp');
        setShowStamp(true);
      } catch (error) {
        console.error('Failed to save reading:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, book.id, book.country_id, language]
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
      {/* Page title */}
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
          {book.title}
        </h1>
        <p className="text-sm text-muted">
          {language === 'en' ? 'English' : '한국어'}로 읽기
        </p>
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
            <PdfViewer pdfUrl={pdfUrl} onLastPage={handleLastPage} />

            {/* Manual skip to emotion (for testing or if PDF is short) */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setPhase('emotion')}
                className="text-sm text-muted hover:text-primary transition-colors underline"
              >
                읽기를 완료했어요 &#8594;
              </button>
            </div>
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
