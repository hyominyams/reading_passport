'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import LibraryGrid, {
  type LibraryCountryShelf,
  type LibraryStoryItem,
} from '@/components/story/LibraryGrid';
import BookViewerModal from '@/components/story/BookViewerModal';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { countries } from '@/lib/data/countries';

interface Comment {
  author: string;
  text: string;
  date: string;
}

function withTimeout<T>(factory: () => Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    factory()
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<LibraryStoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<LibraryStoryItem | null>(null);
  const [viewerSession, setViewerSession] = useState(0);
  const [likedStories, setLikedStories] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedReadCompleted, setSelectedReadCompleted] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchLibrary = async () => {
      try {
        const supabase = createClient();
        setErrorMessage(null);

        const { data, error } = await withTimeout(
          async () =>
            supabase
              .from('library')
              .select('*, book:books(id, title, cover_url), story:stories(*, author:users!stories_student_id_fkey(nickname))')
              .order('likes', { ascending: false }),
          8000,
          'library fetch'
        );

        if (!active) return;

        if (error) {
          console.error('Error fetching library:', error);
          setItems([]);
          setErrorMessage('도서관 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
          return;
        }

        const libraryItems = (data ?? []) as LibraryStoryItem[];
        const storyIds = libraryItems.map((item) => item.story_id);

        let likeCounts = new Map<string, number>();
        if (storyIds.length > 0) {
          const { data: likeRows, error: likeError } = await withTimeout(
            async () =>
              supabase
                .from('story_likes')
                .select('story_id')
                .in('story_id', storyIds),
            8000,
            'story likes fetch'
          );

          if (!active) return;

          if (likeError) {
            console.error('Error fetching likes:', likeError);
          } else {
            likeCounts = (likeRows ?? []).reduce((acc, row: { story_id: string }) => {
              acc.set(row.story_id, (acc.get(row.story_id) ?? 0) + 1);
              return acc;
            }, new Map<string, number>());
          }
        }

        const visibleItems = libraryItems
          .filter((item) => item.story && item.story.visibility !== 'private')
          .map((item) => ({
            ...item,
            likes: likeCounts.get(item.story_id) ?? item.likes,
          }))
          .sort((a, b) => b.likes - a.likes);

        setItems(visibleItems);
      } catch (error) {
        console.error('Unexpected library fetch error:', error);
        if (active) {
          setItems([]);
          setErrorMessage('도서관 연결이 지연되고 있어요. 새로고침 후 다시 시도해주세요.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchLibrary();

    return () => {
      active = false;
    };
  }, []);

  // Fetch user's liked stories
  useEffect(() => {
    let active = true;

    const fetchLikes = async () => {
      if (!user) {
        setLikedStories(new Set());
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from('story_likes')
        .select('story_id')
        .eq('user_id', user.id);

      if (!active) return;

      if (error) {
        console.error('Error fetching liked stories:', error);
        return;
      }

      if (data) {
        setLikedStories(new Set(data.map((d: { story_id: string }) => d.story_id)));
      }
    };

    void fetchLikes();

    return () => {
      active = false;
    };
  }, [user]);

  const countryShelves = useMemo<LibraryCountryShelf[]>(() => {
    const grouped = new Map<
      string,
      {
        countryId: string;
        countryName: string;
        countryFlag: string;
        books: Map<
          string,
          {
            bookId: string;
            bookTitle: string;
            bookCoverUrl?: string | null;
            items: LibraryStoryItem[];
          }
        >;
      }
    >();

    for (const item of items) {
      const countryId = item.country_id;
      const countryData = countries.find((country) => country.id === countryId);
      const bookId = item.book?.id ?? item.book_id;
      const bookTitle = item.book?.title?.trim() || '원작 책';
      const bookCoverUrl = item.book?.cover_url ?? null;

      if (!grouped.has(countryId)) {
        grouped.set(countryId, {
          countryId,
          countryName: countryData?.name ?? countryId,
          countryFlag: countryData?.flag ?? '🌍',
          books: new Map(),
        });
      }

      const countryEntry = grouped.get(countryId)!;
      if (!countryEntry.books.has(bookId)) {
        countryEntry.books.set(bookId, {
          bookId,
          bookTitle,
          bookCoverUrl,
          items: [],
        });
      }

      countryEntry.books.get(bookId)!.items.push(item);
    }

    return Array.from(grouped.values()).map((countryEntry) => ({
      countryId: countryEntry.countryId,
      countryName: countryEntry.countryName,
      countryFlag: countryEntry.countryFlag,
      books: Array.from(countryEntry.books.values())
        .map((bookShelf) => ({
          ...bookShelf,
          items: [...bookShelf.items].sort((a, b) => b.likes - a.likes),
        }))
        .sort((a, b) => b.items.length - a.items.length),
    }));
  }, [items]);

  const commentLockMessage = useMemo(() => {
    if (!user) {
      return '로그인 후 책을 끝까지 읽으면 댓글을 남길 수 있어요.';
    }

    if (!selectedItem) {
      return '댓글을 남길 작품을 선택해주세요.';
    }

    if (selectedItem.story.student_id === user.id) {
      return '내 작품에는 댓글을 남길 수 없어요.';
    }

    if (!selectedReadCompleted) {
      return '이 책을 끝까지 읽은 뒤 댓글을 남길 수 있어요.';
    }

    return '';
  }, [selectedItem, selectedReadCompleted, user]);

  const canComment = !!user
    && !!selectedItem
    && selectedItem.story.student_id !== user.id
    && selectedReadCompleted;

  const handleLike = async (storyId: string) => {
    if (!user) return;
    const supabase = createClient();

    const isLiked = likedStories.has(storyId);

    if (isLiked) {
      const { error } = await supabase
        .from('story_likes')
        .delete()
        .eq('story_id', storyId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error unliking story:', error);
        return;
      }

      setLikedStories((prev) => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from('story_likes')
        .insert({ story_id: storyId, user_id: user.id });

      if (error) {
        console.error('Error liking story:', error);
        return;
      }

      setLikedStories((prev) => new Set([...prev, storyId]));
    }

    // Reconcile counts from the source table so the UI cannot drift from persistence.
    const { data: likeRows } = await supabase
      .from('story_likes')
      .select('story_id')
      .in('story_id', items.map((item) => item.story_id));

    const counts = (likeRows ?? []).reduce((acc, row: { story_id: string }) => {
      acc.set(row.story_id, (acc.get(row.story_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    setItems((prev) =>
      prev
        .map((item) => ({
          ...item,
          likes: counts.get(item.story_id) ?? 0,
        }))
        .sort((a, b) => b.likes - a.likes)
    );
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
    if (!user || !selectedItem || !commentText.trim() || !canComment) return;
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
    setViewerSession((prev) => prev + 1);
    setSelectedItem(item);
    setComments([]);
    setCommentText('');
    setSelectedReadCompleted(false);

    await fetchComments(item.story_id);

    const supabase = createClient();
    if (user) {
      const { data: progress, error: progressError } = await supabase
        .from('story_read_progress')
        .select('completed')
        .eq('story_id', item.story_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (progressError) {
        console.error('Error fetching story read progress:', progressError);
      } else {
        setSelectedReadCompleted(!!progress?.completed);
      }
    }

    // Increment views
    await supabase
      .from('library')
      .update({ views: item.views + 1 })
      .eq('id', item.id);

    setItems((prev) =>
      prev.map((libraryItem) =>
        libraryItem.id === item.id
          ? { ...libraryItem, views: libraryItem.views + 1 }
          : libraryItem
      )
    );
  };

  const handleReadingComplete = async (totalPages: number) => {
    if (!user || !selectedItem) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('story_read_progress')
      .upsert(
        {
          story_id: selectedItem.story_id,
          user_id: user.id,
          last_page: totalPages,
          total_pages_snapshot: totalPages,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'story_id,user_id' }
      );

    if (error) {
      console.error('Error saving story read progress:', error);
      return;
    }

    setSelectedReadCompleted(true);
  };

  if ((authLoading && !user) || loading) {
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
      <main className="flex-1 bg-passport-library passport-border-top">
        <div className="px-4 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-heading text-foreground mb-2">
            우리들의 도서관
          </h1>
          <p className="text-sm text-muted">
            학생들이 만든 이야기를 감상하세요
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {errorMessage}
          </div>
        )}

        {/* Bookshelf Grid */}
        <LibraryGrid
          countryShelves={countryShelves}
          onItemClick={handleItemClick}
          onLike={handleLike}
          likedStories={likedStories}
        />

        {/* Book Viewer Modal with inline comments */}
        {selectedItem && selectedItem.story.final_text && (
          <BookViewerModal
            key={viewerSession}
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
            canComment={canComment}
            commentLockMessage={commentLockMessage}
            onReadingComplete={handleReadingComplete}
            commentText={commentText}
            onCommentChange={setCommentText}
            onSubmitComment={handleSubmitComment}
            submittingComment={submittingComment}
          />
        )}
        </div>
      </main>
    </>
  );
}
