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
  }
) {
  const response = await openai.chat.completions.create({
    model: options?.model ?? 'gpt-4o-mini',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
  });

  return response.choices[0]?.message?.content ?? '';
}
