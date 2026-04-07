'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BookPreview from '@/components/story/BookPreview';
import VisibilitySelector from '@/components/story/VisibilitySelector';
import ConfettiAnimation from '@/components/story/ConfettiAnimation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Story, Visibility } from '@/types/database';

export default function FinishPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = params.id as string;
  const storyId = searchParams.get('storyId');
  const { user, loading: authLoading } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [showConfetti, setShowConfetti] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedPages, setTranslatedPages] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const sourceLanguage = story?.language ?? 'ko';
  const targetLanguage = sourceLanguage === 'ko' ? 'en' : 'ko';
  const translateButtonLabel =
    targetLanguage === 'en' ? '영어로 번역하기' : '한국어로 번역하기';

  const handleDownloadPdf = (mode: 'original' | 'translated') => {
    if (!story?.final_text || !story?.scene_images) return;
    const pages = mode === 'translated' && translatedPages ? translatedPages : story.final_text;
    const title = mode === 'translated' ? 'My Story (Translated)' : 'My Story';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @media print {
            body { margin: 0; }
            .page-break { page-break-after: always; }
          }
          body { font-family: 'Noto Sans KR', sans-serif; padding: 40px; }
          .page { margin-bottom: 40px; text-align: center; }
          .page img { max-width: 100%; max-height: 400px; border-radius: 12px; margin-bottom: 16px; }
          .page p { font-size: 18px; line-height: 1.8; text-align: left; padding: 0 20px; }
          h1 { text-align: center; margin-bottom: 40px; color: #2563eb; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${pages.map((text: string, i: number) => `
          <div class="page ${i < pages.length - 1 ? 'page-break' : ''}">
            ${story.scene_images![i] ? `<img src="${story.scene_images![i]}" alt="Scene ${i + 1}" />` : ''}
            <p>${text.replace(/\n/g, '<br/>')}</p>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();
      if (data) {
        const s = data as Story;
        setStory(s);
        setVisibility(s.visibility);
        if (s.translation_text) {
          setTranslatedPages(s.translation_text);
        }
      }
      setLoading(false);
    };
    fetchStory();
  }, [storyId]);

  const handleComplete = async () => {
    if (!storyId || !user || !story) return;
    setSaving(true);

    try {
      const supabase = createClient();

      await supabase
        .from('stories')
        .update({ visibility })
        .eq('id', storyId);

      const { data: existingLib } = await supabase
        .from('library')
        .select('id')
        .eq('story_id', storyId)
        .single();

      if (!existingLib) {
        await supabase.from('library').insert({
          story_id: storyId,
          country_id: story.country_id,
          book_id: bookId,
          likes: 0,
          views: 0,
        });
      }

      const { data: activity } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', bookId)
        .single();

      if (activity) {
        const completedTabs = (activity.completed_tabs as string[]).includes('mystory')
          ? activity.completed_tabs as string[]
          : [...(activity.completed_tabs as string[]), 'mystory'];
        const stampsEarned = (activity.stamps_earned as string[]).includes('mystory')
          ? activity.stamps_earned as string[]
          : [...(activity.stamps_earned as string[]), 'mystory'];

        await supabase
          .from('activities')
          .update({
            completed_tabs: completedTabs,
            stamps_earned: stampsEarned,
          })
          .eq('id', activity.id);
      }

      setCompleted(true);
      setShowConfetti(true);
    } catch (err) {
      console.error('Complete error:', err);
    }

    setSaving(false);
  };

  const handleTranslate = async () => {
    if (!story?.final_text || !storyId) return;
    setTranslating(true);

    try {
      const res = await fetch('/api/story/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: story.final_text,
          source_language: sourceLanguage,
          target_language: targetLanguage,
        }),
      });
      const { translated_pages } = await res.json();
      setTranslatedPages(translated_pages);

      const supabase = createClient();
      await supabase
        .from('stories')
        .update({ translation_text: translated_pages })
        .eq('id', storyId);
    } catch (err) {
      console.error('Translation error:', err);
    }

    setTranslating(false);
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story || !story.final_text || !story.scene_images) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  return (
    <>
      <ConfettiAnimation show={showConfetti} />
      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto">
        {completed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              축하해요!
            </h1>
            <p className="text-muted mb-8">
              나만의 이야기가 도서관에 등록되었어요
            </p>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.5 }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-stamp-gold/10 border-2 border-stamp-gold rounded-xl mb-8"
            >
              <span className="text-2xl">🏅</span>
              <span className="font-bold text-stamp-gold">
                나만의 이야기 스탬프 획득!
              </span>
            </motion.div>

            <div className="mb-8">
              <BookPreview
                pages={story.final_text!}
                sceneImages={story.scene_images!}
                translatedPages={translatedPages || undefined}
              />
            </div>

            <div className="flex justify-center gap-3 mb-6">
              <button
                onClick={() => handleDownloadPdf('original')}
                className="px-5 py-2.5 bg-accent/10 text-accent border border-accent/30 rounded-xl font-medium hover:bg-accent/20 transition-colors text-sm"
              >
                원본 다운로드
              </button>
              {translatedPages && (
                <button
                  onClick={() => handleDownloadPdf('translated')}
                  className="px-5 py-2.5 bg-secondary/10 text-secondary border border-secondary/30 rounded-xl font-medium hover:bg-secondary/20 transition-colors text-sm"
                >
                  번역본 다운로드
                </button>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <a
                href={`/book/${bookId}`}
                className="px-6 py-3 bg-muted-light text-foreground rounded-xl font-medium hover:bg-border transition-colors"
              >
                책으로 돌아가기
              </a>
              <a
                href="/library"
                className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
              >
                도서관 가기
              </a>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground">
                이야기 완성
              </h1>
              <p className="text-sm text-muted mt-2">
                완성된 이야기를 확인하고 공개 설정을 선택해 주세요
              </p>
            </div>

            <div className="mb-8">
              <BookPreview
                pages={story.final_text}
                sceneImages={story.scene_images}
                translatedPages={translatedPages || undefined}
              />
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-bold text-foreground mb-3">다운로드</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDownloadPdf('original')}
                  className="px-5 py-2.5 bg-accent/10 text-accent border border-accent/30 rounded-xl font-medium hover:bg-accent/20 transition-colors text-sm"
                >
                  원본 다운로드
                </button>
                {translatedPages && (
                  <button
                    onClick={() => handleDownloadPdf('translated')}
                    className="px-5 py-2.5 bg-secondary/10 text-secondary border border-secondary/30 rounded-xl font-medium hover:bg-secondary/20 transition-colors text-sm"
                  >
                    번역본 다운로드
                  </button>
                )}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-bold text-foreground mb-3">번역</h3>
              {translatedPages ? (
                <p className="text-sm text-success font-medium">
                  번역이 완료되었습니다. 미리보기에서 원문/번역을 전환할 수 있어요.
                </p>
              ) : (
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {translating ? '번역 중...' : translateButtonLabel}
                </button>
              )}
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-bold text-foreground mb-3">
                공개 설정
              </h3>
              <VisibilitySelector
                value={visibility}
                onChange={setVisibility}
              />
            </div>

            <div className="flex justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleComplete}
                disabled={saving}
                className="px-10 py-4 bg-primary text-white rounded-xl text-lg font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '완성하기'}
              </motion.button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
