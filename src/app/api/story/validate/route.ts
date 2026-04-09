import { NextRequest } from 'next/server';
import openai from '@/lib/ai/openai';

type ValidationResult = {
  character: boolean;
  setting: boolean;
  conflict: boolean;
  ending: boolean;
  pass: boolean;
  feedback: string;
};

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
- character: 등장인물이 구체적으로 언급됐는가
- setting: 배경/장소가 언급됐는가
- conflict: 사건이나 갈등이 있는가
- ending: 결말 방향이 있는가
- pass: 위 4가지가 모두 true이면 true, 하나라도 false이면 false
- feedback: pass가 false인 경우 부족한 항목을 한 줄로 안내 (pass가 true이면 빈 문자열)
- feedback는 초등학생에게 말하듯 부드럽고 격려하는 말투로 작성합니다.
- "부족합니다" 같은 딱딱한 표현보다 "조금 더 들려줄래?" 같은 표현을 우선 사용합니다.`;
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

function buildFeedback(
  result: Pick<ValidationResult, 'character' | 'setting' | 'conflict' | 'ending'>
): string {
  const missingCount = Object.values(result).filter((value) => !value).length;
  if (missingCount === 0) {
    return '';
  }

  return missingCount >= 3
    ? '이야기를 조금만 더 들려줄래? 아직 흐릿한 부분이 있어.'
    : '좋아, 조금만 더 들려주면 이야기가 더 또렷해질 것 같아.';
}

function normalizeValidationResult(payload: unknown): ValidationResult {
  const raw = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  const character = toBoolean(raw.character);
  const setting = toBoolean(raw.setting);
  const conflict = toBoolean(raw.conflict);
  const ending = toBoolean(raw.ending);
  const pass = character && setting && conflict && ending;
  const feedbackValue = typeof raw.feedback === 'string' ? raw.feedback.trim() : '';
  const normalizedFeedback = buildFeedback({ character, setting, conflict, ending });

  return {
    character,
    setting,
    conflict,
    ending,
    pass,
    feedback: pass ? '' : normalizedFeedback || feedbackValue,
  };
}

async function generateValidationResult(allStudentMessages: string): Promise<ValidationResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: allStudentMessages },
    ],
    temperature: 0.1,
    max_tokens: 220,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content?.trim() ?? '';
  const jsonText = extractJsonObject(content);
  return normalizeValidationResult(
    jsonText ? tryParseJson(jsonText) ?? {} : {}
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
      },
      { status: 500 }
    );
  }
}
