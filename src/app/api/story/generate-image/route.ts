import { NextRequest } from 'next/server';
import { generateGeminiImage } from '@/lib/ai/gemini';
import { getIllustrationStyleOption, normalizeIllustrationStyle } from '@/lib/illustration-styles';
import { storeGeneratedImage } from '@/lib/storage/generated-images';
import type { CharacterRef, IllustrationStyle } from '@/types/database';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      character_refs?: CharacterRef[];
      style_key?: IllustrationStyle;
      matched_character_names?: string[];
      allow_text?: boolean;
      cover_mode?: boolean;
      aspect_ratio?: '4:3' | '3:4' | '1:1';
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
    const styleOption = body.style_key
      ? getIllustrationStyleOption(normalizeIllustrationStyle(body.style_key))
      : null;
    const styleReferenceImages = styleOption
      ? [{
        name: `${styleOption.label} style reference`,
        imageUrl: new URL(styleOption.exampleImagePath, request.url).toString(),
      }]
      : [];

    if (referenceCharacters.length > 0) {
      const refDescs = referenceCharacters
        .map((ref) => ref.name)
        .join(', ');
      fullPrompt = `${prompt}\nUse the attached character reference images to keep ${refDescs} visually consistent across the illustration.`;
    }

    const matchedCharacterNames = (body.matched_character_names ?? []).filter(Boolean);
    if (matchedCharacterNames.length > 0) {
      fullPrompt = `${fullPrompt}\nThe prompt explicitly mentions these characters: ${matchedCharacterNames.join(', ')}. When those named characters appear, use the attached reference images for those same names to keep them visually consistent.`;
    }

    if (styleOption) {
      fullPrompt = `${fullPrompt}\nSelected style: ${styleOption.label}. Style keywords: ${styleOption.promptLabel}. Use the attached example image only as a reference for the ${styleOption.label} design language and illustration style. Do not copy its composition, pose, character identity, objects, layout, or any text.`;
    }

    const aspectRatio =
      body.aspect_ratio?.trim() || (referenceCharacters.length > 0 ? '4:3' : '1:1');
    fullPrompt = `${fullPrompt}\nTarget picture book aspect ratio: ${aspectRatio}. Compose the image to fit this ratio naturally.`;

    const textRule = body.allow_text
      ? body.cover_mode
        ? `Children's book cover artwork: ${fullPrompt}. Create the cover artwork itself, not a physical book, mockup, poster, page, or framed print. No book object, no visible spine, no 3D product mockup.`
        : `Children's book illustration: ${fullPrompt}. Style: warm, friendly, appropriate for elementary school students.`
      : `Children's book illustration: ${fullPrompt}. Style: warm, friendly, appropriate for elementary school students. Do not include any written text, letters, words, captions, speech bubbles, signs, logos, or typography in the image.`;

    const generatedImage = await generateGeminiImage({
      prompt: textRule,
      referenceImages: [
        ...styleReferenceImages,
        ...referenceCharacters.map((ref) => ({
          name: ref.name,
          imageUrl: ref.imageUrl,
        })),
      ],
      aspectRatio,
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
