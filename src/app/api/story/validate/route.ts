import { NextRequest } from 'next/server';
import openai from '@/lib/ai/openai';

type ValidationResult = {
  character: boolean;
  setting: boolean;
  conflict: boolean;
  ending: boolean;
  pass: boolean;
  feedback: string;
  missing_fields: Array<'character' | 'setting' | 'conflict' | 'ending'>;
  feedback_lines: string[];
  retry_prompt: string;
};

const CHARACTER_ROLE_PATTERN = /주인공|학생|선생님|엄마|아빠|친구|아이|소년|소녀|할머니|할아버지|언니|누나|형|동생|왕자|공주|용|마녀|괴물|강아지|고양이|토끼|곰/;
const EVENT_PATTERN = /사고|문제|갈등|도와|도우|구하|발견|쓰러|넘어|아프|울|잃어버|찾|회복|변하|시작|도전|위기|위험|결심|도망|막았|막아|만나|헤어|비가|지나쳐|다가와|구해|살아|죽|다쳤|고쳤/;
const NAME_WITH_PARTICLE_PATTERN = /([가-힣]{2,6})(?:는|은|이|가|를|을|와|과|에게|한테|도|의|라고|더니|께서)/g;
const KOREAN_NAME_PATTERN = /[가-힣]{2,6}/g;
const STOP_NAME_TOKENS = new Set([
  '이야기', '사건', '배경', '결말', '오늘', '그냥', '사람들', '중요한', '마지막', '그리고',
  '산책', '가게', '도와달라고', '돌아가다', '반성', '감동', '눈물', '분위기',
]);

function buildSystemPrompt(): string {
  return `아래 대화에서 이야기 재료가 충분한지 판단하세요.
반드시 json만 출력하세요. JSON 외 설명, 주석, 코드블록은 금지합니다.

출력 형식:
{
  "character": true 또는 false,
  "setting": true 또는 false,
  "conflict": true 또는 false,
  "ending": true 또는 false,
  "pass": true 또는 false,
  "feedback": "미달 항목 한 줄 안내 (모두 충족 시 빈 문자열)"
}

	판단 기준:
	- character: 중요한 인물이나 역할이 어느 정도라도 드러나면 true입니다. 이름이 없어도 "엄마", "친구", "용", "주인공"처럼 역할이 보이면 인정합니다.
	- setting: 배경/장소가 언급됐는가
	- conflict: 사건, 문제, 목표, 변화 중 하나라도 보이면 true입니다. 거창한 갈등이 아니어도 "무언가 일어난다"는 흐름이 있으면 인정합니다.
	- ending: 결말 방향이 있는가
	- pass: character와 conflict가 모두 true이면 true
	- setting과 ending은 참고용으로만 판단하고, 통과 여부를 막지 않습니다
	- feedback: pass가 false인 경우 부족한 항목을 한 줄로 안내 (pass가 true이면 빈 문자열)
	- feedback는 초등학생에게 말하듯 부드럽고 격려하는 말투로 작성합니다.
	- "부족합니다" 같은 딱딱한 표현보다 "조금 더 들려줄래?" 같은 표현을 우선 사용합니다.
	- 초등학생이 성실하게, 자기 말로, 어느 정도 구체적으로 썼다면 최대한 관대하게 판단합니다.
	- 맞춤법, 문장 완성도, 표현의 세련됨은 평가하지 않습니다.
	- 짧아도 성의 있게 핵심이 보이면 통과시킬 수 있습니다.`;
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const direct = tryParseJson(candidate);
    if (direct) {
      return candidate;
    }

    const start = candidate.indexOf('{');
    if (start < 0) {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < candidate.length; index += 1) {
      const char = candidate[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const slice = candidate.slice(start, index + 1);
          if (tryParseJson(slice)) {
            return slice;
          }
          break;
        }
      }
    }
  }

  return null;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 'ok'].includes(value.toLowerCase().trim());
  }

  return false;
}

function inferCharacterSignal(text: string): boolean {
  if (CHARACTER_ROLE_PATTERN.test(text)) {
    return true;
  }

  const matchesWithParticles = [...text.matchAll(NAME_WITH_PARTICLE_PATTERN)]
    .map((match) => match[1])
    .filter((token) => !STOP_NAME_TOKENS.has(token));

  if (new Set(matchesWithParticles).size >= 1) {
    return true;
  }

  const plainTokens = (text.match(KOREAN_NAME_PATTERN) ?? [])
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && token.length <= 6)
    .filter((token) => !STOP_NAME_TOKENS.has(token));

  const tokenCounts = new Map<string, number>();
  for (const token of plainTokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  return [...tokenCounts.entries()].some(([token, count]) => count >= 2 && token.length >= 2);
}

function inferConflictSignal(text: string): boolean {
  if (EVENT_PATTERN.test(text)) {
    return true;
  }

  const sentences = text
    .split(/\n|[.!?]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8);

  return sentences.length >= 3;
}

function applyLooseHeuristics(
  base: Pick<ValidationResult, 'character' | 'setting' | 'conflict' | 'ending'>,
  inputText: string,
) {
  const character = base.character || inferCharacterSignal(inputText);
  const conflict = base.conflict || inferConflictSignal(inputText);

  return {
    character,
    setting: base.setting,
    conflict,
    ending: base.ending,
  };
}

function buildFeedback(
  result: Pick<ValidationResult, 'character' | 'setting' | 'conflict' | 'ending'>
): { feedback: string; feedback_lines: string[]; retry_prompt: string } {
  const missingFields: Array<'character' | 'conflict'> = [];
  if (!result.character) missingFields.push('character');
  if (!result.conflict) missingFields.push('conflict');

  const missingCount = missingFields.length;
  if (missingCount === 0) {
    return {
      feedback: '좋아, 이야기 재료가 충분히 모였어!',
      feedback_lines: [
        '중요한 인물과 사건 흐름이 잘 보였어.',
        '이 정도면 초안을 만들기 시작해도 충분해.',
      ],
      retry_prompt: '',
    };
  }

  const detailMap: Record<'character' | 'conflict', string> = {
    character: '누가 중요한 인물인지 조금 더 또렷하게 들려줘.',
    conflict: '무슨 일이 벌어지는지, 어떤 사건이 생기는지 더 보여줘.',
  };

  const feedbackLines = [
    missingCount === 2
      ? '지금도 이야기는 보이는데, 중요한 인물과 사건이 조금만 더 또렷하면 충분해.'
      : '좋아, 거의 됐어. 한 가지만 더 보태면 이야기 흐름이 더 잘 보여.',
    ...missingFields.slice(0, 2).map((field) => detailMap[field]),
  ];

  return {
    feedback: missingCount === 2
      ? '좋아, 조금만 더 들려주면 충분할 것 같아.'
      : '좋아, 한 가지만 더 보태면 될 것 같아.',
    feedback_lines: feedbackLines,
    retry_prompt: '좋아, 두 가지 정도만 더 들려줄래?',
  };
}

function normalizeValidationResult(payload: unknown, inputText: string): ValidationResult {
  const raw = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  const heuristicApplied = applyLooseHeuristics({
    character: toBoolean(raw.character),
    setting: toBoolean(raw.setting),
    conflict: toBoolean(raw.conflict),
    ending: toBoolean(raw.ending),
  }, inputText);

  const character = heuristicApplied.character;
  const setting = heuristicApplied.setting;
  const conflict = heuristicApplied.conflict;
  const ending = heuristicApplied.ending;
  const pass = character && conflict;
  const feedbackValue = typeof raw.feedback === 'string' ? raw.feedback.trim() : '';
  const normalizedFeedback = buildFeedback({ character, setting, conflict, ending });
  const missingFields: Array<'character' | 'setting' | 'conflict' | 'ending'> = [];

  if (!character) missingFields.push('character');
  if (!conflict) missingFields.push('conflict');

  return {
    character,
    setting,
    conflict,
    ending,
    pass,
    feedback: pass ? normalizedFeedback.feedback : normalizedFeedback.feedback || feedbackValue,
    missing_fields: missingFields,
    feedback_lines: normalizedFeedback.feedback_lines,
    retry_prompt: pass ? '' : normalizedFeedback.retry_prompt,
  };
}

async function generateValidationResult(allStudentMessages: string): Promise<ValidationResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: allStudentMessages },
    ],
    max_completion_tokens: 220,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content?.trim() ?? '';
  const jsonText = extractJsonObject(content);
  return normalizeValidationResult(
    jsonText ? tryParseJson(jsonText) ?? {} : {},
    allStudentMessages
  );
}

export async function POST(request: NextRequest) {
  try {
    const { all_student_messages, guide_answers, student_freewrite } = await request.json();

    // Support both old format (all_student_messages) and new format (guide_answers + student_freewrite)
    let inputText = '';
    if (guide_answers || student_freewrite) {
      const parts: string[] = [];
      if (guide_answers?.content) parts.push(`내용: ${guide_answers.content}`);
      if (guide_answers?.character) parts.push(`인물: ${guide_answers.character}`);
      if (guide_answers?.world) parts.push(`세계: ${guide_answers.world}`);
      if (student_freewrite) parts.push(`이야기: ${student_freewrite}`);
      inputText = parts.join('\n');
    } else if (typeof all_student_messages === 'string') {
      inputText = all_student_messages;
    }

    if (!inputText.trim()) {
      return Response.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const validation = await generateValidationResult(inputText);
    return Response.json(validation);
  } catch (error) {
    console.error('Validation error:', error);
    return Response.json(
      {
        character: false,
        setting: false,
        conflict: false,
        ending: false,
        pass: false,
        feedback: '대화 검증에 실패했습니다. 다시 시도해 주세요.',
        missing_fields: ['character', 'conflict'],
        feedback_lines: [
          '지금은 이야기 재료를 제대로 확인하지 못했어.',
          '중요한 인물과 사건이 보이게 조금만 더 들려줘.',
        ],
        retry_prompt: '좋아, 두 가지 정도만 더 들려줄래?',
      },
      { status: 500 }
    );
  }
}
