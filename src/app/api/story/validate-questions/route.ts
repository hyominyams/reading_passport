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

    const systemPrompt = `당신은 초등학생의 독서 질문을 검증하는 친절한 선생님입니다.
학생이 그림책 "${book_title ?? '(제목 미정)'}" (국가: ${country_id ?? '미정'})을 읽고 만든 질문을 검증하세요.

[핵심 원칙]
이 검증의 목적은 학생이 성실하게 질문을 작성했는지 확인하는 것입니다.
완벽한 질문을 요구하는 것이 아니라, 책을 읽고 나름대로 생각해서 쓴 질문인지만 판단하세요.
웬만하면 통과시켜 주세요. 아래 경우만 부적절로 판단합니다:
- 아무 의미 없는 글자 나열 (예: "ㅋㅋㅋ", "asdf", "몰라요")
- 질문 형태가 아닌 단순 감상 한마디 (예: "재미있었다", "좋았다")
- 해당 영역과 완전히 무관한 질문 (내용이해에 배경 질문 등은 괜찮음 — 애매하면 통과)

[영역별 참고 기준]
1. 내용이해 (content): 이야기 내용에 대한 질문. 줄거리, 사건, 이유 등을 물으면 OK.
2. 인물이해 (character): 등장인물에 대한 질문. 마음, 성격, 행동, 관계 등 뭐든 OK.
3. 배경이해 (world): 배경, 장소, 나라, 문화 관련 질문. 넓게 해석해서 통과시켜 주세요.
4. 추론 (inference): 상상하거나 생각해 보는 질문. "~했다면?", "왜 그랬을까?", "다음엔?" 등 OK.

[검증 규칙]
- 각 영역별로 질문을 하나씩 검토하세요.
- 기준에 맞지 않는 질문의 인덱스(0부터 시작)를 invalidIndices에 넣으세요.
- invalidIndices가 비어있으면 해당 영역은 valid: true입니다.
- 부적절한 질문이 있으면 feedback에 짧고 다정한 조언을 주세요.
- 적절한 질문이 있으면 feedback에 칭찬을 1-2문장으로 해 주세요.
- feedback은 항상 채워야 합니다. 빈 문자열로 두지 마세요.
- 반말, 친근한 톤으로 피드백을 작성하세요.
- 애매할 때는 무조건 통과시켜 주세요.

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
      { model: 'gpt-5-nano', maxTokens: 1500, jsonMode: true }
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
    } catch (parseError) {
      console.error('Failed to parse AI validation response:', parseError, 'Raw:', result);
      return Response.json(
        { error: 'AI 응답을 처리하지 못했습니다. 다시 시도해 주세요.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Question validation error:', error);
    return Response.json(
      { error: '검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
