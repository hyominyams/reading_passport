'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CharacterDesigner from '@/components/story/CharacterDesigner';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Story } from '@/types/database';

interface ExtractedCharacter {
  name: string;
  description: string;
}

export default function CharactersPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = params.id as string;
  const storyId = searchParams.get('storyId');
  const router = useRouter();
  const { loading: authLoading } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [extractedCharacters, setExtractedCharacters] = useState<ExtractedCharacter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
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
      if (data) {
        setStory(data as Story);
        if ((data as Story).final_text) {
          setExtracting(true);
          try {
            const res = await fetch('/api/story/extract-characters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ final_text: (data as Story).final_text }),
            });
            const { characters } = await res.json();
            setExtractedCharacters(characters);
          } catch (err) {
            console.error('Extract error:', err);
            setExtractedCharacters([
              { name: '주인공', description: '이야기의 주인공' },
              { name: '친구', description: '주인공의 친구' },
            ]);
          }
          setExtracting(false);
        }
      }
      setLoading(false);
    };
    fetchStory();
  }, [storyId]);

  const handleComplete = async (characters: { name: string; imageUrl: string }[], artStyle: string) => {
    if (!storyId) return;
    setSaving(true);

    try {
      const supabase = createClient();
      // Store art_style in the chat_log JSON alongside character_refs
      const { error } = await supabase
        .from('stories')
        .update({
          character_refs: characters,
          chat_log: { ...(story?.chat_log ?? {}), art_style: artStyle },
        })
        .eq('id', storyId);

      if (error) throw error;

      router.push(`/book/${bookId}/mystory/scenes?storyId=${storyId}`);
    } catch (err) {
      console.error('Save error:', err);
      setSaving(false);
    }
  };

  if (authLoading || loading || extracting) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner
          size="lg"
          message={extracting ? '캐릭터를 분석하고 있어요...' : '로딩 중...'}
        />
      </main>
    );
  }

  if (!story || !story.final_text || !extractedCharacters) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  if (saving) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" message="캐릭터 정보를 저장하고 있어요..." />
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6">
      <CharacterDesigner
        extractedCharacters={extractedCharacters}
        storyContext={story.final_text.join('\n')}
        onComplete={handleComplete}
      />
    </main>
  );
}
