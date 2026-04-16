'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { normalizeTranslatedTextsMap } from '@/lib/story-translations';

interface Comment {
  author: string;
  text: string;
  date: string;
}

function getLocalReadProgressKey(storyId: string, userId: string) {
  return `library-read-progress:${userId}:${storyId}`;
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
  const likeRequestVersionsRef = useRef(new Map<string, number>());
  const supabase = useMemo(() => createClient(), []);
  const countryDataById = useMemo(
    () => new Map(countries.map((country) => [country.id, country] as const)),
    []
  );

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
  }, [supabase, user]);

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
      const countryData = countryDataById.get(countryId);

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
  }, [countryDataById, items]);

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

  const handleLike = useCallback(async (storyId: string) => {
    if (!user) return;

    const isLiked = likedStories.has(storyId);
    const nextLiked = !isLiked;
    const likeDelta = nextLiked ? 1 : -1;

    const applyLikeState = (liked: boolean, delta: number) => {
      setLikedStories((prev) => {
        const next = new Set(prev);
        if (liked) {
          next.add(storyId);
        } else {
          next.delete(storyId);
        }
        return next;
      });

      setItems((prev) =>
        prev.map((item) =>
          item.story_id === storyId
            ? { ...item, likes: Math.max(0, item.likes + delta) }
            : item
        )
      );

      setSelectedItem((prev) =>
        prev && prev.story_id === storyId
          ? { ...prev, likes: Math.max(0, prev.likes + delta) }
          : prev
      );
    };

    // Dummy data: local-only toggle without DB
    if (isDummyId(storyId)) {
      applyLikeState(nextLiked, likeDelta);
      return;
    }

    const requestVersion = (likeRequestVersionsRef.current.get(storyId) ?? 0) + 1;
    likeRequestVersionsRef.current.set(storyId, requestVersion);

    applyLikeState(nextLiked, likeDelta);

    try {
      if (nextLiked) {
        const { error } = await supabase
          .from('story_likes')
          .insert({ story_id: storyId, user_id: user.id });

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error toggling story like:', error);

      if (likeRequestVersionsRef.current.get(storyId) === requestVersion) {
        applyLikeState(isLiked, -likeDelta);
      }
    }
  }, [likedStories, supabase, user]);

  const fetchComments = useCallback(async (storyId: string) => {
    if (isDummyId(storyId)) {
      setComments([]);
      return;
    }

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
  }, [supabase]);

  const handleSubmitComment = useCallback(async () => {
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

      // Update comment count locally
      setItems((prev) =>
        prev.map((item) =>
          item.story_id === selectedItem.story_id
            ? { ...item, comment_count: (item.comment_count ?? 0) + 1 }
            : item
        )
      );
    } catch (err) {
      console.error('Error submitting comment:', err);
    }

    setSubmittingComment(false);
  }, [canComment, commentText, fetchComments, profile?.nickname, selectedItem, supabase, user]);

  const handleItemClick = useCallback(async (item: LibraryStoryItem) => {
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

    if (user) {
      try {
        const response = await fetch(`/api/library/read-progress?storyId=${encodeURIComponent(item.story_id)}`);
        const payload = await response.json();

        if (response.ok) {
          if (payload.trackingAvailable === false) {
            const localReadProgress = window.localStorage.getItem(
              getLocalReadProgressKey(item.story_id, user.id)
            );
            setSelectedReadCompleted(localReadProgress === 'completed');
          } else {
            setSelectedReadCompleted(!!payload.progress?.completed);
          }
        } else {
          console.error('Error fetching story read progress:', payload.error);
        }
      } catch (progressError) {
        console.error('Error fetching story read progress:', progressError);
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
  }, [fetchComments, supabase, user]);

  const handleReadingComplete = useCallback(async (totalPages: number) => {
    if (!user || !selectedItem) return;

    if (isDummyId(selectedItem.story_id)) {
      setSelectedReadCompleted(true);
      return;
    }

    try {
      const response = await fetch('/api/library/read-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: selectedItem.story_id,
          totalPages,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        console.error('Error saving story read progress:', payload);
        setErrorMessage('읽기 완료를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
        return;
      }

      if (payload.trackingAvailable === false) {
        window.localStorage.setItem(
          getLocalReadProgressKey(selectedItem.story_id, user.id),
          'completed'
        );
      }
    } catch (error) {
      console.error('Error saving story read progress:', error);
      setErrorMessage('읽기 완료를 저장하지 못했어요. 네트워크 상태를 확인해주세요.');
      return;
    }

    setErrorMessage(null);
    setSelectedReadCompleted(true);
  }, [selectedItem, user]);

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
            translatedPagesByLanguage={normalizeTranslatedTextsMap(
              selectedItem.story.translated_texts,
              selectedItem.story.translation_text,
              selectedItem.story.language
            )}
            comments={comments}
            canComment={canComment}
            commentLockMessage={commentLockMessage}
            onReadingComplete={handleReadingComplete}
            commentText={commentText}
            onCommentChange={setCommentText}
            onSubmitComment={handleSubmitComment}
            submittingComment={submittingComment}
            likeCount={selectedItem.likes}
            isLiked={likedStories.has(selectedItem.story_id)}
            onLike={() => handleLike(selectedItem.story_id)}
            commentCount={selectedItem.comment_count ?? 0}
          />
        )}
      </main>
    </>
  );
}
