import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { generateGeminiImage } from '@/lib/ai/gemini';
import { storeGeneratedImage } from '@/lib/storage/generated-images';
import { createServiceClient } from '@/lib/supabase/service';
import type { Story, CharacterRef, CharacterDesign } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long-running image generation

const ILLUSTRATION_STYLE_LABELS: Record<string, string> = {
  colored_pencil: 'colored pencil illustration style, soft textures, hand-drawn feel',
  watercolor: 'watercolor painting style, soft washes, translucent colors, gentle blending',
  woodblock: 'woodblock print style, bold lines, flat colors, traditional printmaking aesthetic',
  pastel: 'pastel drawing style, soft chalky textures, gentle gradients, warm tones',
};

async function convertSceneToImagePrompt(
  sceneDescription: string,
  pageText: string,
  illustrationStyle: string
): Promise<string> {
  const styleLabel = ILLUSTRATION_STYLE_LABELS[illustrationStyle] ?? illustrationStyle;

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are an expert at converting scene descriptions into image generation prompts.
Given a scene description and the page text from a children's story, produce a concise English image generation prompt.

Rules:
1. The prompt must describe the visual scene clearly and specifically.
2. Include the art style: ${styleLabel}
3. Keep it under 200 words.
4. Focus on visual elements: characters, setting, actions, mood, lighting, colors.
5. Do NOT include any text or dialogue in the prompt.
6. The illustration should be appropriate for elementary school students.

Output ONLY the English image prompt, nothing else.`,
      },
      {
        role: 'user',
        content: `Scene description: ${sceneDescription}\n\nPage text: ${pageText}`,
      },
    ],
    {
      model: 'gpt-5-mini',
      temperature: 0.7,
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

    // Determine images to generate
    const imageTasks: Array<{
      type: 'cover' | 'page';
      index: number; // -1 for cover, page index for pages
      description: string;
      pageText: string;
    }> = [];

    // Cover: generate only if description exists and no uploaded/generated cover
    if (story.cover_design?.description && !story.cover_design?.image_url && !story.cover_image_url) {
      imageTasks.push({
        type: 'cover',
        index: -1,
        description: story.cover_design.description,
        pageText: story.cover_design.title ?? '',
      });
    }

    // Pages: generate for each scene_description where no uploaded_image
    // AND no previously generated scene_image exists (avoids duplicates on retry)
    const sceneDescriptions = story.scene_descriptions ?? [];
    const uploadedImages = story.uploaded_images ?? [];
    const existingSceneImages = story.scene_images ?? [];
    const finalText = story.final_text ?? [];

    for (let i = 0; i < sceneDescriptions.length; i++) {
      if (sceneDescriptions[i] && !uploadedImages[i] && !existingSceneImages[i]) {
        imageTasks.push({
          type: 'page',
          index: i,
          description: sceneDescriptions[i],
          pageText: finalText[i] ?? '',
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
          current_step: 8,
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

    const illustrationStyle = story.illustration_style ?? 'watercolor';
    const characterRefs = story.character_refs ?? [];
    const characterDesigns = story.character_designs ?? [];
    const sceneImages = [...(story.scene_images ?? [])];
    let coverImageUrl = story.cover_image_url;

    // Ensure sceneImages array is large enough
    while (sceneImages.length < sceneDescriptions.length) {
      sceneImages.push(null as unknown as string);
    }

    let completedCount = 0;

    try {
      for (const task of imageTasks) {
        // Convert scene description to image prompt
        const imagePrompt = await convertSceneToImagePrompt(
          task.description,
          task.pageText,
          illustrationStyle
        );

        // Build reference images from character refs and character designs
        const referenceImages = [
          ...characterRefs
            .filter((ref: CharacterRef) => ref.imageUrl)
            .map((ref: CharacterRef) => ({
              name: ref.name,
              imageUrl: ref.imageUrl,
            })),
          ...characterDesigns
            .filter((cd) => cd.imageUrl)
            .map((cd) => ({
              name: cd.name,
              imageUrl: cd.imageUrl!,
            })),
        ];

        const fullPrompt =
          task.type === 'cover'
            ? `Children's book cover illustration: ${imagePrompt}. Style: warm, friendly, appropriate for elementary school students.`
            : `Children's book illustration: ${imagePrompt}. Style: warm, friendly, appropriate for elementary school students.`;

        // Generate image via Gemini
        const generatedImage = await generateGeminiImage({
          prompt: fullPrompt,
          referenceImages,
          aspectRatio: task.type === 'cover' ? '3:4' : '4:3',
          imageSize: '1K',
        });

        // Store image
        const folder = task.type === 'cover' ? 'cover-images' : 'scene-images';
        const imageUrl = await storeGeneratedImage({
          base64Data: generatedImage.data,
          mimeType: generatedImage.mimeType,
          folder,
        });

        // Update the appropriate field
        if (task.type === 'cover') {
          coverImageUrl = imageUrl;
        } else {
          sceneImages[task.index] = imageUrl;
        }

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
          current_step: 8,
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
