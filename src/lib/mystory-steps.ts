/**
 * MyStory 8-step routing helper.
 * Maps current_step to the appropriate route.
 */

export const STEP_ROUTES: Record<number, string> = {
  1: '',            // /book/[id]/mystory
  2: '/write',      // /book/[id]/mystory/write
  3: '/draft',      // /book/[id]/mystory/draft
  4: '/scenes',     // /book/[id]/mystory/scenes
  5: '/characters', // /book/[id]/mystory/characters
  6: '/style',      // /book/[id]/mystory/style
  7: '/creating',   // /book/[id]/mystory/creating
  8: '/finish',     // /book/[id]/mystory/finish
};

export const TOTAL_STEPS = 8;

export function getStepRoute(bookId: string, step: number, storyId: string): string {
  const suffix = STEP_ROUTES[step] ?? '';
  return `/book/${bookId}/mystory${suffix}?storyId=${storyId}`;
}
