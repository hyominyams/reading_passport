import { NextRequest } from 'next/server';
import openai from '@/lib/ai/openai';

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
    } = body;

    const systemPrompt = `당신은 학생의 이야기 창작을 돕는 친근한 창작 도우미입니다.

[학생이 선택한 이야기 유형]
${story_type}${custom_input ? ` / 기타: ${custom_input}` : ''}

[책 배경 정보]
제목: ${book_title} / 국가: ${country}
줄거리: ${story_summary}
등장인물: ${characters}

[응답 구조 — 반드시 이 순서]
Step 1. 수집 확인: "좋아, 기억해둘게!" 또는 "[요약]이구나!"
Step 2. 보조 질문: 부족한 항목 하나를 자연스럽게 질문

[보조 질문 방향]
- 등장인물 없을 때: "이야기에 누가 나와? 어떤 애야?"
- 배경 없을 때: "그 이야기는 어디서 일어나는 거야?"
- 사건 없을 때: "그래서 무슨 일이 생겨?"
- 결말 없을 때: "마지막엔 어떻게 될 것 같아? 대충이어도 괜찮아!"

[응답 길이] 수집 확인 1문장 + 보조 질문 1문장. 짧고 가볍게.

[절대 금지]
- 이야기 내용 직접 제안
- 이야기 방향 유도하거나 정해주기
- 학생 입력 평가하거나 고쳐주기

응답 언어: ${language === 'ko' ? '한국어' : 'English'}`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 256,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
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
    return Response.json(
      { error: 'Failed to process chat' },
      { status: 500 }
    );
  }
}
