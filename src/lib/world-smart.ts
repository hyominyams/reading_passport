import type { AnswerModerationStatus, QuestionBoardCategory } from '@/types/database';

export type WorldSmartTabKey = 'all' | QuestionBoardCategory;

export interface WorldSmartCategoryMeta {
  key: QuestionBoardCategory;
  label: string;
  shortLabel: string;
  icon: string;
  accentClass: string;
  chipClass: string;
}

export interface WorldSmartBadgeTier {
  minAccepted: number;
  label: string;
  icon: string;
  toneClass: string;
  ringClass: string;
  helper: string;
}

export interface WorldSmartAuthor {
  id: string;
  nickname: string;
  avatarEmoji: string | null;
}

export interface WorldSmartAnswerItem {
  id: string;
  postId: string;
  author: WorldSmartAuthor;
  content: string;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  isAdopted: boolean;
}

export interface WorldSmartPostItem {
  id: string;
  bookId: string;
  questionType: QuestionBoardCategory;
  questionText: string;
  createdAt: string;
  updatedAt: string;
  adoptedAnswerId: string | null;
  author: WorldSmartAuthor;
  isMine: boolean;
  answers: WorldSmartAnswerItem[];
  myAnswerId: string | null;
}

export interface WorldSmartBoardData {
  bookTitle: string | null;
  posts: WorldSmartPostItem[];
}

export interface WorldSmartQuestionPayload {
  content?: string[];
  character?: string[];
  world?: string[];
}

export interface MyWorldSmartQuestionItem {
  id: string;
  bookId: string;
  bookTitle: string | null;
  questionType: QuestionBoardCategory;
  questionText: string;
  adoptedAnswerId: string | null;
  createdAt: string;
}

export interface MyWorldSmartSummary {
  acceptedAnswerCount: number;
  badge: ReturnType<typeof getWorldSmartBadge>;
  myQuestions: MyWorldSmartQuestionItem[];
}

export interface WorldSmartManagedAnswerItem extends WorldSmartAnswerItem {
  moderationStatus: AnswerModerationStatus;
  moderatedAt: string | null;
  moderatedBy: WorldSmartAuthor | null;
  moderationReason: string | null;
}

export interface WorldSmartManagedPostItem {
  id: string;
  bookId: string;
  bookTitle: string | null;
  countryId: string | null;
  teacherId: string;
  teacherName: string;
  className: string;
  questionType: QuestionBoardCategory;
  questionText: string;
  createdAt: string;
  updatedAt: string;
  adoptedAnswerId: string | null;
  author: WorldSmartAuthor;
  answers: WorldSmartManagedAnswerItem[];
  visibleAnswerCount: number;
  hiddenAnswerCount: number;
}

export interface WorldSmartManagedBookSummary {
  id: string;
  title: string | null;
  countryId: string | null;
  coverUrl: string | null;
  questionCount: number;
  visibleAnswerCount: number;
  hiddenAnswerCount: number;
  waitingCount: number;
  adoptedCount: number;
}

export interface WorldSmartManagementData {
  books: WorldSmartManagedBookSummary[];
  posts: WorldSmartManagedPostItem[];
}

export const WORLD_SMART_CATEGORY_ORDER: QuestionBoardCategory[] = [
  'content',
  'character',
  'world',
];

export const WORLD_SMART_CATEGORIES: WorldSmartCategoryMeta[] = [
  {
    key: 'content',
    label: '이야기',
    shortLabel: '이야기',
    icon: '📚',
    accentClass: 'text-sky-700',
    chipClass: 'border border-sky-200 bg-sky-50 text-sky-700',
  },
  {
    key: 'character',
    label: '인물',
    shortLabel: '인물',
    icon: '👤',
    accentClass: 'text-rose-700',
    chipClass: 'border border-rose-200 bg-rose-50 text-rose-700',
  },
  {
    key: 'world',
    label: '세계(배경)',
    shortLabel: '세계',
    icon: '🌍',
    accentClass: 'text-emerald-700',
    chipClass: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
];

export const WORLD_SMART_BADGE_TIERS: WorldSmartBadgeTier[] = [
  {
    minAccepted: 0,
    label: '질문 씨앗',
    icon: '🌱',
    toneClass: 'border border-stone-200 bg-stone-50 text-stone-700',
    ringClass: 'bg-stone-100 text-stone-700',
    helper: '답변이 채택되면 첫 배지가 열립니다.',
  },
  {
    minAccepted: 1,
    label: '첫 채택',
    icon: '✨',
    toneClass: 'border border-sky-200 bg-sky-50 text-sky-700',
    ringClass: 'bg-sky-100 text-sky-700',
    helper: '친구가 고른 답변이 생겼어요.',
  },
  {
    minAccepted: 3,
    label: '생각 메이트',
    icon: '💬',
    toneClass: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    ringClass: 'bg-emerald-100 text-emerald-700',
    helper: '질문에 이어지는 좋은 답변을 자주 남기고 있어요.',
  },
  {
    minAccepted: 5,
    label: '통찰 리더',
    icon: '🏅',
    toneClass: 'border border-amber-200 bg-amber-50 text-amber-700',
    ringClass: 'bg-amber-100 text-amber-700',
    helper: '생각을 넓혀 주는 답변이 꾸준히 채택되고 있어요.',
  },
  {
    minAccepted: 10,
    label: 'World Smart',
    icon: '👑',
    toneClass: 'border border-violet-200 bg-violet-50 text-violet-700',
    ringClass: 'bg-violet-100 text-violet-700',
    helper: '친구들의 생각을 깊게 만드는 답변가예요.',
  },
];

export function getWorldSmartCategoryMeta(category: QuestionBoardCategory) {
  return WORLD_SMART_CATEGORIES.find((item) => item.key === category) ?? WORLD_SMART_CATEGORIES[0];
}

export function getWorldSmartBadge(acceptedCount: number) {
  const current = [...WORLD_SMART_BADGE_TIERS]
    .reverse()
    .find((tier) => acceptedCount >= tier.minAccepted) ?? WORLD_SMART_BADGE_TIERS[0];

  const next = WORLD_SMART_BADGE_TIERS.find((tier) => tier.minAccepted > acceptedCount) ?? null;

  return {
    current,
    next,
    acceptedCount,
    remainingToNext: next ? Math.max(0, next.minAccepted - acceptedCount) : 0,
  };
}

export function isWorldSmartTabKey(value?: string | null): value is WorldSmartTabKey {
  return value === 'all' || WORLD_SMART_CATEGORY_ORDER.includes(value as QuestionBoardCategory);
}
