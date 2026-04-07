'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StoryTypeSelector from '@/components/story/StoryTypeSelector';
import GaugeChatInterface from '@/components/story/GaugeChatInterface';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { StoryType, Book } from '@/types/database';

interface StorySelection {
  type: StoryType;
  customInput?: string;
}

export default function MyStoryPage() {
  const params = useParams();
  const bookId = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<StorySelection | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();
      if (data) setBook(data as Book);
      setLoading(false);
    };
    fetchBook();
  }, [bookId]);

  const handleTypeSelect = (type: StoryType, customInput?: string) => {
    setSelection({ type, customInput });
    setStep(2);
  };

  const handleGaugeSubmit = async (data: {
    messages: { role: string; content: string }[];
    allStudentMessages: string;
    gaugeFinal: number;
  }) => {
    if (!user || !book) return;
    setSubmitting(true);

    try {
      // Generate draft
      const draftRes = await fetch('/api/story/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_type: selection!.type,
          custom_input: selection!.customInput,
          book_title: book.title,
          country: book.country_id,
          story_summary: (book.character_analysis as Record<string, string>)?.summary || '',
          characters: (book.character_analysis as Record<string, string>)?.characters || '',
          all_student_messages: data.allStudentMessages,
          language: 'ko',
        }),
      });
      const { pages } = await draftRes.json();

      // Create story record
      const supabase = createClient();
      const { data: storyData, error } = await supabase
        .from('stories')
        .insert({
          student_id: user.id,
          book_id: bookId,
          country_id: book.country_id,
          language: 'ko',
          story_type: selection!.type,
          custom_input: selection!.customInput || null,
          chat_log: { messages: data.messages },
          all_student_messages: data.allStudentMessages,
          gauge_final: data.gaugeFinal,
          ai_draft: pages,
          visibility: 'public',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Navigate to write page with story ID
      router.push(`/book/${bookId}/mystory/write?storyId=${storyData.id}`);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="로딩 중..." />
        </main>
      </>
    );
  }

  if (!book) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted">책을 찾을 수 없습니다.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-6">
        {submitting ? (
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner size="lg" message="이야기 초안을 만들고 있어요..." />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="py-8"
              >
                <StoryTypeSelector onSelect={handleTypeSelect} />
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-muted hover:text-foreground transition-colors"
                  >
                    &larr; 유형 다시 선택
                  </button>
                  <span className="text-xs text-muted px-2 py-1 bg-muted-light rounded-full">
                    {selection?.type === 'custom'
                      ? `기타: ${selection?.customInput}`
                      : ({ continue: '이야기 이어쓰기', new_protagonist: '주인공으로 새 이야기', extra_backstory: '엑스트라 뒷이야기', change_ending: '결말 바꾸기' } as Record<string, string>)[selection?.type || ''] || selection?.type}
                  </span>
                </div>
                <GaugeChatInterface
                  storyType={selection!.type}
                  customInput={selection!.customInput}
                  bookTitle={book.title}
                  country={book.country_id}
                  storySummary={
                    (book.character_analysis as Record<string, string>)?.summary || ''
                  }
                  characters={
                    (book.character_analysis as Record<string, string>)?.characters || ''
                  }
                  language="ko"
                  onSubmit={handleGaugeSubmit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </>
  );
}
