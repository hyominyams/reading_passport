import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
  try {
    const { all_student_messages } = await request.json();

    const systemPrompt = `아래 대화에서 이야기 재료가 충분한지 판단하세요.
반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

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
- feedback: pass가 false인 경우 부족한 항목을 한 줄로 안내 (pass가 true이면 빈 문자열)`;

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: all_student_messages },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 256,
      }
    );

    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: 'Failed to parse validation result' },
        { status: 500 }
      );
    }

    const validation = JSON.parse(jsonMatch[0]);

    return Response.json(validation);
  } catch (error) {
    console.error('Validation error:', error);
    return Response.json(
      { error: 'Failed to validate story materials' },
      { status: 500 }
    );
  }
}
