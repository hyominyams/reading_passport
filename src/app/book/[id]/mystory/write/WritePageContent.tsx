'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Story } from '@/types/database';

export default function WritePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = params.id as string;
  const storyId = searchParams.get('storyId');
  const router = useRouter();
  const { loading: authLoading } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [freewrite, setFreewrite] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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
        if (s.student_freewrite) setFreewrite(s.student_freewrite);
        // If already past step 2, redirect forward
        if (s.current_step > 2) {
          router.replace(`/book/${bookId}/mystory/draft?storyId=${storyId}`);
          return;
        }
      }
      setLoading(false);
    };
    fetchStory();
  }, [storyId, bookId, router]);

  const handleSave = async () => {
    if (!storyId || !freewrite.trim()) return;
    setSaving(true);
    setFeedback(null);

    try {
      const supabase = createClient();
      await supabase
        .from('stories')
        .update({ student_freewrite: freewrite })
        .eq('id', storyId);

      // Get feedback from API
      const res = await fetch('/api/story/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide_answers: story?.guide_answers,
          student_freewrite: freewrite,
          language: story?.language ?? 'ko',
        }),
      });
      const data = await res.json();
      setFeedback(data.feedback ?? '저장되었습니다.');
    } catch {
      setFeedback('저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!storyId || !freewrite.trim()) return;
    setGenerating(true);
    setValidationError(null);

    try {
      // Save first
      const supabase = createClient();
      await supabase
        .from('stories')
        .update({ student_freewrite: freewrite })
        .eq('id', storyId);

      // Validate
      const valRes = await fetch('/api/story/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide_answers: story?.guide_answers,
          student_freewrite: freewrite,
        }),
      });
      const validation = await valRes.json();

      if (!validation.pass) {
        setValidationError(validation.feedback || '이야기를 조금 더 써보세요.');
        setGenerating(false);
        return;
      }

      // Generate draft + advice
      const draftRes = await fetch('/api/story/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: story?.book_id,
          story_type: story?.story_type,
          custom_input: story?.custom_input,
          guide_answers: story?.guide_answers,
          student_freewrite: freewrite,
          language: story?.language ?? 'ko',
        }),
      });
      const draftData = await draftRes.json();

      if (!draftData.pages || draftData.pages.length === 0) {
        setValidationError('초안 생성에 실패했습니다. 다시 시도해 주세요.');
        setGenerating(false);
        return;
      }

      // Save draft and advance step
      await supabase
        .from('stories')
        .update({
          ai_draft: draftData.pages,
          current_step: 3,
        })
        .eq('id', storyId);

      router.push(`/book/${bookId}/mystory/draft?storyId=${storyId}`);
    } catch (err) {
      console.error('Generation error:', err);
      setValidationError('오류가 발생했습니다. 다시 시도해 주세요.');
      setGenerating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  if (generating) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" message="이야기 초안을 만들고 있어요..." />
      </main>
    );
  }

  const canGenerate = freewrite.trim().length >= 30;

  return (
    <main className="flex-1 px-4 py-6 max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
            Step 2/8
          </span>
          <span>이야기 쓰기</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          나만의 이야기를 써보세요
        </h1>
        <p className="text-gray-500 mt-1">
          자유롭게 이야기를 써 내려가 보세요. 저장하면 도움이 되는 조언을 드릴게요.
        </p>
      </div>

      {/* Guide answers summary */}
      {story.guide_answers && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-amber-800 mb-2">내가 떠올린 이야기 재료</h3>
          <div className="space-y-1 text-sm text-amber-700">
            {story.guide_answers.content && (
              <p><span className="font-medium">내용:</span> {story.guide_answers.content}</p>
            )}
            {story.guide_answers.character && (
              <p><span className="font-medium">인물:</span> {story.guide_answers.character}</p>
            )}
            {story.guide_answers.world && (
              <p><span className="font-medium">세계:</span> {story.guide_answers.world}</p>
            )}
          </div>
        </div>
      )}

      {/* Freewrite area */}
      <div className="mb-4">
        <textarea
          value={freewrite}
          onChange={(e) => {
            setFreewrite(e.target.value);
            setValidationError(null);
          }}
          placeholder="여기에 이야기를 자유롭게 써보세요. 맞춤법이나 문법은 걱정하지 않아도 돼요!"
          className="w-full min-h-[300px] p-4 border border-gray-300 rounded-xl text-base leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
        <div className="flex justify-between items-center mt-2 text-sm text-gray-400">
          <span>{freewrite.length}자</span>
          {freewrite.length < 30 && freewrite.length > 0 && (
            <span className="text-amber-500">조금 더 써보세요 (최소 30자)</span>
          )}
        </div>
      </div>

      {/* Feedback area */}
      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-blue-800 text-sm">{feedback}</p>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-700 text-sm">{validationError}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !freewrite.trim()}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          이야기 만들기 &rarr;
        </button>
      </div>
    </main>
  );
}
