/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';
import type { CampaignAssetMeta, CampaignContentType, SubmissionStatus } from '@/types/database';
import { getAvatarEmoji } from '@/lib/profile';

const contentTypeLabels: Record<CampaignContentType, string> = {
  poster: '포스터',
  card_news: '카드뉴스',
  impression: '감상문',
  culture_intro: '문화 소개',
  worksheet: '활동지',
  other: '기타',
};

interface SubmissionCardProps {
  submission: {
    id: string;
    title: string;
    content_type: CampaignContentType;
    assets: CampaignAssetMeta[];
    status: SubmissionStatus;
    student?: { id: string; nickname: string | null; avatar: string | null } | null;
    like_count: number;
    liked_by_me: boolean;
  };
  onLike?: (submissionId: string) => void;
  onClick?: () => void;
  onFeature?: (submissionId: string) => void;
  isTeacher?: boolean;
}

export default function SubmissionCard({
  submission,
  onLike,
  onClick,
  onFeature,
  isTeacher,
}: SubmissionCardProps) {
  const coverAsset = submission.assets.find((a) => a.type === 'image');
  const nickname = submission.student?.nickname ?? '익명';
  const avatarEmoji = getAvatarEmoji(submission.student?.avatar);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
      onClick={onClick}
    >
      {/* Cover */}
      {coverAsset ? (
        <div className="relative overflow-hidden">
          <img
            src={coverAsset.public_url}
            alt={submission.title}
            className="h-44 w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
          {submission.status === 'featured' && (
            <div className="absolute left-2 top-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-white">
              Featured
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center bg-slate-100">
          <span className="text-3xl font-bold text-slate-200">
            {submission.assets.length > 0 ? 'PDF' : '?'}
          </span>
        </div>
      )}

      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {contentTypeLabels[submission.content_type] ?? submission.content_type}
          </span>
        </div>

        <h3 className="font-heading text-sm font-semibold text-slate-900 line-clamp-1">
          {submission.title}
        </h3>

        <div className="mt-3 flex items-center justify-between">
          {/* Author */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px]">
              {avatarEmoji || nickname.charAt(0)}
            </div>
            <span className="text-xs text-slate-400">{nickname}</span>
          </div>

          {/* Like + teacher feature */}
          <div className="flex items-center gap-2">
            {isTeacher && onFeature && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFeature(submission.id);
                }}
                className={`rounded-lg p-1 text-xs transition ${
                  submission.status === 'featured'
                    ? 'text-amber-500'
                    : 'text-slate-300 hover:text-amber-400'
                }`}
                title={submission.status === 'featured' ? '추천 해제' : '추천'}
              >
                <svg className="h-4 w-4" fill={submission.status === 'featured' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLike?.(submission.id);
              }}
              className="flex items-center gap-1 text-xs"
            >
              <svg
                className={`h-4 w-4 transition ${
                  submission.liked_by_me ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'
                }`}
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
              <span className={submission.liked_by_me ? 'text-rose-500' : 'text-slate-400'}>
                {submission.like_count}
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
