'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenText,
  FileText,
  Languages,
  Plus,
  ScanSearch,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Book } from '@/types/database';
import { SUPPORTED_LANGUAGES, getLanguageMeta } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BookCoverImage from '@/components/book/BookCoverImage';
import { countries } from '@/lib/data/countries';
import { AdminMetricCard } from '@/components/admin/AdminSurface';
import { adminSectionMap } from '@/components/admin/admin-config';

interface PdfEntry {
  lang: string;
  url: string;
  fileName?: string;
  uploading?: boolean;
}

export default function BookManager() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const tone = adminSectionMap.books.tone;

  const [formData, setFormData] = useState({
    country_id: '',
    title: '',
    cover_url: '',
  });
  const [pdfEntries, setPdfEntries] = useState<PdfEntry[]>([{ lang: 'ko', url: '' }]);
  const [analysisText, setAnalysisText] = useState('');

  const fetchBooks = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/books');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '도서 목록을 불러오지 못했습니다');
      }

      setBooks((data.books ?? []) as Book[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBooks();
  }, []);

  const filteredBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return books.filter((book) => {
      if (countryFilter !== 'all' && book.country_id !== countryFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [book.title, book.country_id]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [books, countryFilter, query]);

  const counts = useMemo(() => ({
    total: books.length,
    approved: books.filter((book) => book.approved).length,
    analyzed: books.filter((book) => Object.keys(book.character_analysis ?? {}).length > 0).length,
    bilingual: books.filter((book) => Object.keys(book.pdf_urls ?? {}).length >= 2).length,
  }), [books]);

  const closeForm = () => {
    setShowForm(false);
    setEditingBook(null);
    setAnalysisText('');
  };

  const openCreateForm = () => {
    setFormData({ country_id: '', title: '', cover_url: '' });
    setPdfEntries([{ lang: 'ko', url: '' }]);
    setEditingBook(null);
    setAnalysisText('');
    setShowForm(true);
    setError('');
  };

  const openEditForm = (book: Book) => {
    setFormData({
      country_id: book.country_id,
      title: book.title,
      cover_url: book.cover_url,
    });
    // Convert pdf_urls map to entries array
    const urls = book.pdf_urls ?? {};
    const entries = Object.entries(urls)
      .filter(([, v]) => v?.trim())
      .map(([lang, url]) => ({ lang, url }));
    setPdfEntries(entries.length > 0 ? entries : [{ lang: 'ko', url: '' }]);
    setEditingBook(book);
    setAnalysisText('');
    setShowForm(true);
    setError('');
  };

  const handlePdfUpload = async (index: number, file: File) => {
    setPdfEntries((prev) => prev.map((e, i) => i === index ? { ...e, uploading: true } : e));
    try {
      const fd = new FormData();
      fd.append('kind', 'book-pdf');
      fd.append('file', file);
      const res = await fetch('/api/teacher/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '파일 업로드에 실패했습니다');
      setPdfEntries((prev) => prev.map((e, i) => i === index ? { ...e, url: data.asset.publicUrl, fileName: file.name, uploading: false } : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다');
      setPdfEntries((prev) => prev.map((e, i) => i === index ? { ...e, uploading: false } : e));
    }
  };

  const usedLangs = new Set(pdfEntries.map((e) => e.lang));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    // Build pdf_urls map from entries
    const pdfUrls: Record<string, string> = {};
    for (const entry of pdfEntries) {
      if (entry.lang && entry.url.trim()) {
        pdfUrls[entry.lang] = entry.url.trim();
      }
    }
    const hasPdfs = Object.keys(pdfUrls).length > 0;

    if (
      !formData.country_id.trim()
      || !formData.title.trim()
      || (!formData.cover_url.trim() && !hasPdfs)
    ) {
      setError('국가, 제목, PDF 또는 표지 URL은 필수입니다.');
      return;
    }

    setSaving(true);

    try {
      let targetBookId = editingBook?.id ?? null;
      const manualAnalysisText = analysisText.trim();
      const oldPdfUrls = editingBook?.pdf_urls ?? {};
      const pdfChanged =
        !!editingBook && JSON.stringify(oldPdfUrls) !== JSON.stringify(pdfUrls);
      const hasExistingAnalysis =
        !!editingBook
        && !!editingBook.character_analysis
        && Object.keys(editingBook.character_analysis).length > 0;
      const shouldAnalyze =
        !!manualAnalysisText
        || (hasPdfs && (!editingBook || pdfChanged || !hasExistingAnalysis));

      if (editingBook) {
        const res = await fetch('/api/admin/books', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingBook.id,
            country_id: formData.country_id.trim(),
            title: formData.title.trim(),
            cover_url: formData.cover_url.trim(),
            pdf_urls: pdfUrls,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '수정에 실패했습니다');
        }
      } else {
        const res = await fetch('/api/admin/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country_id: formData.country_id.trim(),
            title: formData.title.trim(),
            cover_url: formData.cover_url.trim(),
            pdf_urls: pdfUrls,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '등록에 실패했습니다');
        }

        targetBookId = data.bookId ?? null;
      }

      if (targetBookId && shouldAnalyze) {
        const analysisRes = await fetch('/api/scan/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: targetBookId,
            ...(manualAnalysisText ? { bookText: manualAnalysisText } : {}),
          }),
        });
        const analysisData = await analysisRes.json();
        if (!analysisRes.ok) {
          throw new Error(analysisData.error || '캐릭터 분석에 실패했습니다');
        }
      }

      closeForm();
      await fetchBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bookId: string) => {
    setError('');

    try {
      const res = await fetch(`/api/admin/books?id=${bookId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '도서 삭제에 실패했습니다');
      }

      setBooks((prev) => prev.filter((book) => book.id !== bookId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="도서 목록을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="전체 도서"
          value={counts.total}
          caption="관리 대상 글로벌 그림책"
          icon={BookOpenText}
          tone={tone}
        />
        <AdminMetricCard
          label="승인 완료"
          value={counts.approved}
          caption="즉시 노출 가능한 도서 수"
          icon={FileText}
          tone={tone}
        />
        <AdminMetricCard
          label="캐릭터 분석"
          value={counts.analyzed}
          caption="Hidden/질문 생성을 위한 분석 완료"
          icon={ScanSearch}
          tone={tone}
        />
        <AdminMetricCard
          label="이중 언어"
          value={counts.bilingual}
          caption="한/영 PDF가 모두 연결된 도서"
          icon={Languages}
          tone={tone}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-slate-950">도서 카탈로그</h3>
            <p className="mt-1 text-sm text-slate-500">
              국가별 도서와 PDF, 표지, 캐릭터 분석 준비 상태를 한 번에 점검합니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="도서명 또는 국가 검색"
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <select
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">모든 국가</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              + 새 도서 등록
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        {filteredBooks.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            표시할 도서가 없습니다.
          </div>
        ) : (
          filteredBooks.map((book) => {
            const country = countries.find((item) => item.id === book.country_id);
            const isAnalyzed = Object.keys(book.character_analysis ?? {}).length > 0;

            return (
              <article
                key={book.id}
                className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_55px_-48px_rgba(15,23,42,0.35)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                    <BookCoverImage
                      key={book.cover_url}
                      title={book.title}
                      coverUrl={book.cover_url}
                      sizes="72px"
                      iconClassName="h-5 w-5 text-slate-400"
                      fallbackClassName="flex h-full w-full items-center justify-center bg-slate-100"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {country ? `${country.flag} ${country.name}` : book.country_id}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${book.approved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {book.approved ? '공개됨' : '승인 필요'}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isAnalyzed ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {isAnalyzed ? '분석 완료' : '분석 필요'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {(book.languages_available ?? []).map((l) => l.toUpperCase()).join('+') || 'KO 기본'}
                      </span>
                    </div>

                    <h4 className="mt-3 truncate text-lg font-semibold text-slate-950">
                      {book.title}
                    </h4>
                    <p className="mt-2 text-sm text-slate-500">
                      범위 {book.scope} · 생성일 {new Date(book.created_at).toLocaleDateString('ko-KR')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      PDF {(book.languages_available ?? []).map((l) => getLanguageMeta(l).label).join(' / ') || '없음'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(book)}
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      수정
                    </button>
                    {deleteConfirm === book.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDelete(book.id)}
                          className="rounded-2xl bg-rose-600 px-3 py-2 text-xs font-medium text-white"
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(book.id)}
                        className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-heading font-semibold text-slate-950">
                  {editingBook ? '도서 수정' : '새 도서 등록'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  저장 후 필요하면 캐릭터 분석을 자동으로 다시 수행합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">국가</label>
                  <select
                    value={formData.country_id}
                    onChange={(event) => setFormData({ ...formData, country_id: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">국가를 선택하세요</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-900">제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                    placeholder="도서 제목"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">표지 이미지 URL <span className="font-normal text-slate-400">(선택)</span></label>
                <input
                  type="text"
                  value={formData.cover_url}
                  onChange={(event) => setFormData({ ...formData, cover_url: event.target.value })}
                  placeholder="없으면 PDF 첫 페이지로 자동 생성"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  PDF URL이 있으면 저장 시 첫 페이지를 기준으로 표지를 자동 생성합니다.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-900">언어별 PDF</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = SUPPORTED_LANGUAGES.find((l) => !usedLangs.has(l.code))?.code ?? '';
                      setPdfEntries((prev) => [...prev, { lang: next, url: '' }]);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    <Plus className="h-3.5 w-3.5" /> 언어 추가
                  </button>
                </div>
                <div className="space-y-3">
                  {pdfEntries.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <select
                        value={entry.lang}
                        onChange={(e) => setPdfEntries((prev) => prev.map((item, i) => i === idx ? { ...item, lang: e.target.value } : item))}
                        className="w-32 shrink-0 rounded-2xl border border-slate-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code} disabled={usedLangs.has(l.code) && l.code !== entry.lang}>
                            {l.flag} {l.label}
                          </option>
                        ))}
                      </select>
                      {entry.fileName ? (
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span className="truncate text-sm font-medium text-emerald-800">{entry.fileName}</span>
                          <button
                            type="button"
                            onClick={() => setPdfEntries((prev) => prev.map((item, i) => i === idx ? { ...item, url: '', fileName: undefined } : item))}
                            className="ml-auto shrink-0 text-xs text-slate-400 hover:text-slate-600"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={entry.url}
                          onChange={(e) => setPdfEntries((prev) => prev.map((item, i) => i === idx ? { ...item, url: e.target.value } : item))}
                          placeholder="PDF URL 또는 파일 업로드"
                          className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      )}
                      <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50">
                        <Upload className="h-4 w-4" />
                        {entry.uploading ? '...' : '파일'}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handlePdfUpload(idx, file);
                          }}
                        />
                      </label>
                      {pdfEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPdfEntries((prev) => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 rounded-2xl border border-red-200 p-3 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-900">
                  도서 본문/분석용 텍스트
                </label>
                <textarea
                  value={analysisText}
                  onChange={(event) => setAnalysisText(event.target.value)}
                  placeholder="비워두면 저장 후 PDF에서 자동으로 텍스트를 추출합니다."
                  rows={5}
                  className="w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  전체 본문이 있으면 그 텍스트를 우선 사용하고, 비워두면 한국어 PDF 다음 영어 PDF 순으로 자동 추출합니다.
                </p>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving
                    ? '저장 및 분석 중...'
                    : editingBook
                      ? '수정 후 자동 분석'
                      : '등록 후 자동 분석'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
