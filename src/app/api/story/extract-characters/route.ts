import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
  try {
    const { final_text } = await request.json();

    const allText = Array.isArray(final_text) ? final_text.join('\n') : final_text;

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `이야기 텍스트에서 가장 중요한 등장인물 2명을 추출하세요.
JSON 배열로만 출력하세요.

출력 형식:
[
  { "name": "캐릭터 이름", "description": "이야기에서의 역할 한 줄 설명" },
  { "name": "캐릭터 이름", "description": "이야기에서의 역할 한 줄 설명" }
]`,
        },
        { role: 'user', content: allText },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 256,
      }
    );

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return Response.json(
        { error: 'Failed to parse characters' },
        { status: 500 }
      );
    }

    const characters = JSON.parse(jsonMatch[0]);
    return Response.json({ characters });
  } catch (error) {
    console.error('Character extraction error:', error);
    return Response.json(
      { error: 'Failed to extract characters' },
      { status: 500 }
    );
  }
}
