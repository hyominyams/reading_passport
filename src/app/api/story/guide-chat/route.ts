import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { createServiceClient } from '@/lib/supabase/service';

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

interface BookCharacter {
  name: string;
  role?: string;
  personality?: string[];
}

interface BookContext {
  story_summary?: string;
  characters?: BookCharacter[];
}

const GUIDE_CHAT_FALLBACK_REPLY = '앗, 잠깐 생각이 끊겼어! 네 이야기를 한 번만 더 말해줄래?';
const MAX_CONTEXT_MESSAGES = 6;

async function generateGuideReply(apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
  const primaryReply = await chatCompletion(apiMessages, {
    model: 'gpt-5-mini',
    maxTokens: 2200,
  });

  if (primaryReply.trim()) {
    return {
      reply: primaryReply.trim(),
      model: 'gpt-5-mini',
      fallbackUsed: false,
    };
  }

  return {
    reply: '',
    model: 'gpt-5-mini',
    fallbackUsed: true,
  };
}

function buildSystemPrompt(
  bookTitle: string,
  storyType: string,
  customInput: string | null,
  language: string,
  bookContext: BookContext | null,
): string {
  const typeLabel = storyType === 'custom' && customInput
    ? `기타: ${customInput}`
    : STORY_TYPE_LABELS[storyType] ?? storyType;

  let bookSection = `- 학생이 읽은 책: "${bookTitle}"`;

  if (bookContext) {
    if (bookContext.story_summary) {
      bookSection += `\n- 책 줄거리: ${bookContext.story_summary}`;
    }
    if (bookContext.characters?.length) {
      const charDescriptions = bookContext.characters.map((c) => {
        let desc = c.name;
        if (c.role) desc += `(${c.role})`;
        if (c.personality?.length) desc += ` - ${c.personality.join(', ')}`;
        return desc;
      }).join(' / ');
      bookSection += `\n- 등장인물: ${charDescriptions}`;
    }
  }

  return `너는 '토리'야. 초등학생의 이야기 만들기를 도와주는 친구야.

[상황]
${bookSection}
- 학생이 선택한 이야기 유형: ${typeLabel}
- 대화 언어: ${language === 'en' ? '영어' : '한국어'}

[말투]
- 친한 친구처럼 편하게 반말로 말해. "응!", "오 대박!", "헐 그러면?" 같은 자연스러운 리액션을 써.
- 절대 콜론(:), 목록, 분석 형식으로 말하지 마. "등장인물:", "배경:", "사건:" 같은 정리는 금지야.
- 그냥 친구한테 이야기하듯 자연스럽게 말해.

[할 일]
- 학생이 하는 말에 먼저 반응해줘. 공감하고 흥미를 보여줘.
- 이야기에 아직 안 나온 게 있으면 (누가 나오는지, 어디서 일어나는지, 무슨 일이 생기는지, 어떻게 끝나는지) 자연스럽게 하나씩만 물어봐.
- 예를 들어 배경이 빠졌으면 "근데 그 이야기는 어디에서 일어나는 거야?" 처럼 대화 속에서 물어봐.
- 2~3문장 이내로 짧게. 길면 안 돼.
- 절대 "AI"나 "인공지능"이라고 밝히지 마.

[예시 대화]
학생: "주인공이 숲에서 모험하는 이야기를 쓰고 싶어"
토리: "오 숲에서 모험! 재밌겠다~ 주인공은 어떤 애야? 용감한 편이야 아니면 좀 겁 많은 편?"
7. 학생이 이미 충분한 정보를 줬다면 "좋아! 이야기 재료가 잘 모였어!"라고 격려해.
8. 학생이 원래 책 내용과 다른 이야기를 만들어도 괜찮아. 상상력을 격려해.`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      book_id,
      book_title,
      story_type,
      custom_input,
      language = 'ko',
    } = (await request.json()) as {
      messages: ChatMessage[];
      book_id?: string;
      book_title: string;
      story_type: string;
      custom_input?: string | null;
      language?: string;
    };

    if (!messages || !book_title || !story_type) {
      return Response.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 },
      );
    }

    // Fetch only the story summary for lightweight context.
    let bookContext: BookContext | null = null;
    if (book_id) {
      try {
        const serviceClient = createServiceClient();
        const { data: bookData } = await serviceClient
          .from('books')
          .select('character_analysis')
          .eq('id', book_id)
          .single();

        if (bookData?.character_analysis) {
          const analysis = bookData.character_analysis as Record<string, unknown>;
          bookContext = {
            story_summary: typeof analysis.story_summary === 'string'
              ? analysis.story_summary
              : undefined,
            characters: Array.isArray(analysis.characters)
              ? (analysis.characters as BookCharacter[]).filter((c) => c && c.name)
              : undefined,
          };
        }
      } catch {
        // Non-critical — proceed without book context
      }
    }

    const systemPrompt = buildSystemPrompt(
      book_title,
      story_type,
      custom_input ?? null,
      language,
      bookContext,
    );

    const recentMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_CONTEXT_MESSAGES);

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentMessages
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    ];

    const result = await generateGuideReply(apiMessages);
    const safeReply = result.reply;

    if (!safeReply) {
      console.error('Guide chat returned an empty reply.', {
        bookId: book_id ?? null,
        bookTitle: book_title,
        storyType: story_type,
        language,
        messageCount: apiMessages.length,
        originalMessageCount: messages.length,
        modelTried: result.model,
        fallbackUsed: result.fallbackUsed,
      });

      return Response.json({ reply: GUIDE_CHAT_FALLBACK_REPLY });
    }

    if (result.fallbackUsed) {
      console.warn('Guide chat used fallback model after empty primary reply.', {
        bookId: book_id ?? null,
        storyType: story_type,
        language,
      });
    }

    return Response.json({ reply: safeReply });
  } catch (error) {
    console.error('Guide chat error:', error);
    return Response.json(
      { reply: GUIDE_CHAT_FALLBACK_REPLY },
      { status: 500 },
    );
  }
}
