'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Campaign } from '@/types/database';
import CampaignStatusBadge from './CampaignStatusBadge';

const ACCENT_COLORS = [
  'from-[#1d4ed8] via-[#2563eb] to-[#60a5fa]',
  'from-[#7c3aed] via-[#8b5cf6] to-[#c4b5fd]',
  'from-[#047857] via-[#10b981] to-[#6ee7b7]',
  'from-[#b45309] via-[#f59e0b] to-[#fcd34d]',
  'from-[#be185d] via-[#ec4899] to-[#f9a8d4]',
  'from-[#0369a1] via-[#0ea5e9] to-[#7dd3fc]',
];

function getAccent(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return '마감됨';
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '오늘 마감';
  if (days === 1) return '내일 마감';
  return `${days}일 남음`;
}

export default function CampaignCard({
  campaign,
  submissionCount,
}: {
  campaign: Campaign;
  submissionCount?: number;
}) {
  const accent = getAccent(campaign.id);
  const deadlineLabel = formatDeadline(campaign.deadline);

  return (
    <Link href={`/campaign/${campaign.id}`}>
      <motion.article
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="group overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
      >
        {/* Accent strip */}
        <div className={`h-2 w-full bg-gradient-to-r ${accent}`} />

        {/* Cover area */}
        {campaign.cover_image_url ? (
          <div className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={campaign.cover_image_url}
              alt={campaign.title}
              className="h-40 w-full object-cover transition-transform group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div
            className={`flex h-32 items-end bg-gradient-to-br ${accent} p-5 text-white`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
              Campaign
            </div>
          </div>
        )}

        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            {deadlineLabel && (
              <span className="text-[11px] font-medium text-slate-400">
                {deadlineLabel}
              </span>
            )}
          </div>

          <h3 className="font-heading text-lg font-bold text-slate-900 line-clamp-2">
            {campaign.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 line-clamp-2">
            {campaign.description}
          </p>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {campaign.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
            {submissionCount != null && (
              <span className="text-xs text-slate-400">
                {submissionCount}명 참여
              </span>
            )}
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
