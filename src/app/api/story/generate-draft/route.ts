import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { createServiceClient } from '@/lib/supabase/service';
import { extractPreferredPdfText } from '@/lib/pdf-analysis';

export async function POST(request: NextRequest) {
  try {
    const {
      bookId,
      story_type,
      custom_input,
      book_title,
      country,
      story_summary,
      characters,
      // New 7-step fields
      guide_answers,
      student_freewrite,
      // Legacy field (still supported)
      all_student_messages,
      book_full_text,
      language = 'ko',
    } = await request.json();

    const storyTypeLabel: Record<string, string> = {
      continue: '이야기 이어쓰기',
      new_protagonist: '주인공으로 새 이야기 써보기',
      extra_backstory: '엑스트라 주인공의 뒷이야기 쓰기',
      change_ending: '결말 바꾸기',
      custom: `기타: ${custom_input}`,
    };

    // Build student input from either new or legacy format
    let studentInput = '';
    if (guide_answers || student_freewrite) {
      const parts: string[] = [];
      if (guide_answers?.content) parts.push(`내용: ${guide_answers.content}`);
      if (guide_answers?.character) parts.push(`인물: ${guide_answers.character}`);
      if (guide_answers?.world) parts.push(`세계: ${guide_answers.world}`);
      if (student_freewrite) parts.push(`자유 작성:\n${student_freewrite}`);
      studentInput = parts.join('\n');
    } else {
      studentInput = typeof all_student_messages === 'string' ? all_student_messages : '';
    }

    const serviceClient = createServiceClient();
    let resolvedBookTitle = book_title ?? '';
    let resolvedCountry = country ?? '';
    let resolvedStorySummary = story_summary ?? '';
    let resolvedCharacters = characters ?? '';
    let resolvedBookText =
      typeof book_full_text === 'string' ? book_full_text.trim() : '';

    if (bookId) {
      const { data: book } = await serviceClient
        .from('books')
        .select('title, country_id, pdf_url_ko, pdf_url_en, character_analysis')
        .eq('id', bookId)
        .single();

      if (book) {
        resolvedBookTitle = resolvedBookTitle || book.title;
        resolvedCountry = resolvedCountry || book.country_id;

        if (!resolvedStorySummary || !resolvedCharacters) {
          const analysis = (book.character_analysis ?? {}) as Record<string, unknown>;
          const summary = analysis.story_summary ?? analysis.summary;
          if (!resolvedStorySummary && typeof summary === 'string') {
            resolvedStorySummary = summary;
          }

          if (!resolvedCharacters) {
            const analysisCharacters = analysis.characters;
            if (typeof analysisCharacters === 'string') {
              resolvedCharacters = analysisCharacters;
            } else if (Array.isArray(analysisCharacters)) {
              resolvedCharacters = analysisCharacters
                .map((character) => {
                  if (!character || typeof character !== 'object') return String(character);

                  const entry = character as Record<string, unknown>;
                  const parts = [
                    typeof entry.name === 'string' ? entry.name : '',
                    typeof entry.role === 'string' ? entry.role : '',
                    typeof entry.profile_prompt === 'string' ? entry.profile_prompt : '',
                    typeof entry.background === 'string' ? entry.background : '',
                  ].filter(Boolean);

                  return parts.join(' - ');
                })
                .filter(Boolean)
                .join('\n');
            }
          }
        }

        if (!resolvedBookText) {
          try {
            resolvedBookText = await extractPreferredPdfText(
              book.pdf_url_ko,
              book.pdf_url_en,
              request.url,
              100
            );
          } catch (error) {
            console.warn('Book PDF text extraction failed:', error);
          }
        }
      }
    }

    const bookTextSection = resolvedBookText
      ? `[원문 텍스트]\n${resolvedBookText}`
      : '[원문 텍스트]\n(원문을 불러오지 못했습니다.)';

    // New format: generate draft + advice together as JSON
    const useNewFormat = !!(guide_answers || student_freewrite);

    const systemPrompt = useNewFormat
      ? `당신은 아동 창작 교육 도우미입니다.

[원문 이야기]
${bookTextSection}

[이야기 유형] ${storyTypeLabel[story_type] || story_type}

[책 배경 정보]
제목: ${resolvedBookTitle} / 국가: ${resolvedCountry}
줄거리: ${resolvedStorySummary}
등장인물: ${resolvedCharacters}

[학생 입력]
${studentInput}

위 내용을 바탕으로 이야기 초안과 페이지별 조언을 함께 작성하세요.

[초안 작성 규칙]
1. 의도적으로 부족하게 쓰세요. 감정 묘사, 장면 전환, 문장 어색한 곳을 남겨두세요. 학생이 직접 채워 넣을 여백이 반드시 있어야 합니다.
2. 초등학생이 읽고 이해할 수 있는 문체로 쓰세요.
3. 6개 구역(장면)으로 나눠 작성하세요.
4. 각 구역은 2~4문장으로만 구성하세요.

[조언 작성 규칙]
1. 각 구역마다 학생이 자유 작성에서 쓴 내용을 참고해 "네가 쓴 ~에 대해 더 자세히 적어봐!" 형태로 작성하세요.
2. 학생이 쓴 내용에서 살릴 수 있는 부분을 구체적으로 언급하세요.
3. 각 조언은 1~2문장. 반말, 친근한 톤.

출력 형식 (반드시 JSON으로만 출력, 다른 텍스트 금지):
{"pages":[{"draft":"장면1 초안","advice":"장면1 조언"},{"draft":"장면2 초안","advice":"장면2 조언"},{"draft":"장면3 초안","advice":"장면3 조언"},{"draft":"장면4 초안","advice":"장면4 조언"},{"draft":"장면5 초안","advice":"장면5 조언"},{"draft":"장면6 초안","advice":"장면6 조언"}]}

응답 언어: ${language === 'ko' ? '한국어' : 'English'}`
      : `당신은 학생의 이야기 재료를 바탕으로 이야기 초안을 작성하는 창작 도우미입니다.

[이야기 유형] ${storyTypeLabel[story_type] || story_type}

[책 배경 정보]
제목: ${resolvedBookTitle} / 국가: ${resolvedCountry}
${bookTextSection}

[요약 정보]
줄거리: ${resolvedStorySummary}
등장인물: ${resolvedCharacters}

[학생이 제공한 이야기 재료]
${studentInput}

[작성 규칙]
1. 원문 텍스트를 최우선으로 참고하고, 부족한 부분만 요약과 등장인물 정보로 보완하세요.
2. 의도적으로 부족하게 쓰세요. 감정 묘사, 장면 전환, 문장 어색한 곳을 남겨두세요.
3. 초등학생이 읽고 이해할 수 있는 문체로 쓰세요.
4. 3~5개 구역으로 나눠 작성하세요. 구역 구분은 반드시 [PAGE_BREAK] 태그를 사용하세요.
5. 각 구역은 2~4문장으로만 구성하세요.

[출력 형식]
구역1 내용
[PAGE_BREAK]
구역2 내용
[PAGE_BREAK]
구역3 내용

응답 언어: ${language === 'ko' ? '한국어' : 'English'}`;

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: useNewFormat
          ? '이야기 초안과 조언을 6장면으로 나눠 JSON으로 작성해 주세요.'
          : '이야기 재료를 바탕으로 6장면 초안을 작성해 주세요.' },
      ],
      {
        model: 'gpt-5-mini',
        maxTokens: 3500,
      }
    );

    if (useNewFormat) {
      // Parse JSON response: { pages: [{ draft, advice }] }
      try {
        const trimmed = result.trim();
        const jsonStart = trimmed.indexOf('{');
        const jsonEnd = trimmed.lastIndexOf('}');
        const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart
          ? trimmed.slice(jsonStart, jsonEnd + 1)
          : trimmed;
        const parsed = JSON.parse(jsonStr);
        return Response.json(parsed);
      } catch {
        // Fallback: try to split by PAGE_BREAK and generate default advice
        const pages = result
          .split('[PAGE_BREAK]')
          .map((page) => page.trim())
          .filter((page) => page.length > 0)
          .map((draft) => ({ draft, advice: '이 부분을 네 말로 다시 써봐!' }));
        return Response.json({ pages });
      }
    } else {
      // Legacy format: string[]
      const pages = result
        .split('[PAGE_BREAK]')
        .map((page) => page.trim())
        .filter((page) => page.length > 0);
      return Response.json({ pages });
    }
  } catch (error) {
    console.error('Draft generation error:', error);
    return Response.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
