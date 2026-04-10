import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
  try {
    const { guide_answers, student_freewrite, language = 'ko' } = await request.json();

    if (!student_freewrite || typeof student_freewrite !== 'string') {
      return Response.json({ error: '작성 내용이 없습니다.' }, { status: 400 });
    }

    const guideContent = guide_answers?.content ?? '';
    const guideCharacter = guide_answers?.character ?? '';
    const guideWorld = guide_answers?.world ?? '';

    const systemPrompt = `당신은 초등학생의 이야기 창작을 돕는 친근한 도우미입니다.
학생이 자유롭게 쓴 이야기 초안을 읽고, 짧은 피드백을 주세요.

[Step 1 가이드 답변]
내용: ${guideContent}
인물: ${guideCharacter}
세계: ${guideWorld}

[학생이 자유롭게 쓴 이야기]
${student_freewrite}

[피드백 규칙]
1. 칭찬 1문장 + 보완 제안 1문장으로만 응답하세요.
2. 보완 제안은 아래 우선순위로 하나만 선택:
   - 글이 50자 미만 → "글이 아직 짧아요. 조금 더 써볼까요?"
   - 인물 묘사 부족 → "주인공이 어떤 표정이었는지 써보면 좋겠어요."
   - 장소 묘사 부족 → "그곳이 어떤 곳인지 더 설명해보세요."
   - 사건 부족 → "그래서 어떤 일이 일어났나요?"
   - 충분히 작성됨 → "좋아요! 이제 이야기를 만들어볼까요?"
3. 반드시 반말 사용. 친근한 톤.

응답 언어: ${language === 'ko' ? '한국어' : 'English'}`;

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '피드백을 주세요.' },
      ],
      { model: 'gpt-5-nano', maxTokens: 200 }
    );

    return Response.json({ feedback: result.trim() });
  } catch (error) {
    console.error('Feedback error:', error);
    return Response.json(
      { feedback: '저장되었습니다. 이야기를 더 써보세요!' },
      { status: 200 }
    );
  }
}
