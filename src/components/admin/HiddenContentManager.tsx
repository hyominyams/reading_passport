'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FileImage,
  FileText,
  Link2,
  PlayCircle,
} from 'lucide-react';
import type { ContentType } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { countries } from '@/lib/data/countries';
import { AdminMetricCard } from '@/components/admin/AdminSurface';
import { adminSectionMap } from '@/components/admin/admin-config';

interface AdminBookOption {
  id: string;
  title: string;
  country_id: string;
}

interface HiddenContentRow {
  id: string;
  book_id: string;
  country_id: string;
  type: ContentType;
  title: string;
  url: string;
  order: number;
  scope: 'global' | 'class';
  approved: boolean;
  book?: {
    id: string;
    title: string;
    country_id: string;
  } | null;
  creator?: {
    nickname?: string | null;
    email?: string | null;
  } | null;
}

interface HiddenContentFormState {
  bookId: string;
  countryId: string;
  type: ContentType;
  title: string;
  url: string;
  order: string;
}

const emptyForm: HiddenContentFormState = {
  bookId: '',
  countryId: '',
  type: 'video',
  title: '',
  url: '',
  order: '0',
};

export default function HiddenContentManager() {
  const [books, setBooks] = useState<AdminBookOption[]>([]);
  const [content, setContent] = useState<HiddenContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ContentType>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<HiddenContentRow | null>(null);
  const [form, setForm] = useState<HiddenContentFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const tone = adminSectionMap.hidden.tone;

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [booksRes, contentRes] = await Promise.all([
        fetch('/api/admin/books'),
        fetch('/api/admin/hidden-content'),
      ]);
      const booksData = await booksRes.json();
      const contentData = await contentRes.json();

      if (!booksRes.ok) {
        throw new Error(booksData.error || '도서 목록을 불러오지 못했습니다');
      }

      if (!contentRes.ok) {
        throw new Error(contentData.error || 'Hidden Stories를 불러오지 못했습니다');
      }

      setBooks((booksData.books ?? []) as AdminBookOption[]);
      setContent((contentData.content ?? []) as HiddenContentRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredContent = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return content.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        item.title,
        item.book?.title,
        item.country_id,
        item.creator?.nickname,
        item.creator?.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [content, query, typeFilter]);

  const counts = useMemo(() => ({
    total: content.length,
    video: content.filter((item) => item.type === 'video').length,
    pdf: content.filter((item) => item.type === 'pdf').length,
    media: content.filter((item) => item.type === 'image' || item.type === 'link').length,
  }), [content]);

  const openCreateForm = () => {
    setEditingItem(null);
    setForm({
      ...emptyForm,
      bookId: books[0]?.id ?? '',
      countryId: books[0]?.country_id ?? '',
    });
    setShowForm(true);
    setError('');
  };

  const openEditForm = (item: HiddenContentRow) => {
    setEditingItem(item);
    setForm({
      bookId: item.book_id,
      countryId: item.country_id,
      type: item.type,
      title: item.title,
      url: item.url,
      order: String(item.order),
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    if (!form.bookId || !form.countryId || !form.title.trim() || !form.url.trim()) {
      setSaving(false);
      setError('도서, 국가, 제목, URL은 모두 입력해야 합니다.');
      return;
    }

    try {
      const payload = {
        id: editingItem?.id,
        bookId: form.bookId,
        countryId: form.countryId,
        type: form.type,
        title: form.title.trim(),
        url: form.url.trim(),
        order: Number(form.order) || 0,
      };

      const res = await fetch('/api/admin/hidden-content', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Hidden Story 저장에 실패했습니다');
      }

      setShowForm(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('이 Hidden Story를 삭제하시겠습니까?');
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/hidden-content?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '삭제에 실패했습니다');
      }
      setContent((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="Hidden Stories를 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="전체 카드"
          value={counts.total}
          caption="관리 중인 Hidden Story 전체 수"
          icon={PlayCircle}
          tone={tone}
        />
        <AdminMetricCard
          label="비디오"
          value={counts.video}
          caption="유튜브/영상 기반 확장 콘텐츠"
          icon={PlayCircle}
          tone={tone}
        />
        <AdminMetricCard
          label="PDF"
          value={counts.pdf}
          caption="문서 자료형 Hidden Story"
          icon={FileText}
          tone={tone}
        />
        <AdminMetricCard
          label="이미지/링크"
          value={counts.media}
          caption="이미지와 외부 링크형 콘텐츠"
          icon={FileImage}
          tone={tone}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-slate-950">Hidden Stories 운영</h3>
            <p className="mt-1 text-sm text-slate-500">
              글로벌 Hidden Stories를 책, 타입, 생성자 단위로 유지합니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 책, 국가 검색"
              className="min-w-[220px] rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | ContentType)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              <option value="all">모든 타입</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="image">Image</option>
              <option value="link">Link</option>
            </select>
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              + Hidden Story 추가
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
        {filteredContent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
            표시할 Hidden Story가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContent.map((item) => {
              const country = countries.find((entry) => entry.id === item.country_id);

              return (
                <article key={item.id} className="rounded-[24px] border border-slate-200 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {item.type.toUpperCase()}
                        </span>
                        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                          {country ? `${country.flag} ${country.name}` : item.country_id}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                          전체 공개
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        연결 도서: {item.book?.title || item.book_id}
                      </p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-cyan-700 underline-offset-2 hover:underline"
                      >
                        <Link2 className="h-4 w-4" />
                        <span>원본 링크 열기</span>
                      </a>
                      <p className="mt-2 text-xs text-slate-500">
                        생성자 {item.creator?.nickname || item.creator?.email || '관리자'} · 순서 {item.order}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-heading font-semibold text-slate-950">
                  {editingItem ? 'Hidden Story 수정' : 'Hidden Story 추가'}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  관리자 저장 즉시 전체 공개 상태로 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">도서</label>
                <select
                  value={form.bookId}
                  onChange={(event) => {
                    const book = books.find((item) => item.id === event.target.value);
                    setForm((prev) => ({
                      ...prev,
                      bookId: event.target.value,
                      countryId: book?.country_id ?? prev.countryId,
                    }));
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                >
                  <option value="">도서를 선택하세요</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">국가</label>
                  <select
                    value={form.countryId}
                    onChange={(event) => setForm((prev) => ({ ...prev, countryId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  >
                    <option value="">국가 선택</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">타입</label>
                  <select
                    value={form.type}
                    onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ContentType }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  >
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                    <option value="image">Image</option>
                    <option value="link">Link</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">제목</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">URL</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">순서</label>
                <input
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : editingItem ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
