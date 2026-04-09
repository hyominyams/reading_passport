import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;

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
    model: options?.model ?? 'gpt-5-mini',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
    ...(options?.jsonMode && { response_format: { type: 'json_object' as const } }),
  });

  return response.choices[0]?.message?.content ?? '';
}
