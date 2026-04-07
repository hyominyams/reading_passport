'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import SceneGenerator from '@/components/story/SceneGenerator';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Story } from '@/types/database';

export default function ScenesPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = params.id as string;
  const storyId = searchParams.get('storyId');
  const router = useRouter();
  const { loading: authLoading } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      if (data) setStory(data as Story);
      setLoading(false);
    };
    fetchStory();
  }, [storyId]);

  const handleComplete = async (sceneImages: string[]) => {
    if (!storyId) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({ scene_images: sceneImages })
        .eq('id', storyId);

      if (error) throw error;

      router.push(`/book/${bookId}/mystory/finish?storyId=${storyId}`);
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

  if (!story || !story.final_text || !story.character_refs) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  if (saving) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" message="장면 이미지를 저장하고 있어요..." />
      </main>
    );
  }

  // Read art style from the story's chat_log (saved during character design), with fallback
  const artStyle = (story.chat_log as Record<string, unknown>)?.art_style as string
    ?? 'colored_pencil';

  return (
    <main className="flex-1 px-4 py-6">
      <SceneGenerator
        pages={story.final_text}
        characterRefs={story.character_refs}
        artStyle={artStyle}
        onComplete={handleComplete}
      />
    </main>
  );
}
