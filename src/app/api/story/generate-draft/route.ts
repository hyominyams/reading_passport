import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { buildBookAnalysisPromptContext, parseBookCharacterAnalysis } from '@/lib/book-analysis';
import { createServiceClient } from '@/lib/supabase/service';
import { extractPreferredPdfText } from '@/lib/pdf-analysis';

type DraftPage = {
  draft: string;
  advice: string;
};

function buildStudentInput(params: {
  guide_answers?: {
    content?: string;
    character?: string;
    world?: string;
  } | null;
  student_freewrite?: string | null;
  all_student_messages?: string | null;
}) {
  const { guide_answers, student_freewrite, all_student_messages } = params;
  const parts: string[] = [];

  if (guide_answers?.content) parts.push(`내용: ${guide_answers.content}`);
  if (guide_answers?.character) parts.push(`인물: ${guide_answers.character}`);
  if (guide_answers?.world) parts.push(`세계: ${guide_answers.world}`);
  if (student_freewrite) parts.push(`자유 작성:\n${student_freewrite}`);

  const combined = parts.join('\n').trim();
  if (combined) {
    return {
      sourceLabel: '학생이 직접 정리한 이야기 재료',
      text: combined,
    };
  }

  return {
    sourceLabel: '학생 채팅에서 나온 이야기 재료',
    text: typeof all_student_messages === 'string' ? all_student_messages.trim() : '',
  };
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try extracting the first balanced object below.
    }

    const start = candidate.indexOf('{');
    if (start < 0) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < candidate.length; index += 1) {
      const char = candidate[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const slice = candidate.slice(start, index + 1);
          try {
            JSON.parse(slice);
            return slice;
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function buildDefaultAdvice(index: number, language: string): string {
  if (language === 'en') {
    const prompts = [
      'Try adding one more feeling or detail to set the scene.',
      'Show what changes or builds up in this part with your own words.',
      'What problem or challenge appears here? Add more tension.',
      'This is the most exciting moment — make it vivid and dramatic.',
      'How does everything wrap up? Write the ending in your own style.',
    ];
    return prompts[index] ?? 'Add one more detail in your own words.';
  }

  const prompts = [
    '이야기의 시작 분위기를 네 말로 더 자세히 그려봐.',
    '여기서 어떤 일이 펼쳐지는지 네 말로 써봐.',
    '어떤 문제나 어려움이 생기는지 긴장감 있게 써봐.',
    '가장 중요한 순간이야 — 생생하고 흥미진진하게 써봐.',
    '이야기가 어떻게 마무리되는지 네 스타일로 써봐.',
  ];
  return prompts[index] ?? '이 장면을 네 말로 조금 더 자세히 써봐.';
}

function normalizePages(payload: unknown, language: string): DraftPage[] {
  const source =
    payload && typeof payload === 'object' && Array.isArray((payload as { pages?: unknown[] }).pages)
      ? (payload as { pages: unknown[] }).pages
      : [];

  const normalized = source
    .map((page, index) => {
      if (!page || typeof page !== 'object') return null;
      const raw = page as Record<string, unknown>;
      const draft = typeof raw.draft === 'string' ? raw.draft.trim() : '';
      const advice = typeof raw.advice === 'string' ? raw.advice.trim() : '';

      if (!draft) return null;

      return {
        draft,
        advice: advice || buildDefaultAdvice(index, language),
      };
    })
    .filter((page): page is DraftPage => page !== null)
    .slice(0, 6);

  return normalized;
}

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

    const studentSource = buildStudentInput({
      guide_answers,
      student_freewrite,
      all_student_messages,
    });

    if (!studentSource.text) {
      return Response.json(
        { error: '학생 이야기 재료가 비어 있습니다.' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    let resolvedBookTitle = book_title ?? '';
    let resolvedCountry = country ?? '';
    let resolvedStorySummary = story_summary ?? '';
    let resolvedCharacters = characters ?? '';
    let resolvedAnalysisContext = '';
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

        const analysis = parseBookCharacterAnalysis(book.character_analysis);
        resolvedAnalysisContext = buildBookAnalysisPromptContext(analysis);

        if (!resolvedStorySummary && analysis.story_summary) {
          resolvedStorySummary = analysis.story_summary;
        }

        if (!resolvedCharacters && analysis.characters.length > 0) {
          resolvedCharacters = analysis.characters
            .map((character) => [
              character.name,
              character.role ?? '',
              character.profile_prompt ?? '',
              character.background ?? '',
            ].filter(Boolean).join(' - '))
            .filter(Boolean)
            .join('\n');
        }

        if (!resolvedBookText && !resolvedAnalysisContext) {
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

    const bookContextSection = resolvedAnalysisContext
      ? `[도서 구조화 요약]\n${resolvedAnalysisContext}`
      : resolvedBookText
        ? `[원문 텍스트]\n${resolvedBookText}`
        : '[도서 맥락]\n(도서 요약을 불러오지 못했습니다.)';

    const systemPrompt = `당신은 초등학생의 그림책 창작을 돕는 아동 창작 교육 도우미입니다.

[도서 맥락]
${bookContextSection}

[이야기 유형] ${storyTypeLabel[story_type] || story_type}

[책 배경 정보]
제목: ${resolvedBookTitle} / 국가: ${resolvedCountry}
줄거리: ${resolvedStorySummary}
등장인물: ${resolvedCharacters}

[${studentSource.sourceLabel}]
${studentSource.text}

위 내용을 바탕으로 이야기 초안과 페이지별 조언을 함께 작성하세요.

[초안 작성 규칙]
1. 학생이 직접 말한 재료를 최우선으로 사용하세요.
2. 책의 배경과 분위기는 참고하되, 학생이 말하지 않은 핵심 사건을 멋대로 새로 만들지 마세요.
3. 초안은 비어 있으면 안 됩니다. 각 장면마다 실제 문장으로 초안을 써 주세요.
4. 일부 감정 묘사나 연결 문장은 일부러 덜 채워 학생이 다시 쓸 여백을 남기세요.
5. 초등학생이 읽고 이해할 수 있는 문체로 쓰세요.
6. 정확히 5개 장면으로 나누세요: 발단(이야기의 시작, 배경과 인물 소개), 전개(사건이 펼쳐지며 이야기가 진행), 위기(갈등이나 어려움 등장), 절정(가장 긴장감 넘치는 순간), 결말(문제 해결과 마무리).
7. 각 장면의 draft는 2~4문장으로 쓰세요.

[조언 작성 규칙]
1. 각 장면마다 학생이 이미 말한 내용 중 살릴 만한 요소를 하나씩 짚어 주세요.
2. 조언은 학생이 오른쪽 칸에 다시 써 볼 수 있게 구체적이어야 합니다.
3. 각 advice는 1~2문장, 반말, 친근한 톤으로 쓰세요.
4. advice가 너무 일반적이면 안 됩니다. 가능하면 학생이 말한 인물, 행동, 감정, 배경을 직접 언급하세요.

출력 형식 (반드시 JSON으로만 출력, 다른 텍스트 금지):
{"pages":[{"draft":"발단 초안","advice":"발단 조언"},{"draft":"전개 초안","advice":"전개 조언"},{"draft":"위기 초안","advice":"위기 조언"},{"draft":"절정 초안","advice":"절정 조언"},{"draft":"결말 초안","advice":"결말 조언"}]}

응답 언어: ${language === 'ko' ? '한국어' : 'English'}`;

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: language === 'en'
            ? 'Write the draft and advice as JSON only.'
            : '이야기 초안과 조언을 JSON으로만 작성해 주세요.',
        },
      ],
      {
        model: 'gpt-5-mini',
        maxTokens: 3500,
        jsonMode: true,
      }
    );

    const jsonText = extractJsonObject(result);
    const parsed = jsonText ? JSON.parse(jsonText) : {};
    const pages = normalizePages(parsed, language);

    if (pages.length === 0) {
      return Response.json(
        { error: '초안 생성 결과를 해석하지 못했습니다.' },
        { status: 502 }
      );
    }

    return Response.json({ pages });
  } catch (error) {
    console.error('Draft generation error:', error);
    return Response.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
