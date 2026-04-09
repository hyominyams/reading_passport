import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  extractPdfTextFromUrl,
  pickPreferredPdfUrl,
} from '@/lib/pdf-analysis';

type CharacterProfile = {
  name: string;
  role?: string;
  age?: string;
  personality?: string[];
  speech_style?: string;
  background?: string;
  core_emotion?: string;
  key_moments?: string;
  profile_prompt?: string;
};

type CharacterAnalysis = {
  story_summary: string;
  characters: CharacterProfile[];
  key_events: string[];
  emotional_keywords: string[];
  out_of_scope_topics: string[];
};

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
      bookText?: string;
    };

    if (!bookId) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const manualText = typeof bookText === 'string' ? bookText.trim() : '';
    const serviceClient = createServiceClient();

    const { data: book, error: bookError } = await serviceClient
      .from('books')
      .select('id, title, pdf_url_ko, pdf_url_en')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: bookError?.message || '도서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    let sourceText = manualText;
    let sourceLabel = manualText ? 'manual text' : '';

    if (!sourceText) {
      const pdfUrl = pickPreferredPdfUrl(book.pdf_url_ko, book.pdf_url_en);
      if (!pdfUrl) {
        return NextResponse.json(
          { error: '자동 분석을 위해 PDF URL 또는 본문 텍스트가 필요합니다.' },
          { status: 422 }
        );
      }

      try {
        sourceText = await extractPdfTextFromUrl(pdfUrl, request.url);
        sourceLabel = pdfUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'PDF 추출에 실패했습니다.';
        return NextResponse.json({ error: message }, { status: 422 });
      }
    }

    if (!sourceText) {
      return NextResponse.json(
        { error: '분석할 텍스트를 얻지 못했습니다.' },
        { status: 422 }
      );
    }

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `${SCAN_PROMPT}\n\n도서 제목: ${book.title}`,
        },
        { role: 'user', content: `다음 그림책 텍스트를 분석해주세요:\n\n${sourceText}` },
      ],
      {
        model: 'gpt-5-nano',
        temperature: 0.3,
        maxTokens: 2048,
      }
    );

    let parsed: Partial<CharacterAnalysis>;
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

    const normalized: CharacterAnalysis = {
      story_summary: typeof parsed.story_summary === 'string' ? parsed.story_summary.trim() : '',
      characters: Array.isArray(parsed.characters)
        ? parsed.characters
            .filter((character): character is CharacterProfile => !!character && typeof character === 'object')
            .map((character) => ({
              name: typeof character.name === 'string' ? character.name.trim() : 'Unknown',
              role: typeof character.role === 'string' ? character.role : undefined,
              age: typeof character.age === 'string' ? character.age : undefined,
              personality: Array.isArray(character.personality)
                ? character.personality.filter((item): item is string => typeof item === 'string')
                : undefined,
              speech_style: typeof character.speech_style === 'string' ? character.speech_style : undefined,
              background: typeof character.background === 'string' ? character.background : undefined,
              core_emotion: typeof character.core_emotion === 'string' ? character.core_emotion : undefined,
              key_moments: typeof character.key_moments === 'string' ? character.key_moments : undefined,
              profile_prompt: typeof character.profile_prompt === 'string' ? character.profile_prompt : undefined,
            }))
        : [],
      key_events: Array.isArray(parsed.key_events)
        ? parsed.key_events.filter((item): item is string => typeof item === 'string')
        : [],
      emotional_keywords: Array.isArray(parsed.emotional_keywords)
        ? parsed.emotional_keywords.filter((item): item is string => typeof item === 'string')
        : [],
      out_of_scope_topics: Array.isArray(parsed.out_of_scope_topics)
        ? parsed.out_of_scope_topics.filter((item): item is string => typeof item === 'string')
        : [],
    };

    // Save to book's character_analysis field
    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from('books')
      .update({ character_analysis: normalized })
      .eq('id', bookId);

    if (updateError) {
      console.error('Error saving character analysis:', updateError);
      return NextResponse.json(
        { error: '분석 결과 저장에 실패했습니다.', data: normalized },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: normalized,
      source: sourceLabel || 'manual text',
    });
  } catch (error) {
    console.error('Character scan API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
