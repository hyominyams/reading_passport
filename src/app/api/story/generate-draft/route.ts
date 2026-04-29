import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { buildBookAnalysisPromptContext } from '@/lib/book-analysis';
import { countries } from '@/lib/data/countries';
import { getLatestCompletedBookAnalysis } from '@/lib/queries/book-analyses';
import { getLatestCompletedBookPdfText } from '@/lib/queries/book-pdf-texts';
import { createClient } from '@/lib/supabase/server';
import { getToriCardSet, normalizeToriAnswers } from '@/lib/tori-questions';
import type { DocentActivityRecommendation, ToriAnswersRecord } from '@/types/database';

type DraftPage = {
  draft: string;
  advice: string;
};

type DocentChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

/**
 * Per-activity guidance the LLM uses to map Tori answers onto the 5-scene
 * picture-book structure. The keys here match the `key` field of each card
 * in `src/lib/tori-questions.ts`. The prompt also tells the model to fall
 * back to inference when an answer is vague.
 */
const ACTIVITY_SCENE_MAPPINGS: Record<string, string> = {
  continue_story: `
1. 발단: "start_event" 답을 그대로 사용해 책이 끝난 다음 날의 풍경과 주인공을 보여준다.
2. 전개: 일상 속에서 "new_event"가 시작되는 장면.
3. 위기: "new_event"의 여파로 주인공이 흔들리는 순간.
4. 절정: "helper" 답을 등장시켜 전환점을 만든다.
5. 결말: "ending" 답을 학생 어조 그대로 이룬다.`,
  before_story: `
1. 발단: "timeframe"과 "past_state" 답을 토대로 책 이전의 주인공을 소개한다.
2. 전개: "origin_event"의 첫 신호가 일상에 등장한다.
3. 위기: "origin_event"가 본격적으로 주인공을 흔든다.
4. 절정: 주인공이 그 사건을 마주하는 결정적 장면.
5. 결말: "ending" 답대로 마무리하되, 책의 시작 장면과 자연스럽게 이어지도록 한다.`,
  new_problem_story: `
1. 발단: 책의 결말 직후 풍경에서 시작. 주인공이 평온해 보이는 순간.
2. 전개: "new_problem" 답을 그대로 발생 장면으로 만든다.
3. 위기: "why_hard"의 이유가 드러나며 주인공이 흔들린다.
4. 절정: "helper" 답을 등장시켜 전환점을 만든다.
5. 결말: "ending" 답대로 마무리한다.`,
  hidden_scene_story: `
1. 발단: "between_what"이 가리키는 두 장면 중 앞 장면의 끝에서 시작한다.
2. 전개: "what_happened"의 첫 부분을 보여준다.
3. 위기: "what_happened"가 깊어지는 순간 + "inner_feeling"의 흔들림.
4. 절정: 그 마음이 정점에 도달하는 장면.
5. 결말: "between_what"이 가리키는 뒷 장면으로 자연스럽게 이어지는 마무리.`,
  new_helper_story: `
1. 발단: 책의 어려움이 아직 남아 있는 풍경에서 시작.
2. 전개: "meeting_moment"에 따라 "new_friend"가 등장.
3. 위기: 함께 풀어가려 했지만 더 큰 문제가 드러나는 순간.
4. 절정: "how_help"가 일어나는 결정적 장면.
5. 결말: "ending" 답대로 마무리한다.`,
  change_main_character: `
1. 발단: "new_protagonist"를 소개하고 "daily_life" 답으로 그의 세계를 보여준다.
2. 전개: 그 인물의 일상에서 "conflict"가 시작된다.
3. 위기: "conflict"가 커지고 인물이 흔들린다.
4. 절정: 인물이 "conflict"를 마주하는 결정적 장면.
5. 결말: "ending" 답대로 마무리한다.`,
  side_character_story: `
1. 발단: "which_character"의 평범한 하루를 "daily_life" 답으로 보여준다.
2. 전개: "hidden_feeling"의 단서가 드러나는 작은 사건.
3. 위기: 그 인물이 숨긴 마음과 마주하는 순간.
4. 절정: "hidden_feeling"이 행동으로 표현되는 장면.
5. 결말: "ending" 답대로 마무리한다.`,
  opposite_perspective: `
1. 발단: "whose_eyes"의 시점에서 책의 첫 만남 장면을 다시 그린다.
2. 전개: "what_seen" 답에 따라 같은 사건이 그 인물 눈에 어떻게 보였는지 보여준다.
3. 위기: 그 인물이 처음에 알아채지 못한 진실 또는 갈등이 드러난다.
4. 절정: "feeling_change"가 일어나는 결정적 장면.
5. 결말: 그 인물의 시점으로 책의 결말을 다시 본다.`,
  change_ending: `
1. 발단: 원작과 동일하게 시작하되 시각적 디테일은 학생 답을 참고한다.
2. 전개: 원작의 흐름이 이어지다가 "branching_point"가 가까워진다.
3. 위기: "branching_point"에서 "different_choice"가 일어난다.
4. 절정: "different_choice"의 결과가 정점에 도달한다.
5. 결말: "new_ending" 답을 학생 어조 그대로 이룬다.`,
  change_choice: `
1. 발단: 원작과 동일한 시작.
2. 전개: "choice_moment"가 가까워지는 흐름.
3. 위기: "choice_moment"에서 "different_choice"가 일어나며 흐름이 갈라진다.
4. 절정: 그 다른 선택이 만든 결정적 장면.
5. 결말: "result" 답대로 마무리한다.`,
  same_message_new_story: `
1. 발단: "country_scene" 답을 풍경으로 깔고 "new_protagonist"를 소개한다.
2. 전개: 그 인물의 일상에서 "conflict"가 시작된다.
3. 위기: "conflict"가 깊어지는 순간.
4. 절정: "inherited_feeling"이 행동으로 표현되는 결정적 장면.
5. 결말: "ending" 답대로 마무리하되, "inherited_feeling"이 살아있게 한다.`,
  change_setting: `
1. 발단: "new_setting" 답으로 새 장소와 주인공을 보여준다.
2. 전개: 책의 사건이 그 장소에서 새롭게 시작된다.
3. 위기: "setting_difference" 답이 드러나는 순간 — 장소 때문에 보이는 새로운 어려움.
4. 절정: 주인공이 그 장소만의 어려움을 마주하는 장면.
5. 결말: "ending" 답대로 마무리한다.`,
  _custom: `
1-4. 학생의 "plan" 답을 5장면 중 1~4번에 걸쳐 발단·전개·위기·절정으로 풀어낸다.
5. 결말: "ending" 답을 학생 어조 그대로 이룬다.`,
};

function formatToriAnswers(
  answers: ToriAnswersRecord | null,
): { hasContent: boolean; text: string; activityId: string } {
  if (!answers) return { hasContent: false, text: '(없음)', activityId: '_custom' };

  const cardSet = getToriCardSet(answers.activity_id);
  const lines: string[] = [];

  for (const card of cardSet.cards) {
    const value = answers.answers[card.key]?.trim();
    if (!value) continue;
    // Strip the variable templates from the title for the prompt — the
    // student already saw the rendered title; we just want the question
    // intent for the LLM.
    const plainTitle = card.title.replace(/\$\{country\}/g, '국가').replace(/\$\{protagonist\}/g, '주인공');
    lines.push(`- [${card.key}] ${plainTitle}\n  ↳ ${value}`);
  }

  return {
    hasContent: lines.length > 0,
    text: lines.length > 0 ? lines.join('\n') : '(없음)',
    activityId: answers.activity_id,
  };
}

function getActivitySceneMapping(activityId: string): string {
  return ACTIVITY_SCENE_MAPPINGS[activityId] ?? ACTIVITY_SCENE_MAPPINGS._custom;
}

function getCountryDisplayName(countryId: string | null | undefined): string {
  if (!countryId) return '';
  const country = countries.find((item) => item.id === countryId);
  return country?.name ?? countryId;
}

function buildExploreChallengesText(rows: unknown): string {
  if (!Array.isArray(rows)) return '';
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const title = typeof item.content_title === 'string' ? item.content_title.trim() : '';
      const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
      const curiosity = typeof item.curiosity === 'string' ? item.curiosity.trim() : '';
      if (!title && !summary && !curiosity) return null;
      const parts = [title ? `자료: ${title}` : '', summary ? `정리: ${summary}` : '', curiosity ? `궁금한 점: ${curiosity}` : ''].filter(Boolean);
      return `- ${parts.join(' / ')}`;
    })
    .filter(Boolean)
    .slice(0, 5)
    .join('\n');
}

function formatSelectedActivity(activity: DocentActivityRecommendation | null | undefined, customInput: string | null | undefined) {
  if (activity?.title || activity?.description || activity?.starter) {
    return [
      activity.title ? `활동 이름: ${activity.title}` : '',
      activity.description ? `활동 설명: ${activity.description}` : '',
      activity.starter ? `시작 문장: ${activity.starter}` : '',
    ].filter(Boolean).join('\n');
  }

  return typeof customInput === 'string' && customInput.trim()
    ? `학생이 직접 정한 활동: ${customInput.trim()}`
    : '';
}

function formatDocentConversation(messages: DocentChatMessage[] | null | undefined) {
  if (!Array.isArray(messages)) return '';

  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-12)
    .map((message) => `${message.role === 'user' ? '학생' : '도슨트'}: ${message.content}`)
    .join('\n');
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

function limitPromptContext(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[이하 생략: 초안 생성에는 앞부분과 구조화 요약을 우선 사용]`;
}

async function generateDraftPages(params: {
  systemPrompt: string;
  userPrompt: string;
  language: string;
  maxTokens?: number;
}) {
  const result = await chatCompletion(
    [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    {
      model: 'gpt-5-mini',
      maxTokens: params.maxTokens ?? 4500,
      jsonMode: true,
      reasoningEffort: 'low',
      timeoutMs: 90_000,
    }
  );

  const jsonText = extractJsonObject(result);
  const parsed = jsonText ? JSON.parse(jsonText) : {};
  return {
    pages: normalizePages(parsed, params.language),
    hasResult: result.length > 0,
    hasJsonText: Boolean(jsonText),
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      bookId,
      custom_input,
      book_title,
      country,
      story_summary,
      characters,
      selected_activity,
      docent_messages,
      tori_answers,
      book_full_text,
      language = 'ko',
    } = await request.json();

    const selectedActivityText = formatSelectedActivity(selected_activity, custom_input);
    const docentConversationText = formatDocentConversation(docent_messages);
    const toriAnswersInfo = formatToriAnswers(normalizeToriAnswers(tori_answers));
    const sceneMapping = getActivitySceneMapping(toriAnswersInfo.activityId);

    if (!toriAnswersInfo.hasContent) {
      return Response.json(
        { error: '토리 답변이 비어 있어 초안을 만들 수 없어요.' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    let resolvedBookTitle = book_title ?? '';
    let resolvedCountry = country ?? '';
    let resolvedStorySummary = story_summary ?? '';
    let resolvedCharacters = characters ?? '';
    let resolvedAnalysisContext = '';
    let resolvedPdfText = '';
    let resolvedExploreText = '';
    const resolvedBookText =
      typeof book_full_text === 'string' ? book_full_text.trim() : '';

    if (bookId) {
      const { data: book } = await supabase
        .from('books')
        .select('title, country_id')
        .eq('id', bookId)
        .single();

      if (book) {
        resolvedBookTitle = resolvedBookTitle || book.title;
        resolvedCountry = resolvedCountry || book.country_id;

        const [pdfTextRecord, analysisRecord, activityRecord] = await Promise.all([
          getLatestCompletedBookPdfText(supabase, bookId),
          getLatestCompletedBookAnalysis(supabase, bookId),
          supabase
            .from('activities')
            .select('explore_challenges')
            .eq('student_id', user.id)
            .eq('book_id', bookId)
            .maybeSingle(),
        ]);

        resolvedPdfText = pdfTextRecord?.extracted_text?.trim() ?? '';

        const analysis = analysisRecord?.analysis_json;
        resolvedAnalysisContext = analysis ? buildBookAnalysisPromptContext(analysis) : '';

        if (!resolvedStorySummary && analysis?.story_summary) {
          resolvedStorySummary = analysis.story_summary;
        }

        if (!resolvedCharacters && analysis?.characters.length) {
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

        resolvedExploreText = buildExploreChallengesText(activityRecord.data?.explore_challenges);
      }
    }

    const bookContextSection = resolvedBookText
      ? `[원문 텍스트]\n${limitPromptContext(resolvedBookText, 9000)}`
      : resolvedPdfText
        ? `[PDF 원문 텍스트]\n${limitPromptContext(resolvedPdfText, 9000)}`
        : resolvedAnalysisContext
          ? `[도서 구조화 요약]\n${limitPromptContext(resolvedAnalysisContext, 7000)}`
          : '[도서 맥락]\n(도서 요약을 불러오지 못했습니다.)';

    const analysisContextSection = resolvedAnalysisContext
      ? `\n\n[도서 분석 보조 정보]\n${limitPromptContext(resolvedAnalysisContext, 5000)}`
      : '';

    const finalBookContextSection = `${bookContextSection}${analysisContextSection}`;

    if (!resolvedBookText && !resolvedPdfText && !resolvedAnalysisContext) {
      return Response.json(
        { error: '도서 원문 또는 분석 데이터가 아직 준비되지 않았습니다.' },
        { status: 409 },
      );
    }

    const countryDisplay = getCountryDisplayName(resolvedCountry) || resolvedCountry || '이 나라';

    const systemPrompt = `당신은 초등학생의 그림책 창작을 돕는 아동 창작 교육 도우미입니다.
학생은 ${countryDisplay}의 그림책 《${resolvedBookTitle}》을 읽고, 작가 도슨트와 대화하고,
활동을 골랐고, 자기 이야기 방향을 토리 질문 답변으로 정리했습니다.
당신은 그 모든 재료로 정확히 5장면 그림책 초안과 페이지별 조언을 씁니다.

[신호 우선순위 — 충돌하면 위쪽을 따른다]
1. 학생의 토리 답변 (절대 우선)
2. 학생이 선택한 활동
3. 도슨트와 학생의 대화
4. Hidden Stories에서 학생이 본 자료
5. 책 원문/분석

[책 정보]
- 제목: ${resolvedBookTitle}
- 국가: ${countryDisplay}
- 줄거리: ${resolvedStorySummary || '(요약 없음)'}
- 등장인물: ${resolvedCharacters || '(분석 없음)'}

[도서 원문 또는 분석 요약]
${finalBookContextSection}

[Hidden Stories - 학생이 본 자료]
${resolvedExploreText || '(없음)'}

[도슨트와 학생의 대화]
${docentConversationText || '(없음)'}

[학생이 선택한 활동]
${selectedActivityText || '(없음)'}

[학생이 토리 질문에 답한 내용 ★최우선]
${toriAnswersInfo.text}

[활동별 5장면 매핑 - 반드시 따른다]
${sceneMapping}

[초안 작성 규칙]
1. 위 토리 답변에 직접 적힌 인물·사건·결말을 그대로 골격으로 사용한다.
2. 학생이 말하지 않은 핵심 사건을 멋대로 새로 만들지 않는다.
3. 학생 답변이 모호하거나 책의 특정 장면을 가리키면 (예: "마지막 장면", "친구를 만난 순간"), 위 책 원문/분석에서 가장 가까운 장면을 추론해 적용한다.
4. 주인공의 이름·성격은 5장면 전체에서 일관되게 유지한다.
5. 각 draft는 2~4문장. 일부 감정 묘사와 연결 문장은 일부러 덜 채워 학생이 오른쪽 칸에 다시 쓸 여백을 남긴다.
6. 초등학생이 한 번 읽고 이해할 수 있는 쉬운 말로 쓴다.
7. 정확히 5개 장면(발단·전개·위기·절정·결말)으로 나눈다.

[국가·문화 표현 가드 - 반드시 지킨다]
1. ${countryDisplay}을 "가난한 나라", "불쌍한 곳", "어두운 곳", "위험한 곳" 같은 단일 이미지로 그리지 않는다.
2. ${countryDisplay} 사람들 전체를 한 가지 성격(착함, 게으름, 슬픔 등)으로 단정하지 않는다.
3. 어려움을 다루더라도 인물의 존엄·일상의 따뜻함·작은 기쁨을 함께 보여준다.
4. 학생이 적은 어려움을 그 나라의 본질이라고 일반화하지 않는다.

[조언(advice) 작성 규칙]
1. 각 advice는 그 장면에서 학생이 직접 적은 단어·인물·감정 중 하나를 골라 짚고, 그걸 어떻게 더 풀어낼 수 있는지 한 가지만 제안한다.
2. "더 자세히 써봐", "감정을 넣어봐" 같은 일반론은 금지.
3. 1~2문장, 반말, 친근한 톤.

출력 형식 (JSON만, 다른 텍스트 금지):
{"pages":[{"draft":"발단 초안","advice":"발단 조언"},{"draft":"전개 초안","advice":"전개 조언"},{"draft":"위기 초안","advice":"위기 조언"},{"draft":"절정 초안","advice":"절정 조언"},{"draft":"결말 초안","advice":"결말 조언"}]}

응답 언어: ${language === 'ko' ? '한국어' : 'English'}`;

    const userPrompt = language === 'en'
      ? 'Write the draft and advice as JSON only.'
      : '이야기 초안과 조언을 JSON으로만 작성해 주세요.';

    let { pages, hasResult, hasJsonText } = await generateDraftPages({
      systemPrompt,
      userPrompt,
      language,
      maxTokens: 4500,
    });

    if (pages.length === 0) {
      console.error('Draft generation returned no usable pages. Retrying with compact prompt.', {
        hasResult,
        hasJsonText,
      });

      const retrySystemPrompt = `당신은 초등학생의 그림책 창작을 돕는 아동 창작 교육 도우미입니다.

[책 정보]
제목: ${resolvedBookTitle}
국가: ${countryDisplay}
줄거리: ${resolvedStorySummary || '(없음)'}
등장인물: ${resolvedCharacters || '(없음)'}

[학생이 선택한 활동]
${selectedActivityText || '(없음)'}

[학생이 토리 질문에 답한 내용 ★최우선]
${toriAnswersInfo.text}

[활동별 5장면 매핑]
${sceneMapping}

[규칙]
1. 토리 답변을 최우선으로 사용한다. 답변에 없는 핵심 사건을 만들지 않는다.
2. 위 5장면 매핑을 반드시 따른다.
3. 정확히 5개 장면(발단·전개·위기·절정·결말)을 만든다.
4. 각 draft는 2~4문장, 각 advice는 1~2문장.
5. ${countryDisplay}을 단일 이미지나 부정적 고정관념으로 그리지 않는다.
6. 초등학생이 이해할 수 있는 쉬운 말로 쓴다.

출력은 JSON만 허용한다.
{"pages":[{"draft":"발단 초안","advice":"발단 조언"},{"draft":"전개 초안","advice":"전개 조언"},{"draft":"위기 초안","advice":"위기 조언"},{"draft":"절정 초안","advice":"절정 조언"},{"draft":"결말 초안","advice":"결말 조언"}]}

응답 언어: ${language === 'ko' ? '한국어' : 'English'}`;

      ({ pages, hasResult, hasJsonText } = await generateDraftPages({
        systemPrompt: retrySystemPrompt,
        userPrompt,
        language,
        maxTokens: 3500,
      }));
    }

    if (pages.length === 0) {
      console.error('Draft generation failed after retry.', {
        hasResult,
        hasJsonText,
      });
      return Response.json(
        { error: '초안 생성 결과를 해석하지 못했습니다.' },
        { status: 502 },
      );
    }

    return Response.json({ pages });
  } catch (error) {
    console.error('Draft generation error:', error);
    return Response.json(
      { error: 'Failed to generate draft' },
      { status: 500 },
    );
  }
}
