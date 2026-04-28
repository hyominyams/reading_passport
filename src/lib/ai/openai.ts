import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;

function extractMessageContent(
  message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
): string {
  if (!message) return '';

  const content = message.content as
    | string
    | Array<{ text?: string; refusal?: string }>
    | null
    | undefined;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }

        if ('refusal' in part && typeof part.refusal === 'string') {
          return part.refusal;
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

export async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
    timeoutMs?: number;
  }
) {
  const model = options?.model ?? 'gpt-5-nano';
  const maxTokens = options?.maxTokens ?? 1024;
  const request = {
    model,
    messages,
    max_completion_tokens: maxTokens,
    ...(options?.reasoningEffort && { reasoning_effort: options.reasoningEffort }),
    ...(options?.jsonMode && { response_format: { type: 'json_object' as const } }),
  };
  const response = await openai.chat.completions.create(request, { timeout: options?.timeoutMs ?? 20_000 });

  let content = extractMessageContent(response.choices[0]?.message);

  if (!content) {
    console.error('OpenAI chat completion returned empty content.', {
      model,
      finishReason: response.choices[0]?.finish_reason,
      usage: response.usage,
    });
  }

  if (!content && response.choices[0]?.finish_reason === 'length') {
    const retryResponse = await openai.chat.completions.create({
      ...request,
      max_completion_tokens: Math.max(maxTokens * 2, 2400),
      reasoning_effort: 'minimal',
    }, { timeout: options?.timeoutMs ?? 30_000 });

    content = extractMessageContent(retryResponse.choices[0]?.message);

    if (!content) {
      console.error('OpenAI chat completion retry returned empty content.', {
        model,
        finishReason: retryResponse.choices[0]?.finish_reason,
        usage: retryResponse.usage,
      });
    }
  }

  return content;
}
