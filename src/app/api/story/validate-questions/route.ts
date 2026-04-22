import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import {
  normalizeQuestionValidation,
  type QuestionCategoryKey,
  type QuestionFeedbackItem,
  type QuestionThinkingType,
  type QuestionValidationResult,
} from '@/lib/question-validation';

type QuestionsPayload = Record<QuestionCategoryKey, string[]>;

const CATEGORY_KEYS: QuestionCategoryKey[] = ['content', 'character', 'world', 'inference'];
const DEFAULT_THINKING_TYPE: Record<QuestionCategoryKey, QuestionThinkingType> = {
  content: 'fact',
  character: 'feeling',
  world: 'fact',
  inference: 'inference',
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

function fillQuestionCoverage(
  validation: QuestionValidationResult,
  questionsByCategory: QuestionsPayload,
): QuestionValidationResult {
  const next: QuestionValidationResult = {
    ...validation,
    content: validation.content,
    character: validation.character,
    world: validation.world,
    inference: validation.inference,
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
        : '좋은 질문 씨앗이 보여. 힌트를 보고 한 문장씩 더 또렷하게 바꿔 보자.'
    ),
    nextStep: validation.nextStep || (
      overall
        ? '마음에 드는 질문을 하나 골라 친구와 더 이야기해 봐도 좋아.'
        : '장면, 인물, 이유 가운데 하나를 더 넣어 다시 제출해 보자.'
    ),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { questions, book_title, country_id } = await request.json();

    if (!questions?.content || !questions?.character || !questions?.world) {
      return Response.json({ error: '질문 데이터가 없습니다.' }, { status: 400 });
    }

    const questionsByCategory: QuestionsPayload = {
      content: (questions.content as string[]).filter((question: string) => question.trim()),
      character: (questions.character as string[]).filter((question: string) => question.trim()),
      world: (questions.world as string[]).filter((question: string) => question.trim()),
      inference: ((questions.inference ?? []) as string[]).filter((question: string) => question.trim()),
    };

    const systemPrompt = `당신은 초등학생의 독서 질문을 코칭하는 친절한 선생님입니다.
학생이 그림책 "${book_title ?? '(제목 미정)'}" (국가: ${country_id ?? '미정'})을 읽고 만든 질문을 살펴보고, 통과 여부보다 "어떻게 더 좋은 질문으로 바꿀 수 있는지"를 알려 주세요.

[중요한 관점]
- 질문은 생각을 여는 도구입니다. 완벽한 질문만 찾지 마세요.
- 학생이 책을 읽고 자기 생각으로 질문을 만들었다면 최대한 관대하게 인정하세요.
- 아래 경우만 invalid로 판단하세요.
  1. 의미 없는 글자 나열
  2. 질문이 아닌 감상문
  3. 네/아니오 한 단어로만 끝나는 질문
  4. 책 속 장면, 인물, 나라와 거의 연결되지 않는 질문
  5. 같은 뜻의 질문을 거의 반복한 경우
  6. 카테고리가 너무 어긋난 경우

[사고 유형 분류]
- fact: 보이는 것, 책에서 바로 확인 가능한 질문
- inference: 짐작, 이유나 결과를 생각하게 하는 질문
- feeling: 생각/느낌, 인물의 마음이나 자신의 감정을 묻는 질문
- application: 바꾸면?, 다른 선택, 삶에 적용, 새 아이디어를 묻는 질문

[카테고리]
- content: 이야기 내용, 사건, 흐름
- character: 등장인물의 마음, 관계, 성격, 선택, 변화
- world: 장소, 나라, 문화, 사회적 배경
- inference: 글에 직접 쓰이지 않은 것을 상상하거나 연결하는 질문

[피드백 작성 규칙]
- 카테고리별 feedback은 1~2문장으로 적습니다.
- questionFeedback은 질문마다 반드시 하나씩 만듭니다.
- praise: 그 질문의 좋은 점을 짧게 적습니다.
- problem: invalid인 경우 왜 아쉬운지 정확히 적습니다. valid면 빈 문자열도 가능합니다.
- hint: 지금 문장을 어떻게 바꾸면 좋아지는지 한 문장으로 적습니다.
- example: 학생 질문을 더 또렷하게 다듬은 예시 질문을 한 문장으로 적습니다. valid여도 더 깊어진 예시를 줄 수 있습니다.
- 반말, 따뜻한 톤을 사용합니다.
- 맞춤법은 평가하지 않습니다.

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
  "inference": { "valid": true, "feedback": "", "invalidIndices": [], "questionFeedback": [] },
  "overall": true,
  "overallFeedback": "",
  "nextStep": ""
}`;

    const userMessage = `[내용이해 질문]
${questionsByCategory.content.map((question: string, index: number) => `${index}. ${question}`).join('\n')}

[인물이해 질문]
${questionsByCategory.character.map((question: string, index: number) => `${index}. ${question}`).join('\n')}

[배경이해 질문]
${questionsByCategory.world.map((question: string, index: number) => `${index}. ${question}`).join('\n')}

[추론 질문]
${questionsByCategory.inference.map((question: string, index: number) => `${index}. ${question}`).join('\n')}`;

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { model: 'gpt-5-nano', maxTokens: 2600, jsonMode: true }
    );

    try {
      const trimmed = result.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart
        ? trimmed.slice(jsonStart, jsonEnd + 1)
        : trimmed;
      const parsed = JSON.parse(jsonStr);
      const normalized = normalizeQuestionValidation(parsed);
      const validation = fillQuestionCoverage(normalized, questionsByCategory);

      return Response.json(validation);
    } catch (parseError) {
      console.error('Failed to parse AI validation response:', parseError, 'Raw:', result);
      return Response.json(
        { error: 'AI 응답을 처리하지 못했습니다. 다시 시도해 주세요.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Question validation error:', error);
    return Response.json(
      { error: '검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
