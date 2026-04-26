/**
 * My World routing helper.
 * `current_step` keeps the legacy DB values, while the UI displays the
 * 7 student-facing My World steps from DETAIL_STEP_SEQUENCE.
 */

export const STEP_ROUTES: Record<number, string> = {
  1: '',            // /book/[id]/mystory
  2: '',            // legacy freewrite step -> restart chat
  3: '/draft',      // /book/[id]/mystory/draft
  4: '/scenes',     // /book/[id]/mystory/scenes
  5: '/characters', // /book/[id]/mystory/characters
  6: '/style',      // /book/[id]/mystory/style
  7: '/creating',   // /book/[id]/mystory/creating
  8: '/complete',   // /book/[id]/mystory/complete
};

export const DETAIL_STEP_SEQUENCE = [1, 3, 4, 5, 6, 7, 8] as const;
export const DETAIL_STEP_TOTAL = DETAIL_STEP_SEQUENCE.length;
export const DETAIL_STEP_META: Array<{ step: (typeof DETAIL_STEP_SEQUENCE)[number]; label: string }> = [
  { step: 1, label: '이야기 채팅' },
  { step: 3, label: '이야기 바꿔 쓰기' },
  { step: 4, label: '장면 상상하기' },
  { step: 5, label: '주인공 설정' },
  { step: 6, label: '표지 디자인' },
  { step: 7, label: '그림책 제작' },
  { step: 8, label: '완성하기' },
];

export function getStepRoute(bookId: string, step: number, storyId: string): string {
  const suffix = STEP_ROUTES[step] ?? '';
  return `/book/${bookId}/mystory${suffix}?storyId=${storyId}`;
}

export function getStepRouteWithLang(
  bookId: string,
  step: number,
  storyId: string,
  lang?: string | null
): string {
  const base = getStepRoute(bookId, step, storyId);
  return lang ? `${base}&lang=${lang}` : base;
}

export function getDetailStepIndex(step: number): number {
  const currentIndex = DETAIL_STEP_SEQUENCE.indexOf(step as (typeof DETAIL_STEP_SEQUENCE)[number]);
  return currentIndex >= 0 ? currentIndex + 1 : 1;
}

export function getDetailStepLabel(step: number): string {
  return DETAIL_STEP_META.find((item) => item.step === step)?.label ?? '이야기 채팅';
}

export function getDetailStepProgressLabel(step: number): string {
  return `My World ${getDetailStepIndex(step)}/${DETAIL_STEP_TOTAL} · ${getDetailStepLabel(step)}`;
}

export function getAdjacentDetailSteps(step: number): { previousStep: number | null; nextStep: number | null } {
  const currentIndex = DETAIL_STEP_SEQUENCE.indexOf(step as (typeof DETAIL_STEP_SEQUENCE)[number]);
  if (currentIndex < 0) {
    return { previousStep: null, nextStep: null };
  }

  return {
    previousStep: DETAIL_STEP_SEQUENCE[currentIndex - 1] ?? null,
    nextStep: DETAIL_STEP_SEQUENCE[currentIndex + 1] ?? null,
  };
}
