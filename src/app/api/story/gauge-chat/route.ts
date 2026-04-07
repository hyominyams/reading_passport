import { NextRequest } from 'next/server';
import openai from '@/lib/ai/openai';

type GaugeReplyPayload = {
  ack?: string;
  question?: string;
};

const ITEM_KEYWORDS: Record<'character' | 'setting' | 'conflict' | 'ending', string[]> = {
  character: ['주인공', '캐릭터', '등장인물', '누가', '친구', '아이', '소년', '소녀', '동물', '이름'],
  setting: ['장소', '배경', '어디', '마을', '숲', '바다', '학교', '집', '나라', '도시'],
  conflict: ['사건', '갈등', '문제', '위기', '도전', '어려움', '일이', '생겨', '찾아', '잃어'],
  ending: ['결말', '마지막', '끝', '해결', '결국', '돌아가', '성공', '화해'],
};

type MissingFocus = keyof typeof ITEM_KEYWORDS;

function detectMissingFocus(messages: { role: string; content: string }[]): MissingFocus {
  const joined = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');

  const hasAny = (keywords: string[]) => keywords.some((keyword) => joined.includes(keyword));

  if (!hasAny(ITEM_KEYWORDS.character)) return 'character';
  if (!hasAny(ITEM_KEYWORDS.setting)) return 'setting';
  if (!hasAny(ITEM_KEYWORDS.conflict)) return 'conflict';
  return 'ending';
}

function fallbackQuestion(language: string, focus: MissingFocus): string {
  if (language === 'en') {
    switch (focus) {
      case 'character':
        return 'Who is important in your story, and what kind of person are they?';
      case 'setting':
        return 'Where does your story happen?';
      case 'conflict':
        return 'What problem or event happens in the story?';
      case 'ending':
        return 'How would you like the story to end?';
    }
  }

  switch (focus) {
    case 'character':
      return '이야기에 누가 나오고 어떤 아이인지 조금 더 말해줄래?';
    case 'setting':
      return '이야기는 어디에서 일어나는지 말해줄래?';
    case 'conflict':
      return '이야기에서 무슨 일이 생기는지 조금 더 들려줄래?';
    case 'ending':
      return '마지막엔 어떻게 되고 싶은지 말해줄래?';
  }
}

function buildSystemPrompt(body: {
  story_type?: string;
  custom_input?: string;
  book_title?: string;
  country?: string;
  story_summary?: string;
  characters?: string;
  language: string;
  focus: MissingFocus;
}): string {
  const {
    story_type,
    custom_input,
    book_title,
    country,
    story_summary,
    characters,
    language,
    focus,
  } = body;

  const focusLabel = {
    character: language === 'ko' ? '등장인물' : 'character',
    setting: language === 'ko' ? '배경/장소' : 'setting',
    conflict: language === 'ko' ? '사건/갈등' : 'conflict',
    ending: language === 'ko' ? '결말 방향' : 'ending',
  }[focus];

  return `당신은 학생의 이야기 창작을 돕는 짧고 친근한 점검 도우미입니다.

[학생이 선택한 이야기 유형]
${story_type ?? ''}${custom_input ? ` / 기타: ${custom_input}` : ''}

[책 배경 정보]
제목: ${book_title ?? ''} / 국가: ${country ?? ''}
줄거리: ${story_summary ?? ''}
등장인물: ${characters ?? ''}

[지금 우선해서 확인할 항목]
${focusLabel}

[응답 규칙]
1. 반드시 ${language === 'ko' ? '한국어' : 'English'}로만 답합니다.
2. 출력은 json만 허용합니다. JSON 외 텍스트는 금지합니다.
3. ack는 학생 말에 대한 짧은 확인/공감 1문장입니다.
4. question은 반드시 정확히 1개의 질문 1문장입니다.
5. question은 부족한 항목 1개만 묻고, 이야기 아이디어/예시/전개/해결책을 절대 제안하지 않습니다.
6. question에는 책 제목, 캐릭터 이름, 이미 언급된 행동 계획을 직접 넣지 않습니다.
7. question은 초등학생에게 말하듯 쉽고 부드럽게 씁니다.
8. 전체 응답에는 질문 표시가 question에만 1개 있어야 합니다.
9. 학생의 입력을 평가하거나 고치지 않습니다.
10. 가볍게 확인하고, 바로 한 가지를 묻습니다.

[출력 형식]
{
  "ack": "짧은 확인 문장",
  "question": "부족한 항목 하나를 묻는 질문"
}`;
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

function parsePayload(text: string): GaugeReplyPayload {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return {};
  }

  const parsed = tryParseJson(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  return parsed as GaugeReplyPayload;
}

function normalizeAck(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[?？]/g, '')
    .replace(/\b(?:예를\s*들어|예시|추천|제안|아이디어|생각해보면|해볼까|maybe|for example|suggest)\b/gi, '')
    .trim()
    .replace(/[.!。！]+$/g, '')
    .trim();
}

function normalizeQuestion(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[?？]/g, '')
    .replace(/\b(?:예를\s*들어|예시|추천|제안|아이디어|생각해보면|해볼까|행동|예정|계획|방법|maybe|for example|suggest|plan|way)\b/gi, '')
    .trim()
    .replace(/[.!。！]+$/g, '')
    .trim();

  return cleaned ? `${cleaned}?` : '';
}

function countQuestionMarks(text: string): number {
  return (text.match(/[?？]/g) ?? []).length;
}

function hasSpecificTerms(
  text: string,
  body: {
    book_title?: string;
    characters?: string;
  }
): boolean {
  const terms = new Set<string>();

  if (body.book_title) {
    terms.add(body.book_title.trim());
  }

  if (body.characters) {
    for (const line of body.characters.split('\n')) {
      const firstSegment = line.split('-')[0]?.trim();
      if (firstSegment && firstSegment.length >= 2) {
        terms.add(firstSegment);
      }
    }
  }

  return [...terms].some((term) => text.includes(term));
}

function matchesFocus(question: string, focus: MissingFocus, language: string): boolean {
  if (language === 'en') {
    switch (focus) {
      case 'character':
        return /\bwho\b|\bwhat kind of\b/i.test(question);
      case 'setting':
        return /\bwhere\b/i.test(question);
      case 'conflict':
        return /\bwhat problem\b|\bwhat happens\b|\bwhat event\b/i.test(question);
      case 'ending':
        return /\bend\b|\bending\b|\bhow would\b/i.test(question);
    }
  }

  switch (focus) {
    case 'character':
      return /누가|어떤 아이|어떤 인물/.test(question);
    case 'setting':
      return /어디|어느 곳|어디에서/.test(question);
    case 'conflict':
      return /무슨 일|어떤 일|문제/.test(question);
    case 'ending':
      return /마지막|결말|어떻게 되고|어떻게 끝/.test(question);
  }
}

function isValidGaugeReply(
  ack: string,
  question: string,
  body: {
    book_title?: string;
    characters?: string;
  },
  focus: MissingFocus,
  language: string
): boolean {
  const combined = `${ack} ${question}`.trim();
  const banned = /\b(예를\s*들어|예시|추천|제안|아이디어|해결책|전개|상상|행동|예정|계획|방법|maybe|for example|what if|plan|way)\b/gi;
  const guidingPattern = /(하기\s*위해|어떤\s*방법|어떻게\s*할|what\s+will|how\s+will|which\s+way)/i;

  return (
    ack.length > 0 &&
    question.length > 0 &&
    countQuestionMarks(ack) === 0 &&
    countQuestionMarks(question) === 1 &&
    /[?？]\s*$/.test(question) &&
    !banned.test(combined) &&
    !guidingPattern.test(question) &&
    !hasSpecificTerms(question, body) &&
    matchesFocus(question, focus, language)
  );
}

function fallbackGaugeReply(
  language: string,
  focus: MissingFocus
): { ack: string; question: string } {
  if (language === 'ko') {
    return {
      ack: '좋아, 기억해둘게.',
      question: fallbackQuestion(language, focus),
    };
  }

  return {
    ack: 'Got it, I’ll keep that in mind.',
    question: fallbackQuestion(language, focus),
  };
}

async function generateGaugePayload(messages: { role: string; content: string }[], systemPrompt: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    ],
    temperature: 0.4,
    max_tokens: 220,
    response_format: { type: 'json_object' },
  });

  return parsePayload(response.choices[0]?.message?.content?.trim() ?? '');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      story_type,
      custom_input,
      book_title,
      country,
      story_summary,
      characters,
      language = 'ko',
    } = body as {
      messages: { role: string; content: string }[];
      story_type?: string;
      custom_input?: string;
      book_title?: string;
      country?: string;
      story_summary?: string;
      characters?: string;
      language?: string;
    };

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const focus = detectMissingFocus(messages);
    const systemPrompt = buildSystemPrompt({
      story_type,
      custom_input,
      book_title,
      country,
      story_summary,
      characters,
      language,
      focus,
    });

    const payload = await generateGaugePayload(messages, systemPrompt);
    let ack = normalizeAck(typeof payload.ack === 'string' ? payload.ack : '');
    let question = normalizeQuestion(typeof payload.question === 'string' ? payload.question : '');

    if (!isValidGaugeReply(ack, question, { book_title, characters }, focus, language)) {
      const fallback = fallbackGaugeReply(language, focus);
      const repairResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n\n아래 JSON 초안에서 규칙을 위반한 부분만 고쳐서 다시 JSON으로 출력하세요.\n${JSON.stringify({
              ack: ack || fallback.ack,
              question: question || fallback.question,
            })}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 180,
        response_format: { type: 'json_object' },
      });

      const repaired = parsePayload(repairResponse.choices[0]?.message?.content?.trim() ?? '');
      ack = normalizeAck(typeof repaired.ack === 'string' ? repaired.ack : fallback.ack);
      question = normalizeQuestion(
        typeof repaired.question === 'string' ? repaired.question : fallback.question
      );
    }

    if (!isValidGaugeReply(ack, question, { book_title, characters }, focus, language)) {
      const fallback = fallbackGaugeReply(language, focus);
      ack = fallback.ack;
      question = fallback.question;
    }

    const text = `${ack} ${question}`.trim();
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
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
    console.error('Gauge chat error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
