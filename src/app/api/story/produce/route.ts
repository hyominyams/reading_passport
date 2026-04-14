import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { generateGeminiImage } from '@/lib/ai/gemini';
import { getIllustrationStyleOption, normalizeIllustrationStyle } from '@/lib/illustration-styles';
import { getPictureBookShapeOption, normalizePictureBookShape } from '@/lib/picture-book-shapes';
import { storeGeneratedImage } from '@/lib/storage/generated-images';
import { createServiceClient } from '@/lib/supabase/service';
import type { Story, CharacterRef, IllustrationStyle } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long-running image generation

function pickMatchedReferenceImages(
  text: string,
  referenceImages: Array<{ name: string; imageUrl: string }>
) {
  const normalizedText = text.toLowerCase();
  const matched = referenceImages.filter((ref) => normalizedText.includes(ref.name.toLowerCase()));

  return {
    matched,
    matchedNames: matched.map((ref) => ref.name),
  };
}

/**
 * Convert student's story text into an image generation prompt using GPT-5-nano.
 * The student's written text is narrative, so we extract the visual scene from it.
 */
async function convertTextToImagePrompt(
  studentText: string,
  illustrationStyle: IllustrationStyle,
  pictureBookPromptLabel: string,
  pictureBookAspectRatio: '4:3' | '3:4' | '1:1'
): Promise<string> {
  const styleOption = getIllustrationStyleOption(illustrationStyle);
  const styleLabel = styleOption.promptLabel;

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are an expert at converting children's story text into image generation prompts.
Given a page of text from a student-written children's story, produce a concise English image generation prompt that captures the visual scene described or implied by the text.

Rules:
1. Extract the visual scene from the narrative text — identify characters, setting, actions, mood.
2. The prompt must describe the visual scene clearly and specifically, even if the text is abstract or emotional.
3. The prompt must clearly specify this visual style: ${styleOption.label}
4. Include these style keywords: ${styleLabel}
5. The output prompt must strongly preserve that chosen style.
6. Keep it under 200 words.
7. Focus on visual elements: characters, setting, actions, mood, lighting, colors.
8. Do NOT include any written text, letters, words, captions, dialogue, speech bubbles, signs, logos, or typography in the prompt.
9. The illustration should be appropriate for elementary school students.
10. Compose the illustration for this picture book format: ${pictureBookPromptLabel} (${pictureBookAspectRatio}).
11. If the text is dialogue-heavy, focus on the characters' expressions and the scene around them.

Output ONLY the English image prompt, nothing else.`,
      },
      {
        role: 'user',
        content: `Student's story text:\n${studentText}`,
      },
    ],
    {
      model: 'gpt-5-nano',
      maxTokens: 300,
    }
  );

  return result.trim();
}

function buildReferenceImages(story: Story, coverImageUrl: string | null) {
  const referenceImages: Array<{ name: string; imageUrl: string }> = [];

  if (coverImageUrl) {
    referenceImages.push({
      name: 'cover design style reference',
      imageUrl: coverImageUrl,
    });
  }

  for (const character of story.character_designs ?? []) {
    if (character.imageUrl) {
      referenceImages.push({
        name: character.name,
        imageUrl: character.imageUrl,
      });
    }
  }

  for (const ref of story.character_refs ?? []) {
    if ((ref as CharacterRef).imageUrl) {
      referenceImages.push({
        name: (ref as CharacterRef).name,
        imageUrl: (ref as CharacterRef).imageUrl,
      });
    }
  }

  return referenceImages;
}

function ensureSceneImagesLength(sceneImages: Array<string | null>, pageCount: number) {
  const next = [...sceneImages];

  while (next.length < pageCount) {
    next.push(null);
  }

  return next;
}

function calculateProductionProgress(
  finalText: string[],
  uploadedImages: Array<string | null | undefined>,
  sceneImages: Array<string | null | undefined>
) {
  let total = 0;
  let completed = 0;

  for (let i = 0; i < finalText.length; i += 1) {
    if (!finalText[i]?.trim() || uploadedImages[i]) {
      continue;
    }

    total += 1;

    if (sceneImages[i]) {
      completed += 1;
    }
  }

  return {
    total,
    completed,
    progress: total === 0 ? 100 : Math.round((completed / total) * 100),
  };
}

async function generateSceneImageForPage({
  story,
  studentText,
  coverImageUrl,
}: {
  story: Story;
  studentText: string;
  coverImageUrl: string | null;
}) {
  const illustrationStyle = normalizeIllustrationStyle(story.illustration_style);
  const styleOption = getIllustrationStyleOption(illustrationStyle);
  const pictureBookShape = normalizePictureBookShape(story.cover_design?.picture_book_shape);
  const pictureBookShapeOption = getPictureBookShapeOption(pictureBookShape);
  const referenceImages = buildReferenceImages(story, coverImageUrl);
  const characterReferenceImages = referenceImages.filter(
    (ref) => ref.name !== 'cover design style reference'
  );
  const { matchedNames } = pickMatchedReferenceImages(studentText, characterReferenceImages);

  const imagePrompt = await convertTextToImagePrompt(
    studentText,
    illustrationStyle,
    pictureBookShapeOption.promptLabel,
    pictureBookShapeOption.aspectRatio
  );

  const fullPrompt =
    `Children's book illustration: ${imagePrompt}. Picture book format: ${pictureBookShapeOption.label}. Match a ${pictureBookShapeOption.aspectRatio} composition and keep the layout natural for a ${pictureBookShapeOption.promptLabel}. Selected style: ${styleOption.label}. Style keywords: ${styleOption.promptLabel}.${coverImageUrl ? ' Use the attached cover design image ONLY as a reference for the overall artistic style and color palette. Do not copy its composition, characters, scene, objects, or layout.' : ''}${matchedNames.length > 0 ? ` The named characters in this scene are ${matchedNames.join(', ')}. Use the attached character reference images for those same names to keep them visually consistent.` : ''} Style: warm, friendly, appropriate for elementary school students. Do not include any written text, letters, words, captions, speech bubbles, signs, logos, or typography in the image.`;

  const generatedImage = await generateGeminiImage({
    prompt: fullPrompt,
    referenceImages,
    aspectRatio: pictureBookShapeOption.aspectRatio,
    imageSize: '1K',
  });

  return storeGeneratedImage({
    base64Data: generatedImage.data,
    mimeType: generatedImage.mimeType,
    folder: 'scene-images',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      storyId?: string;
      pageIndex?: number;
      pageText?: string;
      forceRegenerate?: boolean;
    };
    const storyId = body.storyId;
    const pageIndex =
      typeof body.pageIndex === 'number' && Number.isInteger(body.pageIndex)
        ? body.pageIndex
        : null;
    const isSinglePageRegeneration = pageIndex !== null;
    const forceRegenerate = Boolean(body.forceRegenerate);
    const pageTextOverride = body.pageText?.trim() ?? null;

    if (!storyId) {
      return Response.json({ error: 'storyId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Load the story
    const { data: storyData, error: storyError } = await supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .single();

    if (storyError || !storyData) {
      return Response.json({ error: 'Story not found' }, { status: 404 });
    }

    const story = storyData as Story;

    if (story.production_status === 'processing') {
      return Response.json({ message: 'Production already in progress' });
    }
    if (
      story.production_status === 'completed'
      && !isSinglePageRegeneration
      && !forceRegenerate
    ) {
      return Response.json({ message: 'Production already completed' });
    }

    const finalText = story.final_text ?? [];
    const uploadedImages = story.uploaded_images ?? [];
    const sceneImages = ensureSceneImagesLength(
      (story.scene_images ?? []) as Array<string | null>,
      finalText.length
    );
    const imageTasks: Array<{ index: number; studentText: string }> = [];

    if (isSinglePageRegeneration) {
      if (pageIndex < 0 || pageIndex >= finalText.length) {
        return Response.json({ error: 'Invalid page index' }, { status: 400 });
      }

      if (uploadedImages[pageIndex]) {
        return Response.json(
          { error: 'This page is using an uploaded image and cannot be regenerated here.' },
          { status: 400 }
        );
      }

      const studentText = pageTextOverride ?? finalText[pageIndex]?.trim() ?? '';
      if (!studentText) {
        return Response.json(
          { error: 'Page text is required to regenerate an image.' },
          { status: 400 }
        );
      }

      imageTasks.push({
        index: pageIndex,
        studentText,
      });
    } else {
      for (let i = 0; i < finalText.length; i += 1) {
        if (!finalText[i]?.trim() || uploadedImages[i]) {
          continue;
        }

        if (!forceRegenerate && sceneImages[i]) {
          continue;
        }

        imageTasks.push({
          index: i,
          studentText: finalText[i],
        });
      }
    }

    const totalImages = imageTasks.length;

    if (totalImages === 0) {
      const progressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);
      await supabase
        .from('stories')
        .update({
          production_status: progressInfo.progress >= 100 ? 'completed' : 'pending',
          production_progress: progressInfo.progress,
          current_step: Math.max(story.current_step, 7),
          scene_images: sceneImages as unknown as string[],
        })
        .eq('id', storyId);

      return Response.json({
        message: 'No images to generate',
        total: progressInfo.total,
        completed: progressInfo.completed,
        progress: progressInfo.progress,
        scene_images: sceneImages,
      });
    }

    await supabase
      .from('stories')
      .update({
        production_status: 'processing',
        production_progress: 0,
      })
      .eq('id', storyId);

    const coverImageUrl = story.cover_image_url ?? story.cover_design?.image_url ?? null;

    try {
      for (const task of imageTasks) {
        const imageUrl = await generateSceneImageForPage({
          story,
          studentText: task.studentText,
          coverImageUrl,
        });

        sceneImages[task.index] = imageUrl;

        const progressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);
        await supabase
          .from('stories')
          .update({
            production_progress: progressInfo.progress,
            scene_images: sceneImages as unknown as string[],
            cover_image_url: coverImageUrl,
            production_status: progressInfo.progress >= 100 ? 'completed' : 'processing',
          })
          .eq('id', storyId);
      }

      const progressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);
      await supabase
        .from('stories')
        .update({
          production_status: progressInfo.progress >= 100 ? 'completed' : 'pending',
          production_progress: progressInfo.progress,
          current_step: Math.max(story.current_step, 7),
          scene_images: sceneImages as unknown as string[],
          cover_image_url: coverImageUrl,
        })
        .eq('id', storyId);

      return Response.json({
        message: isSinglePageRegeneration
          ? 'Page image regenerated'
          : 'Production completed',
        total: progressInfo.total,
        completed: progressInfo.completed,
        progress: progressInfo.progress,
        page_index: pageIndex,
        image_url: isSinglePageRegeneration && pageIndex !== null ? sceneImages[pageIndex] : null,
        scene_images: sceneImages,
      });
    } catch (genError) {
      console.error('Image generation error during production:', genError);
      const progressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);

      await supabase
        .from('stories')
        .update({
          production_status: 'failed',
          production_progress: progressInfo.progress,
          scene_images: sceneImages as unknown as string[],
          cover_image_url: coverImageUrl,
        })
        .eq('id', storyId);

      return Response.json(
        {
          error:
            genError instanceof Error
              ? genError.message
              : 'Image generation failed during production',
          completed: progressInfo.completed,
          total: progressInfo.total,
          progress: progressInfo.progress,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Production API error:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to start production',
      },
      { status: 500 }
    );
  }
}
