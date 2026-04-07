'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import LibraryGrid, { type LibraryStoryItem } from '@/components/story/LibraryGrid';
import BookViewerModal from '@/components/story/BookViewerModal';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

interface Comment {
  author: string;
  text: string;
  date: string;
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<LibraryStoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<LibraryStoryItem | null>(null);
  const [likedStories, setLikedStories] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchLibrary = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('library')
      .select('*, story:stories(*, author:users!stories_student_id_fkey(nickname))')
      .order('likes', { ascending: false });

    if (error) {
      console.error('Error fetching library:', error);
      setLoading(false);
      return;
    }

    const libraryItems = (data ?? []) as LibraryStoryItem[];

    const visibleItems = libraryItems.filter(
      (item) => item.story && item.story.visibility !== 'private'
    );

    setItems(visibleItems);
    setLoading(false);
  }, []);

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

  // Group items by country
  const itemsByCountry = useMemo(() => {
    const grouped: Record<string, LibraryStoryItem[]> = {};
    for (const item of items) {
      const country = item.country_id;
      if (!grouped[country]) grouped[country] = [];
      grouped[country].push(item);
    }
    return grouped;
  }, [items]);

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
      const parsed: Comment[] = data.map((c: Record<string, unknown>) => {
        const u = c.user as { nickname: string | null; role: string } | null;
        return {
          author: u?.nickname ?? '사용자',
          text: c.content as string,
          date: new Date(c.created_at as string).toLocaleDateString('ko-KR'),
        };
      });
      setComments(parsed);
    } else {
      setComments([]);
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
    setComments([]);
    setCommentText('');

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
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-heading text-foreground mb-2">
            우리들의 도서관
          </h1>
          <p className="text-sm text-muted">
            학생들이 만든 이야기를 감상하세요
          </p>
        </div>

        {/* Bookshelf Grid */}
        <LibraryGrid
          itemsByCountry={itemsByCountry}
          onItemClick={handleItemClick}
          onLike={handleLike}
          likedStories={likedStories}
        />

        {/* Book Viewer Modal with inline comments */}
        {selectedItem && selectedItem.story.final_text && (
          <BookViewerModal
            isOpen={!!selectedItem}
            onClose={() => {
              setSelectedItem(null);
              setComments([]);
              setCommentText('');
            }}
            pages={selectedItem.story.final_text}
            sceneImages={selectedItem.story.scene_images || []}
            translatedPages={selectedItem.story.translation_text || undefined}
            comments={comments}
            canComment={!!user}
            commentText={commentText}
            onCommentChange={setCommentText}
            onSubmitComment={handleSubmitComment}
            submittingComment={submittingComment}
          />
        )}
      </main>
    </>
  );
}
