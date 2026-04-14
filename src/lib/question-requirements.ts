export type QuestionCategoryKey = 'content' | 'character' | 'world' | 'inference';

export interface QuestionRequirement {
  key: QuestionCategoryKey;
  required: number;
  max: number;
}

const BASE_REQUIREMENTS: QuestionRequirement[] = [
  { key: 'content', required: 1, max: 3 },
  { key: 'character', required: 1, max: 3 },
  { key: 'world', required: 1, max: 3 },
  { key: 'inference', required: 1, max: 2 },
];

const EXTRA_DISTRIBUTION_ORDER: QuestionCategoryKey[] = [
  'content',
  'character',
  'world',
  'inference',
  'content',
  'character',
  'world',
];

export function clampRequiredQuestionCount(count?: number | null) {
  const normalized = Math.round(Number(count ?? 7));
  if (!Number.isFinite(normalized)) {
    return 7;
  }

  return Math.max(4, Math.min(11, normalized));
}

export function buildQuestionRequirements(count?: number | null) {
  const total = clampRequiredQuestionCount(count);
  const requirements = BASE_REQUIREMENTS.map((item) => ({ ...item }));
  const extraCount = total - BASE_REQUIREMENTS.reduce((sum, item) => sum + item.required, 0);

  for (let index = 0; index < extraCount; index += 1) {
    const key = EXTRA_DISTRIBUTION_ORDER[index];
    const target = requirements.find((item) => item.key === key);

    if (target && target.required < target.max) {
      target.required += 1;
    }
  }

  return requirements;
}
