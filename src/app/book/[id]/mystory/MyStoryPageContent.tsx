'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StoryTypeSelector from '@/components/story/StoryTypeSelector';
import GaugeChatInterface from '@/components/story/GaugeChatInterface';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Book, StoryType } from '@/types/database';

interface StorySelection {
  type: StoryType;
  customInput?: string;
}

interface MyStoryPageContentProps {
  book: Book;
  bookId: string;
  language: 'ko' | 'en';
}

function getStorySummary(analysis: Record<string, unknown> | null): string {
  if (!analysis) return '';
  const summary = analysis.story_summary ?? analysis.summary;
  return typeof summary === 'string' ? summary : '';
}

function getCharacterText(analysis: Record<string, unknown> | null): string {
  if (!analysis) return '';

  const characters = analysis.characters;
  if (typeof characters === 'string') return characters;
  if (!Array.isArray(characters)) return '';

  return characters
    .map((character) => {
      if (!character || typeof character !== 'object') {
        return String(character);
      }

      const entry = character as Record<string, unknown>;
      const parts = [
        typeof entry.name === 'string' ? entry.name : '',
        typeof entry.role === 'string' ? entry.role : '',
        typeof entry.profile_prompt === 'string' ? entry.profile_prompt : '',
        typeof entry.background === 'string' ? entry.background : '',
      ].filter(Boolean);

      return parts.join(' - ');
    })
    .filter(Boolean)
    .join('\n');
}

export default function MyStoryPageContent({
  book,
  bookId,
  language,
}: MyStoryPageContentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<StorySelection | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleTypeSelect = (type: StoryType, customInput?: string) => {
    setSelection({ type, customInput });
    setStep(2);
  };

  const handleGaugeSubmit = async (data: {
    messages: { role: string; content: string }[];
    allStudentMessages: string;
    gaugeFinal: number;
  }) => {
    if (!user) return;
    setSubmitting(true);

    try {
      const analysis = (book.character_analysis ?? {}) as Record<string, unknown>;
      const storySummary = getStorySummary(analysis);
      const charactersText = getCharacterText(analysis);

      const draftRes = await fetch('/api/story/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          story_type: selection!.type,
          custom_input: selection!.customInput,
          book_title: book.title,
          country: book.country_id,
          story_summary: storySummary,
          characters: charactersText,
          all_student_messages: data.allStudentMessages,
          language,
        }),
      });
      const draftData = await draftRes.json();

      if (!draftRes.ok) {
        throw new Error(draftData.error || '이야기 초안 생성에 실패했습니다.');
      }

      const pages = draftData.pages;
      if (!Array.isArray(pages) || pages.length === 0) {
        throw new Error('이야기 초안이 비어 있습니다.');
      }

      const supabase = createClient();
      const { data: storyData, error } = await supabase
        .from('stories')
        .insert({
          student_id: user.id,
          book_id: bookId,
          country_id: book.country_id,
          language,
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

      router.push(`/book/${bookId}/mystory/write?storyId=${storyData.id}&lang=${language}`);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitting(false);
    }
  };

  return (
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
                storySummary={getStorySummary((book.character_analysis ?? {}) as Record<string, unknown>)}
                characters={getCharacterText((book.character_analysis ?? {}) as Record<string, unknown>)}
                language={language}
                onSubmit={handleGaugeSubmit}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </main>
  );
}
