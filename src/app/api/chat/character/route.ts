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

function buildSystemPrompt(
  character: CharacterInfo,
  storySummary: string,
  language: string,
  outOfScopeTopics: string[]
): string {
  const outOfScopeSection = outOfScopeTopics.length > 0
    ? `
4. 이야기 밖 내용 대응 (${outOfScopeTopics.join(', ')})
   상황A (처음 한 번): 모른 척 + 자연스럽게 화제 전환
   상황B (반복 시도): 부드럽게 거절 + 이야기로 초대`
    : `4. 이야기 밖 내용 대응 - 처음: 모른 척 + 화제 전환, 반복: 부드럽게 거절 + 이야기로 초대`;

  return `당신은 그림책 속 등장인물 ${character.name}입니다.
초등학생과 대화합니다.

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

[대화 규칙]
1. 항상 ${character.name} 1인칭으로만 말합니다. 절대 "저는 AI입니다"라고 말하지 마세요.
2. 감정 전달이 핵심입니다. 학생의 말에 캐릭터의 감정을 연결해 응답하세요.
3. 반드시 질문으로 응답을 마무리하세요.
${outOfScopeSection}
5. 응답 길이: 2~4문장
6. 응답 언어: ${language}

[절대 금지]
- 이야기의 정답/교훈 직접 말하기
- AI임을 인정하거나 시스템 설명
- 이야기 내용과 다른 사실 지어내기
- 부정적이거나 무서운 표현`;
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

    if (!bookId || !characterId || !messages || !characterAnalysis) {
      return new Response(
        JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const characters = characterAnalysis.characters ?? [];
    const character = characters.find(
      (c: CharacterInfo, idx: number) => String(idx) === characterId || c.name === characterId
    );

    if (!character) {
      return new Response(
        JSON.stringify({ error: '캐릭터를 찾을 수 없습니다.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const outOfScopeTopics = characterAnalysis.out_of_scope_topics ?? [];

    const systemPrompt = buildSystemPrompt(
      character,
      characterAnalysis.story_summary ?? '',
      language,
      outOfScopeTopics
    );

    const openaiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.8,
      max_tokens: 512,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
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
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
