'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTexts, setEditedTexts] = useState<string[]>([]);

  const sourceLanguage = story?.language ?? 'ko';
  const targetLanguage = sourceLanguage === 'ko' ? 'en' : 'ko';
  const translateButtonLabel =
    targetLanguage === 'en' ? '영어로 번역하기' : '한국어로 번역하기';

  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) { setLoading(false); return; }
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
        setEditedTexts(s.final_text ?? []);
        if (s.translation_text) setTranslatedPages(s.translation_text);
      }
      setLoading(false);
    };
    fetchStory();
  }, [storyId]);

  // Get image for a page (uploaded > AI generated > null)
  const getPageImage = (index: number): string | null => {
    if (!story) return null;
    const uploaded = story.uploaded_images?.[index];
    if (uploaded) return uploaded;
    const generated = story.scene_images?.[index];
    if (generated) return generated;
    return null;
  };

  const coverTitle = story?.cover_design?.title ?? '나의 이야기';
  const coverAuthor = story?.cover_design?.author ?? '';
  const coverImage = story?.cover_image_url ?? null;

  const handleTextEdit = (index: number, text: string) => {
    setEditedTexts(prev => prev.map((t, i) => i === index ? text : t));
  };

  const handleTextSave = async (index: number) => {
    if (!storyId) return;
    const supabase = createClient();
    await supabase
      .from('stories')
      .update({ final_text: editedTexts })
      .eq('id', storyId);
    setEditingIndex(null);
  };

  const handleComplete = async () => {
    if (!storyId || !user || !story) return;
    setSaving(true);

    try {
      const supabase = createClient();

      // Save final texts and visibility
      await supabase
        .from('stories')
        .update({ final_text: editedTexts, visibility })
        .eq('id', storyId);

      // Register to library
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

      // Add mystory stamp
      const { data: activity } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', bookId)
        .maybeSingle();

      if (activity) {
        const completedTabs = (activity.completed_tabs as string[]).includes('mystory')
          ? activity.completed_tabs as string[]
          : [...(activity.completed_tabs as string[]), 'mystory'];
        const stampsEarned = (activity.stamps_earned as string[]).includes('mystory')
          ? activity.stamps_earned as string[]
          : [...(activity.stamps_earned as string[]), 'mystory'];

        await supabase
          .from('activities')
          .update({ completed_tabs: completedTabs, stamps_earned: stampsEarned })
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
    if (!editedTexts.length || !storyId) return;
    setTranslating(true);
    try {
      const res = await fetch('/api/story/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: editedTexts,
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

  const handleDownloadPdf = (mode: 'original' | 'translated') => {
    const pages = mode === 'translated' && translatedPages ? translatedPages : editedTexts;
    const title = coverTitle;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @media print { body { margin: 0; } .page-break { page-break-after: always; } }
          body { font-family: 'Noto Sans KR', sans-serif; padding: 40px; }
          .cover { text-align: center; margin-bottom: 40px; }
          .cover img { max-width: 80%; max-height: 500px; border-radius: 12px; margin-bottom: 16px; }
          .cover h1 { font-size: 28px; color: #2563eb; }
          .cover p { font-size: 16px; color: #666; }
          .page { margin-bottom: 40px; text-align: center; }
          .page img { max-width: 100%; max-height: 400px; border-radius: 12px; margin-bottom: 16px; }
          .page p { font-size: 18px; line-height: 1.8; text-align: left; padding: 0 20px; }
        </style>
      </head>
      <body>
        <div class="cover page-break">
          ${coverImage ? `<img src="${coverImage}" alt="Cover" />` : ''}
          <h1>${title}</h1>
          <p>${coverAuthor}</p>
        </div>
        ${pages.map((text: string, i: number) => `
          <div class="page ${i < pages.length - 1 ? 'page-break' : ''}">
            ${getPageImage(i) ? `<img src="${getPageImage(i)}" alt="Scene ${i + 1}" />` : ''}
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
      printWindow.onload = () => printWindow.print();
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story || !editedTexts.length) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  return (
    <>
      <ConfettiAnimation show={showConfetti} />
      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto">
        {completed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">축하해요!</h1>
            <p className="text-gray-500 mb-8">나만의 이야기가 서재에 등록되었어요</p>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.5 }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-50 border-2 border-amber-400 rounded-xl mb-8"
            >
              <span className="text-2xl">🏅</span>
              <span className="font-bold text-amber-600">나만의 이야기 스탬프 획득!</span>
            </motion.div>

            <div className="flex justify-center gap-3 mb-6">
              <button onClick={() => handleDownloadPdf('original')} className="px-5 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors">
                원본 다운로드
              </button>
              {translatedPages && (
                <button onClick={() => handleDownloadPdf('translated')} className="px-5 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors">
                  번역본 다운로드
                </button>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <a href={`/book/${bookId}`} className="px-6 py-3 bg-gray-100 text-gray-800 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                책으로 돌아가기
              </a>
              <a href="/library" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                서재 가기
              </a>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  Step 8/8
                </span>
                <span>완성</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">이야기가 완성되었어요!</h1>
              <p className="text-gray-500 mt-1">텍스트를 수정하고 서재에 등록하세요.</p>
            </div>

            {/* Cover */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              {coverImage && (
                <div className="aspect-[4/3] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImage} alt="표지" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6 text-center">
                <h2 className="text-xl font-bold text-gray-900">{coverTitle}</h2>
                <p className="text-gray-500 text-sm mt-1">글/그림: {coverAuthor}</p>
              </div>
            </div>

            {/* Pages: Image + Editable Text */}
            <div className="space-y-6">
              {editedTexts.map((text, index) => {
                const image = getPageImage(index);
                const isEditing = editingIndex === index;

                return (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {image && (
                      <div className="aspect-[4/3] relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={`장면 ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      {isEditing ? (
                        <div>
                          <textarea
                            value={text}
                            onChange={(e) => handleTextEdit(index, e.target.value)}
                            className="w-full min-h-[100px] p-3 border border-gray-200 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleTextSave(index)}
                              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap flex-1">
                            {text}
                          </p>
                          <button
                            onClick={() => setEditingIndex(index)}
                            className="ml-3 text-gray-400 hover:text-indigo-600 text-xs shrink-0"
                          >
                            ✏️ 수정
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Translation */}
            <div className="mt-8 p-4 bg-gray-50 rounded-xl">
              <h3 className="font-semibold text-gray-800 mb-3">번역</h3>
              {translatedPages ? (
                <p className="text-sm text-green-700">번역이 완료되었습니다.</p>
              ) : (
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {translating ? '번역 중...' : translateButtonLabel}
                </button>
              )}
            </div>

            {/* Visibility + Complete */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <h3 className="font-semibold text-gray-800 mb-3">공개 설정</h3>
              <VisibilitySelector value={visibility} onChange={setVisibility} />
            </div>

            <div className="mt-8 flex justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleComplete}
                disabled={saving}
                className="px-10 py-4 bg-indigo-600 text-white rounded-xl text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '서재에 등록하기 🎊'}
              </motion.button>
            </div>

            {/* Download buttons */}
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => handleDownloadPdf('original')} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors">
                원본 다운로드
              </button>
              {translatedPages && (
                <button onClick={() => handleDownloadPdf('translated')} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors">
                  번역본 다운로드
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
