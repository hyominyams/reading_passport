import { after, NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai/openai';
import { generateOpenAIImage } from '@/lib/ai/openai-image';
import { getIllustrationStyleOption, normalizeIllustrationStyle } from '@/lib/illustration-styles';
import { getPictureBookShapeOption, normalizePictureBookShape } from '@/lib/picture-book-shapes';
import { storeGeneratedImage } from '@/lib/storage/generated-images';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyProductionWatchdog } from '@/lib/story-production-watchdog';
import type { Story, CharacterRef, IllustrationStyle } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long-running image generation

const PRODUCTION_IMAGE_CONCURRENCY = 5;

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

type ImageTask = {
  index: number;
  studentText: string;
  sceneDescription: string;
};

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
 * Convert the student's visual direction into an image generation prompt.
 * sceneDescription is the student's direct visual instruction and has priority.
 */
async function convertTextToImagePrompt(
  {
    studentText,
    sceneDescription,
    illustrationStyle,
    pictureBookPromptLabel,
    pictureBookAspectRatio,
  }: {
    studentText: string;
    sceneDescription: string;
    illustrationStyle: IllustrationStyle;
    pictureBookPromptLabel: string;
    pictureBookAspectRatio: '4:3' | '3:4' | '1:1';
  }
): Promise<string> {
  const styleOption = getIllustrationStyleOption(illustrationStyle);
  const styleLabel = styleOption.promptLabel;

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are an expert at converting children's picture-book planning notes into image generation prompts.
The student may provide both a scene description and page story text. The scene description is the student's direct visual instruction and is authoritative when present. Use the story text only as supporting context for character, setting, mood, and cause/effect.

Rules:
1. If a student scene description is present, preserve it as the main visual plan.
2. Extract supporting visual details from the page story text - characters, setting, actions, mood.
3. The prompt must clearly specify this visual style: ${styleOption.label}
4. Include these style keywords: ${styleLabel}
5. The output prompt must strongly preserve that chosen style.
6. Keep it under 220 words.
7. Focus on visual elements: characters, setting, actions, mood, lighting, colors.
8. Do NOT include any written text, letters, words, captions, dialogue, speech bubbles, signs, logos, or typography in the prompt.
9. The illustration should be appropriate for elementary school students.
10. Compose the illustration for this picture book format: ${pictureBookPromptLabel} (${pictureBookAspectRatio}).
11. If the text is dialogue-heavy, focus on the characters' expressions and the scene around them.
12. In Korean story context, when "다리" appears with words like "고치다", "흔들리는", "건너다", or village/rain context, interpret it as a bridge, not a body part, unless the scene description clearly says otherwise.

Output ONLY the English image prompt, nothing else.`,
      },
      {
        role: 'user',
        content: `Student-written scene description:\n${sceneDescription || '(not provided)'}\n\nStudent's page story text:\n${studentText}`,
      },
    ],
    {
      model: 'gpt-5-nano',
      maxTokens: 300,
    }
  );

  return result.trim();
}

function getPageText(values: Array<string | null | undefined> | null | undefined, index: number) {
  const value = values?.[index];
  return typeof value === 'string' ? value.trim() : '';
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
  sceneDescription,
  coverImageUrl,
}: {
  story: Story;
  studentText: string;
  sceneDescription: string;
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
  const visualTextForMatching = `${sceneDescription}\n${studentText}`;
  const { matchedNames } = pickMatchedReferenceImages(
    visualTextForMatching,
    characterReferenceImages
  );

  const imagePrompt = await convertTextToImagePrompt({
    studentText,
    sceneDescription,
    illustrationStyle,
    pictureBookPromptLabel: pictureBookShapeOption.promptLabel,
    pictureBookAspectRatio: pictureBookShapeOption.aspectRatio,
  });

  const studentSceneInstruction = sceneDescription
    ? ` Student-written scene description to follow exactly as the primary visual direction: "${sceneDescription}".`
    : '';
  const pageContextInstruction = studentText
    ? ` Story page context: "${studentText}".`
    : '';

  const fullPrompt =
    `Children's book illustration.${studentSceneInstruction}${pageContextInstruction} Final English visual prompt: ${imagePrompt}. Picture book format: ${pictureBookShapeOption.label}. Match a ${pictureBookShapeOption.aspectRatio} composition and keep the layout natural for a ${pictureBookShapeOption.promptLabel}. Selected style: ${styleOption.label}. Style keywords: ${styleOption.promptLabel}.${coverImageUrl ? ' Use the attached cover design image ONLY as a reference for the overall artistic style and color palette. Do not copy its composition, characters, scene, objects, or layout.' : ''}${matchedNames.length > 0 ? ` The named characters in this scene are ${matchedNames.join(', ')}. Use the attached character reference images for those same names to keep them visually consistent.` : ''} Style: warm, friendly, appropriate for elementary school students. Do not include any written text, letters, words, captions, speech bubbles, signs, logos, or typography in the image.`;

  const generatedImage = await generateOpenAIImage({
    prompt: fullPrompt,
    referenceImages,
    aspectRatio: pictureBookShapeOption.aspectRatio,
  });

  return storeGeneratedImage({
    base64Data: generatedImage.data,
    mimeType: generatedImage.mimeType,
    folder: 'scene-images',
  });
}

async function runProductionJob({
  supabase,
  story,
  storyId,
  finalText,
  uploadedImages,
  sceneImages,
  imageTasks,
  coverImageUrl,
  isSinglePageRegeneration,
  pageIndex,
}: {
  supabase: SupabaseServiceClient;
  story: Story;
  storyId: string;
  finalText: string[];
  uploadedImages: Array<string | null | undefined>;
  sceneImages: Array<string | null>;
  imageTasks: ImageTask[];
  coverImageUrl: string | null;
  isSinglePageRegeneration: boolean;
  pageIndex: number | null;
}) {
  const totalImages = imageTasks.length;

  try {
    let nextTaskIndex = 0;
    let generationError: unknown = null;
    let progressPersistError: unknown = null;
    let progressPersistChain = Promise.resolve();

    const queueProgressPersist = () => {
      const sceneImagesSnapshot = [...sceneImages];
      const progressInfo = calculateProductionProgress(
        finalText,
        uploadedImages,
        sceneImagesSnapshot
      );

      progressPersistChain = progressPersistChain
        .then(async () => {
          const { error: progressUpdateError } = await supabase
            .from('stories')
            .update({
              production_progress: progressInfo.progress,
              scene_images: sceneImagesSnapshot as unknown as string[],
              cover_image_url: coverImageUrl,
              production_status: progressInfo.progress >= 100 ? 'completed' : 'processing',
              production_heartbeat_at: new Date().toISOString(),
              production_error_message: null,
            })
            .eq('id', storyId);

          if (progressUpdateError) {
            throw progressUpdateError;
          }
        })
        .catch((error) => {
          progressPersistError ??= error;
        });
    };

    const workerCount = Math.min(PRODUCTION_IMAGE_CONCURRENCY, totalImages);
    const workers = Array.from({ length: workerCount }, async () => {
      while (!generationError) {
        const task = imageTasks[nextTaskIndex];
        nextTaskIndex += 1;

        if (!task) {
          return;
        }

        try {
          const imageUrl = await generateSceneImageForPage({
            story,
            studentText: task.studentText,
            sceneDescription: task.sceneDescription,
            coverImageUrl,
          });

          sceneImages[task.index] = imageUrl;
          queueProgressPersist();
        } catch (error) {
          generationError ??= error;
          return;
        }
      }
    });

    await Promise.all(workers);
    await progressPersistChain;

    if (generationError) {
      throw generationError;
    }

    if (progressPersistError) {
      throw progressPersistError;
    }

    const progressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);
    const { error: finalUpdateError } = await supabase
      .from('stories')
      .update({
        production_status: progressInfo.progress >= 100 ? 'completed' : 'pending',
        production_progress: progressInfo.progress,
        production_heartbeat_at: new Date().toISOString(),
        production_error_message: null,
        current_step: Math.max(story.current_step, 7),
        scene_images: sceneImages as unknown as string[],
        cover_image_url: coverImageUrl,
      })
      .eq('id', storyId);

    if (finalUpdateError) {
      throw finalUpdateError;
    }

    return {
      message: isSinglePageRegeneration
        ? 'Page image regenerated'
        : 'Production completed',
      total: progressInfo.total,
      completed: progressInfo.completed,
      progress: progressInfo.progress,
      concurrency: workerCount,
      page_index: pageIndex,
      image_url: isSinglePageRegeneration && pageIndex !== null ? sceneImages[pageIndex] : null,
      scene_images: sceneImages,
    };
  } catch (genError) {
    console.error('Image generation error during production:', genError);
    const progressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);

    await supabase
      .from('stories')
      .update({
        production_status: 'failed',
        production_progress: progressInfo.progress,
        production_heartbeat_at: new Date().toISOString(),
        production_error_message:
          genError instanceof Error
            ? genError.message
            : 'Image generation failed during production',
        scene_images: sceneImages as unknown as string[],
        cover_image_url: coverImageUrl,
      })
      .eq('id', storyId);

    throw genError;
  }
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

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    let story = storyData as Story;

    if (story.student_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    story = await applyProductionWatchdog(supabase, story);

    if (story.production_status === 'processing') {
      return Response.json(
        {
          message: 'Production already in progress',
          status: story.production_status,
          progress: story.production_progress,
          error_message: story.production_error_message,
        },
        { status: 202 }
      );
    }
    if (
      story.production_status === 'completed'
      && !isSinglePageRegeneration
      && !forceRegenerate
    ) {
      return Response.json({
        message: 'Production already completed',
        status: story.production_status,
        progress: story.production_progress,
        error_message: story.production_error_message,
      });
    }

    const finalText = story.final_text ?? [];
    const uploadedImages = story.uploaded_images ?? [];
    const sceneImages = ensureSceneImagesLength(
      (story.scene_images ?? []) as Array<string | null>,
      finalText.length
    );
    const imageTasks: ImageTask[] = [];

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
        sceneDescription: getPageText(story.scene_descriptions, pageIndex),
      });
    } else {
      for (let i = 0; i < finalText.length; i += 1) {
        const studentText = getPageText(finalText, i);

        if (!studentText || uploadedImages[i]) {
          continue;
        }

        if (!forceRegenerate && sceneImages[i]) {
          continue;
        }

        imageTasks.push({
          index: i,
          studentText,
          sceneDescription: getPageText(story.scene_descriptions, i),
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
          production_heartbeat_at: new Date().toISOString(),
          production_error_message: null,
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

    const coverImageUrl = story.cover_image_url ?? story.cover_design?.image_url ?? null;
    const initialProgressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);
    const nowIso = new Date().toISOString();

    const { error: processingUpdateError } = await supabase
      .from('stories')
      .update({
        production_status: 'processing',
        production_progress: initialProgressInfo.progress,
        production_started_at: nowIso,
        production_heartbeat_at: nowIso,
        production_error_message: null,
      })
      .eq('id', storyId);

    if (processingUpdateError) {
      return Response.json(
        { error: 'Failed to update production status' },
        { status: 500 }
      );
    }

    if (!isSinglePageRegeneration) {
      after(async () => {
        try {
          await runProductionJob({
            supabase,
            story,
            storyId,
            finalText,
            uploadedImages,
            sceneImages,
            imageTasks,
            coverImageUrl,
            isSinglePageRegeneration,
            pageIndex,
          });
        } catch (backgroundError) {
          console.error('Background production failed:', backgroundError);
        }
      });

      return Response.json(
        {
          message: 'Production started',
          status: 'processing',
          total: initialProgressInfo.total,
          completed: initialProgressInfo.completed,
          progress: initialProgressInfo.progress,
        },
        { status: 202 }
      );
    }

    try {
      const result = await runProductionJob({
        supabase,
        story,
        storyId,
        finalText,
        uploadedImages,
        sceneImages,
        imageTasks,
        coverImageUrl,
        isSinglePageRegeneration,
        pageIndex,
      });

      return Response.json(result);
    } catch (genError) {
      const progressInfo = calculateProductionProgress(finalText, uploadedImages, sceneImages);

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
