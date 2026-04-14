import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { getTranslationLanguageEnglishLabel } from '@/lib/story-translations';

async function translatePageText(
  page: string,
  sourceLanguage: string,
  targetLanguage: string
) {
  const messages = [
    {
      role: 'system' as const,
      content: `You are a translator for children's stories. Translate the following text from ${getTranslationLanguageEnglishLabel(sourceLanguage)} to ${getTranslationLanguageEnglishLabel(targetLanguage)}.

Rules:
- Keep the translation natural and age-appropriate
- Maintain the same tone and emotion
- Keep proper nouns as-is unless there's a well-known translation
- NEVER return an empty response
- Output ONLY the translated text, no explanations`,
    },
    { role: 'user' as const, content: page },
  ];

  let result = await chatCompletion(messages, {
    model: 'gpt-5-nano',
    maxTokens: 1200,
    reasoningEffort: 'minimal',
  });

  if (!result.trim()) {
    result = await chatCompletion(
      [
        ...messages,
        {
          role: 'user',
          content: 'The previous response was empty. Return only the translated text for this page.',
        },
      ],
      {
        model: 'gpt-5-nano',
        maxTokens: 1200,
        reasoningEffort: 'minimal',
      }
    );
  }

  return result.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { pages, source_language = 'ko', target_language = 'en' } =
      await request.json();

    const translatedPages: string[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const result = await translatePageText(page, source_language, target_language);

      if (!result) {
        throw new Error(`Empty translation result on page ${i + 1}`);
      }

      translatedPages.push(result);
    }

    return Response.json({
      translated_pages: translatedPages,
      target_language: target_language,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return Response.json(
      { error: 'Failed to translate' },
      { status: 500 }
    );
  }
}
