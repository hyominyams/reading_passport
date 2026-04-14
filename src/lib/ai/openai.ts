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
  }
) {
  const response = await openai.chat.completions.create({
    model: options?.model ?? 'gpt-5-nano',
    messages,
    max_completion_tokens: options?.maxTokens ?? 1024,
    ...(options?.reasoningEffort && { reasoning_effort: options.reasoningEffort }),
    ...(options?.jsonMode && { response_format: { type: 'json_object' as const } }),
  }, { timeout: 20_000 });

  const content = extractMessageContent(response.choices[0]?.message);

  if (!content) {
    console.error('OpenAI chat completion returned empty content.', {
      model: options?.model ?? 'gpt-5-nano',
      finishReason: response.choices[0]?.finish_reason,
      usage: response.usage,
    });
  }

  return content;
}
