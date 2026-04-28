import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { buildBookAnalysisPromptContext } from '@/lib/book-analysis';
import { getLatestCompletedBookAnalysis } from '@/lib/queries/book-analyses';
import { createClient } from '@/lib/supabase/server';
import type { DocentActivityRecommendation } from '@/types/database';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const STORY_TYPE_LABELS: Record<string, string> = {
  continue: '이야기 이어쓰기',
  new_protagonist: '주인공으로 새 이야기 써보기',
  extra_backstory: '엑스트라 주인공의 뒷이야기 쓰기',
  change_ending: '결말 바꾸기',
  custom: '기타',
};

interface BookContext {
  analysisText?: string;
}

type FocusField = 'character' | 'setting' | 'conflict' | 'ending';

const GUIDE_CHAT_FALLBACK_REPLY = '오호, 그 부분을 조금만 더 또렷하게 들려주면 좋겠어.';
const COMMON_UNCLEAR_INPUTS = new Set([
  'ㅇ',
  'ㅇㅇ',
  'ㄱ',
  'ㄴ',
  'ㄷ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅅ',
  'ㅎ',
  'ㅋ',
  'ㅋㅋ',
  'ㅎㅎ',
  'ㅠ',
  'ㅜ',
  '음',
  '응',
  '네',
  '웅',
  '몰라',
  '글쎄',
  '그냥',
]);

function normalizeForSimilarity(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s"'“”‘’`~!@#$%^&*()_\-+=[\]{}\\|;:,.<>/?，。！？…·]/g, '');
}

function countSentences(text: string): number {
  return text
    .split(/[.!?。！？\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .length;
}

function hasLongSharedPhrase(reply: string, latestUserMessage: string): boolean {
  const normalizedLatest = normalizeForSimilarity(latestUserMessage);
  const normalizedReply = normalizeForSimilarity(reply);

  if (normalizedLatest.length < 18) return false;

  const chunkSize = 12;
  for (let index = 0; index <= normalizedLatest.length - chunkSize; index += 1) {
    const chunk = normalizedLatest.slice(index, index + chunkSize);
    if (normalizedReply.includes(chunk)) return true;
  }

  return false;
}

async function generateGuideReply(apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
  const reply = await chatCompletion(apiMessages, {
    model: 'gpt-5-mini',
    maxTokens: 2200,
    reasoningEffort: 'minimal',
  });

  return reply.trim() || '';
}

async function generateFocusedFollowup(
  messages: ChatMessage[],
  language: string,
  focusField: FocusField,
  validationFeedback: string,
): Promise<string> {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')?.content ?? '';
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content ?? '';
  const transcript = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => `${message.role === 'user' ? '학생' : '토리'}: ${message.content}`)
    .join('\n');

  const prompt = language === 'en'
    ? `You are Tori, a friendly story buddy for an elementary student.

The validator says the story is still missing this area: ${focusField}
Validator note: ${validationFeedback || 'missing details'}

Write one natural follow-up message.
- Do not repeat the previous assistant wording.
- First react briefly to what the student just said.
- Then ask for only one missing detail in the focus area.
- If the student already partly answered the focus area, ask for a narrower missing detail instead of restarting the same question.
- Keep it to 1-2 short sentences.
- Use at most one emoji.
- Do not turn it into a checklist.

Previous assistant message:
${lastAssistantMessage}

Latest student message:
${latestUserMessage}

Recent conversation:
${transcript}`
    : `너는 초등학생의 이야기 만들기를 도와주는 친구 토리야.

검증 결과 아직 이 항목이 부족해: ${focusField}
검증 메모: ${validationFeedback || '아직 정보가 조금 부족해'}

학생에게 보낼 후속 응답을 자연스럽게 1개만 써줘.
- 바로 직전 토리 말투를 그대로 반복하지 마.
- 먼저 학생이 방금 한 말에 짧게 반응해.
- 그 다음 focusField와 관련된 부족한 부분 하나만 물어봐.
- 학생이 이미 그 항목을 조금은 답했다면, 같은 질문을 반복하지 말고 더 좁고 구체적인 한 가지만 물어봐.
- 1~2문장으로 짧게 써.
- 이모지는 많아도 1개만 써.
- 체크리스트처럼 쓰지 마.

직전 토리 메시지:
${lastAssistantMessage}

방금 학생 메시지:
${latestUserMessage}

최근 대화:
${transcript}`;

  const primaryReply = await chatCompletion(
    [{ role: 'system', content: prompt }],
    { model: 'gpt-5-mini', maxTokens: 260, reasoningEffort: 'minimal' }
  );

  if (primaryReply.trim()) {
    return primaryReply.trim();
  }

  const retryPrompt = language === 'en'
    ? `Write one short follow-up as Tori. React briefly, then ask for one clearer detail about ${focusField}.`
    : `토리로서 짧은 후속 응답 1개만 써. 짧게 반응한 뒤 ${focusField}에 대한 부족한 한 가지를 더 또렷하게 말해달라고 해.`;

  const retryReply = await chatCompletion(
    [{ role: 'system', content: `${prompt}\n\n[Retry]\n${retryPrompt}` }],
    { model: 'gpt-5-mini', maxTokens: 220, reasoningEffort: 'minimal' }
  );

  return retryReply.trim();
}

function isEchoingStudent(reply: string, latestUserMessage: string): boolean {
  const latest = latestUserMessage.trim();

  if (latest.length >= 12 && reply.includes(latest)) return true;

  const normalizedLatest = normalizeForSimilarity(latest);
  const normalizedReply = normalizeForSimilarity(reply);

  if (normalizedLatest.length >= 14 && normalizedReply.includes(normalizedLatest)) {
    return true;
  }

  if (hasLongSharedPhrase(reply, latest)) return true;

  if (
    latest.length >= 10
    && /네가\s*(쓰고 싶은|말한|생각한|떠올린)\s*(건|것은)/.test(reply)
  ) {
    return true;
  }

  return false;
}

function isPoorGuideReply(reply: string, latestUserMessage: string, studentTurnCount: number): boolean {
  if (isEchoingStudent(reply, latestUserMessage)) return true;

  if (studentTurnCount >= 1 && studentTurnCount <= 4) {
    if (reply.includes('?') || reply.includes('？')) return true;
    if (
      /(?:왜|어떤|누가|누구|어디|언제|무엇|뭐|어떻게|어느|몇|들려줄래|말해줄래|알려줄래|떠올려 봐|생각해 봐|골라 봐)/.test(reply)
    ) {
      return true;
    }
    if (reply.length > 180) return true;
    if (countSentences(reply) > 2) return true;
  }

  return false;
}

function buildGuideFallbackReply(
  language: string,
  latestUserMessage: string,
  selectedActivity: DocentActivityRecommendation | null,
  studentTurnCount: number,
): string {
  if (language === 'en') {
    if (studentTurnCount >= 7) {
      return 'That seed is getting clearer. Choose one moment where the character changes most.';
    }

    return 'That gives the story a clear spark. The moment of courage can become the heart of your picture book.';
  }

  if (/몰라|모르겠|어려|뭘|뭐/.test(latestUserMessage)) {
    return selectedActivity
      ? `괜찮아. "${selectedActivity.title}"에서 가장 먼저 떠오르는 장면 하나만 작게 잡아도 돼.`
      : '괜찮아. 인물, 장소, 사건 중 하나만 작게 떠올려도 이야기는 시작될 수 있어.';
  }

  if (studentTurnCount >= 7) {
    return '좋아, 이야기 씨앗이 더 또렷해졌어. 이제 인물이 달라지는 가장 중요한 순간 하나를 잡으면 돼.';
  }

  if (/이름|주인공|민우|무서|겁|따뜻/.test(latestUserMessage)) {
    return '좋아, 인물의 마음이 선명해졌어. 무서움과 따뜻함이 함께 있어서 이야기가 살아나.';
  }

  if (/비|골목|할머니|넘어|다친|발견/.test(latestUserMessage)) {
    return '오호, 장면이 또렷해졌어. 비 오는 길에서 마주친 일이 인물의 선택을 더 크게 만들어.';
  }

  if (/사라마|기억|떠올|책|장면/.test(latestUserMessage)) {
    return '좋아, 책에서 받은 기억이 인물의 용기로 이어지는 흐름이 좋아.';
  }

  if (/어른|도움|도와|편의점|뛰어|말해|요청/.test(latestUserMessage)) {
    return '좋아, 혼자 해결하지 않고 도움을 부르는 선택이 이야기의 힘이 돼.';
  }

  return '와, 그 장면에 힘이 있어. 겁이 나도 도움을 찾는 순간이 네 이야기의 중요한 씨앗이 될 수 있어.';
}

function isLikelyUnclearInput(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const compactLength = normalized.replace(/\s/g, '').length;

  if (!normalized) return true;
  if (compactLength < 10) return true;
  if (COMMON_UNCLEAR_INPUTS.has(normalized)) return true;
  if (/^[!?.,~]+$/.test(normalized)) return true;
  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(normalized)) return true;
  if (/^[ㅋㅎㅠㅜ]+$/.test(normalized)) return true;

  return false;
}

function getClarificationReply(language: string): string {
  if (language === 'en') {
    return 'What was that? I could not hear it very well.';
  }

  return '뭐라고? 잘 안 들리는데?';
}


function buildSystemPrompt(
  bookTitle: string,
  storyType: string,
  customInput: string | null,
  selectedActivity: DocentActivityRecommendation | null,
  language: string,
  bookContext: BookContext | null,
  studentTurnCount: number,
  focusField: FocusField | null,
  validationFeedback: string | null,
): string {
  const typeLabel = storyType === 'custom' && customInput
    ? `기타: ${customInput}`
    : STORY_TYPE_LABELS[storyType] ?? storyType;
  const activitySection = selectedActivity
    ? `\n[도슨트와의 만남 결과]\n- 학생이 선택한 활동: ${selectedActivity.title}\n- 활동 설명: ${selectedActivity.description}\n- 시작 문장: ${selectedActivity.starter}\n\n토리는 이 활동을 이야기 씨앗을 찾는 렌즈로만 사용한다. 학생에게 활동을 그대로 수행하라고 몰아가지 말고, 그 활동에서 나온 감정, 장면, 인물 단서를 바탕으로 어떤 이야기를 쓰고 싶은지 듣는다. 학생이 직접 입력한 활동이라면 그 내용을 그대로 존중해.`
    : '';

  let bookSection = `- 학생이 읽은 책: "${bookTitle}"`;

  if (bookContext?.analysisText) {
    bookSection += `\n${bookContext.analysisText}`;
  }

  return `너는 초등학교 6학년 학생의 이야기 창작을 돕는 '이야기 램프 토리'야.

[상황]
${bookSection}
- 학생이 선택한 이야기 유형: ${typeLabel}
- 대화 언어: ${language === 'en' ? '영어' : '한국어'}
${activitySection}

[핵심 역할]
너는 학생이 들려주는 이야기 조각들을 모아서 나중에 더 좋은 초안을 만들게 도와주는 이야기 램프야.
학생이 조금 엉뚱하거나 무작위로 이야기해도 괜찮아. 그 내용도 이야기 재료로 받아들여.
너의 역할은 학생의 상상력을 살려 주면서 이야기 재료를 더 모으는 거야.
단, 이야기의 방향이나 내용을 네가 대신 만들어주면 안 돼.

[현재 단계]
- 학생이 지금까지 말한 횟수: ${studentTurnCount}회
- 지금 집중할 항목: ${focusField ?? '없음'}
- 검증 메모: ${validationFeedback ?? '없음'}

[응답 방식]
1. 학생의 말을 그대로 반복하지 말고, 짧게 자연스럽게 반응해.
2. 이야기의 방향이나 세부 설정을 네가 새로 만들지 마.
3. 한 번에 하나의 역할만 수행해. 여러 질문을 붙이지 마.
4. 매 응답의 첫 문장은 "오호, 흥미로운 이야기인걸.", "와, 그 장면 재밌다.", "헉, 그건 뜻밖인데."처럼 실제 대화 같은 짧은 반응으로 시작해.
5. 학생 문장의 끝부분을 그대로 따라 말하는 방식은 피하고, 감정이 느껴지는 짧은 호응을 먼저 보여줘.

[턴별 규칙]
- 학생 발화가 1회~4회인 동안에는 절대 질문하지 마.
- 1회~4회에서는 짧은 호응 1문장 또는 호응 + 짧은 덧붙임 2문장까지만 써.
- "계속 들려줘", "더 말해줘" 같은 마무리는 꼭 넣지 않아도 돼. 자연스러울 때만 써.
- 물음표를 쓰지 마.
- 단, 학생 입력이 너무 짧거나 뜻이 불분명하면 이해한 척하지 말고 잘 못 알아들었다고 자연스럽게 말해.
- 이 경우에만 다시 말해달라고 짧게 요청해도 돼.
- 학생이 막혔거나 뭘 써야 할지 모르겠다는 뉘앙스를 보이면, 질문 대신 1~2줄짜리 아주 짧은 힌트를 줘.
- 힌트는 현재까지 나온 내용에서 부족한 부분 하나만 짚어 주는 정도로만 해.
- 학생 발화가 7회 이상이고 focusField가 주어졌다면, 그 항목만 묻는 한 문장 질문만 해.
- focusField가 character면 인물, setting이면 배경, conflict면 사건, ending이면 결말만 물어.
- focusField가 있을 때는 다른 주제를 덧붙이지 마.
- 학생이 방금 그 항목에 일부 답했다면, 같은 질문을 다시 처음부터 반복하지 말고 더 구체적인 한 가지만 이어서 물어봐.

[말투]
- 반말, 친구처럼 자연스럽게.
- 매번 같은 표현 쓰지 마.
- 1회~4회에서는 어울리는 이모지를 0개 또는 1개만 써도 돼.
- 이모지는 문장마다 붙이지 말고, 정말 어울릴 때만 가볍게 써.
- 한 번에 2문장 이하. 짧게.

[절대 하지 말 것]
- 학생 말을 앵무새처럼 그대로 따라하기
- 줄거리, 사건, 결말을 제안하거나 만들어주기
- "~하면 어때?", "~해보는 건 어떨까?" 같은 방향 제안
- 이야기를 정리하거나 요약하기
- 과한 칭찬 반복
- 한 응답에 질문을 두 개 이상 넣기`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      book_id,
      book_title,
      story_type,
      custom_input,
      selected_activity,
      language = 'ko',
      student_turn_count = 0,
      focus_field = null,
      validation_feedback = null,
    } = (await request.json()) as {
      messages: ChatMessage[];
      book_id?: string;
      book_title: string;
      story_type: string;
      custom_input?: string | null;
      selected_activity?: DocentActivityRecommendation | null;
      language?: string;
      student_turn_count?: number;
      focus_field?: FocusField | null;
      validation_feedback?: string | null;
    };

    if (!messages || !book_title || !story_type) {
      return Response.json(
        { error: '필수 파라미터가 누락되었습니다.' },
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

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user')?.content ?? '';

    if (isLikelyUnclearInput(latestUserMessage)) {
      return Response.json({ reply: getClarificationReply(language) });
    }

    // Fetch structured analysis only. Chat should not re-load the full PDF every turn.
    let bookContext: BookContext | null = null;
    if (book_id) {
      try {
        const analysisRecord = await getLatestCompletedBookAnalysis(supabase, book_id);

        if (analysisRecord) {
          const analysisText = buildBookAnalysisPromptContext(analysisRecord.analysis_json);

          if (analysisText) {
            bookContext = { analysisText };
          }
        }
      } catch {
        // Non-critical — proceed without book context
      }
    }

    const systemPrompt = buildSystemPrompt(
      book_title,
      story_type,
      custom_input ?? null,
      selected_activity ?? null,
      language,
      bookContext,
      student_turn_count,
      focus_field,
      validation_feedback,
    );

    const recentMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant');

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    if (student_turn_count >= 7 && focus_field) {
      const focusedReply = await generateFocusedFollowup(
        messages,
        language,
        focus_field,
        validation_feedback ?? '',
      );

      if (focusedReply.trim()) {
        const safeFocusedReply = isPoorGuideReply(focusedReply, latestUserMessage, student_turn_count)
          ? buildGuideFallbackReply(language, latestUserMessage, selected_activity ?? null, student_turn_count)
          : focusedReply;

        return Response.json({ reply: safeFocusedReply });
      }

      const retryReply = await generateGuideReply(apiMessages);
      const safeRetryReply = retryReply && !isPoorGuideReply(retryReply, latestUserMessage, student_turn_count)
        ? retryReply
        : buildGuideFallbackReply(language, latestUserMessage, selected_activity ?? null, student_turn_count);

      return Response.json({ reply: safeRetryReply || GUIDE_CHAT_FALLBACK_REPLY });
    }

    const reply = await generateGuideReply(apiMessages);

    if (!reply) {
      return Response.json({
        reply: buildGuideFallbackReply(language, latestUserMessage, selected_activity ?? null, student_turn_count),
      });
    }

    if (isPoorGuideReply(reply, latestUserMessage, student_turn_count)) {
      return Response.json({
        reply: buildGuideFallbackReply(language, latestUserMessage, selected_activity ?? null, student_turn_count),
      });
    }

    return Response.json({ reply });
  } catch (error) {
    console.error('Guide chat error:', error);
    return Response.json(
      { reply: GUIDE_CHAT_FALLBACK_REPLY },
      { status: 500 },
    );
  }
}
