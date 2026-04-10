import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';

interface QuestionValidation {
  content: { valid: boolean; feedback: string; invalidIndices: number[] };
  character: { valid: boolean; feedback: string; invalidIndices: number[] };
  world: { valid: boolean; feedback: string; invalidIndices: number[] };
  inference: { valid: boolean; feedback: string; invalidIndices: number[] };
  overall: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { questions, book_title, country_id } = await request.json();

    if (!questions?.content || !questions?.character || !questions?.world) {
      return Response.json({ error: '질문 데이터가 없습니다.' }, { status: 400 });
    }

    const contentQs = (questions.content as string[]).filter((q: string) => q.trim());
    const characterQs = (questions.character as string[]).filter((q: string) => q.trim());
    const worldQs = (questions.world as string[]).filter((q: string) => q.trim());
    const inferenceQs = ((questions.inference ?? []) as string[]).filter((q: string) => q.trim());

    const systemPrompt = `당신은 초등학생의 독서 질문을 검증하는 교육 전문가입니다.
학생이 그림책 "${book_title ?? '(제목 미정)'}" (국가: ${country_id ?? '미정'})을 읽고 만든 질문을 검증하세요.

[영역별 기준]
1. 내용이해 (content): 이야기에 있던 일을 묻는 질문이어야 합니다.
   - 적절: "주인공은 왜 여행을 떠났나요?", "이야기에서 어떤 사건이 일어났나요?"
   - 부적절: 이야기와 무관한 질문, 단순 감상("재미있었다")

2. 인물이해 (character): 등장인물의 마음, 성격, 관계, 변화를 묻는 질문이어야 합니다.
   - 적절: "주인공의 성격은 어떤가요?", "두 인물의 관계는 어떻게 변했나요?"
   - 부적절: 인물과 무관한 질문, 외모만 묻는 질문

3. 배경이해 (world): 시간, 장소, 사회문화적 배경이 이야기와 어떻게 연결되는지 묻는 질문, 해당 이야기의 국가에 대한 질문이어야 합니다.
   - 적절: "이 이야기의 배경이 되는 나라는 어떤 곳인가요?", "왜 그 장소에서 이런 일이 일어났나요?"
   - 부적절: 배경과 무관한 질문

4. 추론 (inference): 글에 직접 쓰이지 않은 것을 상상하거나 생각해 보는 질문이어야 합니다.
   - 적절: "주인공이 다른 선택을 했다면 어떻게 됐을까?", "이 이야기 뒤에는 무슨 일이 일어났을까?"
   - 부적절: 이야기에 이미 답이 나와 있는 질문
   - 초등학생이라 추론이 어려울 수 있으니 특히 관대하게 판단하세요.

[검증 규칙]
- 각 영역별로 질문을 하나씩 검토하세요.
- 기준에 맞지 않는 질문의 인덱스(0부터 시작)를 invalidIndices에 넣으세요.
- invalidIndices가 비어있으면 해당 영역은 valid: true입니다.
- 부적절한 질문이 있으면 해당 영역의 feedback에 "~한 질문을 다시 만들어 보세요" 형태로 짧은 조언을 주세요.
- 적절한 질문이 있으면 해당 영역의 feedback에 해당 질문의 장점을 1-2문장으로 칭찬해 주세요. (예: "이야기의 핵심을 잘 파악했어! 등장인물의 변화를 묻는 질문이 특히 좋았어.")
- feedback은 항상 채워야 합니다. 빈 문자열로 두지 마세요.
- 초등학생 수준을 고려해서 너무 엄격하지 않게 판단하세요. 의도가 보이면 통과시켜 주세요.
- 반말, 친근한 톤으로 피드백을 작성하세요.

[출력 형식 - 반드시 JSON만 출력]
{
  "content": { "valid": true/false, "feedback": "", "invalidIndices": [] },
  "character": { "valid": true/false, "feedback": "", "invalidIndices": [] },
  "world": { "valid": true/false, "feedback": "", "invalidIndices": [] },
  "inference": { "valid": true/false, "feedback": "", "invalidIndices": [] },
  "overall": true/false
}`;

    const userMessage = `[내용이해 질문]
${contentQs.map((q: string, i: number) => `${i}. ${q}`).join('\n')}

[인물이해 질문]
${characterQs.map((q: string, i: number) => `${i}. ${q}`).join('\n')}

[배경이해 질문]
${worldQs.map((q: string, i: number) => `${i}. ${q}`).join('\n')}

[추론 질문]
${inferenceQs.map((q: string, i: number) => `${i}. ${q}`).join('\n')}`;

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { model: 'gpt-5-nano', maxTokens: 800, jsonMode: true }
    );

    // Parse JSON response
    try {
      const trimmed = result.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart
        ? trimmed.slice(jsonStart, jsonEnd + 1)
        : trimmed;
      const parsed = JSON.parse(jsonStr) as QuestionValidation;

      // Normalize
      const normalize = (cat: { valid?: boolean; feedback?: string; invalidIndices?: number[] }) => ({
        valid: cat.valid ?? true,
        feedback: typeof cat.feedback === 'string' ? cat.feedback : '',
        invalidIndices: Array.isArray(cat.invalidIndices) ? cat.invalidIndices : [],
      });

      const validation: QuestionValidation = {
        content: normalize(parsed.content ?? {}),
        character: normalize(parsed.character ?? {}),
        world: normalize(parsed.world ?? {}),
        inference: normalize(parsed.inference ?? {}),
        overall: false,
      };
      validation.overall = validation.content.valid && validation.character.valid && validation.world.valid && validation.inference.valid;

      return Response.json(validation);
    } catch {
      // If parsing fails, pass through
      return Response.json({
        content: { valid: true, feedback: '', invalidIndices: [] },
        character: { valid: true, feedback: '', invalidIndices: [] },
        world: { valid: true, feedback: '', invalidIndices: [] },
        inference: { valid: true, feedback: '', invalidIndices: [] },
        overall: true,
      });
    }
  } catch (error) {
    console.error('Question validation error:', error);
    return Response.json(
      { error: '검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
