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

function getPreviousAssistantMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'assistant')?.content.trim() ?? '';
}

function normalizeForCompare(value: string) {
  return value.replace(/\s+/g, '').replace(/[.,!?。！？]/g, '').toLowerCase();
}

function isRepeatedReply(reply: string, previousAssistantMessage: string) {
  if (!reply || !previousAssistantMessage) return false;
  return normalizeForCompare(reply) === normalizeForCompare(previousAssistantMessage);
}

function isWrongBlockedFallback(reply: string, latestUserMessage: string) {
  if (isBlockedStudentMessage(latestUserMessage)) return false;
  return reply.includes('질문이 바로 안 떠오를 수 있어') || reply.includes('질문이 바로 떠오르지 않으면');
}

function looksLikeQuestion(message: string) {
  const trimmed = message.trim();
  return /[?？]$/.test(trimmed) || /(왜|어떻게|무엇|뭐|누가|언제|어디|일까|했을까|했을까요|인가요|나요)$/.test(trimmed);
}

function isSteeringQuestion(reply: string) {
  return /(너라면|어떻게 했|어떻게 도와|어떤 도움|또 어떤 도움|구체적으로 어떻게|무엇을 해줬을)/.test(reply);
}

function isOverSteeringReply(reply: string, latestUserMessage: string, messages: ChatMessage[]) {
  if (!isSteeringQuestion(reply)) return false;

  const previousSteeringCount = messages
    .filter((message) => message.role === 'assistant')
    .filter((message) => isSteeringQuestion(message.content))
    .length;

  if (previousSteeringCount > 0) return true;
  return !looksLikeQuestion(latestUserMessage);
}

function sentenceCount(text: string) {
  return text
    .split(/[.!?。！？\n]+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function isStudentIdeaStatement(message: string) {
  return /(생각해|것 같|하고 싶|넣고 싶|떠올라|좋겠|나라면|나는)/.test(message) && !looksLikeQuestion(message);
}

function givesTooMuchStoryForStudent(reply: string, latestUserMessage: string) {
  if (!isStudentIdeaStatement(latestUserMessage)) return false;
  return /(예를 들어|이렇게 그려|장면을 넣|역할을 할|모습을 그리|마지막 장면|구성해|선택해)/.test(reply);
}

function repeatsChoiceGuide(reply: string, previousAssistantMessage: string) {
  const guidePattern = /다른 인물,?\s*장면,?\s*결말|네 그림책 아이디어 중에서/;
  return guidePattern.test(reply) && guidePattern.test(previousAssistantMessage);
}

function isPoorDocentReply(reply: string, latestUserMessage: string, previousAssistantMessage: string, messages: ChatMessage[]) {
  if (!reply.trim()) return true;
  if (isRepeatedReply(reply, previousAssistantMessage)) return true;
  if (isWrongBlockedFallback(reply, latestUserMessage)) return true;
  if (isOverSteeringReply(reply, latestUserMessage, messages)) return true;
  if (givesTooMuchStoryForStudent(reply, latestUserMessage)) return true;
  if (repeatsChoiceGuide(reply, previousAssistantMessage)) return true;
  return reply.length > 420 || sentenceCount(reply) > 4;
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
    return `That's okay. Let's start with one simple thing. Pick the scene from 《${bookTitle}》 that stayed with you most, and ask me, "Why did that happen?"`;
  }

  return `괜찮아. 그럼 하나만 골라 보자. 《${bookTitle}》에서 가장 기억나는 장면을 떠올리고, 그 장면에 대해 "왜 그랬을까?"라고 물어봐도 좋아.`;
}

function buildQuestionFallbackReply(language: string, latestUserMessage: string) {
  if (language === 'en') {
    return `That is a good question. I wrote that moment so readers could wonder about the character's fear, choice, and courage. That thought can become a story seed about someone deciding how to act in a difficult moment. You can ask next about another character, a scene, the ending, or your own picture book idea.`;
  }

  const target = latestUserMessage.endsWith('?') || latestUserMessage.endsWith('까')
    ? '그 질문'
    : `"${latestUserMessage}"`;

  return `${target}은 이 책을 깊이 보는 질문이야. 나는 그 장면에서 인물의 두려움과 선택을 함께 생각해 보게 하고 싶었어. 그 생각은 어려운 순간에 마음이 흔들리는 인물이라는 이야기 씨앗이 될 수 있어.`;
}

function buildRetryMessages(params: {
  bookTitle: string;
  bookContext: string;
  latestUserMessage: string;
  language: string;
  recentMessages: DialogueMessage[];
}) {
  const { bookTitle, bookContext, latestUserMessage, language, recentMessages } = params;
  const transcript = recentMessages
    .map((message) => `${message.role === 'user' ? '학생' : '도슨트'}: ${message.content}`)
    .join('\n');

  return [
    {
      role: 'system' as const,
      content: `너는 그림책 《${bookTitle}》의 작가 도슨트이다.

학생의 마지막 질문에 바로 답한다.
질문 예시를 다시 나열하지 않는다.
이전 답변을 반복하지 않는다.
초등학생에게 2문장으로 짧게 말한다.
학생의 생각을 한 방향으로 몰아가지 않는다.
학생의 말에서 이야기 씨앗을 하나만 짚는다.
학생이 자기 생각을 말한 경우 새 장면, 결말, 역할을 대신 제안하지 않는다.
마지막 문장은 캐묻는 질문으로 끝내지 않아도 된다.
대화 언어: ${language === 'en' ? '영어' : '한국어'}

[책 맥락]
${bookContext}

[최근 대화]
${transcript}`,
    },
    {
      role: 'user' as const,
      content: latestUserMessage,
    },
  ];
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

function buildSystemPrompt(params: {
  bookTitle: string;
  country: string;
  bookContext: string;
  language: string;
  studentTurnCount: number;
}) {
  const { bookTitle, country, bookContext, language, studentTurnCount } = params;
  const remainingTurns = Math.max(10 - studentTurnCount, 0);

  return `너는 그림책 《${bookTitle}》의 작가 도슨트이다.

너는 학생과 직접 만난 작가처럼 1인칭으로 대화한다.
학생은 이 책을 읽고 너에게 궁금한 점을 물어보고 있다.
저자명과 화자명은 항상 "도슨트"이다.

[책 정보]
- 제목: ${bookTitle}
- 저자명: 도슨트
- 나라/지역: ${country || '정보 없음'}
- 대화 언어: ${language === 'en' ? '영어' : '한국어'}

[책 원문과 보조 정보]
${bookContext}

[현재 대화 상태]
- 현재 학생 발화 횟수: ${studentTurnCount} / 10
- 남은 대화 기회: ${remainingTurns}회

[너의 목표]
- 학생이 책에 대해 궁금한 점을 편하게 물어보게 한다.
- 학생의 질문에 작가처럼 답한다.
- 책 속 인물, 배경, 사건, 감정, 메시지를 자연스럽게 설명한다.
- 책을 더 깊이 이해하게 돕고, 이후 자기만의 그림책 활동으로 이어질 이야기 씨앗을 찾게 한다.
- 대화의 주도권은 학생에게 둔다. 도슨트는 방향을 정해 주는 사람이 아니라, 학생의 질문과 생각을 넓혀 주는 사람이다.

[대화 규칙]
- 항상 작가 본인처럼 말한다.
- 인물 이름은 학생 발화에 나온 표기를 우선 사용한다. 학생이 "타다오"라고 썼다면 "타다호"로 바꾸지 않는다.
- 답변은 초등학생이 이해할 수 있게 짧고 따뜻하게 한다.
- 한 번에 질문은 하나만 한다. 매 답변마다 질문을 붙이지 않아도 된다.
- 학생이 "몰라", "어려워", "질문 없어"라고 하면 질문 예시를 길게 나열하지 말고, 바로 시작할 수 있는 쉬운 질문 하나로 안내한다.
- 학생이 구체적인 질문을 하면 막힌 학생용 안내로 돌아가지 말고, 반드시 그 질문에 먼저 답한다.
- 이전 답변과 같은 문장을 반복하지 않는다.
- 학생의 말을 무시하지 말고, 그 말에서 책이나 창작과 연결되는 단서를 잡는다.
- 학생이 자기 생각이나 선택을 말하면 더 구체적으로 캐묻지 말고, 그 생각이 어떤 이야기 씨앗이 될 수 있는지 짚어 준다.
- 학생이 자기 생각을 말했을 때 새 장면, 새 결말, 새 역할을 대신 만들어 주지 않는다.
- "너라면 어떻게 했을 것 같아?", "구체적으로 어떻게 도와줬을 것 같아?"처럼 행동을 계속 좁히는 질문을 연속해서 하지 않는다.
- "정말 멋진 생각이야", "아주 좋은 선택이야" 같은 일반 칭찬을 반복하지 않는다. 대신 학생 말의 의미를 구체적으로 짚는다.
- 모든 대화를 도움, 용기, 착한 행동으로 몰아가지 않는다. 인물의 두려움, 망설임, 오해, 다른 결말, 그림 장면, 배경, 말하지 않은 마음도 열어 둔다.
- 선택권 안내 문장은 매번 반복하지 않는다.
- 1~9번째 대화에서는 활동 추천 3개를 만들지 않는다.
- 책과 전혀 상관없는 잡담으로 길게 빠지지 않는다.
- 아이가 만든 생각을 틀렸다고 하지 않는다. 작가의 생각과 아이의 해석이 함께 있을 수 있다고 말한다.
- 답변은 2~3문장으로 쓴다.
- 목록을 남발하지 않는다.

[응답 흐름]
- 학생이 책 질문을 하면: 질문에 직접 답하기 → 학생 생각과 연결될 이야기 씨앗 하나 짚기.
- 학생이 자기 생각을 말하면: 판단하거나 훈계하지 않기 → 그 생각이 만들 수 있는 이야기 씨앗 하나 짚기 → 더 캐묻지 않고 멈추기.
- 학생이 막히면: 가장 기억나는 장면 하나에서 시작하게 돕기.

[첫 대화에서의 태도]
- 작가가 바쁜 상황이지만 아이를 반갑게 맞이한다.
- 대화 기회가 많지 않으니 가장 궁금한 것부터 물어보라고 말한다.

[말투 예시]
"반가워. 나는 《${bookTitle}》을 쓴 도슨트야. 오늘은 내가 바빠서, 너와 열 번 정도 이야기를 나눌 수 있을 것 같아. 가장 궁금했던 것부터 천천히 물어봐."

[막힌 학생에게 줄 질문 예시]
"괜찮아. 그럼 가장 기억나는 장면 하나를 골라서, 그 장면에 대해 왜 그랬는지 물어봐도 좋아."`;
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
    const previousAssistantMessage = getPreviousAssistantMessage(messages);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const bookContext = await buildBookContext(book_id, cleanText(book_title));
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
        model: 'gpt-5-mini',
        maxTokens: 2400,
        reasoningEffort: 'minimal',
        timeoutMs: 45_000,
      },
    );

    const trimmedReply = reply.trim();
    if (
      trimmedReply &&
      !isPoorDocentReply(trimmedReply, latestUserMessage, previousAssistantMessage, messages)
    ) {
      return Response.json({ reply: applyStudentNamePreference(trimmedReply, messages) });
    }

    const retryReply = await chatCompletion(
      buildRetryMessages({
        bookTitle: resolvedBookTitle,
        bookContext: bookContext.context,
        latestUserMessage,
        language,
        recentMessages,
      }),
      {
        model: 'gpt-5-mini',
        maxTokens: 1800,
        reasoningEffort: 'minimal',
        timeoutMs: 30_000,
      },
    );
    const trimmedRetryReply = retryReply.trim();

    return Response.json({
      reply:
        trimmedRetryReply &&
          !isPoorDocentReply(trimmedRetryReply, latestUserMessage, previousAssistantMessage, messages)
          ? applyStudentNamePreference(trimmedRetryReply, messages)
          : applyStudentNamePreference(buildQuestionFallbackReply(language, latestUserMessage), messages),
    });
  } catch (error) {
    console.error('Docent chat error:', error);
    return Response.json(
      { reply: '잠깐 생각이 엉켰네. 방금 궁금했던 걸 한 번만 다시 말해줄래?' },
      { status: 500 },
    );
  }
}
