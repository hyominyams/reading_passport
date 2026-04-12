'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { LibraryStoryItem } from '@/components/story/LibraryGrid';
import LibraryHero from '@/components/story/LibraryHero';
import LibraryCountrySection from '@/components/story/LibraryCountrySection';
import BookViewerModal from '@/components/story/BookViewerModal';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { countries } from '@/lib/data/countries';
import { generateDummyLibraryItems, isDummyId } from '@/lib/data/dummyLibrary';

interface Comment {
  author: string;
  text: string;
  date: string;
}

export default function LibraryPage() {
  const { user, profile, loading: authLoading } = useAuth();
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
        setErrorMessage(null);

        const res = await fetch('/api/library');
        if (!active) return;

        if (!res.ok) {
          console.error('Error fetching library:', res.statusText);
          setItems([]);
          setErrorMessage('도서관 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
          return;
        }

        const { items: libraryItems } = (await res.json()) as {
          items: LibraryStoryItem[];
        };

        if (!active) return;
        setItems(libraryItems.length > 0 ? libraryItems : generateDummyLibraryItems());
      } catch (error) {
        console.error('Unexpected library fetch error:', error);
        if (active) {
          setItems(generateDummyLibraryItems());
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

  // Weekly rotating hero: pick from top-liked stories based on week number
  const heroItem = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => b.likes - a.likes);
    const topPool = sorted.slice(0, Math.min(5, sorted.length));
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return topPool[weekNumber % topPool.length];
  }, [items]);

  // Group items by country (excluding hero item from its section to avoid duplicate)
  const countrySections = useMemo(() => {
    const grouped = new Map<
      string,
      { countryId: string; countryName: string; countryFlag: string; items: LibraryStoryItem[] }
    >();

    for (const item of items) {
      const countryId = item.country_id;
      const countryData = countries.find((c) => c.id === countryId);

      if (!grouped.has(countryId)) {
        grouped.set(countryId, {
          countryId,
          countryName: countryData?.name ?? countryId,
          countryFlag: countryData?.flag ?? '🌍',
          items: [],
        });
      }

      grouped.get(countryId)!.items.push(item);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.items.length - a.items.length);
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

    const isLiked = likedStories.has(storyId);

    // Dummy data: local-only toggle without DB
    if (isDummyId(storyId)) {
      setLikedStories((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(storyId); else next.add(storyId);
        return next;
      });
      setItems((prev) =>
        prev.map((item) =>
          item.story_id === storyId
            ? { ...item, likes: item.likes + (isLiked ? -1 : 1) }
            : item
        )
      );
      return;
    }

    const supabase = createClient();

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

    const counts = (likeRows ?? []).reduce((acc: Map<string, number>, row: { story_id: string }) => {
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
    if (isDummyId(storyId)) {
      setComments([]);
      return;
    }
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
      if (isDummyId(selectedItem.story_id)) {
        // Local-only comment for dummy data
        setComments((prev) => [
          ...prev,
          {
            author: profile?.nickname ?? '사용자',
            text: commentText.trim(),
            date: new Date().toLocaleDateString('ko-KR'),
          },
        ]);
        setCommentText('');
      } else {
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
      }
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

    if (isDummyId(item.story_id)) {
      // Skip DB operations for dummy data; increment views locally
      setItems((prev) =>
        prev.map((libraryItem) =>
          libraryItem.id === item.id
            ? { ...libraryItem, views: libraryItem.views + 1 }
            : libraryItem
        )
      );
      return;
    }

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

    if (isDummyId(selectedItem.story_id)) {
      setSelectedReadCompleted(true);
      return;
    }

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
      <main className="flex-1 bg-background pb-16">
        {errorMessage && (
          <div className="mx-4 sm:mx-8 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {errorMessage}
          </div>
        )}

        {/* Hero: most-liked story */}
        {heroItem && (
          <LibraryHero item={heroItem} onItemClick={handleItemClick} />
        )}

        {/* Country sections */}
        <div className="mt-12 space-y-12">
          {countrySections.map((section, idx) => (
            <LibraryCountrySection
              key={section.countryId}
              countryName={section.countryName}
              countryFlag={section.countryFlag}
              items={section.items}
              storyCount={section.items.length}
              onItemClick={handleItemClick}
              onLike={handleLike}
              likedStories={likedStories}
              variant={idx % 2 === 1 ? 'alt' : 'default'}
            />
          ))}
        </div>

        {items.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4 opacity-30">📚</span>
            <h3 className="text-lg font-heading text-foreground mb-2">
              아직 이야기가 없어요
            </h3>
            <p className="text-sm text-muted">
              첫 번째 이야기를 만들어 보세요!
            </p>
          </div>
        )}

        {/* Book Viewer Modal */}
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
      </main>
    </>
  );
}
