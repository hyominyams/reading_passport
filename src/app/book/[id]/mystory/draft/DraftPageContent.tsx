'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import { createClient } from '@/lib/supabase/client';
import type { Story, AiDraftPage } from '@/types/database';
import { getStepRouteWithLang } from '@/lib/mystory-steps';

interface PageData {
  draft: string;
  advice: string;
  studentText: string;
}

function normalizeAiDraftPages(rawPages: unknown): AiDraftPage[] {
  if (!Array.isArray(rawPages)) return [];

  return rawPages
    .map((page) => {
      if (typeof page === 'string') {
        const draft = page.trim();
        return draft ? { draft, advice: '' } : null;
      }

      if (!page || typeof page !== 'object') return null;

      const raw = page as Record<string, unknown>;
      const draft = typeof raw.draft === 'string' ? raw.draft.trim() : '';
      const advice = typeof raw.advice === 'string' ? raw.advice.trim() : '';

      if (!draft) return null;

      return { draft, advice };
    })
    .filter((page): page is AiDraftPage => page !== null);
}

export default function DraftPageContent({ storyId }: { storyId: string | null }) {
  const params = useParams();
  const bookId = params.id as string;
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<PageData[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('stories')
          .select('*')
          .eq('id', storyId)
          .single();

        if (data) {
          const s = data as Story;
          setStory(s);

          if (s.current_step < 3) {
            router.replace(`/book/${bookId}/mystory?storyId=${storyId}&lang=${s.language}`);
            return;
          }

          // Build pages from ai_draft + existing final_text
          const aiPages = normalizeAiDraftPages(s.ai_draft);
          const finalTexts = s.final_text ?? [];
          const initialPages: PageData[] = aiPages.map((p, i) => ({
            draft: p.draft,
            advice: p.advice,
            studentText: finalTexts[i] ?? '',
          }));

          // If there are extra final_text entries beyond ai_draft (added pages)
          for (let i = aiPages.length; i < finalTexts.length; i++) {
            initialPages.push({ draft: '', advice: '', studentText: finalTexts[i] ?? '' });
          }

          // Ensure minimum 3 pages
          while (initialPages.length < 5) {
            initialPages.push({ draft: '', advice: '', studentText: '' });
          }

          setPages(initialPages);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [storyId, bookId, router]);

  const updatePageText = useCallback((index: number, text: string) => {
    setPages(prev => prev.map((p, i) => i === index ? { ...p, studentText: text } : p));
  }, []);

  const addPage = useCallback(() => {
    if (pages.length >= 6) return;
    setPages(prev => [...prev, { draft: '', advice: '', studentText: '' }]);
  }, [pages.length]);

  const removePage = useCallback((index: number) => {
    if (pages.length <= 5) return;
    setPages(prev => prev.filter((_, i) => i !== index));
  }, [pages.length]);

  const autoSave = useCallback(async () => {
    if (!storyId) return;
    const supabase = createClient();
    const finalText = pages.map(p => p.studentText);
    await supabase
      .from('stories')
      .update({ final_text: finalText })
      .eq('id', storyId);
  }, [storyId, pages]);

  // Auto-save on text changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pages.some(p => p.studentText.trim())) {
        autoSave();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [pages, autoSave]);

  const handleNext = async () => {
    if (!storyId) return;
    const filledPages = pages.filter(p => p.studentText.trim().length > 0);
    if (filledPages.length < 5) {
      setError('최소 5개의 장면을 채운 뒤 다음 단계로 갈 수 있어요.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const finalText = pages.map(p => p.studentText);
      await supabase
        .from('stories')
        .update({ final_text: finalText, current_step: 4 })
        .eq('id', storyId);

      router.push(`/book/${bookId}/mystory/scenes?storyId=${storyId}`);
    } catch (err) {
      console.error('Save error:', err);
      setSaving(false);
    }
  };

  const handleStepSelect = useCallback(async (targetStep: number) => {
    if (!storyId || !story) return;

    const goingForward = targetStep > 3;
    const finalText = pages.map((p) => p.studentText);

    if (goingForward) {
      const filledPages = pages.filter((p) => p.studentText.trim().length > 0);
      if (filledPages.length < 5) {
        setError('최소 5개의 장면을 채운 뒤 다음 단계로 갈 수 있어요.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      await supabase
        .from('stories')
        .update({ final_text: finalText, current_step: Math.max(story.current_step, targetStep) })
        .eq('id', storyId);

      router.push(getStepRouteWithLang(bookId, targetStep, storyId, story.language));
    } catch (err) {
      console.error('Step navigation save error:', err);
      setSaving(false);
    }
  }, [bookId, pages, router, story, storyId]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story || !story.ai_draft) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">토리가 써준 이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  if (saving) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" message="저장하고 있어요..." />
      </main>
    );
  }

  const filledCount = pages.filter(p => p.studentText.trim().length > 0).length;
  const canProceed = filledCount >= 5;

  const sectionLabels = ['발단', '전개', '위기', '절정', '결말'];

  return (
    <>
      <MyStoryStepSidebar currentStep={3} busy={saving} onStepSelect={handleStepSelect} />
      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto">
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
            Step 2/7
          </span>
          <span>토리가 써준 이야기 바꿔 쓰기</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          이야기를 완성해 보세요
        </h1>
        <p className="text-gray-500 mt-1">
          토리가 써준 이야기를 읽어보고, 오른쪽에 나만의 이야기로 바꿔 적어 보세요.
        </p>
      </div>

      {/* Pages */}
      <div className="space-y-6">
        {pages.map((page, index) => (
          <div key={index} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Page header */}
            <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">
                #{index + 1} {sectionLabels[index] ?? `장면 ${index + 1}`}
              </h3>
              {index >= 5 && pages.length > 5 && (
                <button
                  onClick={() => removePage(index)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  삭제
                </button>
              )}
            </div>

            {/* Content: Tori draft (left) + Student writing (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Left: Tori story */}
              <div className="p-4 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/50">
                {page.draft ? (
                  <>
                    <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">토리가 써준 이야기</h4>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                      {page.draft}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[120px]">
                    <p className="text-gray-400 text-sm">추가된 페이지 (자유롭게 작성하세요)</p>
                  </div>
                )}
              </div>

              {/* Right: Student writing + Advice */}
              <div className="p-4">
                <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">내가 쓰는 이야기</h4>
                <textarea
                  value={page.studentText}
                  onChange={(e) => updatePageText(index, e.target.value)}
                  placeholder="여기에 이야기를 써보세요..."
                  className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                />

                {/* Advice */}
                {page.advice && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-amber-800 text-xs">
                      <span className="font-medium">조언: </span>
                      {page.advice}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add page button */}
      {pages.length < 6 && (
        <button
          onClick={addPage}
          className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm"
        >
          + 페이지 추가 ({pages.length}/6)
        </button>
      )}

      {/* Footer actions */}
      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {filledCount}/{pages.length} 페이지 작성 완료
          {filledCount < 5 && ' (최소 5페이지 필요)'}
        </p>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          그림 만들러 가기
        </button>
      </div>
      </main>
    </>
  );
}
