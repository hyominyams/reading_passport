import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { buildBookAnalysisPromptContext } from '@/lib/book-analysis';
import { getLatestCompletedBookAnalysis } from '@/lib/queries/book-analyses';
import { getLatestCompletedBookPdfText } from '@/lib/queries/book-pdf-texts';
import { createClient } from '@/lib/supabase/server';
import type { DocentActivityRecommendation } from '@/types/database';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ActivityCandidate extends DocentActivityRecommendation {
  id: string;
  fitFor: string;
}

interface PriorStudentContext {
  oneLine: string;
  readQuestionSeed: string;
  exploreChallenges: Array<{
    content_title?: string;
    summary?: string;
    curiosity?: string;
  }>;
  questionPosts: Array<{
    question_type: string;
    question_text: string;
  }>;
}

const ACTIVITY_CANDIDATES: ActivityCandidate[] = [
  {
    id: 'continue_story',
    title: '다음 이야기 만들기',
    description: '책이 끝난 뒤 인물에게 생긴 일을 새 그림책으로 만들어요.',
    starter: '책이 끝난 다음 날, ___에게 이런 일이 생겼어요.',
    fitFor: '결말 뒤의 변화, 후속 사건, 인물의 성장에 관심을 보인 학생',
  },
  {
    id: 'change_ending',
    title: '다른 결말 만들기',
    description: '같은 이야기에서 마지막 장면만 다르게 바꿔 새 그림책을 만들어요.',
    starter: '만약 마지막에 ___이 달라졌다면, 이야기는 이렇게 끝났어요.',
    fitFor: '결말, 후회, 더 나은 해결 방법, 다른 마무리에 관심을 보인 학생',
  },
  {
    id: 'change_main_character',
    title: '다른 주인공으로 만들기',
    description: '원래 주인공이 아닌 다른 인물을 주인공으로 새 그림책을 만들어요.',
    starter: '이번에는 ___이 주인공이에요. 그 인물은 ___을 겪게 돼요.',
    fitFor: '특정 인물의 마음, 이유, 행동을 많이 물어본 학생',
  },
  {
    id: 'side_character_story',
    title: '잠깐 나온 인물 이야기 만들기',
    description: '책에 잠깐 나온 인물이 겪은 일을 새 그림책으로 만들어요.',
    starter: '책에 잠깐 나온 ___은 사실 이런 하루를 보내고 있었어요.',
    fitFor: '주변 인물, 엑스트라 인물, 책에 덜 나온 인물의 사정을 궁금해한 학생',
  },
  {
    id: 'change_choice',
    title: '다른 선택 이야기 만들기',
    description: '인물이 중요한 순간에 다른 선택을 했다면 어떻게 됐을지 만들어요.',
    starter: '그때 ___이 원래와 다른 선택을 했다면, 이런 일이 벌어졌어요.',
    fitFor: '인물이 왜 그렇게 행동했는지, 다른 행동을 할 수 있었는지 질문한 학생',
  },
  {
    id: 'before_story',
    title: '처음 전 이야기 만들기',
    description: '책이 시작되기 전에 있었던 일을 상상해 새 그림책으로 만들어요.',
    starter: '이 이야기가 시작되기 전, ___에게는 이런 일이 있었어요.',
    fitFor: '인물의 과거, 성격이 생긴 이유, 사건의 원인을 궁금해한 학생',
  },
  {
    id: 'hidden_scene_story',
    title: '숨은 장면 이야기 만들기',
    description: '책에는 나오지 않았지만 있었을 것 같은 장면을 새 그림책으로 만들어요.',
    starter: '책에는 나오지 않았지만, 그 사이에 ___ 장면이 있었어요.',
    fitFor: '장면 사이의 빈틈, 감정이 바뀌는 순간, 안 보이는 사건을 상상한 학생',
  },
  {
    id: 'same_message_new_story',
    title: '같은 마음을 담은 새 이야기 만들기',
    description: '책이 전한 마음은 살리고, 인물과 사건은 새롭게 만들어요.',
    starter: '이 책에서 느낀 ___이라는 마음을 담아, 새로운 인물 ___의 이야기를 만들어요.',
    fitFor: '책의 메시지, 교훈, 현실에서 할 수 있는 행동을 자기 이야기로 옮기려는 학생',
  },
  {
    id: 'change_setting',
    title: '다른 장소에서 다시 만들기',
    description: '같은 사건이 다른 장소에서 일어난다면 어떨지 새 그림책으로 만들어요.',
    starter: '같은 일이 ___에서 벌어진다면, 이야기는 이렇게 시작돼요.',
    fitFor: '장소, 나라, 시대, 날씨, 분위기를 바꿔 상상한 학생',
  },
  {
    id: 'opposite_perspective',
    title: '다른 인물 눈으로 다시 보기',
    description: '같은 일을 다른 인물의 마음으로 다시 만든 그림책을 써요.',
    starter: '이번에는 ___의 눈으로 같은 장면을 바라보면, 이런 마음이 보여요.',
    fitFor: '서로 다른 인물의 마음, 오해, 입장 차이에 관심을 보인 학생',
  },
  {
    id: 'new_problem_story',
    title: '또 다른 어려움 만나기',
    description: '책 속 인물이 새로운 어려움을 만났을 때의 이야기를 만들어요.',
    starter: '그 일이 지나간 뒤, ___은 또 다른 어려움 ___을 만나게 돼요.',
    fitFor: '원래 인물이 다시 성장하거나 새 문제를 해결하는 이야기를 만들고 싶은 학생',
  },
  {
    id: 'new_helper_story',
    title: '새 친구가 도와주는 이야기 만들기',
    description: '책 속 문제를 도와줄 새 친구를 넣어 이야기를 만들어요.',
    starter: '어려움에 빠진 ___ 앞에 새 친구 ___이 나타났어요.',
    fitFor: '도움, 협력, 새로운 인물, 함께 해결하는 이야기에 관심을 보인 학생',
  },
];

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
      // Try extracting a balanced JSON object.
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

function fallbackRecommendations(): DocentActivityRecommendation[] {
  return ACTIVITY_CANDIDATES
    .filter((candidate) =>
      ['change_choice', 'opposite_perspective', 'continue_story'].includes(candidate.id),
    )
    .map(({ title, description, starter }) => ({ title, description, starter }));
}

function activityCandidateListForPrompt(): string {
  return ACTIVITY_CANDIDATES
    .map((candidate, index) => (
      `${index + 1}. id: ${candidate.id}\n`
      + `   활동명: ${candidate.title}\n`
      + `   설명: ${candidate.description}\n`
      + `   기본 시작 문장: ${candidate.starter}\n`
      + `   잘 맞는 경우: ${candidate.fitFor}`
    ))
    .join('\n');
}

function matchCandidate(raw: Record<string, unknown>): ActivityCandidate | null {
  const rawId = cleanText(raw.id);
  const rawTitle = cleanText(raw.title);

  return ACTIVITY_CANDIDATES.find((candidate) => candidate.id === rawId)
    ?? ACTIVITY_CANDIDATES.find((candidate) => candidate.title === rawTitle)
    ?? null;
}

function normalizeCandidateRecommendations(payload: unknown): DocentActivityRecommendation[] {
  const source =
    payload && typeof payload === 'object' && Array.isArray((payload as { recommendations?: unknown[] }).recommendations)
      ? (payload as { recommendations: unknown[] }).recommendations
      : [];

  const seen = new Set<string>();
  const normalized: DocentActivityRecommendation[] = [];

  for (const item of source) {
    if (!item || typeof item !== 'object') continue;

    const raw = item as Record<string, unknown>;
    const candidate = matchCandidate(raw);
    if (!candidate || seen.has(candidate.id)) continue;

    const starter = cleanText(raw.starter) || candidate.starter;
    normalized.push({
      title: candidate.title,
      description: candidate.description,
      starter,
    });
    seen.add(candidate.id);

    if (normalized.length >= 3) break;
  }

  if (normalized.length >= 3) return normalized;

  const fallbacks = fallbackRecommendations().filter(
    (fallback) => !normalized.some((item) => item.title === fallback.title),
  );

  return [...normalized, ...fallbacks].slice(0, 3);
}

function applyStudentNamePreference(
  recommendations: DocentActivityRecommendation[],
  studentTranscript: string,
): DocentActivityRecommendation[] {
  const replacements: Array<[RegExp, string]> = [];

  if (studentTranscript.includes('타다오')) {
    replacements.push([/타다호/g, '타다오']);
  }

  if (replacements.length === 0) return recommendations;

  const fix = (value: string) =>
    replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);

  return recommendations.map((item) => ({
    title: fix(item.title),
    description: fix(item.description),
    starter: fix(item.starter),
  }));
}

async function buildBookContext(bookId: string | undefined, fallbackTitle: string) {
  const supabase = await createClient();
  let title = fallbackTitle;
  let country = '';
  let originalText = '';
  let analysisText = '';

  if (!bookId) {
    return { title, country, context: '[도서 맥락]\n책 원문을 찾지 못했습니다.' };
  }

  const { data: book } = await supabase
    .from('books')
    .select('title, country_id')
    .eq('id', bookId)
    .maybeSingle<{ title: string; country_id: string }>();

  if (book) {
    title = title || book.title;
    country = book.country_id;
  }

  const [pdfTextRecord, analysisRecord] = await Promise.all([
    getLatestCompletedBookPdfText(supabase, bookId),
    getLatestCompletedBookAnalysis(supabase, bookId),
  ]);

  originalText = pdfTextRecord?.extracted_text?.trim() ?? '';
  analysisText = analysisRecord ? buildBookAnalysisPromptContext(analysisRecord.analysis_json) : '';

  const contextParts = [
    originalText ? `[책 원문]\n${originalText}` : '',
    analysisText ? `[책 분석 보조 정보]\n${analysisText}` : '',
  ].filter(Boolean);

  return {
    title,
    country,
    context: contextParts.length > 0
      ? contextParts.join('\n\n')
      : '[도서 맥락]\n책 원문이나 분석 정보를 아직 불러오지 못했습니다.',
  };
}

async function buildPriorStudentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  bookId: string | undefined,
): Promise<PriorStudentContext> {
  if (!bookId) {
    return {
      oneLine: '',
      readQuestionSeed: '',
      exploreChallenges: [],
      questionPosts: [],
    };
  }

  const [activityResult, questionsResult] = await Promise.all([
    supabase
      .from('activities')
      .select('one_line, read_question_seed, explore_challenges')
      .eq('student_id', studentId)
      .eq('book_id', bookId)
      .maybeSingle(),
    supabase
      .from('question_posts')
      .select('question_type, question_text, created_at')
      .eq('student_id', studentId)
      .eq('book_id', bookId)
      .order('created_at', { ascending: true }),
  ]);

  if (activityResult.error && activityResult.error.code !== 'PGRST116') {
    console.error('Failed to load prior activity context:', activityResult.error);
  }

  if (questionsResult.error) {
    console.error('Failed to load student question context:', questionsResult.error);
  }

  const activity = (activityResult.data ?? {}) as {
    one_line?: string | null;
    read_question_seed?: string | null;
    explore_challenges?: unknown;
  };
  const exploreChallenges = Array.isArray(activity.explore_challenges)
    ? activity.explore_challenges
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const raw = item as Record<string, unknown>;
          return {
            content_title: cleanText(raw.content_title),
            summary: cleanText(raw.summary),
            curiosity: cleanText(raw.curiosity),
          };
        })
        .filter((item): item is { content_title: string; summary: string; curiosity: string } =>
          Boolean(item && (item.content_title || item.summary || item.curiosity)),
        )
    : [];

  return {
    oneLine: cleanText(activity.one_line),
    readQuestionSeed: cleanText(activity.read_question_seed),
    exploreChallenges,
    questionPosts: ((questionsResult.data ?? []) as Array<{ question_type: string; question_text: string }>)
      .map((question) => ({
        question_type: cleanText(question.question_type),
        question_text: cleanText(question.question_text),
      }))
      .filter((question) => question.question_text),
  };
}

function formatPriorStudentContext(context: PriorStudentContext): string {
  const lines: string[] = [];

  if (context.oneLine) {
    lines.push(`[Step 1 한 줄 감상]\n${context.oneLine}`);
  }

  if (context.readQuestionSeed) {
    lines.push(`[Step 1 읽고 떠올린 질문 씨앗]\n${context.readQuestionSeed}`);
  }

  if (context.exploreChallenges.length > 0) {
    lines.push(
      `[Step 2 자료 탐색 메모]\n${context.exploreChallenges
        .slice(0, 5)
        .map((item) => {
          const title = item.content_title ? `- ${item.content_title}` : '- 자료';
          const summary = item.summary ? ` / 정리: ${item.summary}` : '';
          const curiosity = item.curiosity ? ` / 궁금한 점: ${item.curiosity}` : '';
          return `${title}${summary}${curiosity}`;
        })
        .join('\n')}`,
    );
  }

  if (context.questionPosts.length > 0) {
    lines.push(
      `[Step 3 학생이 만든 질문]\n${context.questionPosts
        .slice(0, 12)
        .map((question) => `- (${question.question_type}) ${question.question_text}`)
        .join('\n')}`,
    );
  }

  return lines.length > 0
    ? lines.join('\n\n')
    : '이전 단계에서 저장된 한 줄 감상, 질문 씨앗, 질문 게시글이 아직 없습니다.';
}

export async function POST(request: NextRequest) {
  try {
    const {
      story_id,
      messages,
      book_id,
      book_title,
      language = 'ko',
    } = (await request.json()) as {
      story_id?: string;
      messages?: ChatMessage[];
      book_id?: string;
      book_title?: string;
      language?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '도슨트와 나눈 대화를 찾지 못했어요.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const bookContext = await buildBookContext(book_id, cleanText(book_title));
    const priorStudentContext = await buildPriorStudentContext(supabase, user.id, book_id);
    const studentTranscript = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');
    const transcript = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => `${message.role === 'user' ? '학생' : '도슨트'}: ${message.content}`)
      .join('\n');

    const systemPrompt = `너는 초등학생과 작가 도슨트의 대화 내용을 읽고, 다음 단계에서 하기 좋은 그림책 활동 3개를 추천하는 교육 설계자이다.

[절대 조건]
- 추천은 반드시 아래 [활동 후보] 중에서만 고른다.
- 추천 활동은 모두 "읽은 그림책을 바탕으로 다시 새 그림책을 만드는 활동"이어야 한다.
- 독후감, 발표, 조사, 토론, 만들기만 하는 활동은 추천하지 않는다.
- 활동명과 설명은 후보의 문구를 그대로 사용한다.
- starter만 학생 대화와 책 내용에 맞게 한 문장으로 구체화한다.
- 학생이 대화에서 보인 관심사, 질문, 감정, 막힌 지점을 반영한다.
- 인물 이름은 학생 발화에 나온 표기를 우선 사용한다. 학생이 "타다오"라고 썼다면 "타다호"로 바꾸지 않는다.
- starter에는 학생이 직접 말한 인물, 장면, 질문, 이야기 씨앗을 우선 사용한다.
- 학생이 직접 말하지 않은 새 인물이나 곁가지 인물을 starter의 중심으로 세우지 않는다.
- 정확히 3개만 추천한다.
- 각 추천은 UI 카드에 들어갈 만큼 짧고 선명해야 한다.
- "다른 활동하기"는 화면에서 별도로 제공하므로 JSON에는 넣지 않는다.

[도서 정보]
- 제목: ${bookContext.title || cleanText(book_title) || '이 그림책'}
- 저자명: 도슨트
- 나라/지역: ${bookContext.country || '정보 없음'}
- 응답 언어: ${language === 'en' ? 'English' : '한국어'}

[책 원문과 보조 정보]
${bookContext.context}

[이전 단계 학생 데이터]
${formatPriorStudentContext(priorStudentContext)}

[도슨트와 학생의 대화]
${transcript}

[활동 후보]
${activityCandidateListForPrompt()}

[추천 기준]
1. 작가 도슨트 대화에서 학생이 가장 자주 물은 인물, 장면, 선택, 결말, 마음을 우선한다.
2. Step 1 한 줄 감상과 질문 씨앗이 있으면 학생이 처음 붙잡은 감정과 궁금증으로 보고 강하게 반영한다.
3. Step 3 학생 질문이 있으면 반복되는 질문 유형을 보고 후보를 고른다. 인물 질문은 다른 주인공/다른 인물 눈, 선택 질문은 다른 선택, 결말 질문은 다른 결말/다음 이야기와 잘 맞는다.
4. Step 2 자료 탐색 메모가 있으면 장소, 문화, 배경 단서를 보조로 반영한다.
5. 학생이 직접 말한 해석이나 만들고 싶은 이야기 씨앗을 우선한다.
6. 책의 핵심 사건과 메시지에서 너무 멀어지지 않는 후보를 고른다.
7. 학생이 막히거나 질문을 어려워했다면 시작하기 쉬운 후보를 고른다.

출력은 JSON 객체로만 작성한다.
형식:
{
  "recommendations": [
    {
      "id": "활동 후보 id",
      "title": "활동 후보의 활동명 그대로",
      "description": "활동 후보의 설명 그대로",
      "starter": "다음 단계에서 학생에게 보여줄 시작 문장"
    }
  ]
}`;

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '추천 3개를 JSON으로만 작성해 주세요.' },
      ],
      {
        model: 'gpt-5-mini',
        maxTokens: 1800,
        reasoningEffort: 'minimal',
        jsonMode: true,
        timeoutMs: 60_000,
      },
    );

    const jsonText = extractJsonObject(result);
    const parsed = jsonText ? JSON.parse(jsonText) : {};
    const recommendations = applyStudentNamePreference(
      normalizeCandidateRecommendations(parsed),
      studentTranscript,
    );

    if (story_id) {
      const { error: updateError } = await supabase
        .from('stories')
        .update({
          docent_chat_log: messages,
          docent_recommendations: recommendations,
        })
        .eq('id', story_id)
        .eq('student_id', user.id);

      if (updateError) {
        console.error('Failed to save docent recommendations:', updateError);
      }
    }

    return Response.json({
      farewell: '이제 헤어질 시간이야. 오늘 네가 나눈 이야기를 보니, 다음에는 이런 활동이 잘 어울리겠어.',
      recommendations,
    });
  } catch (error) {
    console.error('Docent recommendation error:', error);
    return Response.json(
      {
        farewell: '이제 헤어질 시간이야. 오늘 이야기를 바탕으로 바로 시작하기 좋은 활동을 골라봤어.',
        recommendations: fallbackRecommendations(),
      },
      { status: 500 },
    );
  }
}
