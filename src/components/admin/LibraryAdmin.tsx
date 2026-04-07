'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { Story, User, LibraryItem } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface LibraryItemWithStory extends LibraryItem {
  story?: Story & { student?: User };
}

export default function LibraryAdmin() {
  const [items, setItems] = useState<LibraryItemWithStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [visibilityChange, setVisibilityChange] = useState<{
    storyId: string;
    current: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('library')
        .select('*, story:stories(*, student:users(*))')
        .order('likes', { ascending: false });

      if (cancelled) return;

      setItems((data ?? []) as LibraryItemWithStory[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(libraryId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('library').delete().eq('id', libraryId);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== libraryId));
      setRemoveConfirm(null);
    }
  }

  async function handleVisibilityChange(storyId: string, visibility: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('stories')
      .update({ visibility })
      .eq('id', storyId);

    if (!error) {
      setItems((prev) =>
        prev.map((item) =>
          item.story_id === storyId && item.story
            ? { ...item, story: { ...item.story, visibility: visibility as Story['visibility'] } }
            : item
        )
      );
      setVisibilityChange(null);
    }
  }

  const visibilityLabel = (v: string) => {
    switch (v) {
      case 'public': return { text: '공개', color: 'bg-success/10 text-success' };
      case 'class': return { text: '반 공개', color: 'bg-secondary/10 text-secondary-dark' };
      case 'private': return { text: '비공개', color: 'bg-gray-100 text-gray-600' };
      default: return { text: v, color: 'bg-gray-100 text-gray-600' };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="도서관을 불러오는 중..." />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        도서관에 등록된 작품이 없습니다
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">총 {items.length}개 작품</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const vis = visibilityLabel(item.story?.visibility ?? 'public');
          return (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-card-hover transition-colors"
            >
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted-light shrink-0">
                {item.story?.scene_images?.[0] ? (
                  <Image
                    src={item.story.scene_images[0]}
                    alt="작품"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">
                    \uD83D\uDCDA
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {item.story?.student?.nickname ?? '알 수 없음'}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${vis.color}`}>
                    {vis.text}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>\u2764\uFE0F {item.likes}</span>
                  <span>\uD83D\uDC41 {item.views}</span>
                  <span>
                    {new Date(item.story?.created_at ?? '').toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Visibility toggle */}
                {visibilityChange?.storyId === item.story_id ? (
                  <div className="flex gap-1">
                    {['public', 'class', 'private'].map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          handleVisibilityChange(item.story_id, v)
                        }
                        className={`px-2 py-1 text-xs rounded ${
                          item.story?.visibility === v
                            ? 'bg-primary text-white'
                            : 'border border-border hover:bg-muted-light'
                        }`}
                      >
                        {visibilityLabel(v).text}
                      </button>
                    ))}
                    <button
                      onClick={() => setVisibilityChange(null)}
                      className="px-2 py-1 text-xs text-muted"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      setVisibilityChange({
                        storyId: item.story_id,
                        current: item.story?.visibility ?? 'public',
                      })
                    }
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted-light"
                  >
                    공개 설정
                  </button>
                )}

                {/* Remove */}
                {removeConfirm === item.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="px-3 py-1.5 text-xs bg-error text-white rounded-lg"
                    >
                      확인
                    </button>
                    <button
                      onClick={() => setRemoveConfirm(null)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRemoveConfirm(item.id)}
                    className="px-3 py-1.5 text-xs text-error border border-error/30 rounded-lg hover:bg-error/5"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
