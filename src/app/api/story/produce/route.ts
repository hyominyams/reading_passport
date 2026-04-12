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

export async function POST(request: NextRequest) {
  try {
    const { storyId } = (await request.json()) as { storyId?: string };

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

    // Don't restart if already processing or completed
    if (story.production_status === 'processing') {
      return Response.json({ message: 'Production already in progress' });
    }
    if (story.production_status === 'completed') {
      return Response.json({ message: 'Production already completed' });
    }

    // Use final_text (student's written text) as the basis for image generation
    const finalText = story.final_text ?? [];
    const uploadedImages = story.uploaded_images ?? [];
    const existingSceneImages = story.scene_images ?? [];

    // Determine images to generate: for every page with text and no uploaded/existing image
    const imageTasks: Array<{
      index: number;
      studentText: string;
    }> = [];

    for (let i = 0; i < finalText.length; i++) {
      if (finalText[i] && !uploadedImages[i] && !existingSceneImages[i]) {
        imageTasks.push({
          index: i,
          studentText: finalText[i],
        });
      }
    }

    const totalImages = imageTasks.length;

    if (totalImages === 0) {
      // No images to generate, mark as completed
      await supabase
        .from('stories')
        .update({
          production_status: 'completed',
          production_progress: 100,
          current_step: 7,
        })
        .eq('id', storyId);

      return Response.json({ message: 'No images to generate, marked completed' });
    }

    // Set processing state
    await supabase
      .from('stories')
      .update({
        production_status: 'processing',
        production_progress: 0,
      })
      .eq('id', storyId);

    const illustrationStyle = normalizeIllustrationStyle(story.illustration_style);
    const styleOption = getIllustrationStyleOption(illustrationStyle);
    const pictureBookShape = normalizePictureBookShape(story.cover_design?.picture_book_shape);
    const pictureBookShapeOption = getPictureBookShapeOption(pictureBookShape);
    const characterRefs = story.character_refs ?? [];
    const characterDesigns = story.character_designs ?? [];
    const sceneImages = [...(story.scene_images ?? [])];
    const coverImageUrl = story.cover_image_url ?? story.cover_design?.image_url ?? null;

    // Ensure sceneImages array is large enough
    while (sceneImages.length < finalText.length) {
      sceneImages.push(null as unknown as string);
    }

    let completedCount = 0;

    try {
      for (const task of imageTasks) {
        // Convert student's story text to image prompt via GPT-5-nano
        const imagePrompt = await convertTextToImagePrompt(
          task.studentText,
          illustrationStyle,
          pictureBookShapeOption.promptLabel,
          pictureBookShapeOption.aspectRatio
        );

        // Build reference images: character designs + cover design (no example style images)
        const referenceImages: Array<{ name: string; imageUrl: string }> = [];

        // Cover design as style/design reference (replaces illustration-style example image)
        if (coverImageUrl) {
          referenceImages.push({
            name: 'cover design style reference',
            imageUrl: coverImageUrl,
          });
        }

        // Character designs (student-created)
        for (const cd of characterDesigns) {
          if (cd.imageUrl) {
            referenceImages.push({ name: cd.name, imageUrl: cd.imageUrl });
          }
        }

        // Character refs from original book
        for (const ref of characterRefs) {
          if ((ref as CharacterRef).imageUrl) {
            referenceImages.push({
              name: (ref as CharacterRef).name,
              imageUrl: (ref as CharacterRef).imageUrl,
            });
          }
        }

        // Match character names appearing in the student's text
        const characterReferenceImages = referenceImages.filter(
          (ref) => ref.name !== 'cover design style reference'
        );
        const { matchedNames } = pickMatchedReferenceImages(
          task.studentText,
          characterReferenceImages
        );

        // Build the full prompt
        const fullPrompt =
          `Children's book illustration: ${imagePrompt}. Picture book format: ${pictureBookShapeOption.label}. Match a ${pictureBookShapeOption.aspectRatio} composition and keep the layout natural for a ${pictureBookShapeOption.promptLabel}. Selected style: ${styleOption.label}. Style keywords: ${styleOption.promptLabel}.${coverImageUrl ? ' Use the attached cover design image ONLY as a reference for the overall artistic style and color palette. Do not copy its composition, characters, scene, objects, or layout.' : ''}${matchedNames.length > 0 ? ` The named characters in this scene are ${matchedNames.join(', ')}. Use the attached character reference images for those same names to keep them visually consistent.` : ''} Style: warm, friendly, appropriate for elementary school students. Do not include any written text, letters, words, captions, speech bubbles, signs, logos, or typography in the image.`;

        // Generate image via Gemini
        const generatedImage = await generateGeminiImage({
          prompt: fullPrompt,
          referenceImages,
          aspectRatio: pictureBookShapeOption.aspectRatio,
          imageSize: '1K',
        });

        // Store image
        const imageUrl = await storeGeneratedImage({
          base64Data: generatedImage.data,
          mimeType: generatedImage.mimeType,
          folder: 'scene-images',
        });

        // Update the appropriate field
        sceneImages[task.index] = imageUrl;

        completedCount++;

        // Update progress in DB after each image
        const progress = Math.round((completedCount / totalImages) * 100);
        await supabase
          .from('stories')
          .update({
            production_progress: progress,
            scene_images: sceneImages,
            cover_image_url: coverImageUrl,
          })
          .eq('id', storyId);
      }

      // Mark as completed
      await supabase
        .from('stories')
        .update({
          production_status: 'completed',
          production_progress: 100,
          current_step: 7,
          scene_images: sceneImages,
          cover_image_url: coverImageUrl,
        })
        .eq('id', storyId);

      return Response.json({
        message: 'Production completed',
        total: totalImages,
        completed: completedCount,
      });
    } catch (genError) {
      console.error('Image generation error during production:', genError);

      // Mark as failed but save whatever progress was made
      await supabase
        .from('stories')
        .update({
          production_status: 'failed',
          scene_images: sceneImages,
          cover_image_url: coverImageUrl,
        })
        .eq('id', storyId);

      return Response.json(
        {
          error:
            genError instanceof Error
              ? genError.message
              : 'Image generation failed during production',
          completed: completedCount,
          total: totalImages,
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
