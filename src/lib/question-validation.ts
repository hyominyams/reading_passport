export type QuestionCategoryKey = 'content' | 'character' | 'world' | 'inference';

export type QuestionThinkingType =
  | 'fact'
  | 'inference'
  | 'feeling'
  | 'application'
  | 'unknown';

export type QuestionIssueCode =
  | 'pass'
  | 'nonsense'
  | 'not_question'
  | 'too_broad'
  | 'not_book_grounded'
  | 'yes_no_only'
  | 'duplicate'
  | 'category_mismatch'
  | 'needs_specificity';

export interface QuestionFeedbackItem {
  index: number;
  question: string;
  valid: boolean;
  thinkingType: QuestionThinkingType;
  praise: string;
  problem: string;
  hint: string;
  example: string;
  issueCode: QuestionIssueCode;
}

export interface CategoryValidation {
  valid: boolean;
  feedback: string;
  invalidIndices: number[];
  questionFeedback: QuestionFeedbackItem[];
}

export interface QuestionValidationResult {
  content: CategoryValidation;
  character: CategoryValidation;
  world: CategoryValidation;
  inference: CategoryValidation;
  overall: boolean;
  overallFeedback: string;
  nextStep: string;
}

const CATEGORY_KEYS: QuestionCategoryKey[] = ['content', 'character', 'world', 'inference'];
const THINKING_TYPES = new Set<QuestionThinkingType>([
  'fact',
  'inference',
  'feeling',
  'application',
  'unknown',
]);
const ISSUE_CODES = new Set<QuestionIssueCode>([
  'pass',
  'nonsense',
  'not_question',
  'too_broad',
  'not_book_grounded',
  'yes_no_only',
  'duplicate',
  'category_mismatch',
  'needs_specificity',
]);

function normalizeIndices(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((item) => (typeof item === 'number' ? item : Number(item)))
      .filter((item) => Number.isInteger(item) && item >= 0)
  )].sort((left, right) => left - right);
}

function normalizeThinkingType(value: unknown): QuestionThinkingType {
  if (typeof value === 'string' && THINKING_TYPES.has(value as QuestionThinkingType)) {
    return value as QuestionThinkingType;
  }

  return 'unknown';
}

function normalizeIssueCode(value: unknown, valid: boolean): QuestionIssueCode {
  if (typeof value === 'string' && ISSUE_CODES.has(value as QuestionIssueCode)) {
    return value as QuestionIssueCode;
  }

  return valid ? 'pass' : 'needs_specificity';
}

function normalizeQuestionFeedbackItem(
  value: unknown,
  fallbackIndex: number,
): QuestionFeedbackItem {
  const raw = (value ?? {}) as Record<string, unknown>;
  const index = typeof raw.index === 'number' && raw.index >= 0 ? raw.index : fallbackIndex;
  const valid = typeof raw.valid === 'boolean' ? raw.valid : true;

  return {
    index,
    question: typeof raw.question === 'string' ? raw.question : '',
    valid,
    thinkingType: normalizeThinkingType(raw.thinkingType),
    praise: typeof raw.praise === 'string' ? raw.praise : '',
    problem: typeof raw.problem === 'string' ? raw.problem : '',
    hint: typeof raw.hint === 'string' ? raw.hint : '',
    example: typeof raw.example === 'string' ? raw.example : '',
    issueCode: normalizeIssueCode(raw.issueCode, valid),
  };
}

function normalizeCategory(value: unknown): CategoryValidation {
  const raw = (value ?? {}) as Record<string, unknown>;
  const normalizedQuestionFeedback = Array.isArray(raw.questionFeedback)
    ? raw.questionFeedback.map((item, index) => normalizeQuestionFeedbackItem(item, index))
    : [];

  const questionFeedbackByIndex = new Map<number, QuestionFeedbackItem>();
  for (const item of normalizedQuestionFeedback) {
    questionFeedbackByIndex.set(item.index, item);
  }

  const questionFeedback = [...questionFeedbackByIndex.values()].sort((left, right) => left.index - right.index);
  const invalidFromQuestions = questionFeedback
    .filter((item) => !item.valid)
    .map((item) => item.index);
  const invalidIndices = normalizeIndices(raw.invalidIndices);
  const mergedInvalidIndices = [...new Set([...invalidIndices, ...invalidFromQuestions])].sort(
    (left, right) => left - right,
  );
  const valid = mergedInvalidIndices.length === 0;

  return {
    valid,
    feedback: typeof raw.feedback === 'string'
      ? raw.feedback
      : valid
        ? '질문이 또렷하게 보여.'
        : '좋은 시작이야. 장면이나 이유를 조금 더 넣어 보자.',
    invalidIndices: mergedInvalidIndices,
    questionFeedback,
  };
}

export function normalizeQuestionValidation(value: unknown): QuestionValidationResult {
  const raw = (value ?? {}) as Record<string, unknown>;
  const normalized = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, normalizeCategory(raw[key])])
  ) as Record<QuestionCategoryKey, CategoryValidation>;
  const overall = CATEGORY_KEYS.every((key) => normalized[key].valid);

  return {
    content: normalized.content,
    character: normalized.character,
    world: normalized.world,
    inference: normalized.inference,
    overall,
    overallFeedback: typeof raw.overallFeedback === 'string'
      ? raw.overallFeedback
      : overall
        ? '질문이 책을 읽은 흔적을 잘 보여 주고 있어.'
        : '좋은 질문 씨앗이 보여. 힌트를 보고 한 문장씩 더 또렷하게 바꿔 보자.',
    nextStep: typeof raw.nextStep === 'string'
      ? raw.nextStep
      : overall
        ? '마음에 드는 질문을 하나 골라 친구와 더 이야기해 봐도 좋아.'
        : '장면, 인물, 이유 가운데 하나를 더 넣어 다시 제출해 보자.',
  };
}
