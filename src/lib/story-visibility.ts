import type { Visibility } from '@/types/database';

export const STORY_VISIBILITY_OPTIONS = ['public', 'secret'] as const satisfies readonly Visibility[];

export function normalizeStoryVisibility(value: unknown): Visibility {
  return value === 'public' ? 'public' : 'secret';
}

export function getStoryVisibilityLabel(value: unknown) {
  return normalizeStoryVisibility(value) === 'public' ? '전체 공개' : '비밀';
}
