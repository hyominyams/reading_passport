/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CampaignAssetMeta, CampaignContentType } from '@/types/database';
import { getAvatarEmoji } from '@/lib/profile';

const contentTypeLabels: Record<CampaignContentType, string> = {
  poster: '포스터',
  card_news: '카드뉴스',
  impression: '감상문',
  culture_intro: '문화 소개',
  worksheet: '활동지',
  other: '기타',
};

interface SubmissionViewerProps {
  submission: {
    id: string;
    title: string;
    description: string | null;
    content_type: CampaignContentType;
    assets: CampaignAssetMeta[];
    created_at: string;
    student?: { id: string; nickname: string | null; avatar: string | null } | null;
    like_count: number;
    liked_by_me: boolean;
  };
  onClose: () => void;
  onLike?: (submissionId: string) => void;
}

export default function SubmissionViewerModal({
  submission,
  onClose,
  onLike,
}: SubmissionViewerProps) {
  const imageAssets = submission.assets.filter((a) => a.type === 'image');
  const pdfAssets = submission.assets.filter((a) => a.type === 'pdf');
  const [currentImage, setCurrentImage] = useState(0);

  const nickname = submission.student?.nickname ?? '익명';
  const avatarEmoji = getAvatarEmoji(submission.student?.avatar);
  const dateStr = new Date(submission.created_at).toLocaleDateString('ko-KR');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image gallery */}
          {imageAssets.length > 0 && (
            <div className="relative">
              <img
                src={imageAssets[currentImage].public_url}
                alt={submission.title}
                className="w-full max-h-[50vh] object-contain bg-slate-100"
              />

              {/* Image nav */}
              {imageAssets.length > 1 && (
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {imageAssets.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentImage(i)}
                      className={`h-2 w-2 rounded-full transition ${
                        i === currentImage ? 'bg-white' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}

              {imageAssets.length > 1 && currentImage > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentImage((p) => p - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm hover:bg-black/50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
              )}
              {imageAssets.length > 1 && currentImage < imageAssets.length - 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentImage((p) => p + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm hover:bg-black/50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6 sm:p-8">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
              {contentTypeLabels[submission.content_type] ?? submission.content_type}
            </span>

            <h2 className="mt-3 font-heading text-xl font-bold text-slate-900">
              {submission.title}
            </h2>

            {submission.description && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {submission.description}
              </p>
            )}

            {/* Author & date */}
            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm">
                {avatarEmoji || nickname.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">{nickname}</p>
                <p className="text-xs text-slate-400">{dateStr}</p>
              </div>

              {/* Like */}
              <button
                type="button"
                onClick={() => onLike?.(submission.id)}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-sm transition hover:bg-slate-50"
              >
                <svg
                  className={`h-4 w-4 ${submission.liked_by_me ? 'text-rose-500' : 'text-slate-400'}`}
                  fill={submission.liked_by_me ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
                <span className={submission.liked_by_me ? 'text-rose-500 font-medium' : 'text-slate-500'}>
                  {submission.like_count}
                </span>
              </button>
            </div>

            {/* PDF downloads */}
            {pdfAssets.length > 0 && (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  첨부 PDF
                </p>
                {pdfAssets.map((asset) => (
                  <a
                    key={asset.id}
                    href={asset.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:bg-slate-100"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-500">
                      PDF
                    </div>
                    <span className="truncate text-sm text-slate-700">{asset.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
