/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { Campaign, CampaignAssetMeta, CampaignContentType } from '@/types/database';

const contentTypeLabels: Record<CampaignContentType, string> = {
  poster: '포스터',
  card_news: '카드뉴스',
  impression: '감상문',
  culture_intro: '문화 소개',
  worksheet: '활동지',
  other: '기타',
};

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

interface UploadedAsset extends CampaignAssetMeta {
  previewUrl?: string;
}

export default function SubmissionForm({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<CampaignContentType>(
    campaign.allowed_content_types[0] ?? 'other'
  );
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState(false);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      assets.forEach((a) => {
        if (a.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, [assets]);

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fileArray = Array.from(files);

      if (assets.length + fileArray.length > campaign.max_files_per_submission) {
        setError(`파일은 최대 ${campaign.max_files_per_submission}개까지 첨부할 수 있어요.`);
        return;
      }

      const maxBytes = campaign.max_file_size_mb * 1024 * 1024;
      for (const f of fileArray) {
        if (f.size > maxBytes) {
          setError(`파일 크기는 ${campaign.max_file_size_mb}MB 이하여야 해요.`);
          return;
        }
        if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
          setError('이미지와 PDF 파일만 업로드할 수 있어요.');
          return;
        }
      }

      setError(null);
      setUploading(true);

      try {
        const uploaded: UploadedAsset[] = [];
        for (const file of fileArray) {
          const formData = new FormData();
          formData.append('campaignId', campaign.id);
          formData.append('file', file);

          const res = await fetch('/api/campaign/upload', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? '업로드에 실패했습니다.');
          }

          const data = await res.json();
          const previewUrl = file.type.startsWith('image/')
            ? URL.createObjectURL(file)
            : undefined;

          uploaded.push({ ...data.asset, previewUrl });
        }

        setAssets((prev) => [...prev, ...uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.');
      } finally {
        setUploading(false);
      }
    },
    [assets.length, campaign.id, campaign.max_file_size_mb, campaign.max_files_per_submission]
  );

  const removeAsset = (assetId: string) => {
    setAssets((prev) => {
      const removed = prev.find((a) => a.id === assetId);
      if (removed?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((a) => a.id !== assetId);
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (assets.length === 0) {
      setError('파일을 최소 1개 첨부해주세요.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/campaign/${campaign.id}/submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            content_type: contentType,
            assets: assets.map(({ previewUrl, ...rest }) => rest),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? '제출에 실패했습니다.');
          return;
        }

        router.push(`/campaign/${campaign.id}`);
        router.refresh();
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      }
    });
  };

  const busy = isPending || uploading;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          캠페인으로 돌아가기
        </button>

        <h1 className="font-heading text-2xl font-bold text-slate-900">
          작품 제출
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          &quot;{campaign.title}&quot; 캠페인에 나의 작품을 제출하세요
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Content type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              콘텐츠 유형
            </label>
            <div className="flex flex-wrap gap-2">
              {campaign.allowed_content_types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContentType(t as CampaignContentType)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                    contentType === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {contentTypeLabels[t as CampaignContentType] ?? t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="sub-title" className="block text-sm font-medium text-slate-700 mb-1.5">
              제목
            </label>
            <input
              id="sub-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="작품 제목을 입력하세요"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              disabled={busy}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="sub-desc" className="block text-sm font-medium text-slate-700 mb-1.5">
              설명 (선택)
            </label>
            <textarea
              id="sub-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작품에 대해 간단히 설명해주세요"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
              disabled={busy}
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              파일 첨부 ({assets.length}/{campaign.max_files_per_submission})
            </label>

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-slate-300"
            >
              {uploading ? (
                <LoadingSpinner size="sm" message="업로드 중..." />
              ) : (
                <>
                  <svg className="mb-3 h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-slate-500">
                    파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    이미지 또는 PDF, 최대 {campaign.max_file_size_mb}MB
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFileUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Uploaded files */}
            {assets.length > 0 && (
              <div className="mt-4 space-y-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    {asset.previewUrl ? (
                      <img
                        src={asset.previewUrl}
                        alt={asset.name}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-500">
                        PDF
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{asset.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(asset.size_bytes)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAsset(asset.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? <LoadingSpinner size="sm" /> : '제출하기'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={busy}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              취소
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
