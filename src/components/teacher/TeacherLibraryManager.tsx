'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CommentBox from '@/components/teacher/CommentBox';
import { STORY_VISIBILITY_OPTIONS, getStoryVisibilityLabel } from '@/lib/story-visibility';
import type { Visibility } from '@/types/database';

interface TeacherLibraryItem {
  story_id: string;
  student_id: string;
  visibility: Visibility;
  created_at: string;
  country_id: string;
  book_id: string;
  book?: { id: string; title: string } | null;
  student?: { id?: string; nickname?: string | null; class?: string | null } | null;
  cover_image_url?: string | null;
  cover_design?: { title?: string | null; image_url?: string | null } | null;
  final_text?: string[] | null;
  scene_images?: string[] | null;
  library_id: string | null;
  in_library: boolean;
  likes: number;
  views: number;
  story_title: string | null;
  author_nickname: string | null;
  thumbnail_url: string | null;
}

type LibraryFilter = 'all' | 'in_library' | 'not_in_library';

export default function TeacherLibraryManager() {
  const [items, setItems] = useState<TeacherLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emptyMessage, setEmptyMessage] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [updatingStoryId, setUpdatingStoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<TeacherLibraryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/teacher/library');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '도서관 작품을 불러오지 못했습니다');
        }

        setItems(data.items ?? []);
        if (data.message) setEmptyMessage(data.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      if (filter === 'in_library' && !item.in_library) {
        return false;
      }

      if (filter === 'not_in_library' && item.in_library) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        item.story_title,
        item.author_nickname,
        item.book?.title,
        item.student?.class,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [filter, items, query]);

  const updateVisibility = async (storyId: string, visibility: TeacherLibraryItem['visibility']) => {
    setUpdatingStoryId(storyId);
    setError('');

    try {
      const res = await fetch('/api/teacher/library', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_visibility', storyId, visibility }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '공개 범위 변경에 실패했습니다');
      }

      setItems((prev) => prev.map((item) => (
        item.story_id === storyId ? { ...item, visibility } : item
      )));
      setSelectedItem((prev) => prev && prev.story_id === storyId ? { ...prev, visibility } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setUpdatingStoryId(null);
    }
  };

  const toggleLibrary = async (storyId: string) => {
    setUpdatingStoryId(storyId);
    setError('');

    try {
      const res = await fetch('/api/teacher/library', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_library', storyId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '도서관 설정 변경에 실패했습니다');
      }

      setItems((prev) => prev.map((item) => (
        item.story_id === storyId
          ? {
            ...item,
            in_library: data.in_library,
            library_id: data.in_library ? (data.library_id ?? item.library_id) : null,
          }
          : item
      )));
      setSelectedItem((prev) => prev && prev.story_id === storyId
        ? {
          ...prev,
          in_library: data.in_library,
          library_id: data.in_library ? (data.library_id ?? prev.library_id) : null,
        }
        : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setUpdatingStoryId(null);
    }
  };

  const openStoryDetail = async (storyId: string) => {
    setDetailLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/teacher/library?storyId=${storyId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '작품 정보를 불러오지 못했습니다');
      }

      setSelectedItem(data.item as TeacherLibraryItem);
      setCurrentPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="도서관 작품을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-bold">도서관 관리</h3>
            <p className="mt-1 text-sm text-muted">
              완성된 학생 작품을 확인하고, 도서관 노출 여부와 공개 범위를 조절합니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[220px_160px]">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="학생, 작품, 책 제목 검색"
              className="rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as LibraryFilter)}
              className="rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
            >
              <option value="all">전체 작품</option>
              <option value="in_library">도서관 등록됨</option>
              <option value="not_in_library">도서관 미등록</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            {emptyMessage || '완성된 작품이 없거나, 학생이 교사 계정에 연결되지 않았습니다.'}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredItems.map((item) => (
              <article key={item.story_id} className="rounded-2xl border border-border p-4">
                <div className="flex gap-4">
                  <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted-light">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.story_title ?? '학생 작품'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">📚</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                        item.in_library
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.in_library ? '도서관 등록됨' : '도서관 미등록'}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                        {getStoryVisibilityLabel(item.visibility)}
                      </span>
                    </div>

                    <h4 className="truncate text-sm font-semibold text-foreground">
                      {item.story_title ?? '제목 없음'}
                    </h4>
                    <p className="mt-1 text-xs text-muted">
                      {item.author_nickname ?? '학생'} · {item.student?.class ?? '반 미지정'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      원작 도서: {item.book?.title ?? '알 수 없음'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      작성일 {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <span>❤️ {item.likes}</span>
                      <span>👀 {item.views}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setCurrentPage(0);
                        void openStoryDetail(item.story_id);
                      }}
                      className="mt-3 rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted-light"
                    >
                      작품 보기
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleLibrary(item.story_id)}
                    disabled={updatingStoryId === item.story_id}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      item.in_library
                        ? 'border border-error/30 text-error hover:bg-error/5'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {item.in_library ? '도서관에서 제외' : '도서관에 등록'}
                  </button>

                  {STORY_VISIBILITY_OPTIONS.map((visibility) => (
                    <button
                      key={visibility}
                      onClick={() => updateVisibility(item.story_id, visibility)}
                      disabled={updatingStoryId === item.story_id}
                      className={`rounded-xl border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
                        item.visibility === visibility
                          ? 'border-foreground bg-foreground/5 text-foreground font-medium'
                          : 'border-border hover:bg-muted-light'
                      }`}
                    >
                      {getStoryVisibilityLabel(visibility)}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">
                  {selectedItem.story_title ?? '제목 없음'}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {selectedItem.author_nickname ?? '학생'} · {selectedItem.book?.title ?? '원작 정보 없음'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setCurrentPage(0);
                }}
                className="text-xl text-muted hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {selectedItem.scene_images?.[currentPage] && (
                <div className="mb-4 overflow-hidden rounded-2xl bg-muted-light">
                  <img
                    src={selectedItem.scene_images[currentPage] ?? ''}
                    alt={`장면 ${currentPage + 1}`}
                    className="h-64 w-full object-cover"
                  />
                </div>
              )}

              {detailLoading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <LoadingSpinner message="작품을 불러오는 중..." />
                </div>
              ) : selectedItem.final_text && selectedItem.final_text.length > 0 ? (
                <div className="rounded-2xl border border-border bg-white p-5">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {selectedItem.final_text[currentPage]}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
                  아직 완성된 본문이 없습니다.
                </div>
              )}
            </div>

            {selectedItem.final_text && selectedItem.final_text.length > 1 && (
              <div className="flex items-center justify-center gap-4 border-t border-border px-4 py-3">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
                  disabled={currentPage === 0}
                  className="rounded-xl border border-border px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-muted-light"
                >
                  이전
                </button>
                <span className="text-sm text-muted">
                  {currentPage + 1} / {selectedItem.final_text.length}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, selectedItem.final_text!.length - 1))}
                  disabled={currentPage === selectedItem.final_text.length - 1}
                  className="rounded-xl border border-border px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-muted-light"
                >
                  다음
                </button>
              </div>
            )}

            <div className="border-t border-border px-5 py-4">
              <CommentBox storyId={selectedItem.story_id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
