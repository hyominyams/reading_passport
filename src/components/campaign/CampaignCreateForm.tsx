'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { CampaignContentType } from '@/types/database';

const contentTypeOptions: { key: CampaignContentType; label: string }[] = [
  { key: 'poster', label: '포스터' },
  { key: 'card_news', label: '카드뉴스' },
  { key: 'impression', label: '감상문' },
  { key: 'culture_intro', label: '문화 소개' },
  { key: 'worksheet', label: '활동지' },
  { key: 'other', label: '기타' },
];

export default function CampaignCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<CampaignContentType[]>(['other']);
  const [tags, setTags] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxFiles, setMaxFiles] = useState(3);
  const [maxSizeMb, setMaxSizeMb] = useState(5);

  const toggleType = (key: CampaignContentType) => {
    setSelectedTypes((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const handleSubmit = (status: 'draft' | 'active') => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (!description.trim()) {
      setError('설명을 입력해주세요.');
      return;
    }
    if (selectedTypes.length === 0) {
      setError('허용할 콘텐츠 유형을 최소 1개 선택해주세요.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            allowed_content_types: selectedTypes,
            tags: tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 5),
            deadline: deadline || null,
            max_files_per_submission: maxFiles,
            max_file_size_mb: maxSizeMb,
            status,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? '캠페인 생성에 실패했습니다.');
          return;
        }

        router.push('/campaign');
        router.refresh();
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      }
    });
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          돌아가기
        </button>

        <h1 className="font-heading text-2xl font-bold text-slate-900">
          캠페인 만들기
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          학생들이 참여할 수 있는 캠페인을 만들어보세요
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1.5">
              캠페인 제목
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 우리 반 세계시장 포스터전"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">
              설명
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="캠페인의 주제와 참여 방법을 안내해주세요"
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
              disabled={isPending}
            />
          </div>

          {/* Content types */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              허용할 콘텐츠 유형
            </label>
            <div className="flex flex-wrap gap-2">
              {contentTypeOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleType(opt.key)}
                  disabled={isPending}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                    selectedTypes.includes(opt.key)
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-slate-700 mb-1.5">
              태그 (쉼표로 구분, 최대 5개)
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="예: 포스터, 문화비교, 전시"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              disabled={isPending}
            />
          </div>

          {/* Deadline */}
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-slate-700 mb-1.5">
              마감일 (선택)
            </label>
            <input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              disabled={isPending}
            />
          </div>

          {/* File limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxFiles" className="block text-sm font-medium text-slate-700 mb-1.5">
                최대 파일 수
              </label>
              <input
                id="maxFiles"
                type="number"
                min={1}
                max={10}
                value={maxFiles}
                onChange={(e) => setMaxFiles(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                disabled={isPending}
              />
            </div>
            <div>
              <label htmlFor="maxSize" className="block text-sm font-medium text-slate-700 mb-1.5">
                파일당 최대 크기 (MB)
              </label>
              <input
                id="maxSize"
                type="number"
                min={1}
                max={20}
                value={maxSizeMb}
                onChange={(e) => setMaxSizeMb(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => handleSubmit('active')}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? <LoadingSpinner size="sm" /> : '캠페인 공개'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={isPending}
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              임시 저장
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isPending}
              className="ml-auto text-sm text-slate-400 hover:text-slate-600"
            >
              취소
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
