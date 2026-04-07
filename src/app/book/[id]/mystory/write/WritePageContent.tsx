'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import DraftEditor from '@/components/story/DraftEditor';
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
  const [saving, setSaving] = useState(false);
  const [hiddenStorySummary, setHiddenStorySummary] = useState<string | undefined>(undefined);

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
        setStory(data as Story);

        // Fetch hidden_content for this book to build a summary
        const { data: hiddenContent } = await supabase
          .from('hidden_content')
          .select('title, type')
          .eq('book_id', (data as Story).book_id);

        if (hiddenContent && hiddenContent.length > 0) {
          const summary = hiddenContent
            .map((hc: { title: string; type: string }) => `${hc.title} (${hc.type})`)
            .join(', ');
          setHiddenStorySummary(summary);
        }
      }
      setLoading(false);
    };
    fetchStory();
  }, [storyId]);

  const handleComplete = async (finalText: string[]) => {
    if (!storyId) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({ final_text: finalText })
        .eq('id', storyId);

      if (error) throw error;

      router.push(`/book/${bookId}/mystory/characters?storyId=${storyId}`);
    } catch (err) {
      console.error('Save error:', err);
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story || !story.ai_draft) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">이야기 초안을 찾을 수 없습니다.</p>
      </main>
    );
  }

  if (saving) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" message="이야기를 저장하고 있어요..." />
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6">
      <DraftEditor
        aiDraft={story.ai_draft}
        hiddenStorySummary={hiddenStorySummary}
        onComplete={handleComplete}
      />
    </main>
  );
}
