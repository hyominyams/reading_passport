import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { createClient } from '@/lib/supabase/server';

const SCAN_PROMPT = `당신은 그림책 분석 전문가입니다. 주어진 그림책 텍스트를 분석하여 다음 JSON 형식으로 결과를 반환하세요.

반드시 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "story_summary": "이야기 전체 요약 (3~5문장)",
  "characters": [
    {
      "name": "캐릭터 이름",
      "role": "역할 (주인공/조력자/반대자 등)",
      "age": "추정 나이 또는 연령대",
      "personality": ["키워드1", "키워드2", "키워드3"],
      "speech_style": "말투 특징",
      "background": "캐릭터 배경",
      "core_emotion": "핵심 감정",
      "key_moments": "주요 장면 설명",
      "profile_prompt": "한 줄 소개 (학생에게 보여줄 문구)"
    }
  ],
  "key_events": ["주요 사건 1", "주요 사건 2", "주요 사건 3"],
  "emotional_keywords": ["감정 키워드 1", "감정 키워드 2"],
  "out_of_scope_topics": ["이야기 범위 밖 주제 1", "이야기 범위 밖 주제 2"]
}

캐릭터는 대화가 가능한 인물만 포함하세요 (동물, 의인화 캐릭터 포함).
personality는 반드시 배열 형식으로 출력하세요 (예: ["용감한", "호기심 많은", "다정한"]).
2~3명의 캐릭터를 추출하세요.`;

export async function POST(request: NextRequest) {
  try {
    const { bookId, bookText } = (await request.json()) as {
      bookId: string;
      bookText: string;
    };

    if (!bookId || !bookText) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const result = await chatCompletion(
      [
        { role: 'system', content: SCAN_PROMPT },
        { role: 'user', content: `다음 그림책 텍스트를 분석해주세요:\n\n${bookText}` },
      ],
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2048,
      }
    );

    let parsed;
    try {
      // Try to extract JSON from possible markdown code blocks
      const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : result.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'AI 응답을 파싱할 수 없습니다.', raw: result },
        { status: 500 }
      );
    }

    // Save to book's character_analysis field
    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from('books')
      .update({ character_analysis: parsed })
      .eq('id', bookId);

    if (updateError) {
      console.error('Error saving character analysis:', updateError);
      return NextResponse.json(
        { error: '분석 결과 저장에 실패했습니다.', data: parsed },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Character scan API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
