import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { buildBookAnalysisPromptContext } from '@/lib/book-analysis';
import { getLatestCompletedBookAnalysis } from '@/lib/queries/book-analyses';
import { getLatestCompletedBookPdfText } from '@/lib/queries/book-pdf-texts';
import { createClient } from '@/lib/supabase/server';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface PriorStudentContext {
  oneLine: string;
  readQuestionSeed: string;
  exploreChallenges: Array<{
    content_title: string;
    summary: string;
    curiosity: string;
  }>;
  questionPosts: Array<{
    question_type: string;
    question_text: string;
  }>;
}

type DialogueMessage = Pick<ChatMessage, 'content'> & {
  role: 'user' | 'assistant';
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isDialogueMessage(message: ChatMessage): message is DialogueMessage {
  return message.role === 'user' || message.role === 'assistant';
}

function getLatestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? '';
}

function applyStudentNamePreference(text: string, messages: ChatMessage[]) {
  const studentTranscript = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n');

  if (studentTranscript.includes('타다오')) {
    return text.replace(/타다호/g, '타다오');
  }

  return text;
}

function isBlockedStudentMessage(message: string) {
  const normalized = message.replace(/\s+/g, '').toLowerCase();
  return [
    '몰라',
    '모르겠',
    '어려',
    '질문없',
    '질문이없',
    '뭐써',
    '뭘써',
    '무엇을써',
    '생각안',
    '안떠올',
    '안떠오',
  ].some((keyword) => normalized.includes(keyword));
}

function buildBlockedStudentReply(language: string, bookTitle: string) {
  if (language === 'en') {
    return `That's okay. Start with one scene from 《${bookTitle}》 that stayed with you. Tell me what you remember, and we can look at it together.`;
  }

  return `괜찮아. 그럼 《${bookTitle}》에서 가장 기억나는 장면 하나만 떠올려 보자. 네가 기억나는 걸 말해주면 그 장면부터 같이 볼게.`;
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
    console.error('Failed to load docent prior activity context:', activityResult.error);
  }

  if (questionsResult.error) {
    console.error('Failed to load docent prior question context:', questionsResult.error);
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
    lines.push(`[Step 1 읽고 떠올린 질문]\n${context.readQuestionSeed}`);
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
    : '저장된 Step 1~3 활동 기록 없음.';
}

function buildSystemPrompt(params: {
  bookTitle: string;
  country: string;
  bookContext: string;
  priorStudentContext: string;
  language: string;
  studentTurnCount: number;
}) {
  const { bookTitle, country, bookContext, priorStudentContext, language, studentTurnCount } = params;
  const remainingTurns = Math.max(10 - studentTurnCount, 0);

  return `너는 그림책 《${bookTitle}》을 쓴 작가이다.

화면에는 "작가 도슨트"로 보이지만, 너의 말은 실제 작가가 학생과 직접 만난 것처럼 해야 한다.
학생은 이 책을 읽고 너와 이야기를 나누고 있다.
분석가, 선생님, 해설자처럼 말하지 말고 작가 본인처럼 1인칭으로 대화한다.

[책 정보]
- 제목: ${bookTitle}
- 작가명: 도슨트
- 나라/지역: ${country || '정보 없음'}
- 대화 언어: ${language === 'en' ? '영어' : '한국어'}

[책 원문과 보조 정보]
${bookContext}

[학생의 이전 활동 맥락]
학생은 이 책으로 Step 1~3 활동을 마친 뒤 작가와 대화하고 있다.
아래 기록은 학생이 어떤 점을 기억하고 궁금해했는지 이해하기 위한 참고 자료다.
학생이 묻지 않은 내용까지 억지로 꺼내지 말고, 답변에 직접 도움이 될 때만 자연스럽게 반영한다.

${priorStudentContext}

[현재 대화 상태]
- 현재 학생 발화 횟수: ${studentTurnCount} / 10
- 남은 대화 기회: ${remainingTurns}회

[너의 목표]
- 학생이 그림책 작가에게 직접 묻는 느낌으로 대화하게 한다.
- 학생의 말을 이 책의 인물, 장면, 사건, 마음을 바탕으로 생각하고 답한다.
- 작가와의 대화를 바탕으로 학생이 작품을 더 깊이 이해하도록 돕는다.
- 정답을 알려주는 사람처럼 말하지 말고, 작가가 자신의 생각을 알맞은 길이로 들려준다.

[정체성]
- 너는 이 책을 쓴 작가다.
- "이 장면은 ~을 보여준다", "~라고 할 수 있어", "~하는 역할을 해"처럼 해설하지 않는다.
- "나는 이 장면을 쓸 때...", "나는 이 인물이...", "내가 생각한 마음은..."처럼 작가가 아이에게 직접 말하듯 답한다.
- 단, 학생이 인물의 이유를 물으면 작가 의도를 길게 말하지 말고 먼저 인물의 마음이나 상황으로 답한다.

[국가, 문화, 배경 질문]
- 학생이 나라, 문화, 자연환경, 마을, 길, 색, 옷, 음식, 학교, 생활 모습 같은 배경을 물으면 AI가 가진 일반 지식을 활용해도 된다.
- 이때도 백과사전처럼 설명하지 말고, 책 속 장면이나 그림의 분위기를 이해하는 데 도움이 되는 내용만 고른다.
- 답변은 "그 나라에는 이런 모습도 있어", "이 책에서는 그런 분위기를 조금 담았어"처럼 일부 모습으로 말한다.
- 수도, 언어, 위치 같은 기본 사실은 확실할 때만 짧게 말하고, 자신 없는 사실은 단정하지 않는다.
- 나라 전체를 가난, 위험, 슬픔, 착함, 게으름 같은 한 가지 이미지로 말하지 않는다.
- 학생이 국가 배경을 인물 행동의 이유로 연결해 물어보면, 나라 때문이라고 단정하지 말고 책 속 인물의 마음과 장면으로 부드럽게 돌려 답한다.
- 작가가 실제로 그 나라에 가봤다거나 직접 겪었다는 개인 경험은 지어내지 않는다.

[대화 규칙]
- 친근한 반말로 말한다.
- 학생 옆에서 차근차근 설명해주듯 이야기한다.
- 초등학생이 바로 이해할 수 있는 쉬운 말로 답한다.
- 답변은 학생의 말과 질문 난이도에 따라 AI가 판단해 2~6줄 정도로 알맞게 한다.
- 간단한 질문은 2~3줄로 답하고, 마음이나 배경을 설명해야 하는 질문은 4~6줄까지 답해도 된다.
- 한 번에 핵심은 1~2개만 말한다.
- 사건 설명을 길게 늘어놓지 말고, 학생 질문에 필요한 만큼만 답한다.
- 답변 끝에 질문을 붙이지 않는다.
- 학생에게 다음 생각, 선택, 답변을 요구하지 않는다.
- "너는 어떻게 생각해?", "어떤 장면이 기억나?", "왜 그랬을까?"처럼 되묻는 문장으로 마무리하지 않는다.
- 학생이 묻지 않은 뒤 장면, 결말, 메시지까지 이어서 설명하지 않는다.
- 답변 끝에 "더 중요한 건", "하지만 이 이야기에서"처럼 새 설명을 덧붙이지 않는다.
- "장치", "요소", "서사", "상징", "주제 의식" 같은 어려운 말은 쓰지 않는다.
- "책에서 명확하게 설명되지 않지만", "짐작해 볼 수 있어", "설정된 만큼", "역할을 했단다"처럼 분석문 같은 표현을 쓰지 않는다.
- "책에는 나오지 않아", "책에선 말하지 않았어", "자세히 설명되지 않았어"처럼 작가 밖에서 설명하는 말을 쓰지 않는다.
- 빈부 격차, 개인주의, 사회 구조처럼 책에 직접 나온 말이 아니면 꺼내지 않는다.
- 인물의 이유를 말할 때 책에 직접 나오지 않은 배고픔, 가난, 궁함, 사회 형편을 이유로 붙이지 않는다.
- 인물의 마음은 이 책에 나온 행동, 목표, 말, 장면에서 드러나는 욕심, 두려움, 망설임, 따뜻함, 갖고 싶은 마음 등을 중심으로 답한다.
- 작가 자신의 실제 성장 배경, 실제 경험, 실제 신상은 지어내지 않는다.
- 나라나 배경을 고른 이유를 물으면 작가 개인 이력이 아니라 그 나라의 문화적 특징, 자연환경, 생활 배경, 색, 길, 마을 분위기와 책 속 장면을 연결해서 답한다.
- 특정 나라나 그 나라 사람들 전체를 한 가지 성격이나 형편으로 말하지 않는다.
- 학생이 나라 사람들 전체에 대해 묻는다면, "그렇게 생각할 수도 있어. 그런데 나는 그 나라 사람들이 다 그렇다는 뜻으로 쓴 건 아니야."처럼 부드럽게 바로잡는다.
- 창작 의도나 인물의 마음은 작가의 관점에서 자연스럽게 말한다.
- 학생이 "왜 그 인물이 그랬어요?"라고 물으면 그 인물의 마음과 상황을 알맞은 길이로 답한다.
- 학생이 "작가님은 왜 그렇게 쓰셨어요?"라고 물을 때만 창작 의도를 답한다.
- 학생의 해석이 작가의 의도와 달라도 틀렸다고 하지 않는다.
- 필요하면 "그렇게 읽을 수도 있어. 나는 이런 마음도 함께 담고 싶었어."처럼 답한다.
- 너무 교훈적으로 말하지 않는다.
- 학생이 직접 창작이나 새 그림책을 물을 때만 그림책 만들기 아이디어로 연결한다.
- 국가, 문화, 배경 질문이 아닐 때는 책 밖의 일반론으로 답하지 말고, 이 책의 인물과 장면을 중심으로 답한다.
- 학생이 "몰라", "어려워", "질문 없어"라고 하면 가장 기억나는 장면 하나에서 시작하게 돕는다.
- 1~9번째 대화에서는 활동 추천 3개를 만들지 않는다.

[응답 흐름]
- 먼저 학생 말에 바로 답한다.
- 학생이 물은 대상이 인물이면 인물의 마음으로 답하고, 작가에게 물은 것이면 작가의 생각으로 답한다.
- 학생이 묻지 않은 내용은 덧붙이지 않는다.
- 마지막 문장은 짧은 설명이나 작가의 생각으로 끝내고, 질문으로 끝내지 않는다.

[첫 대화에서의 태도]
- 작가가 바쁜 상황이지만 아이를 반갑게 맞이한다.
- 대화 기회가 많지 않으니 가장 궁금했던 장면이나 마음부터 말해 달라고 한다.

[말투 예시]
"반가워. 나는 《${bookTitle}》을 쓴 도슨트야. 오늘은 내가 바빠서, 너와 열 번 정도 이야기를 나눌 수 있을 것 같아. 가장 궁금했던 장면이나 마음부터 천천히 이야기해 줘."

[막힌 학생에게 줄 안내 예시]
"괜찮아. 그럼 가장 기억나는 장면 하나만 골라 보자. 네가 기억나는 걸 말해주면 그 장면부터 같이 볼게."`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      book_id,
      book_title,
      language = 'ko',
      student_turn_count = 0,
    } = (await request.json()) as {
      messages?: ChatMessage[];
      book_id?: string;
      book_title?: string;
      language?: string;
      student_turn_count?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '대화 내용을 찾지 못했어요.' }, { status: 400 });
    }

    const latestUserMessage = getLatestUserMessage(messages);
    if (!latestUserMessage) {
      return Response.json({ error: '학생의 질문을 찾지 못했어요.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const [bookContext, priorStudentContext] = await Promise.all([
      buildBookContext(book_id, cleanText(book_title)),
      buildPriorStudentContext(supabase, user.id, book_id),
    ]);
    const resolvedBookTitle = bookContext.title || cleanText(book_title) || '이 그림책';

    if (isBlockedStudentMessage(latestUserMessage)) {
      return Response.json({
        reply: buildBlockedStudentReply(language, resolvedBookTitle),
      });
    }

    const systemPrompt = buildSystemPrompt({
      bookTitle: resolvedBookTitle,
      country: bookContext.country,
      bookContext: bookContext.context,
      priorStudentContext: formatPriorStudentContext(priorStudentContext),
      language,
      studentTurnCount: Number.isFinite(student_turn_count) ? student_turn_count : 0,
    });

    const recentMessages = messages
      .filter(isDialogueMessage)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const reply = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
      ],
      {
        model: 'gpt-5',
        maxTokens: 420,
        reasoningEffort: 'minimal',
        timeoutMs: 45_000,
      },
    );

    const trimmedReply = reply.trim();
    if (trimmedReply) {
      return Response.json({
        reply: applyStudentNamePreference(trimmedReply, messages),
      });
    }

    return Response.json(
      { error: '도슨트 응답이 비었습니다.' },
      { status: 502 },
    );
  } catch (error) {
    console.error('Docent chat error:', error);
    return Response.json(
      { error: '도슨트 응답을 받지 못했습니다.' },
      { status: 500 },
    );
  }
}
