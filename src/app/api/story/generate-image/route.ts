import { NextRequest } from 'next/server';
import { generateGeminiImage } from '@/lib/ai/gemini';
import { storeGeneratedImage } from '@/lib/storage/generated-images';
import type { CharacterRef } from '@/types/database';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      character_refs?: CharacterRef[];
    };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Build the full prompt with character refs if available
    let fullPrompt = prompt;
    const referenceCharacters = (body.character_refs ?? []).filter(
      (ref) => ref.imageUrl
    );

    if (referenceCharacters.length > 0) {
      const refDescs = referenceCharacters
        .map((ref) => ref.name)
        .join(', ');
      fullPrompt = `${prompt}\nUse the attached character reference images to keep ${refDescs} visually consistent across the illustration.`;
    }

    const generatedImage = await generateGeminiImage({
      prompt: `Children's book illustration: ${fullPrompt}. Style: warm, friendly, appropriate for elementary school students.`,
      referenceImages: referenceCharacters.map((ref) => ({
        name: ref.name,
        imageUrl: ref.imageUrl,
      })),
      aspectRatio: referenceCharacters.length > 0 ? '4:3' : '1:1',
      imageSize: '1K',
    });

    const imageUrl = await storeGeneratedImage({
      base64Data: generatedImage.data,
      mimeType: generatedImage.mimeType,
      folder: referenceCharacters.length > 0 ? 'scene-images' : 'character-images',
    });

    return Response.json({
      image_url: imageUrl,
      model: generatedImage.model,
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate image',
      },
      { status: 500 }
    );
  }
}
