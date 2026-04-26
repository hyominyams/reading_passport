import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { buildBookAnalysisPromptContext } from '@/lib/book-analysis';
import { getLatestCompletedBookAnalysis } from '@/lib/queries/book-analyses';
import {
  normalizeQuestionValidation,
  type QuestionCategoryKey,
  type QuestionFeedbackItem,
  type QuestionThinkingType,
  type QuestionValidationResult,
} from '@/lib/question-validation';
import { createClient } from '@/lib/supabase/server';
import type { BookAnalysis } from '@/types/database';

type QuestionsPayload = Record<QuestionCategoryKey, string[]>;
type BookContextSource = 'analysis' | 'partial_analysis' | 'none';

interface BookContext {
  title: string;
  countryId: string;
  text: string;
  source: BookContextSource;
  reliable: boolean;
}

const CATEGORY_KEYS: QuestionCategoryKey[] = ['content', 'character', 'world'];
const MIN_RELIABLE_CONTEXT_CHARS = 180;
const MAX_BOOK_CONTEXT_CHARS = 12000;
const QUESTION_SIGNAL_PATTERN =
  /[?？]|왜|무엇|뭐|누가|어디|언제|어떻게|어떤|얼마|몇|이유|궁금|일까|일까요|인가요|인가|나요|까요|했나요|했을까|할까|됩니까|습니까/;
const DEFAULT_THINKING_TYPE: Record<QuestionCategoryKey, QuestionThinkingType> = {
  content: 'fact',
  character: 'feeling',
  world: 'fact',
};

function buildFallbackQuestionFeedback(
  category: QuestionCategoryKey,
  question: string,
  index: number,
  invalid: boolean,
): QuestionFeedbackItem {
  const trimmedQuestion = question.trim();

  return {
    index,
    question: trimmedQuestion,
    valid: !invalid,
    thinkingType: DEFAULT_THINKING_TYPE[category],
    praise: invalid
      ? '무엇이 궁금한지 말해 보려는 시작은 좋아.'
      : '무엇을 묻고 싶은지 초점이 보여.',
    problem: invalid
      ? '책 속 장면이나 인물, 이유가 조금 더 또렷하면 좋아.'
      : '',
    hint: invalid
      ? '누가, 어떤 장면에서, 왜 그런지 가운데 하나를 더 넣어 보자.'
      : '다음에는 장면이나 이유를 한 가지 더 넣으면 더 깊어져.',
    example: invalid
      ? `${trimmedQuestion.replace(/[?？]\s*$/, '')} 왜 그랬을까요?`
      : '',
    issueCode: invalid ? 'needs_specificity' : 'pass',
  };
}

function truncateContext(text: string) {
  const normalized = text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  if (normalized.length <= MAX_BOOK_CONTEXT_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_BOOK_CONTEXT_CHARS).trim()}\n\n[이하 생략]`;
}

function hasReliableAnalysisContext(
  analysis: BookAnalysis,
  contextText: string,
) {
  const eventCount = analysis.plot_points.length + analysis.key_events.length;

  return contextText.length >= MIN_RELIABLE_CONTEXT_CHARS
    && (
      analysis.detailed_story_summary.length >= 80
      || analysis.story_summary.length >= 80
      || eventCount >= 3
      || analysis.characters.length >= 1
    );
}

async function resolveBookContext(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  bookId?: string;
  fallbackTitle?: string;
  fallbackCountryId?: string;
}): Promise<BookContext> {
  const fallbackContext: BookContext = {
    title: options.fallbackTitle ?? '(제목 미정)',
    countryId: options.fallbackCountryId ?? '미정',
    text: '',
    source: 'none',
    reliable: false,
  };

  if (!options.bookId) {
    return fallbackContext;
  }

  try {
    const { data: book, error } = await options.supabase
      .from('books')
      .select('title, country_id')
      .eq('id', options.bookId)
      .maybeSingle();

    if (error || !book) {
      if (error) {
        console.warn('Failed to resolve book context for question validation:', error);
      }
      return fallbackContext;
    }

    const title = typeof book.title === 'string' ? book.title : fallbackContext.title;
    const countryId = typeof book.country_id === 'string' ? book.country_id : fallbackContext.countryId;
    const analysisRecord = await getLatestCompletedBookAnalysis(options.supabase, options.bookId);
    const analysis = analysisRecord?.analysis_json;

    if (!analysis) {
      return {
        title,
        countryId,
        text: '',
        source: 'none',
        reliable: false,
      };
    }

    const analysisText = truncateContext(buildBookAnalysisPromptContext(analysis));

    if (hasReliableAnalysisContext(analysis, analysisText)) {
      return {
        title,
        countryId,
        text: analysisText,
        source: 'analysis',
        reliable: true,
      };
    }

    return {
      title,
      countryId,
      text: analysisText,
      source: analysisText ? 'partial_analysis' : 'none',
      reliable: false,
    };
  } catch (error) {
    console.warn('Unexpected book context resolution error:', error);
    return fallbackContext;
  }
}

function buildQuestionLikeExample(category: QuestionCategoryKey) {
  if (category === 'character') {
    return '그 인물은 왜 그런 선택을 했을까요?';
  }

  if (category === 'world') {
    return '이 나라의 생활 모습은 이야기와 어떻게 이어질까요?';
  }

  return '이 장면에서 왜 그런 일이 일어났을까요?';
}

function buildDeterministicInvalidFeedback(
  category: QuestionCategoryKey,
  question: string,
  index: number,
  issueCode: QuestionFeedbackItem['issueCode'],
): QuestionFeedbackItem {
  const trimmedQuestion = question.trim();
  const shared = {
    index,
    question: trimmedQuestion,
    valid: false,
    thinkingType: DEFAULT_THINKING_TYPE[category],
    praise: '궁금한 대상을 적어 둔 점은 좋아.',
    example: buildQuestionLikeExample(category),
    issueCode,
  } satisfies Omit<QuestionFeedbackItem, 'problem' | 'hint'>;

  if (issueCode === 'nonsense') {
    return {
      ...shared,
      praise: '',
      problem: '질문으로 읽기 어려운 글자예요.',
      hint: '책에서 궁금했던 장면이나 인물을 넣어 한 문장으로 써 주세요.',
    };
  }

  if (issueCode === 'not_question') {
    return {
      ...shared,
      problem: '아직 질문 문장으로 보이지 않아요.',
      hint: '왜, 무엇, 어떻게, 어떤 같은 말로 궁금한 점을 물어보세요.',
    };
  }

  return {
    ...shared,
    problem: '질문이 너무 짧아 무엇이 궁금한지 알기 어려워요.',
    hint: '장면, 인물, 배경 가운데 하나를 더 넣어 질문을 완성해 주세요.',
  };
}

function detectDeterministicIssue(question: string): QuestionFeedbackItem['issueCode'] | null {
  const trimmed = question.trim();
  const compact = trimmed.replace(/\s/g, '');

  if (!compact) {
    return 'not_question';
  }

  if (/^(.)\1{4,}$/.test(compact) || /^[ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]{1,3}$/.test(compact)) {
    return 'nonsense';
  }

  if (compact.length < 6) {
    return 'needs_specificity';
  }

  if (!QUESTION_SIGNAL_PATTERN.test(trimmed)) {
    return 'not_question';
  }

  return null;
}

function applyDeterministicChecks(
  validation: QuestionValidationResult,
  questionsByCategory: QuestionsPayload,
  hasReliableBookContext: boolean,
): QuestionValidationResult {
  const next: QuestionValidationResult = {
    ...validation,
    content: validation.content,
    character: validation.character,
    world: validation.world,
  };

  for (const category of CATEGORY_KEYS) {
    const categoryValidation = validation[category];
    const questionFeedback = categoryValidation.questionFeedback.map((item) => {
      const question = questionsByCategory[category][item.index] ?? item.question;
      const deterministicIssue = detectDeterministicIssue(question);

      if (deterministicIssue) {
        return buildDeterministicInvalidFeedback(category, question, item.index, deterministicIssue);
      }

      if (!hasReliableBookContext && item.issueCode === 'not_book_grounded') {
        return {
          ...item,
          question,
          valid: true,
          problem: '',
          issueCode: 'pass' as const,
          hint: item.hint || '책 속 장면이나 인물과 이어지는 말을 한 가지 더 넣으면 더 또렷해져요.',
        };
      }

      return {
        ...item,
        question,
      };
    });

    const invalidIndices = questionFeedback
      .filter((item) => !item.valid)
      .map((item) => item.index);

    next[category] = {
      ...categoryValidation,
      valid: invalidIndices.length === 0,
      invalidIndices,
      questionFeedback,
      feedback: invalidIndices.length === 0
        ? categoryValidation.feedback
        : '표시된 질문을 한 문장으로 더 또렷하게 고쳐 주세요.',
    };
  }

  const overall = CATEGORY_KEYS.every((category) => next[category].valid);

  return {
    ...next,
    overall,
    overallFeedback: overall
      ? validation.overallFeedback
      : '표시된 질문만 조금 더 또렷하게 고치면 제출할 수 있어요.',
    nextStep: overall
      ? validation.nextStep
      : '고쳐 볼 질문의 조언을 보고 다시 확인해 주세요.',
  };
}

function fillQuestionCoverage(
  validation: QuestionValidationResult,
  questionsByCategory: QuestionsPayload,
): QuestionValidationResult {
  const next: QuestionValidationResult = {
    ...validation,
    content: validation.content,
    character: validation.character,
    world: validation.world,
  };

  for (const category of CATEGORY_KEYS) {
    const categoryValidation = validation[category];
    const questionMap = new Map<number, QuestionFeedbackItem>();

    for (const item of categoryValidation.questionFeedback) {
      questionMap.set(item.index, {
        ...item,
        question: item.question || questionsByCategory[category][item.index] || '',
      });
    }

    questionsByCategory[category].forEach((question, index) => {
      if (!questionMap.has(index)) {
        questionMap.set(
          index,
          buildFallbackQuestionFeedback(
            category,
            question,
            index,
            categoryValidation.invalidIndices.includes(index),
          ),
        );
      }
    });

    const questionFeedback = [...questionMap.values()].sort((left, right) => left.index - right.index);
    const invalidIndices = [...new Set([
      ...categoryValidation.invalidIndices,
      ...questionFeedback.filter((item) => !item.valid).map((item) => item.index),
    ])].sort((left, right) => left - right);

    next[category] = {
      ...categoryValidation,
      valid: invalidIndices.length === 0,
      invalidIndices,
      questionFeedback,
    };
  }

  const overall = CATEGORY_KEYS.every((category) => next[category].valid);

  return {
    ...next,
    overall,
    overallFeedback: validation.overallFeedback || (
      overall
        ? '질문이 책을 읽은 흔적을 잘 보여 주고 있어.'
        : '표시된 질문만 조금 더 또렷하게 고치면 제출할 수 있어요.'
    ),
    nextStep: validation.nextStep || (
      overall
        ? '마음에 드는 질문을 하나 골라 친구와 더 이야기해 봐도 좋아.'
        : '고쳐 볼 질문의 조언을 보고 다시 확인해 주세요.'
    ),
  };
}

function buildHeuristicValidation(questionsByCategory: QuestionsPayload): QuestionValidationResult {
  const categoryEntries = Object.fromEntries(
    CATEGORY_KEYS.map((category) => {
      const invalidIndices = questionsByCategory[category]
        .map((question, index) => (detectDeterministicIssue(question) ? index : -1))
        .filter((index) => index >= 0);
      const valid = invalidIndices.length === 0;

      return [category, {
        valid,
        feedback: valid
          ? '질문의 초점이 잘 보여.'
          : '표시된 질문을 한 문장으로 더 또렷하게 고쳐 주세요.',
        invalidIndices,
        questionFeedback: questionsByCategory[category].map((question, index) => {
          const issueCode = detectDeterministicIssue(question);
          return issueCode
            ? buildDeterministicInvalidFeedback(category, question, index, issueCode)
            : buildFallbackQuestionFeedback(category, question, index, false);
        }),
      }];
    })
  ) as Record<QuestionCategoryKey, QuestionValidationResult[QuestionCategoryKey]>;

  const overall = CATEGORY_KEYS.every((category) => categoryEntries[category].valid);

  return {
    content: categoryEntries.content,
    character: categoryEntries.character,
    world: categoryEntries.world,
    overall,
    overallFeedback: overall
      ? '질문이 책을 읽고 스스로 생각한 흔적을 잘 보여 주고 있어.'
      : '표시된 질문만 조금 더 또렷하게 고치면 제출할 수 있어요.',
    nextStep: overall
      ? '이제 친구들과 질문을 나누며 생각을 더 넓혀 보자.'
      : '고쳐 볼 질문의 조언을 보고 다시 확인해 주세요.',
  };
}

async function readJsonPayload(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const payload = await request.json();
    return payload && typeof payload === 'object'
      ? payload as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizeQuestionsPayload(value: unknown): QuestionsPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<QuestionCategoryKey, unknown>;
  const normalized = Object.fromEntries(
    CATEGORY_KEYS.map((category) => {
      const questions = Array.isArray(source[category])
        ? source[category]
          .filter((question): question is string => typeof question === 'string')
          .map((question) => question.trim())
          .filter(Boolean)
        : null;

      return [category, questions];
    })
  ) as Record<QuestionCategoryKey, string[] | null>;

  if (CATEGORY_KEYS.some((category) => normalized[category] === null)) {
    return null;
  }

  return normalized as QuestionsPayload;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await readJsonPayload(request);

    if (!payload) {
      return Response.json({ error: '요청 데이터가 없습니다.' }, { status: 400 });
    }

    const questionsByCategory = normalizeQuestionsPayload(payload.questions);

    if (!questionsByCategory) {
      return Response.json({ error: '질문 데이터가 없습니다.' }, { status: 400 });
    }

    const resolvedBookContext = await resolveBookContext({
      supabase,
      bookId: typeof payload.bookId === 'string'
        ? payload.bookId
        : typeof payload.book_id === 'string'
          ? payload.book_id
          : undefined,
      fallbackTitle: typeof payload.book_title === 'string' ? payload.book_title : undefined,
      fallbackCountryId: typeof payload.country_id === 'string' ? payload.country_id : undefined,
    });
    const bookContextSection = resolvedBookContext.text
      ? `[도서 맥락: ${resolvedBookContext.source}]\n${resolvedBookContext.text}`
      : '[도서 맥락]\n책 본문이나 분석 정보를 충분히 불러오지 못했습니다.';

    const systemPrompt = `당신은 초등학생의 독서 질문을 코칭하는 친절한 선생님입니다.
학생이 그림책 "${resolvedBookContext.title}" (국가: ${resolvedBookContext.countryId})을 읽고 만든 질문을 살펴보고, 통과 여부보다 "어떻게 더 좋은 질문으로 바꿀 수 있는지"를 알려 주세요.

[도서 정보]
제목: ${resolvedBookContext.title}
국가: ${resolvedBookContext.countryId}
도서 맥락 사용 가능: ${resolvedBookContext.reliable ? '예' : '아니오'}

${bookContextSection}

[중요한 관점]
- 질문은 생각을 여는 도구입니다. 완벽한 질문만 찾지 마세요.
- 학생이 책을 읽고 자기 생각으로 질문을 만들었다면 최대한 관대하게 인정하세요.
- 아래 경우만 invalid로 판단하세요.
  1. 의미 없는 글자 나열
  2. 질문이 아닌 감상문
  3. 구체적 대상 없이 네/아니오만 요구하는 질문
  4. 책 속 장면, 인물, 나라와 거의 연결되지 않는 질문
  5. 같은 뜻의 질문을 거의 반복한 경우
  6. 카테고리가 너무 어긋난 경우
- 네/아니오로 답할 수 있는 질문도 구체적인 장면, 인물, 배경을 묻고 있으면 valid로 인정하세요.

[도서 맥락 사용 규칙]
- 도서 맥락 사용 가능이 "예"일 때만 책 내용과의 연결성을 판단하세요.
- 도서 맥락 사용 가능이 "아니오"이면 not_book_grounded로 불합격 처리하지 말고, 질문 문장인지와 카테고리에 맞는지만 확인하세요.
- 도서 맥락에 없는 인물, 장소, 사건, 나라 정보를 지어내지 마세요.
- 학생 질문에 짧은 단어 조각만 있으면 그 단어를 추측해 확장하지 말고, 질문 문장으로 완성하도록 안내하세요.
- 예시 질문은 학생이 쓴 말과 도서 맥락에 나온 표현만 사용하세요. 확실하지 않으면 일반적인 문장 틀로 제안하세요.

[사고 유형 분류]
- fact: 보이는 것, 책에서 바로 확인 가능한 질문
- inference: 짐작, 이유나 결과를 생각하게 하는 질문
- feeling: 생각/느낌, 인물의 마음이나 자신의 감정을 묻는 질문
- application: 바꾸면?, 다른 선택, 삶에 적용, 새 아이디어를 묻는 질문

[카테고리]
- content: 이야기에서 더 알고 싶은 것, 사건, 흐름, 중요한 장면
- character: 인물을 더 이해하기 위한 질문, 마음, 관계, 성격, 선택, 변화
- world: 세계(배경), 나라, 문화, 장소, 생활, 사회적 배경에 대한 질문

[피드백 작성 규칙]
- 카테고리별 feedback은 1~2문장으로 적습니다.
- questionFeedback은 질문마다 반드시 하나씩 만듭니다.
- praise: 그 질문의 좋은 점을 짧게 적습니다.
- problem: invalid인 경우 왜 아쉬운지 정확히 적습니다. valid면 빈 문자열도 가능합니다.
- hint: 지금 문장을 어떻게 바꾸면 좋아지는지 한 문장으로 적습니다.
- example: 학생 질문을 더 또렷하게 다듬은 예시 질문을 한 문장으로 적습니다. valid여도 더 깊어진 예시를 줄 수 있습니다.
- 반말, 따뜻한 톤을 사용합니다.
- 맞춤법은 평가하지 않습니다.
- "같은 자리에서"라는 표현은 쓰지 않습니다.
- 전체 피드백은 한 문장으로 짧고 직접적으로 작성합니다.

[issueCode]
- pass
- nonsense
- not_question
- too_broad
- not_book_grounded
- yes_no_only
- duplicate
- category_mismatch
- needs_specificity

[출력 형식]
반드시 JSON만 출력하세요.
{
  "content": {
    "valid": true,
    "feedback": "",
    "invalidIndices": [],
    "questionFeedback": [
      {
        "index": 0,
        "question": "",
        "valid": true,
        "thinkingType": "fact",
        "praise": "",
        "problem": "",
        "hint": "",
        "example": "",
        "issueCode": "pass"
      }
    ]
  },
  "character": { "valid": true, "feedback": "", "invalidIndices": [], "questionFeedback": [] },
  "world": { "valid": true, "feedback": "", "invalidIndices": [], "questionFeedback": [] },
  "overall": true,
  "overallFeedback": "",
  "nextStep": ""
}`;

    const userMessage = `[이야기 질문]
${questionsByCategory.content.map((question: string, index: number) => `${index}. ${question}`).join('\n')}

[인물 질문]
${questionsByCategory.character.map((question: string, index: number) => `${index}. ${question}`).join('\n')}

[세계(배경) 질문]
${questionsByCategory.world.map((question: string, index: number) => `${index}. ${question}`).join('\n')}`;

    try {
      const result = await Promise.race([
        chatCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          {
            model: 'gpt-5-nano',
            maxTokens: 5200,
            jsonMode: true,
            reasoningEffort: 'minimal',
            timeoutMs: 32000,
          }
        ),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Question validation timeout')), 28000)
        ),
      ]);
      const trimmed = result.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart
        ? trimmed.slice(jsonStart, jsonEnd + 1)
        : trimmed;
      const parsed = JSON.parse(jsonStr);
      const normalized = normalizeQuestionValidation(parsed);
      const validation = applyDeterministicChecks(
        fillQuestionCoverage(normalized, questionsByCategory),
        questionsByCategory,
        resolvedBookContext.reliable,
      );

      return Response.json(validation);
    } catch (parseError) {
      console.error('Falling back to heuristic question validation:', parseError);
      return Response.json(buildHeuristicValidation(questionsByCategory));
    }
  } catch (error) {
    console.error('Question validation error:', error);
    return Response.json(
      { error: '검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
