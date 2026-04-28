import type { CampaignStatus } from '@/types/database';
import { getEffectiveCampaignStatus } from '@/lib/campaign-deadline';

const statusConfig: Record<CampaignStatus, { label: string; classes: string }> = {
  draft: {
    label: '작성 중',
    classes: 'bg-slate-100 text-slate-500',
  },
  active: {
    label: '참여 가능',
    classes: 'bg-emerald-50 text-emerald-600',
  },
  closed: {
    label: '마감됨',
    classes: 'bg-rose-50 text-rose-500',
  },
};

export default function CampaignStatusBadge({
  status,
  deadline = null,
}: {
  status: CampaignStatus;
  deadline?: string | null;
}) {
  const config = statusConfig[getEffectiveCampaignStatus({ status, deadline })];
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.2em] ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
