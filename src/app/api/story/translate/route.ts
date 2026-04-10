import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
  try {
    const { pages, source_language = 'ko', target_language = 'en' } =
      await request.json();

    const langName: Record<string, string> = {
      ko: 'Korean',
      en: 'English',
    };

    const translatedPages: string[] = [];

    for (const page of pages) {
      const result = await chatCompletion(
        [
          {
            role: 'system',
            content: `You are a translator for children's stories. Translate the following text from ${langName[source_language] || source_language} to ${langName[target_language] || target_language}.

Rules:
- Keep the translation natural and age-appropriate
- Maintain the same tone and emotion
- Keep proper nouns as-is unless there's a well-known translation
- Output ONLY the translated text, no explanations`,
          },
          { role: 'user', content: page },
        ],
        {
          model: 'gpt-5-nano',
          maxTokens: 500,
        }
      );

      translatedPages.push(result);
    }

    return Response.json({ translated_pages: translatedPages });
  } catch (error) {
    console.error('Translation error:', error);
    return Response.json(
      { error: 'Failed to translate' },
      { status: 500 }
    );
  }
}
