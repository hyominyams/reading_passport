'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { Class, HiddenContent, ContentType } from '@/types/database';

interface ContentFormProps {
  bookId: string;
  countryId: string;
  classes?: Class[];
  existingContent?: HiddenContent | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ContentForm({
  bookId,
  countryId,
  classes = [],
  existingContent,
  onClose,
  onSave,
}: ContentFormProps) {
  const isEdit = !!existingContent;

  const [title, setTitle] = useState(existingContent?.title ?? '');
  const [type, setType] = useState<ContentType>(existingContent?.type ?? 'video');
  const [url, setUrl] = useState(existingContent?.url ?? '');
  const [scope, setScope] = useState<'class' | 'global'>(existingContent?.scope ?? 'class');
  const [className, setClassName] = useState(classes[0]?.class_name ?? '기본반');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [error, setError] = useState('');

  const typeOptions: { value: ContentType; label: string }[] = [
    { value: 'video', label: 'YouTube' },
    { value: 'pdf', label: 'PDF' },
    { value: 'image', label: '\uC774\uBBF8\uC9C0' },
    { value: 'link', label: '\uC678\uBD80\uB9C1\uD06C' },
  ];

  const allowFileUpload = type === 'pdf' || type === 'image';

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('kind', 'hidden-content');
      formData.append('file', file);

      const res = await fetch('/api/teacher/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '파일 업로드에 실패했습니다');
      }

      setUrl(data.asset.publicUrl);
      setUploadedFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

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
                className,
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
            {uploadedFileName ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate text-sm font-medium text-emerald-800">{uploadedFileName}</span>
                <button
                  type="button"
                  onClick={() => { setUrl(''); setUploadedFileName(''); }}
                  className="ml-auto shrink-0 text-xs text-slate-400 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={allowFileUpload ? '파일 업로드 후 자동 입력되거나 외부 URL을 직접 넣을 수 있어요' : 'https://...'}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            )}
            {allowFileUpload && (
              <div className="mt-3 rounded-xl border border-dashed border-border bg-muted-light/40 p-3">
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="text-muted">
                    PDF나 이미지 파일을 직접 업로드할 수 있습니다.
                  </span>
                  <span className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-foreground shadow-sm">
                    파일 선택
                  </span>
                  <input
                    type="file"
                    accept={type === 'pdf' ? 'application/pdf' : 'image/*'}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleFileUpload(file);
                      }
                    }}
                  />
                </label>
                {uploading && (
                  <p className="mt-2 text-xs text-muted">파일을 업로드하는 중...</p>
                )}
              </div>
            )}
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

          {!isEdit && scope === 'class' && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                배정 반
              </label>
              <select
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
              disabled={saving || uploading}
              className="flex-1 px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : uploading ? '업로드 중...' : isEdit ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
