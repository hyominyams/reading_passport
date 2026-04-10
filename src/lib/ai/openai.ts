import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;

function extractMessageContent(
  message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined,
): string {
  if (!message) return '';
  return typeof message.content === 'string' ? message.content.trim() : '';
}

export async function chatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
) {
  const response = await openai.chat.completions.create({
    model: options?.model ?? 'gpt-5-nano',
    messages,
    max_completion_tokens: options?.maxTokens ?? 1024,
    ...(options?.jsonMode && { response_format: { type: 'json_object' as const } }),
  });

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
