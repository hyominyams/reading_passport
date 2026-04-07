'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Book, HiddenContent } from '@/types/database';
import ContentForm from './ContentForm';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ContentManager() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [content, setContent] = useState<HiddenContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContent, setEditingContent] = useState<HiddenContent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch books on mount
  useEffect(() => {
    async function fetchBooks() {
      const supabase = createClient();
      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('approved', true)
        .order('title');

      setBooks((data ?? []) as Book[]);
      if (data && data.length > 0) {
        setSelectedBookId(data[0].id);
      }
      setLoading(false);
    }
    fetchBooks();
  }, []);

  useEffect(() => {
    if (!selectedBookId) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/teacher/content?bookId=${selectedBookId}`);
      const data = await res.json();

      if (cancelled) return;

      setContent(data.content ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBookId]);

  const fetchContent = useCallback(async () => {
    if (!selectedBookId) return;
    setLoading(true);
    const res = await fetch(`/api/teacher/content?bookId=${selectedBookId}`);
    const data = await res.json();
    setContent(data.content ?? []);
    setLoading(false);
  }, [selectedBookId]);

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= content.length) return;

    const currentItem = content[index];
    const adjacentItem = content[targetIndex];

    // Swap the order field values
    const currentOrder = currentItem.order;
    const adjacentOrder = adjacentItem.order;

    try {
      // Update both items in the API
      await Promise.all([
        fetch('/api/teacher/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentItem.id, order: adjacentOrder }),
        }),
        fetch('/api/teacher/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: adjacentItem.id, order: currentOrder }),
        }),
      ]);

      // Update local state: swap items and re-sort by order
      setContent((prev) => {
        const updated = [...prev];
        updated[index] = { ...currentItem, order: adjacentOrder };
        updated[targetIndex] = { ...adjacentItem, order: currentOrder };
        return updated.sort((a, b) => a.order - b.order);
      });
    } catch (err) {
      console.error('Error reordering content:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/teacher/content?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setContent((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirm(null);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingContent(null);
    fetchContent();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '\uD83C\uDFAC';
      case 'pdf': return '\uD83D\uDCC4';
      case 'image': return '\uD83D\uDDBC\uFE0F';
      case 'link': return '\uD83D\uDD17';
      default: return '\uD83D\uDCC1';
    }
  };

  const getApprovalBadge = (item: HiddenContent) => {
    if (item.scope === 'class') {
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
          우리 반
        </span>
      );
    }
    if (item.approved) {
      return (
        <span className="px-2 py-0.5 text-xs rounded-full bg-success/10 text-success">
          전체 공개 승인됨
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-secondary/10 text-secondary-dark">
        승인 대기중
      </span>
    );
  };

  if (loading && books.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="콘텐츠를 불러오는 중..." />
      </div>
    );
  }

  return (
    <div>
      {/* Book selector */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-muted">도서 선택:</label>
        <select
          value={selectedBookId}
          onChange={(e) => setSelectedBookId(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 border border-border rounded-lg bg-white text-sm"
        >
          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="sm" />
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {content.length === 0 ? (
              <div className="text-center py-12 text-muted border border-dashed border-border rounded-xl">
                이 도서에 등록된 Hidden Stories 콘텐츠가 없습니다
              </div>
            ) : (
              content.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 border border-border rounded-xl hover:bg-card-hover transition-colors"
                >
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => handleReorder(index, 'up')}
                      disabled={index === 0}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-muted-light disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      aria-label="위로 이동"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleReorder(index, 'down')}
                      disabled={index === content.length - 1}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-muted-light disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      aria-label="아래로 이동"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-xl">{getTypeIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{item.title}</h4>
                      {getApprovalBadge(item)}
                    </div>
                    <p className="text-xs text-muted truncate">{item.url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingContent(item);
                        setShowForm(true);
                      }}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted-light transition-colors"
                    >
                      수정
                    </button>
                    {deleteConfirm === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-3 py-1.5 text-xs bg-error text-white rounded-lg hover:bg-error/90"
                        >
                          확인
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted-light"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
                        className="px-3 py-1.5 text-xs text-error border border-error/30 rounded-lg hover:bg-error/5 transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add button */}
          <button
            onClick={() => {
              setEditingContent(null);
              setShowForm(true);
            }}
            className="w-full py-3 border-2 border-dashed border-primary/30 text-primary rounded-xl hover:bg-primary/5 transition-colors text-sm font-medium"
          >
            + 새 콘텐츠 추가
          </button>
        </>
      )}

      {/* Form modal */}
      {showForm && (
        <ContentForm
          bookId={selectedBookId}
          countryId={books.find((b) => b.id === selectedBookId)?.country_id ?? ''}
          existingContent={editingContent}
          onClose={() => {
            setShowForm(false);
            setEditingContent(null);
          }}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
