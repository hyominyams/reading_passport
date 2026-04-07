'use client';

import { useState } from 'react';
import type { HiddenContent, ContentType } from '@/types/database';

interface ContentFormProps {
  bookId: string;
  countryId: string;
  existingContent?: HiddenContent | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ContentForm({
  bookId,
  countryId,
  existingContent,
  onClose,
  onSave,
}: ContentFormProps) {
  const isEdit = !!existingContent;

  const [title, setTitle] = useState(existingContent?.title ?? '');
  const [type, setType] = useState<ContentType>(existingContent?.type ?? 'video');
  const [url, setUrl] = useState(existingContent?.url ?? '');
  const [scope, setScope] = useState<'class' | 'global'>(existingContent?.scope ?? 'class');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const typeOptions: { value: ContentType; label: string }[] = [
    { value: 'video', label: 'YouTube' },
    { value: 'pdf', label: 'PDF' },
    { value: 'image', label: '\uC774\uBBF8\uC9C0' },
    { value: 'link', label: '\uC678\uBD80\uB9C1\uD06C' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !url.trim()) {
      setError('제목과 URL을 입력해주세요');
      return;
    }

    setSaving(true);

    try {
      if (isEdit) {
        const res = await fetch('/api/teacher/content', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existingContent!.id,
            title: title.trim(),
            type,
            url: url.trim(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '수정에 실패했습니다');
        }
      } else {
        const res = await fetch('/api/teacher/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            countryId,
            type,
            title: title.trim(),
            url: url.trim(),
            scope,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '등록에 실패했습니다');
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">
            {isEdit ? '콘텐츠 수정' : '새 콘텐츠 추가'}
          </h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl leading-none"
          >
            \u00D7
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="콘텐츠 제목을 입력하세요"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              유형
            </label>
            <div className="grid grid-cols-4 gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    type === opt.value
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border hover:bg-muted-light'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Scope (only for new content) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                공개 범위
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('class')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    scope === 'class'
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border hover:bg-muted-light'
                  }`}
                >
                  우리 반만
                </button>
                <button
                  type="button"
                  onClick={() => setScope('global')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    scope === 'global'
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border hover:bg-muted-light'
                  }`}
                >
                  전체 공개 요청
                </button>
              </div>
              {scope === 'global' && (
                <p className="text-xs text-secondary-dark mt-1">
                  전체 공개는 관리자 승인이 필요합니다
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted-light transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
