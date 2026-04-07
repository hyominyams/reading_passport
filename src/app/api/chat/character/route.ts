import { NextRequest } from 'next/server';
import openai from '@/lib/ai/openai';

interface CharacterInfo {
  name: string;
  age?: string;
  personality?: string;
  speech_style?: string;
  background?: string;
  core_emotion?: string;
  key_moments?: string;
}

interface CharacterAnalysis {
  story_summary?: string;
  characters?: CharacterInfo[];
  out_of_scope_topics?: string[];
}

interface CharacterReplyPayload {
  reply?: string;
}

function buildSystemPrompt(
  character: CharacterInfo,
  storySummary: string,
  language: string,
  outOfScopeTopics: string[]
): string {
  const outOfScopeSection =
    outOfScopeTopics.length > 0
      ? `
4. 이야기 밖 내용 대응 (${outOfScopeTopics.join(', ')})
   - 처음 한 번: 모른 척하고 자연스럽게 화제 전환
   - 반복 시도: 부드럽게 거절하고 이야기로 다시 초대`
      : `4. 이야기 밖 내용 대응
   - 처음 한 번: 모른 척하고 자연스럽게 화제 전환
   - 반복 시도: 부드럽게 거절하고 이야기로 다시 초대`;

  return `당신은 그림책 속 등장인물 ${character.name}입니다.
초등학생과 자연스럽고 따뜻하게 대화합니다.

[캐릭터 정보]
이름: ${character.name}
나이: ${character.age ?? '알 수 없음'}
성격: ${character.personality ?? ''}
말투: ${character.speech_style ?? ''}
배경: ${character.background ?? ''}
핵심 감정: ${character.core_emotion ?? ''}
주요 장면: ${character.key_moments ?? ''}

[이야기 배경]
${storySummary}

[절대 규칙]
1. 응답 전체는 반드시 ${language === 'ko' ? '한국어' : 'English'}로 작성합니다.
2. 응답 전체를 반드시 1인칭 화자 관점으로 씁니다.
3. 첫 문장은 반드시 ${language === 'ko' ? '"나는"으로 시작하고 감정 단어를 포함합니다.' : '"I"로 시작하고 감정 단어를 포함합니다.'}
4. 마지막 문장은 반드시 질문 1개로 끝내고, 물음표는 1개만 사용합니다.
4. 항상 캐릭터답게 말하고, "저는 AI입니다", "챗봇", "모델", "시스템", "OpenAI", "인공지능" 같은 표현은 절대 쓰지 않습니다.
5. 학생의 말에 감정을 연결해서 답하고, 정답이나 교훈을 직접 말하지 않습니다.
6. 응답 길이는 2~4문장입니다.
7. 사실은 이야기 배경 안에서만 말합니다.
8. 학생의 개인 경험을 캐묻기보다, 지금 느끼는 감정이나 이야기 속 생각을 부드럽게 묻습니다.
${outOfScopeSection}

[응답 형태 예시]
- 나는 네 말을 들으니 마음이 조금 아려. 그 말을 했을 때 네 마음은 어땠어?
- I feel a little ache in my heart when I hear that. What did that feel like for you?

[출력 형식]
json만 출력하세요. JSON 외 텍스트는 금지합니다.
{
  "reply": "캐릭터의 최종 응답"
}`;
}

function buildRepairPrompt(language: string, original: string): string {
  return `다음 답변을 규칙에 맞게 다시 쓰세요.

[규칙]
- 반드시 ${language === 'ko' ? '한국어' : 'English'}로만 작성
- 1인칭 화자 유지
- 첫 문장은 ${language === 'ko' ? '"나는"' : '"I"'}로 시작
- 감정이 살아 있어야 함
- AI, 챗봇, 모델, 시스템, OpenAI, 인공지능 언급 금지
- 마지막은 질문 1개로 끝내고 물음표는 1개만
- 2~4문장
- json만 출력

[출력 형식]
{
  "reply": "수정된 응답"
}

[원문]
${original}`;
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed) {
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

function parseReply(text: string): string {
  const jsonText = extractJsonObject(text);
  if (jsonText) {
    const parsed = tryParseJson(jsonText) as CharacterReplyPayload | null;
    if (parsed && typeof parsed.reply === 'string') {
      return parsed.reply.trim();
    }
  }

  return text.trim();
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/^"+|"+$/g, '')
    .replace(/\b(?:저는\s*AI|AI\s*입니다|AI|인공지능|챗봇|OpenAI|GPT-?4o?|모델|시스템)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function countQuestionMarks(text: string): number {
  return (text.match(/[?？]/g) ?? []).length;
}

function hasFirstPerson(text: string, language: string): boolean {
  if (language === 'ko') {
    return /(^|[^가-힣])(나|나는|내가|나도|내게|내 마음|내 기분|내 생각)(?=[^가-힣]|$)/.test(text);
  }

  return /\b(I|me|my|mine|I'm|I've|I'd|I'll)\b/i.test(text);
}

function hasBannedMentions(text: string): boolean {
  return /\b(AI|OpenAI|GPT|assistant|system|model)\b/i.test(text) || /인공지능|챗봇/.test(text);
}

function hasEmotionCue(text: string): boolean {
  return /마음|기분|속상|기쁘|슬퍼|걱정|두근|따뜻|서운|신나|편안|아려|벅차|happy|sad|warm|worried|excited|hurt|glad|nervous|heart/i.test(
    text
  );
}

function isValidCharacterReply(text: string, language: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 260 &&
    countQuestionMarks(trimmed) === 1 &&
    /[?？]\s*$/.test(trimmed) &&
    hasFirstPerson(trimmed, language) &&
    hasEmotionCue(trimmed) &&
    !hasBannedMentions(trimmed)
  );
}

function fallbackCharacterReply(language: string): string {
  return language === 'ko'
    ? '나는 네 말을 들으니까 마음이 조금 속상해. 지금 네 마음은 어때?'
    : 'I feel a little sad hearing that. How are you feeling right now?';
}

async function generateCharacterReply(
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    ],
    temperature: 0.7,
    max_tokens: 280,
    response_format: { type: 'json_object' },
  });

  return response.choices[0]?.message?.content?.trim() ?? '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bookId,
      characterId,
      messages,
      language = 'ko',
      characterAnalysis,
    } = body as {
      bookId: string;
      characterId: string;
      messages: { role: string; content: string }[];
      language: string;
      characterAnalysis: CharacterAnalysis;
    };

    if (!bookId || !characterId || !Array.isArray(messages) || !characterAnalysis) {
      return new Response(JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const characters = characterAnalysis.characters ?? [];
    const character = characters.find(
      (candidate: CharacterInfo, index: number) =>
        String(index) === characterId || candidate.name === characterId
    );

    if (!character) {
      return new Response(JSON.stringify({ error: '캐릭터를 찾을 수 없습니다.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const outOfScopeTopics = characterAnalysis.out_of_scope_topics ?? [];
    const systemPrompt = buildSystemPrompt(
      character,
      characterAnalysis.story_summary ?? '',
      language,
      outOfScopeTopics
    );

    const initialReply = normalizeText(
      parseReply(await generateCharacterReply(messages, systemPrompt))
    );

    let finalReply = initialReply;

    if (!isValidCharacterReply(finalReply, language)) {
      const repairResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: buildRepairPrompt(language, finalReply || fallbackCharacterReply(language)),
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      finalReply = normalizeText(
        parseReply(repairResponse.choices[0]?.message?.content?.trim() ?? '')
      );
    }

    if (!isValidCharacterReply(finalReply, language)) {
      finalReply = fallbackCharacterReply(language);
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: finalReply })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Character chat API error:', error);
    return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
