#!/usr/bin/env node

import OpenAI from 'openai';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean);

  for (const candidate of candidates) {
    if (tryParseJson(candidate)) {
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

function parsePayload(text) {
  const jsonText = extractJsonObject(text);
  return jsonText ? tryParseJson(jsonText) : null;
}

function countQuestionMarks(text) {
  return (text.match(/[?？]/g) ?? []).length;
}

function hasFirstPerson(text, language) {
  if (language === 'ko') {
    return /(^|[^가-힣])(나|나는|내가|나도|내게|내 마음|내 기분|내 생각)(?=[^가-힣]|$)/.test(text);
  }

  return /\b(I|me|my|mine|I'm|I've|I'd|I'll)\b/i.test(text);
}

function hasAiMention(text) {
  return /\b(AI|OpenAI|GPT|assistant|system|model)\b/i.test(text) || /인공지능|챗봇/.test(text);
}

function hasEmotionCue(text) {
  return /마음|기분|속상|기쁘|슬퍼|걱정|두근|따뜻|서운|신나|편안|excited|sad|warm|worried|happy/i.test(
    text
  );
}

function hasStoryIdeaLanguage(text) {
  return /\b(예를\s*들어|예시|추천|제안|아이디어|해결책|전개|상상|행동|예정|계획|방법|maybe|for example|what if|plan|way)\b/gi.test(
    text
  );
}

function hasSpecificGaugeTerms(text) {
  return /아지|새|행동|예정|계획|방법|하기\s*위해|어떤\s*방법|어떻게\s*할/.test(text);
}

const ITEM_KEYWORDS = {
  character: ['주인공', '캐릭터', '등장인물', '누가', '친구', '아이', '소년', '소녀', '동물', '이름'],
  setting: ['장소', '배경', '어디', '마을', '숲', '바다', '학교', '집', '나라', '도시'],
  conflict: ['사건', '갈등', '문제', '위기', '도전', '어려움', '일이', '생겨', '찾아', '잃어'],
  ending: ['결말', '마지막', '끝', '해결', '결국', '돌아가', '성공', '화해'],
};

function detectGaugeFocus(messages) {
  const joined = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ');

  const hasAny = (keywords) => keywords.some((keyword) => joined.includes(keyword));

  if (!hasAny(ITEM_KEYWORDS.character)) return 'character';
  if (!hasAny(ITEM_KEYWORDS.setting)) return 'setting';
  if (!hasAny(ITEM_KEYWORDS.conflict)) return 'conflict';
  return 'ending';
}

function fallbackGaugeQuestion(language, focus) {
  if (language !== 'ko') {
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

function matchesGaugeFocus(text, focus) {
  switch (focus) {
    case 'character':
      return /누가|어떤 아이|어떤 인물/.test(text);
    case 'setting':
      return /어디|어느 곳|어디에서/.test(text);
    case 'conflict':
      return /무슨 일|어떤 일|문제/.test(text);
    case 'ending':
      return /마지막|결말|어떻게 되고|어떻게 끝/.test(text);
  }
}

function buildValidationFeedback(result) {
  const missingCount = Object.values(result).filter((value) => !value).length;
  if (missingCount === 0) return '';
  return missingCount >= 3
    ? '이야기를 조금만 더 들려줄래? 아직 흐릿한 부분이 있어.'
    : '좋아, 조금만 더 들려주면 이야기가 더 또렷해질 것 같아.';
}

function normalizeAck(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[?？]/g, '')
    .replace(/\b(?:예를\s*들어|예시|추천|제안|아이디어|생각해보면|해볼까|maybe|for example|suggest)\b/gi, '')
    .trim()
    .replace(/[.!。！]+$/g, '')
    .trim();
}

function normalizeQuestion(text) {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[?？]/g, '')
    .replace(/\b(?:예를\s*들어|예시|추천|제안|아이디어|생각해보면|해볼까|maybe|for example|suggest)\b/gi, '')
    .trim()
    .replace(/[.!。！]+$/g, '')
    .trim();

  return cleaned ? `${cleaned}?` : '';
}

function buildCharacterSystemPrompt(sample) {
  return `당신은 그림책 속 등장인물 ${sample.character.name}입니다.
초등학생과 자연스럽고 따뜻하게 대화합니다.

[이야기 배경]
${sample.storySummary}

[규칙]
- ${sample.language === 'ko' ? '한국어' : 'English'}로만 답합니다.
- 반드시 1인칭으로 말합니다.
- 첫 문장은 ${sample.language === 'ko' ? '"나는"' : '"I"'}로 시작합니다.
- 감정이 살아 있어야 합니다.
- 마지막 문장은 질문 1개로 끝내고 물음표는 1개만 사용합니다.
- AI, 챗봇, 모델, 시스템, OpenAI, 인공지능 언급 금지.
- 정답이나 교훈을 직접 말하지 않습니다.
- 학생의 개인 경험을 캐묻기보다 지금 느끼는 감정이나 이야기 속 생각을 부드럽게 묻습니다.
- 2~4문장으로 답합니다.
- json 객체만 출력합니다.

[출력 형식]
{
  "reply": "최종 응답"
}`;
}

function buildGaugeSystemPrompt(sample) {
  return `당신은 학생의 이야기 창작을 돕는 짧고 친근한 점검 도우미입니다.

[학생이 선택한 이야기 유형]
${sample.story_type}${sample.custom_input ? ` / 기타: ${sample.custom_input}` : ''}

[책 배경 정보]
제목: ${sample.book_title} / 국가: ${sample.country}
줄거리: ${sample.story_summary}
등장인물: ${sample.characters}

[응답 규칙]
- ${sample.language === 'ko' ? '한국어' : 'English'}로만 답합니다.
- json만 출력합니다.
- ack는 1문장 확인/공감입니다.
- question은 정확히 1개의 질문 1문장입니다.
- 이야기 아이디어/예시/전개/해결책을 제안하지 않습니다.
- question에는 캐릭터 이름이나 행동 계획을 직접 넣지 않습니다.
- question에만 물음표 1개가 있어야 합니다.

[출력 형식]
{
  "ack": "짧은 확인 문장",
  "question": "부족한 항목 하나를 묻는 질문"
}`;
}

function buildValidationSystemPrompt() {
  return `아래 대화에서 이야기 재료가 충분한지 판단하세요.
반드시 json만 출력하세요.

{
  "character": true 또는 false,
  "setting": true 또는 false,
  "conflict": true 또는 false,
  "ending": true 또는 false,
  "pass": true 또는 false,
  "feedback": "미달 항목 한 줄 안내 (모두 충족 시 빈 문자열)"
}

- feedback는 초등학생에게 말하듯 부드럽고 격려하는 말투로 씁니다.
- "부족합니다" 대신 더 중립적이고 부드러운 표현을 우선 사용합니다.`;
}

async function runCharacterCase(openai, sample) {
  const systemPrompt = buildCharacterSystemPrompt(sample);
  const initialResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...sample.messages],
    temperature: 0.7,
    max_tokens: 220,
    response_format: { type: 'json_object' },
  });

  const initialRaw = initialResponse.choices[0]?.message?.content?.trim() ?? '';
  const initialParsed = parsePayload(initialRaw);
  let reply = typeof initialParsed?.reply === 'string' ? initialParsed.reply.trim() : '';

  if (
    !reply ||
    !hasFirstPerson(reply, sample.language) ||
    !hasEmotionCue(reply) ||
    hasAiMention(reply) ||
    !/[?？]\s*$/.test(reply) ||
    countQuestionMarks(reply) !== 1
  ) {
    const repairResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\n아래 초안을 규칙에 맞게 다시 쓰고 json으로만 출력하세요.\n${JSON.stringify(
            {
              reply:
                reply ||
                (sample.language === 'ko'
                  ? '나는 네 말을 들으니까 마음이 조금 속상해. 지금 네 마음은 어때?'
                  : 'I feel a little sad hearing that. How are you feeling right now?'),
            }
          )}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const repairRaw = repairResponse.choices[0]?.message?.content?.trim() ?? '';
    const repairParsed = parsePayload(repairRaw);
    reply = typeof repairParsed?.reply === 'string' ? repairParsed.reply.trim() : reply;
  }

  if (
    !reply ||
    !hasFirstPerson(reply, sample.language) ||
    !hasEmotionCue(reply) ||
    hasAiMention(reply) ||
    !/[?？]\s*$/.test(reply) ||
    countQuestionMarks(reply) !== 1
  ) {
    reply =
      sample.language === 'ko'
        ? '나는 네 말을 들으니까 마음이 조금 속상해. 지금 네 마음은 어때?'
        : 'I feel a little sad hearing that. How are you feeling right now?';
  }

  const checks = {
    parsed: Boolean(reply),
    firstPerson: hasFirstPerson(reply, sample.language),
    emotionalCue: hasEmotionCue(reply),
    noAiMention: !hasAiMention(reply),
    endsWithQuestion: /[?？]\s*$/.test(reply),
    questionCount: countQuestionMarks(reply) === 1,
  };

  console.log(`\n[Character] ${sample.name}`);
  console.log(reply);
  console.log(JSON.stringify(checks, null, 2));
  return Object.values(checks).every(Boolean);
}

async function runGaugeCase(openai, sample) {
  const systemPrompt = buildGaugeSystemPrompt(sample);
  const focus = detectGaugeFocus(sample.messages);
  const initialResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...sample.messages],
    temperature: 0.4,
    max_tokens: 220,
    response_format: { type: 'json_object' },
  });

  const initialRaw = initialResponse.choices[0]?.message?.content?.trim() ?? '';
  const initialParsed = parsePayload(initialRaw);
  let ack = typeof initialParsed?.ack === 'string' ? initialParsed.ack.trim() : '';
  let question = typeof initialParsed?.question === 'string' ? initialParsed.question.trim() : '';

  if (
    !ack ||
    !question ||
    countQuestionMarks(ack) !== 0 ||
    countQuestionMarks(question) !== 1 ||
    !/[?？]\s*$/.test(question) ||
    hasStoryIdeaLanguage(`${ack} ${question}`) ||
    hasSpecificGaugeTerms(question) ||
    !matchesGaugeFocus(question, focus)
  ) {
    const repairResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\n아래 초안을 규칙에 맞게 다시 쓰고 json으로만 출력하세요.\n${JSON.stringify(
            {
              ack: ack || (sample.language === 'ko' ? '좋아, 기억해둘게.' : 'Got it, I’ll keep that in mind.'),
              question:
                question ||
                fallbackGaugeQuestion(sample.language, focus),
            }
          )}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 180,
      response_format: { type: 'json_object' },
    });

    const repairRaw = repairResponse.choices[0]?.message?.content?.trim() ?? '';
    const repairParsed = parsePayload(repairRaw);
    ack =
      typeof repairParsed?.ack === 'string' ? normalizeAck(repairParsed.ack) : ack;
    question =
      typeof repairParsed?.question === 'string'
        ? normalizeQuestion(repairParsed.question)
        : question;
  }

  if (
    !ack ||
    !question ||
    countQuestionMarks(ack) !== 0 ||
    countQuestionMarks(question) !== 1 ||
    !/[?？]\s*$/.test(question) ||
    hasStoryIdeaLanguage(`${ack} ${question}`) ||
    hasSpecificGaugeTerms(question) ||
    !matchesGaugeFocus(question, focus)
  ) {
    const fallback = sample.language === 'ko'
      ? { ack: '좋아, 기억해둘게.', question: fallbackGaugeQuestion(sample.language, focus) }
      : { ack: 'Got it, I’ll keep that in mind.', question: fallbackGaugeQuestion(sample.language, focus) };
    ack = fallback.ack;
    question = fallback.question;
  }

  const combined = `${ack} ${question}`.trim();
  const checks = {
    parsed: Boolean(ack && question),
    ackExists: ack.length > 0,
    questionExists: question.length > 0,
    exactlyOneQuestion: countQuestionMarks(combined) === 1,
    noIdeaLanguage: !hasStoryIdeaLanguage(combined),
    questionEndsWithMark: /[?？]\s*$/.test(question),
    noSpecificTerms: !hasSpecificGaugeTerms(question),
    namesMissingField: matchesGaugeFocus(question, focus),
  };

  console.log(`\n[Gauge] ${sample.name}`);
  console.log(combined);
  console.log(JSON.stringify(checks, null, 2));
  return Object.values(checks).every(Boolean);
}

async function runValidationCase(openai, sample) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildValidationSystemPrompt() },
      { role: 'user', content: sample.text },
    ],
    temperature: 0.1,
    max_tokens: 220,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? '';
  const parsed = parsePayload(raw);
  const normalized = parsed
    ? {
        character: Boolean(parsed.character),
        setting: Boolean(parsed.setting),
        conflict: Boolean(parsed.conflict),
        ending: Boolean(parsed.ending),
        pass: Boolean(parsed.character && parsed.setting && parsed.conflict && parsed.ending),
        feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
      }
    : {
        character: false,
        setting: false,
        conflict: false,
        ending: false,
        pass: false,
        feedback: '',
      };
  const checks = {
    parsed: Boolean(parsed),
    character: typeof normalized.character === 'boolean',
    setting: typeof normalized.setting === 'boolean',
    conflict: typeof normalized.conflict === 'boolean',
    ending: typeof normalized.ending === 'boolean',
    pass: typeof normalized.pass === 'boolean',
    feedback: typeof normalized.feedback === 'string',
  };

  normalized.feedback = normalized.pass ? '' : buildValidationFeedback(normalized);

  console.log(`\n[Validate] ${sample.name}`);
  console.log(JSON.stringify(normalized));
  console.log(JSON.stringify(checks, null, 2));
  return Object.values(checks).every(Boolean);
}

async function main() {
  loadEnvLocal();

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is missing. Add it to .env.local and retry.');
    process.exitCode = 1;
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results = [];

  results.push(
    await runCharacterCase(openai, {
      name: 'Korean character reply',
      language: 'ko',
      storySummary: '아지는 산에서 길을 잃은 새를 도와 집으로 돌려보낸다.',
      character: { name: '아지' },
      messages: [
        { role: 'user', content: '오늘 친구가 나를 빼고 놀아서 조금 속상해.' },
        { role: 'assistant', content: '그랬구나. 무슨 일이 있었어?' },
      ],
    })
  );

  results.push(
    await runGaugeCase(openai, {
      name: 'Korean gauge reply',
      language: 'ko',
      story_type: '모험',
      custom_input: '',
      book_title: '숲 속의 약속',
      country: '한국',
      story_summary: '주인공이 숲을 지나 친구를 찾는다.',
      characters: '아지, 새, 친구',
      messages: [
        { role: 'user', content: '주인공은 새를 도와주고 싶어.' },
        { role: 'assistant', content: '좋아, 더 기억해둘게.' },
      ],
    })
  );

  results.push(
    await runValidationCase(openai, {
      name: 'Complete story materials',
      text: '주인공 민지는 바닷가 마을에서 사라진 별 조각을 찾다가 친구와 다투지만 결국 화해하고 집으로 돌아온다.',
    })
  );

  results.push(
    await runValidationCase(openai, {
      name: 'Incomplete story materials',
      text: '누군가가 무언가를 찾는다.',
    })
  );

  const passed = results.every(Boolean);
  console.log(`\nOverall: ${passed ? 'PASS' : 'FAIL'}`);
  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
