import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { requireTeacherOrAdmin } from '@/lib/auth/guards';
import {
  BOOK_ANALYSIS_MODEL,
  BOOK_ANALYSIS_PROMPT_VERSION,
  upsertBookAnalysis,
} from '@/lib/queries/book-analyses';
import { upsertBookPdfText } from '@/lib/queries/book-pdf-texts';
import { createServiceClient } from '@/lib/supabase/service';
import { parseBookAnalysis } from '@/lib/book-analysis';
import {
  extractPdfTextFromUrl,
  pickPreferredPdfUrlFromMap,
} from '@/lib/pdf-analysis';
import type { BookAnalysis } from '@/types/database';

export const maxDuration = 120;

const ANALYSIS_PROMPT = `당신은 그림책 분석 전문가입니다. 주어진 그림책 텍스트를 분석하여 다음 JSON 형식으로 결과를 반환하세요.

반드시 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "story_summary": "이야기 전체를 이해할 수 있는 중간 길이 요약 (5~7문장)",
  "detailed_story_summary": "처음-중간-전환-끝이 드러나는 상세 줄거리 요약 (10~14문장, 너무 짧게 쓰지 말 것)",
  "setting": {
    "time": "시대나 시간 배경",
    "place": "주요 장소",
    "social_context": "문화/생활/사회적 맥락",
    "atmosphere": "이야기 분위기"
  },
  "plot_structure": {
    "beginning": "이야기 시작",
    "middle": "중간 전개",
    "climax": "가장 중요한 전환점 또는 절정",
    "ending": "결말"
  },
  "plot_points": ["사건 흐름 1", "사건 흐름 2", "사건 흐름 3", "사건 흐름 4", "사건 흐름 5"],
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
  "key_events": ["주요 사건 1", "주요 사건 2", "주요 사건 3", "주요 사건 4", "주요 사건 5"],
  "themes": ["핵심 주제 1", "핵심 주제 2"],
  "important_objects": ["중요 사물 또는 상징 1", "중요 사물 또는 상징 2"],
  "emotional_keywords": ["감정 키워드 1", "감정 키워드 2", "감정 키워드 3"],
  "out_of_scope_topics": ["이야기 범위 밖 주제 1", "이야기 범위 밖 주제 2"]
}

요약은 이후 학생 창작 대화와 질문 검증에 그대로 재사용될 예정입니다.
그래서 너무 짧게 줄이지 말고, 책 전체를 이해할 수 있을 만큼 충분히 자세히 써야 합니다.
단, 원문 문장을 길게 베끼지 말고 자연스럽게 재서술하세요.
캐릭터는 대화가 가능한 인물만 포함하세요 (동물, 의인화 캐릭터 포함).
personality는 반드시 배열 형식으로 출력하세요 (예: ["용감한", "호기심 많은", "다정한"]).
2~5명의 핵심 캐릭터를 추출하세요.`;

function resolvePdfSource(pdfUrls: Record<string, string>) {
  const orderedEntries = [
    ['ko', pdfUrls.ko],
    ['en', pdfUrls.en],
    ...Object.entries(pdfUrls).filter(([language]) => language !== 'ko' && language !== 'en'),
  ];

  for (const [language, url] of orderedEntries) {
    const trimmed = typeof url === 'string' ? url.trim() : '';
    if (trimmed) {
      return { language, url: trimmed };
    }
  }

  const fallbackUrl = pickPreferredPdfUrlFromMap(pdfUrls);
  return fallbackUrl ? { language: 'default', url: fallbackUrl } : null;
}

function hashSourceText(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

async function saveFailedAnalysis(options: {
  serviceClient: ReturnType<typeof createServiceClient>;
  bookId: string;
  sourceLanguage: string;
  sourcePdfUrl: string | null;
  errorMessage: string;
}) {
  await upsertBookAnalysis(options.serviceClient, {
    bookId: options.bookId,
    status: 'failed',
    sourceLanguage: options.sourceLanguage,
    sourcePdfUrl: options.sourcePdfUrl,
    model: BOOK_ANALYSIS_MODEL,
    promptVersion: BOOK_ANALYSIS_PROMPT_VERSION,
    errorMessage: options.errorMessage,
    completedAt: new Date().toISOString(),
  });
}

async function saveFailedPdfText(options: {
  serviceClient: ReturnType<typeof createServiceClient>;
  bookId: string;
  sourceLanguage: string;
  sourcePdfUrl: string | null;
  errorMessage: string;
}) {
  await upsertBookPdfText(options.serviceClient, {
    bookId: options.bookId,
    status: 'failed',
    sourceLanguage: options.sourceLanguage,
    sourcePdfUrl: options.sourcePdfUrl,
    extractedText: null,
    extractedTextChars: 0,
    errorMessage: options.errorMessage,
    completedAt: new Date().toISOString(),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookId } = await params;
  let sourceLanguage = 'default';
  let sourcePdfUrl: string | null = null;
  let pdfTextCompleted = false;
  const serviceClient = createServiceClient();

  try {
    const auth = await requireTeacherOrAdmin();
    if ('error' in auth) {
      return auth.error;
    }

    const { bookText } = (await request.json().catch(() => ({}))) as {
      bookText?: string;
    };

    if (!bookId) {
      return NextResponse.json(
        { error: '도서 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const manualText = typeof bookText === 'string' ? bookText.trim() : '';

    const { data: book, error: bookError } = await serviceClient
      .from('books')
      .select('id, title, pdf_urls, pdf_url_ko, pdf_url_en, created_by')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: bookError?.message || '도서를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (auth.profile.role !== 'admin' && book.created_by !== auth.user.id) {
      return NextResponse.json(
        { error: '도서 분석 권한이 없습니다.' },
        { status: 403 },
      );
    }

    let sourceText = manualText;
    sourceLanguage = manualText ? 'manual' : 'default';

    if (!sourceText) {
      const pdfUrls = (book.pdf_urls as Record<string, string>) ?? {};
      if (!Object.keys(pdfUrls).length) {
        if (book.pdf_url_ko) pdfUrls.ko = book.pdf_url_ko as string;
        if (book.pdf_url_en) pdfUrls.en = book.pdf_url_en as string;
      }

      const source = resolvePdfSource(pdfUrls);
      if (!source) {
        const message = '자동 분석을 위해 PDF URL 또는 본문 텍스트가 필요합니다.';
        await saveFailedPdfText({
          serviceClient,
          bookId,
          sourceLanguage,
          sourcePdfUrl,
          errorMessage: message,
        });
        await saveFailedAnalysis({
          serviceClient,
          bookId,
          sourceLanguage,
          sourcePdfUrl,
          errorMessage: message,
        });
        return NextResponse.json(
          { error: message },
          { status: 422 },
        );
      }

      sourceLanguage = source.language;
      sourcePdfUrl = source.url;
      await upsertBookPdfText(serviceClient, {
        bookId,
        status: 'processing',
        sourceLanguage,
        sourcePdfUrl,
        extractedText: null,
        extractedTextChars: 0,
        errorMessage: null,
        startedAt: new Date().toISOString(),
      });

      try {
        sourceText = await extractPdfTextFromUrl(source.url, request.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'PDF 추출에 실패했습니다.';
        await saveFailedPdfText({
          serviceClient,
          bookId,
          sourceLanguage,
          sourcePdfUrl,
          errorMessage: message,
        });
        await saveFailedAnalysis({
          serviceClient,
          bookId,
          sourceLanguage,
          sourcePdfUrl,
          errorMessage: message,
        });
        return NextResponse.json({ error: message }, { status: 422 });
      }
    } else {
      await upsertBookPdfText(serviceClient, {
        bookId,
        status: 'processing',
        sourceLanguage,
        sourcePdfUrl,
        extractedText: null,
        extractedTextChars: 0,
        errorMessage: null,
        startedAt: new Date().toISOString(),
      });
    }

    if (!sourceText) {
      const message = '분석할 텍스트를 얻지 못했습니다.';
      await saveFailedPdfText({
        serviceClient,
        bookId,
        sourceLanguage,
        sourcePdfUrl,
        errorMessage: message,
      });
      await saveFailedAnalysis({
        serviceClient,
        bookId,
        sourceLanguage,
        sourcePdfUrl,
        errorMessage: message,
      });
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const sourceHash = hashSourceText(sourceText);
    const savedPdfText = await upsertBookPdfText(serviceClient, {
      bookId,
      status: 'completed',
      sourceLanguage,
      sourcePdfUrl,
      sourceHash,
      extractedText: sourceText,
      extractedTextChars: sourceText.length,
      errorMessage: null,
      completedAt: new Date().toISOString(),
    });

    if (!savedPdfText) {
      const message = 'PDF 원문 저장에 실패했습니다.';
      await saveFailedAnalysis({
        serviceClient,
        bookId,
        sourceLanguage,
        sourcePdfUrl,
        errorMessage: message,
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }
    pdfTextCompleted = true;

    await upsertBookAnalysis(serviceClient, {
      bookId,
      status: 'processing',
      sourceLanguage,
      sourcePdfUrl,
      sourceHash,
      model: BOOK_ANALYSIS_MODEL,
      promptVersion: BOOK_ANALYSIS_PROMPT_VERSION,
      errorMessage: null,
      startedAt: new Date().toISOString(),
    });

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `${ANALYSIS_PROMPT}\n\n도서 제목: ${book.title}`,
        },
        { role: 'user', content: `다음 그림책 텍스트를 분석해주세요:\n\n${sourceText}` },
      ],
      {
        model: BOOK_ANALYSIS_MODEL,
        maxTokens: 3200,
        jsonMode: true,
        timeoutMs: 90_000,
      },
    );

    let parsed: BookAnalysis;
    try {
      parsed = parseBookAnalysis(JSON.parse(result));
    } catch {
      const message = 'AI 응답을 파싱할 수 없습니다.';
      await saveFailedAnalysis({
        serviceClient,
        bookId,
        sourceLanguage,
        sourcePdfUrl,
        errorMessage: message,
      });
      return NextResponse.json(
        { error: message, raw: result },
        { status: 500 },
      );
    }

    const saved = await upsertBookAnalysis(serviceClient, {
      bookId,
      status: 'completed',
      sourceLanguage,
      sourcePdfUrl,
      sourceHash,
      model: BOOK_ANALYSIS_MODEL,
      promptVersion: BOOK_ANALYSIS_PROMPT_VERSION,
      analysisJson: parsed,
      extractedTextChars: sourceText.length,
      errorMessage: null,
      completedAt: new Date().toISOString(),
    });

    if (!saved) {
      return NextResponse.json(
        { error: '분석 결과 저장에 실패했습니다.', data: parsed },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      pdfText: savedPdfText,
      analysis: saved,
      source: sourcePdfUrl || 'manual text',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
    console.error('Book analysis API error:', error);

    if (bookId) {
      if (!pdfTextCompleted) {
        await saveFailedPdfText({
          serviceClient,
          bookId,
          sourceLanguage,
          sourcePdfUrl,
          errorMessage: message,
        });
      }
      await saveFailedAnalysis({
        serviceClient,
        bookId,
        sourceLanguage,
        sourcePdfUrl,
        errorMessage: message,
      });
    }

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
