'use client';

import { useState, useEffect } from 'react';
import type { Book } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function BookManager() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    country_id: '',
    title: '',
    cover_url: '',
    pdf_url_ko: '',
    pdf_url_en: '',
  });

  useEffect(() => {
    fetchBooks();
  }, []);

  async function fetchBooks() {
    const res = await fetch('/api/admin/books');
    const data = await res.json();
    setBooks(data.books ?? []);
    setLoading(false);
  }

  function openCreateForm() {
    setFormData({ country_id: '', title: '', cover_url: '', pdf_url_ko: '', pdf_url_en: '' });
    setEditingBook(null);
    setShowForm(true);
    setError('');
  }

  function openEditForm(book: Book) {
    setFormData({
      country_id: book.country_id,
      title: book.title,
      cover_url: book.cover_url,
      pdf_url_ko: book.pdf_url_ko ?? '',
      pdf_url_en: book.pdf_url_en ?? '',
    });
    setEditingBook(book);
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.country_id.trim() || !formData.title.trim() || !formData.cover_url.trim()) {
      setError('국가 ID, 제목, 표지 URL은 필수입니다');
      return;
    }

    setSaving(true);
    try {
      if (editingBook) {
        const res = await fetch('/api/admin/books', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingBook.id,
            country_id: formData.country_id.trim(),
            title: formData.title.trim(),
            cover_url: formData.cover_url.trim(),
            pdf_url_ko: formData.pdf_url_ko.trim() || null,
            pdf_url_en: formData.pdf_url_en.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
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
            pdf_url_ko: formData.pdf_url_ko.trim() || null,
            pdf_url_en: formData.pdf_url_en.trim() || null,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '등록에 실패했습니다');
        }
      }

      setShowForm(false);
      fetchBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bookId: string) {
    const res = await fetch(`/api/admin/books?id=${bookId}`, { method: 'DELETE' });
    if (res.ok) {
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      setDeleteConfirm(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="도서 목록을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">총 {books.length}권</span>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          + 새 도서 등록
        </button>
      </div>

      {/* Books list */}
      {books.length === 0 ? (
        <div className="text-center py-12 text-muted border border-dashed border-border rounded-xl">
          등록된 도서가 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-card-hover transition-colors"
            >
              {/* Cover thumbnail */}
              <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted-light shrink-0">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    \uD83D\uDCDA
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm truncate">{book.title}</h4>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    book.approved
                      ? 'bg-success/10 text-success'
                      : 'bg-secondary/10 text-secondary-dark'
                  }`}>
                    {book.approved ? '공개' : '비공개'}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  국가: {book.country_id} | 범위: {book.scope}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEditForm(book)}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted-light transition-colors"
                >
                  수정
                </button>
                {deleteConfirm === book.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(book.id)}
                      className="px-3 py-1.5 text-xs bg-error text-white rounded-lg"
                    >
                      확인
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(book.id)}
                    className="px-3 py-1.5 text-xs text-error border border-error/30 rounded-lg hover:bg-error/5"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">
                {editingBook ? '도서 수정' : '새 도서 등록'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted hover:text-foreground text-xl"
              >
                \u00D7
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">국가 ID</label>
                <input
                  type="text"
                  value={formData.country_id}
                  onChange={(e) => setFormData({ ...formData, country_id: e.target.value })}
                  placeholder="예: colombia"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">제목</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="도서 제목"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">표지 이미지 URL</label>
                <input
                  type="url"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">PDF URL (한국어)</label>
                <input
                  type="url"
                  value={formData.pdf_url_ko}
                  onChange={(e) => setFormData({ ...formData, pdf_url_ko: e.target.value })}
                  placeholder="https://... (선택)"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">PDF URL (영어)</label>
                <input
                  type="url"
                  value={formData.pdf_url_en}
                  onChange={(e) => setFormData({ ...formData, pdf_url_en: e.target.value })}
                  placeholder="https://... (선택)"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted-light"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                >
                  {saving ? '저장 중...' : editingBook ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
