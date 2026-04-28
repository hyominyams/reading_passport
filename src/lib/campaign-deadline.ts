import type { CampaignStatus } from '@/types/database';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CampaignDeadlineState = {
  status: CampaignStatus;
  deadline: string | null;
};

function parseDateOnlyAsEndOfDay(deadline: string) {
  const [year, month, day] = deadline.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function parseUtcMidnightAsEndOfDay(deadline: string) {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;

  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (!isUtcMidnight) return null;

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999
  ).getTime();
}

export function getCampaignDeadlineTime(deadline: string | null) {
  if (!deadline) return null;

  const deadlineTime = DATE_ONLY_PATTERN.test(deadline)
    ? parseDateOnlyAsEndOfDay(deadline)
    : parseUtcMidnightAsEndOfDay(deadline) ?? new Date(deadline).getTime();

  return Number.isNaN(deadlineTime) ? null : deadlineTime;
}

export function normalizeCampaignDeadlineInput(deadline: string | null | undefined) {
  if (!deadline) return null;

  const deadlineTime = DATE_ONLY_PATTERN.test(deadline)
    ? parseDateOnlyAsEndOfDay(deadline)
    : new Date(deadline).getTime();

  return Number.isNaN(deadlineTime) ? null : new Date(deadlineTime).toISOString();
}

export function isCampaignPastDeadline(deadline: string | null, now = new Date()) {
  const deadlineTime = getCampaignDeadlineTime(deadline);
  return deadlineTime !== null && now.getTime() > deadlineTime;
}

export function isCampaignParticipationOpen(
  campaign: CampaignDeadlineState,
  now = new Date()
) {
  return campaign.status === 'active' && !isCampaignPastDeadline(campaign.deadline, now);
}

export function getEffectiveCampaignStatus(
  campaign: CampaignDeadlineState,
  now = new Date()
): CampaignStatus {
  if (campaign.status === 'active' && isCampaignPastDeadline(campaign.deadline, now)) {
    return 'closed';
  }

  return campaign.status;
}
