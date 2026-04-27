'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Eye,
  GalleryVerticalEnd,
  Heart,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { AdminMetricCard } from '@/components/admin/AdminSurface';
import { adminSectionMap } from '@/components/admin/admin-config';
import { STORY_VISIBILITY_OPTIONS, getStoryVisibilityLabel } from '@/lib/story-visibility';
import type { Visibility } from '@/types/database';

interface LibraryAdminItem {
  story_id: string;
  student_id: string;
  country_id: string;
  book_id: string;
  visibility: Visibility;
  created_at: string;
  student?: {
    id?: string;
    nickname?: string | null;
    class?: string | null;
  } | null;
  teacher_name?: string | null;
  book?: {
    id: string;
    title: string;
  } | null;
  library_id: string | null;
  in_library: boolean;
  likes: number;
  views: number;
  story_title: string | null;
  author_nickname: string | null;
  thumbnail_url: string | null;
}

type VisibilityFilter = 'all' | Visibility;
type LibraryFilter = 'all' | 'in_library' | 'not_in_library';
type SortOption = 'recent' | 'likes' | 'views';

export default function LibraryAdmin() {
  const [items, setItems] = useState<LibraryAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const tone = adminSectionMap.library.tone;

  const fetchItems = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/library');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '도서관 작품을 불러오지 못했습니다');
      }

      setItems((data.items ?? []) as LibraryAdminItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchItems();
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = items.filter((item) => {
      if (visibilityFilter !== 'all' && item.visibility !== visibilityFilter) {
        return false;
      }

      if (libraryFilter === 'in_library' && !item.in_library) {
        return false;
      }

      if (libraryFilter === 'not_in_library' && item.in_library) {
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
        item.teacher_name,
        item.country_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    next.sort((a, b) => {
      if (sortBy === 'likes') {
        return b.likes - a.likes;
      }

      if (sortBy === 'views') {
        return b.views - a.views;
      }

      return b.created_at.localeCompare(a.created_at);
    });

    return next;
  }, [items, libraryFilter, query, sortBy, visibilityFilter]);

  const counts = useMemo(() => ({
    total: items.length,
    inLibrary: items.filter((item) => item.in_library).length,
    public: items.filter((item) => item.visibility === 'public').length,
    likes: items.reduce((sum, item) => sum + item.likes, 0),
  }), [items]);

  const setVisibility = async (storyId: string, visibility: Visibility) => {
    setUpdatingId(storyId);
    setError('');

    try {
      const res = await fetch('/api/admin/library', {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleLibrary = async (storyId: string) => {
    setUpdatingId(storyId);
    setError('');

    try {
      const res = await fetch('/api/admin/library', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_library', storyId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '서재 반영에 실패했습니다');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="도서관 운영 데이터를 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="전체 작품"
          value={counts.total}
          caption="완성된 스토리 전체 수"
          icon={GalleryVerticalEnd}
          tone={tone}
        />
        <AdminMetricCard
          label="서재 등록"
          value={counts.inLibrary}
          caption="현재 라이브러리에 노출 중인 작품"
          icon={BookOpenCheck}
          tone={tone}
        />
        <AdminMetricCard
          label="전체 공개"
          value={counts.public}
          caption="도서관 전체에 열려 있는 작품"
          icon={Eye}
          tone={tone}
        />
        <AdminMetricCard
          label="누적 좋아요"
          value={counts.likes}
          caption="노출된 작품의 반응 총합"
          icon={Heart}
          tone={tone}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-slate-950">서재 작품 관리</h3>
            <p className="mt-1 text-sm text-slate-500">
              작품 노출 여부와 공개 범위를 관리합니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="작품, 학생, 교사, 책 검색"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            <select
              value={visibilityFilter}
              onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            >
              <option value="all">모든 공개 범위</option>
              <option value="public">전체 공개</option>
              <option value="secret">비밀</option>
            </select>
            <select
              value={libraryFilter}
              onChange={(event) => setLibraryFilter(event.target.value as LibraryFilter)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            >
              <option value="all">모든 작품</option>
              <option value="in_library">서재 등록됨</option>
              <option value="not_in_library">서재 미등록</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            >
              <option value="recent">최신순</option>
              <option value="likes">좋아요순</option>
              <option value="views">조회순</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
            표시할 작품이 없습니다.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredItems.map((item) => (
              <article key={item.story_id} className="rounded-[24px] border border-slate-200 p-4">
                <div className="flex gap-4">
                  <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
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
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        item.in_library
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.in_library ? '서재 등록됨' : '서재 미등록'}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        item.visibility === 'public'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {getStoryVisibilityLabel(item.visibility)}
                      </span>
                    </div>

                    <p className="truncate text-base font-semibold text-slate-950">
                      {item.story_title || '제목 없음'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.author_nickname || '학생'} · {item.student?.class || '반 미지정'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      담당 교사 {item.teacher_name || '미확인'} · 원작 {item.book?.title || '알 수 없음'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      작성일 {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span>❤️ {item.likes}</span>
                      <span>👀 {item.views}</span>
                      <span>{item.country_id}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleLibrary(item.story_id)}
                    disabled={updatingId === item.story_id}
                    className={`rounded-2xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      item.in_library
                        ? 'border border-rose-200 text-rose-700 hover:bg-rose-50'
                        : 'bg-slate-950 text-white hover:bg-slate-800'
                    }`}
                  >
                    {item.in_library ? '서재에서 제외' : '서재에 등록'}
                  </button>

                  {STORY_VISIBILITY_OPTIONS.map((visibility) => (
                    <button
                      key={visibility}
                      type="button"
                      onClick={() => void setVisibility(item.story_id, visibility)}
                      disabled={updatingId === item.story_id}
                      className={`rounded-2xl border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
                        item.visibility === visibility
                          ? 'border-slate-950 bg-slate-950 text-white font-medium'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
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
      </section>
    </div>
  );
}
