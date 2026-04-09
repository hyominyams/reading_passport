/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/common/Header';
import { useAuth } from '@/hooks/useAuth';

type CampaignCategory = 'all' | 'gallery' | 'pdf' | 'kit' | 'event';
type CampaignAssetType = 'image' | 'pdf';

type CampaignAsset = {
  id: string;
  name: string;
  type: CampaignAssetType;
  sizeLabel: string;
  previewUrl?: string;
};

type CampaignItem = {
  id: string;
  title: string;
  summary: string;
  category: Exclude<CampaignCategory, 'all'>;
  focus: string;
  author: string;
  status: 'featured' | 'new' | 'open';
  publishedAt: string;
  tags: string[];
  accent: string;
  assets: CampaignAsset[];
};

type DraftAsset = CampaignAsset & {
  file: File;
};

const STORAGE_KEY = 'campaign-board-items-v1';
const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const sampleCampaigns: CampaignItem[] = [
  {
    id: 'campaign-sample-1',
    title: '우리 반 세계시장 포스터전',
    summary:
      '각 나라 그림책을 읽고 지역 시장, 음식, 직업 문화를 포스터와 카드뉴스로 재해석한 결과물을 모아 전시합니다.',
    category: 'gallery',
    focus: '이미지, 포스터, 카드뉴스',
    author: '월드도슨트 운영팀',
    status: 'featured',
    publishedAt: '2026.04.08',
    tags: ['전시', '포스터', '문화비교'],
    accent: 'from-[#1d4ed8] via-[#2563eb] to-[#60a5fa]',
    assets: [
      {
        id: 'campaign-sample-1-asset-1',
        name: '세계시장 포스터 보드',
        type: 'image',
        sizeLabel: 'PNG',
        previewUrl: '/images/world_map.png',
      },
    ],
  },
  {
    id: 'campaign-sample-2',
    title: '등장인물 인터뷰집 배포팩',
    summary:
      '학생들이 만든 등장인물 인터뷰 질문지와 응답 기록을 교실 배포용 PDF로 묶어 공유하는 자료 아카이브입니다.',
    category: 'pdf',
    focus: '워크시트, 인터뷰 PDF',
    author: '3학년 2반',
    status: 'open',
    publishedAt: '2026.04.06',
    tags: ['질문지', '배포자료', '토론'],
    accent: 'from-[#7c3aed] via-[#8b5cf6] to-[#c4b5fd]',
    assets: [
      {
        id: 'campaign-sample-2-asset-1',
        name: '인터뷰집 샘플 PDF',
        type: 'pdf',
        sizeLabel: 'PDF',
        previewUrl: '/Story/tanzania-who-is-real-hero.pdf',
      },
    ],
  },
  {
    id: 'campaign-sample-3',
    title: '숨은 이야기 탐험 키트',
    summary:
      'Hidden Stories 활동을 수업 바깥으로 확장해 지도, 조사 카드, 사진 기록지를 함께 묶은 탐험형 자료 꾸러미입니다.',
    category: 'kit',
    focus: '조사 키트, 사진, 기록지',
    author: '김은서 선생님',
    status: 'new',
    publishedAt: '2026.04.04',
    tags: ['탐험', '프로젝트', '조사'],
    accent: 'from-[#047857] via-[#10b981] to-[#6ee7b7]',
    assets: [
      {
        id: 'campaign-sample-3-asset-1',
        name: '탐험 기록 보드',
        type: 'image',
        sizeLabel: 'JPG',
        previewUrl: '/images/world_map.png',
      },
      {
        id: 'campaign-sample-3-asset-2',
        name: '현장 기록 PDF',
        type: 'pdf',
        sizeLabel: 'PDF',
        previewUrl: '/Story/tanzania-who-is-real-hero.pdf',
      },
    ],
  },
];

const categoryOptions: {
  key: CampaignCategory;
  label: string;
  description: string;
}[] = [
  { key: 'all', label: '전체', description: '모든 공유물' },
  { key: 'gallery', label: '이미지', description: '포스터와 카드뉴스' },
  { key: 'pdf', label: 'PDF', description: '배포 자료와 리플렛' },
  { key: 'kit', label: '키트', description: '활동 묶음과 패키지' },
  { key: 'event', label: '이벤트', description: '캠페인 공지와 챌린지' },
];

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

function statusLabel(status: CampaignItem['status']) {
  switch (status) {
    case 'featured':
      return '추천 캠페인';
    case 'new':
      return '새 업로드';
    default:
      return '열린 공유';
  }
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function CampaignCard({ item }: { item: CampaignItem }) {
  const coverAsset =
    item.assets.find((asset) => asset.type === 'image' && asset.previewUrl) ??
    item.assets.find((asset) => asset.previewUrl) ??
    null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
    >
      <div className={`h-2 w-full bg-gradient-to-r ${item.accent}`} />
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-slate-500">
              {statusLabel(item.status)}
            </span>
            <h3 className="mt-3 font-heading text-xl font-bold text-slate-900">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {item.summary}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-[11px] text-slate-500">
            <div>{item.author}</div>
            <div className="mt-1">{item.publishedAt}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
            {coverAsset?.previewUrl && coverAsset.type === 'image' ? (
              <img
                src={coverAsset.previewUrl}
                alt={item.title}
                className="h-56 w-full object-cover sm:h-64"
              />
            ) : (
              <div className={`flex h-56 items-end bg-gradient-to-br ${item.accent} p-6 text-white sm:h-64`}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
                    Campaign Preview
                  </div>
                  <div className="mt-3 text-2xl font-bold">{item.focus}</div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              첨부 자료
            </div>
            <div className="mt-4 space-y-3">
              {item.assets.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 transition hover:-translate-y-0.5 hover:border-slate-300"
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    asset.type === 'pdf'
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-sky-100 text-sky-700'
                  }`}>
                    {asset.type === 'pdf' ? 'PDF' : 'IMG'}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {asset.name}
                    </div>
                    <div className="text-xs text-slate-500">{asset.sizeLabel}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

export default function CampaignPageClient() {
  const { isAuthenticated, profile } = useAuth();
  const [selectedCategory, setSelectedCategory] =
    useState<CampaignCategory>('all');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftCategory, setDraftCategory] =
    useState<Exclude<CampaignCategory, 'all'>>('gallery');
  const [draftFocus, setDraftFocus] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftFiles, setDraftFiles] = useState<DraftAsset[]>([]);
  const [customItems, setCustomItems] = useState<CampaignItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as CampaignItem[];
      setCustomItems(parsed);
    } catch (error) {
      console.error('Failed to load local campaign items:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      draftFiles.forEach((file) => {
        if (file.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, [draftFiles]);

  const combinedItems = useMemo(
    () => [...customItems, ...sampleCampaigns],
    [customItems]
  );

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return combinedItems;
    }

    return combinedItems.filter((item) => item.category === selectedCategory);
  }, [combinedItems, selectedCategory]);

  const featuredItem =
    combinedItems.find((item) => item.status === 'featured') ?? combinedItems[0];

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    if (draftFiles.length + files.length > MAX_FILES) {
      setUploadError(`파일은 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
      return;
    }

    setUploadError(null);

    try {
      const nextFiles = await Promise.all(
        files.map(async (file) => {
          if (
            !file.type.startsWith('image/') &&
            file.type !== 'application/pdf'
          ) {
            throw new Error('이미지와 PDF 파일만 업로드할 수 있어요.');
          }

          if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error('파일은 개당 2MB 이하로 올려주세요.');
          }

          const previewUrl =
            file.type === 'application/pdf'
              ? await readFileAsDataUrl(file)
              : URL.createObjectURL(file);

          return {
            id: crypto.randomUUID(),
            file,
            name: file.name,
            type:
              file.type === 'application/pdf' ? 'pdf' : 'image',
            sizeLabel: formatFileSize(file.size),
            previewUrl,
          } satisfies DraftAsset;
        })
      );

      setDraftFiles((prev) => [...prev, ...nextFiles]);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : '파일을 처리하지 못했습니다.'
      );
    }
  };

  const handleRemoveDraftFile = (fileId: string) => {
    setDraftFiles((prev) => {
      const target = prev.find((file) => file.id === fileId);
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return prev.filter((file) => file.id !== fileId);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draftTitle.trim() || !draftSummary.trim() || draftFiles.length === 0) {
      setUploadError('제목, 설명, 첨부 자료를 모두 채워주세요.');
      return;
    }

    setIsPosting(true);
    setUploadError(null);

    try {
      const assets = await Promise.all(
        draftFiles.map(async (file) => {
          const previewUrl =
            file.type === 'pdf' || file.previewUrl?.startsWith('data:')
              ? await readFileAsDataUrl(file.file)
              : file.previewUrl;

          return {
            id: file.id,
            name: file.name,
            type: file.type,
            sizeLabel: file.sizeLabel,
            previewUrl,
          } satisfies CampaignAsset;
        })
      );

      const nextItem: CampaignItem = {
        id: crypto.randomUUID(),
        title: draftTitle.trim(),
        summary: draftSummary.trim(),
        category: draftCategory,
        focus: draftFocus.trim() || '캠페인 공유물',
        author:
          profile?.nickname?.trim() || profile?.email?.split('@')[0] || '새 참여자',
        status: 'new',
        publishedAt: new Date().toLocaleDateString('ko-KR'),
        tags: draftTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 4),
        accent:
          draftCategory === 'gallery'
            ? 'from-[#0284c7] via-[#38bdf8] to-[#bfdbfe]'
            : draftCategory === 'pdf'
              ? 'from-[#be123c] via-[#fb7185] to-[#fecdd3]'
              : draftCategory === 'kit'
                ? 'from-[#047857] via-[#34d399] to-[#ccfbf1]'
                : 'from-[#7c3aed] via-[#a78bfa] to-[#ddd6fe]',
        assets,
      };

      setCustomItems((prev) => {
        const next = [nextItem, ...prev];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });

      draftFiles.forEach((file) => {
        if (file.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });

      setDraftTitle('');
      setDraftSummary('');
      setDraftCategory('gallery');
      setDraftFocus('');
      setDraftTags('');
      setDraftFiles([]);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : '공유물 저장에 실패했습니다.'
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="flex-1 bg-passport-library passport-border-top pb-20">
        <section className="px-4 pt-6 sm:px-8">
          <div className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/90 shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
              <div>
                <div className="inline-flex rounded-full bg-slate-900 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                  Campaign Board
                </div>
                <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                  도서관 옆, 수업 밖으로 확장되는 공유 보드
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  책 만들기 외에도 포스터, 리플렛, 워크시트, 행사 자료를 올려서
                  수업 결과물을 한곳에 모으는 캠페인 탭입니다.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    이미지와 PDF 업로드
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    브라우저 기반 즉시 공유
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    도서관과 다른 결과물 전용 공간
                  </div>
                </div>
              </div>

              {featuredItem && (
                <div className={`rounded-[28px] bg-gradient-to-br ${featuredItem.accent} p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.25)]`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
                    이번 주 추천
                  </div>
                  <div className="mt-3 text-2xl font-bold">{featuredItem.title}</div>
                  <p className="mt-3 text-sm leading-6 text-white/85">
                    {featuredItem.summary}
                  </p>
                  <div className="mt-6 rounded-[24px] bg-white/12 p-4 backdrop-blur-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                      공유 포맷
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {featuredItem.assets.map((asset) => (
                        <span
                          key={asset.id}
                          className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                        >
                          {asset.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 px-4 sm:px-8">
          <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-[32px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-slate-900">
                    새 캠페인 공유
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    포스터, 활동지, PDF 자료를 여기서 바로 묶어 올릴 수 있어요.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {isAuthenticated ? '로그인됨' : '미리보기 모드'}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">제목</span>
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="예: 세계시장 캠페인 포스터 세트"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-700">형태</span>
                    <select
                      value={draftCategory}
                      onChange={(event) =>
                        setDraftCategory(
                          event.target.value as Exclude<CampaignCategory, 'all'>
                        )
                      }
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      {categoryOptions
                        .filter((option) => option.key !== 'all')
                        .map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-700">집중 포맷</span>
                    <input
                      value={draftFocus}
                      onChange={(event) => setDraftFocus(event.target.value)}
                      placeholder="예: 포스터 + 리플렛"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">설명</span>
                  <textarea
                    value={draftSummary}
                    onChange={(event) => setDraftSummary(event.target.value)}
                    rows={4}
                    placeholder="무엇을 공유하는지, 어디에 쓰면 좋은지 간단히 적어주세요."
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">태그</span>
                  <input
                    value={draftTags}
                    onChange={(event) => setDraftTags(event.target.value)}
                    placeholder="예: 전시, 포스터, 협업"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
              </div>

              <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      자료 업로드
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      이미지/PDF 최대 {MAX_FILES}개, 파일당 2MB 이하
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
                    파일 선택
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="hidden"
                      onChange={handleFilesSelected}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3">
                  {draftFiles.length === 0 && (
                    <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500">
                      아직 첨부한 자료가 없습니다.
                    </div>
                  )}
                  {draftFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3"
                    >
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${
                        file.type === 'pdf'
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-sky-100 text-sky-700'
                      }`}>
                        {file.type === 'image' && file.previewUrl ? (
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold uppercase">
                            {file.type}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {file.name}
                        </div>
                        <div className="text-xs text-slate-500">{file.sizeLabel}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftFile(file.id)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {uploadError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {uploadError}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="text-xs leading-5 text-slate-500">
                  현재는 브라우저 저장 기반 MVP입니다. 같은 브라우저에서는 바로 다시 볼 수 있습니다.
                </p>
                <button
                  type="submit"
                  disabled={isPosting}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isPosting ? '게시 중...' : '캠페인 올리기'}
                </button>
              </div>
            </form>

            <div className="rounded-[32px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-slate-900">
                    캠페인 보드
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    도서관과 별도로, 다양한 교실 산출물을 아카이브하는 공간입니다.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                  총 {filteredItems.length}개
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {categoryOptions.map((option) => {
                  const active = selectedCategory === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSelectedCategory(option.key)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-5">
                {filteredItems.map((item) => (
                  <CampaignCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
