'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import LibraryGrid, { type LibraryStoryItem } from '@/components/story/LibraryGrid';
import BookViewerModal from '@/components/story/BookViewerModal';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

interface TeacherComment {
  author: string;
  text: string;
  date: string;
}

export default function LibraryPage() {
  const { user, loading: authLoading, isTeacher } = useAuth();
  const [items, setItems] = useState<LibraryStoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<LibraryStoryItem | null>(null);
  const [likedStories, setLikedStories] = useState<Set<string>>(new Set());
  const [filterCountry, setFilterCountry] = useState<string>('');
  const [countries, setCountries] = useState<string[]>([]);
  const [teacherComments, setTeacherComments] = useState<TeacherComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchLibrary = useCallback(async () => {
    const supabase = createClient();

    let query = supabase
      .from('library')
      .select('*, story:stories(*)')
      .order('likes', { ascending: false });

    if (filterCountry) {
      query = query.eq('country_id', filterCountry);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching library:', error);
      setLoading(false);
      return;
    }

    const libraryItems = (data ?? []) as LibraryStoryItem[];

    // Filter to only show items with visible stories
    const visibleItems = libraryItems.filter(
      (item) => item.story && item.story.visibility !== 'private'
    );

    setItems(visibleItems);

    // Extract unique countries
    const uniqueCountries = [...new Set(visibleItems.map((i) => i.country_id))];
    setCountries(uniqueCountries);

    setLoading(false);
  }, [filterCountry]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Fetch user's liked stories
  useEffect(() => {
    const fetchLikes = async () => {
      if (!user) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('story_likes')
        .select('story_id')
        .eq('user_id', user.id);
      if (data) {
        setLikedStories(new Set(data.map((d: { story_id: string }) => d.story_id)));
      }
    };
    fetchLikes();
  }, [user]);

  const handleLike = async (storyId: string) => {
    if (!user) return;
    const supabase = createClient();

    const isLiked = likedStories.has(storyId);

    if (isLiked) {
      await supabase
        .from('story_likes')
        .delete()
        .eq('story_id', storyId)
        .eq('user_id', user.id);

      setLikedStories((prev) => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });

      setItems((prev) =>
        prev.map((item) =>
          item.story_id === storyId
            ? { ...item, likes: Math.max(0, item.likes - 1) }
            : item
        )
      );
    } else {
      await supabase
        .from('story_likes')
        .insert({ story_id: storyId, user_id: user.id });

      setLikedStories((prev) => new Set([...prev, storyId]));

      setItems((prev) =>
        prev.map((item) =>
          item.story_id === storyId
            ? { ...item, likes: item.likes + 1 }
            : item
        )
      );
    }
  };

  const fetchComments = async (storyId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('story_comments')
      .select('*, user:users(nickname, role)')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true });

    if (data) {
      const comments: TeacherComment[] = data.map((c: Record<string, unknown>) => {
        const u = c.user as { nickname: string | null; role: string } | null;
        return {
          author: u?.nickname ?? '선생님',
          text: c.content as string,
          date: new Date(c.created_at as string).toLocaleDateString('ko-KR'),
        };
      });
      setTeacherComments(comments);
    } else {
      setTeacherComments([]);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !selectedItem || !commentText.trim()) return;
    setSubmittingComment(true);

    try {
      const supabase = createClient();
      await supabase
        .from('story_comments')
        .insert({
          story_id: selectedItem.story_id,
          user_id: user.id,
          content: commentText.trim(),
        });

      setCommentText('');
      await fetchComments(selectedItem.story_id);
    } catch (err) {
      console.error('Error submitting comment:', err);
    }

    setSubmittingComment(false);
  };

  const handleItemClick = async (item: LibraryStoryItem) => {
    setSelectedItem(item);
    setTeacherComments([]);
    setCommentText('');

    // Fetch comments for this story
    await fetchComments(item.story_id);

    // Increment views
    const supabase = createClient();
    await supabase
      .from('library')
      .update({ views: item.views + 1 })
      .eq('id', item.id);
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="도서관을 불러오고 있어요..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              우리들의 도서관
            </h1>
            <p className="text-sm text-muted mt-1">
              학생들이 만든 이야기를 감상하세요
            </p>
          </div>

          {/* Country filter */}
          {countries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">필터:</span>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">전체</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Grid */}
        <LibraryGrid
          items={items}
          onItemClick={handleItemClick}
          onLike={handleLike}
          likedStories={likedStories}
        />

        {/* Book Viewer Modal */}
        {selectedItem && selectedItem.story.final_text && (
          <>
            <BookViewerModal
              isOpen={!!selectedItem}
              onClose={() => {
                setSelectedItem(null);
                setTeacherComments([]);
                setCommentText('');
              }}
              pages={selectedItem.story.final_text}
              sceneImages={selectedItem.story.scene_images || []}
              translatedPages={selectedItem.story.translation_text || undefined}
              teacherComments={teacherComments}
            />
            {/* Teacher comment input (floating overlay when modal is open) */}
            {isTeacher && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-xl px-4">
                <div className="bg-white rounded-2xl shadow-2xl border border-border p-4">
                  <p className="text-xs font-bold text-foreground mb-2">
                    선생님 코멘트 작성
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="학생 이야기에 대한 코멘트를 남겨주세요..."
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitComment();
                        }
                      }}
                    />
                    <button
                      onClick={handleSubmitComment}
                      disabled={!commentText.trim() || submittingComment}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                      {submittingComment ? '...' : '등록'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
