'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Trash2, Upload } from 'lucide-react';
import type { ApprovalStatus, Book, Class, HiddenContent } from '@/types/database';
import { SUPPORTED_LANGUAGES } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BookCoverImage from '@/components/book/BookCoverImage';
import ContentForm from './ContentForm';
import { countries } from '@/lib/data/countries';

interface PdfEntry {
  lang: string;
  url: string;
  fileName?: string;
  uploading?: boolean;
}

interface TeacherBook extends Book {
  approval_status?: ApprovalStatus | null;
  can_manage?: boolean;
}

interface TeacherHiddenContent extends HiddenContent {
  approval_status?: ApprovalStatus | null;
  can_manage?: boolean;
}

export default function ContentManager() {
  const [books, setBooks] = useState<TeacherBook[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [content, setContent] = useState<TeacherHiddenContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const [showContentForm, setShowContentForm] = useState(false);
  const [editingContent, setEditingContent] = useState<HiddenContent | null>(null);
  const [deleteContentConfirm, setDeleteContentConfirm] = useState<string | null>(null);

  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState<TeacherBook | null>(null);
  const [deleteBookConfirm, setDeleteBookConfirm] = useState<string | null>(null);
  const [savingBook, setSavingBook] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [coverFileName, setCoverFileName] = useState('');
  const [bookForm, setBookForm] = useState({
    country_id: '',
    title: '',
    cover_url: '',
    scope: 'class' as 'class' | 'global',
    class_name: '',
  });
  const [pdfEntries, setPdfEntries] = useState<PdfEntry[]>([{ lang: 'ko', url: '' }]);

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null;

  const fetchBooksAndClasses = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [booksRes, classesRes] = await Promise.all([
        fetch('/api/teacher/books'),
        fetch('/api/teacher/classes'),
      ]);

      const booksData = await booksRes.json();
      const classesData = await classesRes.json();

      if (!booksRes.ok) {
        throw new Error(booksData.error || '도서 목록을 불러오지 못했습니다');
      }

      if (!classesRes.ok) {
        throw new Error(classesData.error || '반 정보를 불러오지 못했습니다');
      }

      const nextBooks = (booksData.books ?? []) as TeacherBook[];
      const nextClasses = (classesData.classes ?? []) as Class[];

      setBooks(nextBooks);
      setClasses(nextClasses);

      const defaultClassName = nextClasses[0]?.class_name ?? '기본반';
      setBookForm((prev) => ({
        ...prev,
        class_name: prev.class_name || defaultClassName,
      }));
      setSelectedBookId((prev) => {
        if (prev && nextBooks.some((book) => book.id === prev)) {
          return prev;
        }
        return nextBooks[0]?.id ?? '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContent = useCallback(async (bookId: string) => {
    if (!bookId) {
      setContent([]);
      return;
    }

    setContentLoading(true);
    try {
      const res = await fetch(`/api/teacher/content?bookId=${bookId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '자료를 불러오지 못했습니다');
      }

      setContent((data.content ?? []) as TeacherHiddenContent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setContentLoading(false);
    }
  }, []);

  const handleUploadCover = async (file: File) => {
    setUploadingField('cover_url');
    setError('');
    try {
      const fd = new FormData();
      fd.append('kind', 'book-cover');
      fd.append('file', file);
      const res = await fetch('/api/teacher/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '파일 업로드에 실패했습니다');
      setBookForm((prev) => ({ ...prev, cover_url: data.asset.publicUrl }));
      setCoverFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다');
    } finally {
      setUploadingField(null);
    }
  };

  const handlePdfUpload = async (index: number, file: File) => {
    setPdfEntries((prev) => prev.map((e, i) => i === index ? { ...e, uploading: true } : e));
    setError('');
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
  const anyUploading = pdfEntries.some((e) => e.uploading) || uploadingField !== null;

  useEffect(() => {
    fetchBooksAndClasses();
  }, [fetchBooksAndClasses]);

  useEffect(() => {
    if (!selectedBookId) {
      setContent([]);
      return;
    }

    fetchContent(selectedBookId);
  }, [fetchContent, selectedBookId]);

  const openCreateBookForm = () => {
    setEditingBook(null);
    setAnalysisText('');
    setUploadingField(null);
    setCoverFileName('');
    setBookForm({
      country_id: '',
      title: '',
      cover_url: '',
      scope: 'class',
      class_name: classes[0]?.class_name ?? '기본반',
    });
    setPdfEntries([{ lang: 'ko', url: '' }]);
    setShowBookForm(true);
    setError('');
  };

  const openEditBookForm = (book: TeacherBook) => {
    setEditingBook(book);
    setAnalysisText('');
    setUploadingField(null);
    setCoverFileName('');
    const className = classes.find((item) => item.id === book.class_id)?.class_name ?? classes[0]?.class_name ?? '기본반';

    setBookForm({
      country_id: book.country_id,
      title: book.title,
      cover_url: book.cover_url,
      scope: book.scope,
      class_name: className,
    });
    const urls = book.pdf_urls ?? {};
    const entries = Object.entries(urls)
      .filter(([, v]) => v?.trim())
      .map(([lang, url]) => ({ lang, url }));
    setPdfEntries(entries.length > 0 ? entries : [{ lang: 'ko', url: '' }]);
    setShowBookForm(true);
    setError('');
  };

  const submitBook = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingBook(true);
    setError('');

    const normalizedCountryId = bookForm.country_id.trim();
    const normalizedTitle = bookForm.title.trim();
    const normalizedCover = bookForm.cover_url.trim();

    // Build pdf_urls map from entries
    const pdfUrls: Record<string, string> = {};
    for (const entry of pdfEntries) {
      if (entry.lang && entry.url.trim()) {
        pdfUrls[entry.lang] = entry.url.trim();
      }
    }
    const hasPdfs = Object.keys(pdfUrls).length > 0;

    if (!normalizedCountryId || !normalizedTitle || (!normalizedCover && !hasPdfs)) {
      setError('국가, 제목, PDF URL 또는 표지 URL을 입력해주세요');
      setSavingBook(false);
      return;
    }

    try {
      let targetBookId = editingBook?.id ?? null;
      const hasExistingAnalysis = !!editingBook?.character_analysis && Object.keys(editingBook.character_analysis).length > 0;
      const oldPdfUrls = editingBook?.pdf_urls ?? {};
      const pdfChanged = !!editingBook && JSON.stringify(oldPdfUrls) !== JSON.stringify(pdfUrls);
      const shouldAnalyze = !!analysisText.trim() || (!editingBook || pdfChanged || !hasExistingAnalysis);

      const payload = {
        country_id: normalizedCountryId,
        title: normalizedTitle,
        cover_url: normalizedCover,
        pdf_urls: pdfUrls,
        scope: bookForm.scope,
        class_name: bookForm.class_name,
      };

      if (editingBook) {
        const res = await fetch('/api/teacher/books', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingBook.id, ...payload }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '도서 수정에 실패했습니다');
        }
      } else {
        const res = await fetch('/api/teacher/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '도서 등록에 실패했습니다');
        }

        targetBookId = data.bookId ?? null;
      }

      if (targetBookId && shouldAnalyze) {
        const analyzeRes = await fetch('/api/scan/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: targetBookId,
            ...(analysisText.trim() ? { bookText: analysisText.trim() } : {}),
          }),
        });

        const analyzeData = await analyzeRes.json();
        if (!analyzeRes.ok) {
          throw new Error(analyzeData.error || '도서 분석에 실패했습니다');
        }
      }

      setShowBookForm(false);
      setEditingBook(null);
      setAnalysisText('');
      setUploadingField(null);
      await fetchBooksAndClasses();

      if (targetBookId) {
        setSelectedBookId(targetBookId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSavingBook(false);
    }
  };

  const deleteBook = async (bookId: string) => {
    try {
      const res = await fetch(`/api/teacher/books?id=${bookId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '도서 삭제에 실패했습니다');
      }

      setDeleteBookConfirm(null);
      await fetchBooksAndClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  const handleContentSave = async () => {
    setShowContentForm(false);
    setEditingContent(null);
    if (selectedBookId) {
      await fetchContent(selectedBookId);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    try {
      const res = await fetch(`/api/teacher/content?id=${contentId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '자료 삭제에 실패했습니다');
      }

      setDeleteContentConfirm(null);
      setContent((prev) => prev.filter((item) => item.id !== contentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  const handleReorderContent = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= content.length) return;

    const currentItem = content[index];
    const adjacentItem = content[targetIndex];

    try {
      await Promise.all([
        fetch('/api/teacher/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentItem.id, order: adjacentItem.order }),
        }),
        fetch('/api/teacher/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: adjacentItem.id, order: currentItem.order }),
        }),
      ]);

      setContent((prev) => {
        const updated = [...prev];
        updated[index] = { ...currentItem, order: adjacentItem.order };
        updated[targetIndex] = { ...adjacentItem, order: currentItem.order };
        return updated.sort((a, b) => a.order - b.order);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '순서 변경에 실패했습니다');
    }
  };

  const getCountryLabel = (countryId: string) => {
    const country = countries.find((item) => item.id === countryId);
    if (!country) return countryId;
    return `${country.flag} ${country.name}`;
  };

  const getBookStatusBadge = (book: TeacherBook) => {
    if (book.scope === 'class') {
      return <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">우리 반 도서</span>;
    }

    if (book.approved) {
      return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">전체 공개</span>;
    }

    if (book.approval_status === 'rejected') {
      return <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700">반려됨</span>;
    }

    return <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-700">승인 대기</span>;
  };

  const getContentStatusBadge = (item: TeacherHiddenContent) => {
    if (item.scope === 'class') {
      return <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">우리 반</span>;
    }

    if (item.approved) {
      return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">전체 공개 승인</span>;
    }

    if (item.approval_status === 'rejected') {
      return <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700">반려됨</span>;
    }

    return <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-700">승인 대기</span>;
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return '🎬';
      case 'pdf':
        return '📄';
      case 'image':
        return '🖼️';
      case 'link':
        return '🔗';
      default:
        return '📁';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="도서와 자료를 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">국가별 도서 업로드</h3>
              <p className="mt-1 text-sm text-muted">
                우리 반 전용 도서 또는 전체 공개 요청 도서를 등록하고 관리합니다.
              </p>
            </div>
            <button
              onClick={openCreateBookForm}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
            >
              + 새 도서
            </button>
          </div>

          {books.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
              등록된 도서가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {books.map((book) => {
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setSelectedBookId(book.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      selectedBookId === book.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:bg-muted-light/60'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted-light">
                        <BookCoverImage
                          title={book.title}
                          coverUrl={book.cover_url}
                          sizes="48px"
                          iconClassName="h-5 w-5 text-muted"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-muted-light"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{book.title}</p>
                          {getBookStatusBadge(book)}
                          {book.character_analysis && Object.keys(book.character_analysis).length > 0 ? (
                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-700">분석 완료</span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">분석 필요</span>
                          )}
                        </div>
                        <p className="text-xs text-muted">{getCountryLabel(book.country_id)}</p>
                        {book.approval_status === 'rejected' && book.can_manage && (
                          <p className="mt-1 text-xs text-rose-600">
                            수정 후 저장하면 다시 승인 요청이 올라갑니다.
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {book.can_manage && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditBookForm(book);
                                }}
                                className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-white"
                              >
                                수정
                              </button>

                              {deleteBookConfirm === book.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteBook(book.id);
                                    }}
                                    className="rounded-xl bg-error px-3 py-1.5 text-xs text-white"
                                  >
                                    삭제 확인
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDeleteBookConfirm(null);
                                    }}
                                    className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-white"
                                  >
                                    취소
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDeleteBookConfirm(book.id);
                                  }}
                                  className="rounded-xl border border-error/30 px-3 py-1.5 text-xs text-error hover:bg-error/5"
                                >
                                  삭제
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">Hidden Stories 자료 업로드</h3>
              <p className="mt-1 text-sm text-muted">
                선택한 책에 연결되는 영상, 이미지, PDF, 링크 자료를 등록합니다.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingContent(null);
                setShowContentForm(true);
              }}
              disabled={!selectedBook}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              + 새 자료
            </button>
          </div>

          {!selectedBook ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
              왼쪽에서 자료를 연결할 도서를 먼저 선택해주세요.
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-2xl bg-muted-light/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Selected Book</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selectedBook.title}</p>
                <p className="mt-1 text-xs text-muted">{getCountryLabel(selectedBook.country_id)}</p>
              </div>

              {contentLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner message="자료를 불러오는 중..." />
                </div>
              ) : content.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                  이 도서에 연결된 Hidden Stories 자료가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {content.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-border p-4">
                      <div className="flex gap-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleReorderContent(index, 'up')}
                            disabled={index === 0}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-muted-light disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleReorderContent(index, 'down')}
                            disabled={index === content.length - 1}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-muted-light disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-lg">{getContentTypeIcon(item.type)}</span>
                            <h4 className="truncate text-sm font-semibold text-foreground">{item.title}</h4>
                            {getContentStatusBadge(item)}
                          </div>
                          <p className="truncate text-xs text-muted">{item.url}</p>
                          {item.approval_status === 'rejected' && item.scope === 'global' && !item.approved && (
                            <p className="mt-1 text-xs text-rose-600">
                              수정 후 저장하면 다시 승인 요청이 올라갑니다.
                            </p>
                          )}
                        </div>

                        {item.can_manage && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingContent(item);
                                setShowContentForm(true);
                              }}
                              className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted-light"
                            >
                              수정
                            </button>

                            {deleteContentConfirm === item.id ? (
                              <>
                                <button
                                  onClick={() => handleDeleteContent(item.id)}
                                  className="rounded-xl bg-error px-3 py-1.5 text-xs text-white"
                                >
                                  삭제 확인
                                </button>
                                <button
                                  onClick={() => setDeleteContentConfirm(null)}
                                  className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted-light"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeleteContentConfirm(item.id)}
                                className="rounded-xl border border-error/30 px-3 py-1.5 text-xs text-error hover:bg-error/5"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {showContentForm && selectedBook && (
        <ContentForm
          bookId={selectedBook.id}
          countryId={selectedBook.country_id}
          classes={classes}
          existingContent={editingContent}
          onClose={() => {
            setShowContentForm(false);
            setEditingContent(null);
          }}
          onSave={handleContentSave}
        />
      )}

      {showBookForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingBook ? '도서 수정' : '새 도서 등록'}</h3>
              <button
                onClick={() => setShowBookForm(false)}
                className="text-xl text-muted hover:text-foreground"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitBook} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">국가</label>
                  <select
                    value={bookForm.country_id}
                    onChange={(event) => setBookForm((prev) => ({ ...prev, country_id: event.target.value }))}
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                  >
                    <option value="">국가 선택</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">제목</label>
                  <input
                    type="text"
                    value={bookForm.title}
                    onChange={(event) => setBookForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="도서 제목"
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">공개 범위</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBookForm((prev) => ({ ...prev, scope: 'class' }))}
                      className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
                        bookForm.scope === 'class'
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:bg-muted-light'
                      }`}
                    >
                      우리 반 전용
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookForm((prev) => ({ ...prev, scope: 'global' }))}
                      className={`rounded-xl border px-4 py-3 text-sm transition-colors ${
                        bookForm.scope === 'global'
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:bg-muted-light'
                      }`}
                    >
                      전체 공개 요청
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">반</label>
                  <select
                    value={bookForm.class_name}
                    onChange={(event) => setBookForm((prev) => ({ ...prev, class_name: event.target.value }))}
                    disabled={bookForm.scope !== 'class'}
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15 disabled:opacity-50"
                  >
                    {classes.length === 0 ? (
                      <option value="기본반">기본반</option>
                    ) : (
                      classes.map((item) => (
                        <option key={item.id} value={item.class_name}>
                          {item.grade}학년 {item.class_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">표지 이미지 URL (선택)</label>
                {coverFileName ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate text-sm font-medium text-emerald-800">{coverFileName}</span>
                    <button
                      type="button"
                      onClick={() => { setBookForm((prev) => ({ ...prev, cover_url: '' })); setCoverFileName(''); }}
                      className="ml-auto shrink-0 text-xs text-muted hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={bookForm.cover_url}
                    onChange={(event) => setBookForm((prev) => ({ ...prev, cover_url: event.target.value }))}
                    placeholder="비우면 PDF 첫 페이지로 자동 생성"
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                  />
                )}
                <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted-light/40 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                    <span className="text-muted">표지 이미지를 직접 업로드할 수도 있습니다.</span>
                    <span className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm">
                      이미지 업로드
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUploadCover(file);
                      }}
                    />
                  </label>
                  {uploadingField === 'cover_url' && (
                    <p className="mt-2 text-xs text-muted">표지 이미지를 업로드하는 중...</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-foreground">언어별 PDF</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = SUPPORTED_LANGUAGES.find((l) => !usedLangs.has(l.code))?.code ?? '';
                      setPdfEntries((prev) => [...prev, { lang: next, url: '' }]);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-muted-light px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted-light/80"
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
                        className="w-32 shrink-0 rounded-xl border border-border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code} disabled={usedLangs.has(l.code) && l.code !== entry.lang}>
                            {l.flag} {l.label}
                          </option>
                        ))}
                      </select>
                      {entry.fileName ? (
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span className="truncate text-sm font-medium text-emerald-800">{entry.fileName}</span>
                          <button
                            type="button"
                            onClick={() => setPdfEntries((prev) => prev.map((item, i) => i === idx ? { ...item, url: '', fileName: undefined } : item))}
                            className="ml-auto shrink-0 text-xs text-muted hover:text-foreground"
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
                          className="min-w-0 flex-1 rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                        />
                      )}
                      <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-border px-3 py-3 text-sm text-muted hover:bg-muted-light">
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
                          className="shrink-0 rounded-xl border border-error/30 p-3 text-error hover:bg-error/5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">도서 본문 또는 분석용 텍스트 (선택)</label>
                <textarea
                  value={analysisText}
                  onChange={(event) => setAnalysisText(event.target.value)}
                  placeholder="비워두면 PDF에서 자동 추출해서 등장인물/줄거리를 분석합니다."
                  rows={5}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookForm(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-muted-light"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={savingBook || anyUploading}
                  className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {savingBook ? '저장 중...' : anyUploading ? '업로드 중...' : editingBook ? '수정 저장' : '도서 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
