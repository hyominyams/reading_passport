const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiReferenceImage {
  imageUrl: string;
  name?: string;
}

export interface GeneratedGeminiImage {
  data: string;
  mimeType: string;
  model: string;
}

interface GenerateGeminiImageOptions {
  prompt: string;
  referenceImages?: GeminiReferenceImage[];
  aspectRatio?: string;
  imageSize?: '512' | '1K' | '2K' | '4K';
}

interface GeminiInlineData {
  data?: string;
  mimeType?: string;
  mime_type?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY;
}

function getGeminiImageModel() {
  return process.env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_IMAGE_MODEL;
}

function parseDataUrl(imageUrl: string) {
  const match = imageUrl.match(/^data:(.+?);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

async function loadReferenceImage(imageUrl: string) {
  const dataUrl = parseDataUrl(imageUrl);
  if (dataUrl) {
    return dataUrl;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load reference image (${response.status})`);
  }

  const mimeType =
    response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    mimeType,
    data: buffer.toString('base64'),
  };
}

async function buildReferenceParts(referenceImages: GeminiReferenceImage[]) {
  const parts: Array<{
    inline_data: {
      mime_type: string;
      data: string;
    };
  }> = [];

  for (const referenceImage of referenceImages) {
    try {
      const imageData = await loadReferenceImage(referenceImage.imageUrl);
      parts.push({
        inline_data: {
          mime_type: imageData.mimeType,
          data: imageData.data,
        },
      });
    } catch (error) {
      console.warn(
        `Skipping reference image for "${referenceImage.name ?? 'unknown'}"`,
        error
      );
    }
  }

  return parts;
}

export async function generateGeminiImage({
  prompt,
  referenceImages = [],
  aspectRatio = '1:1',
  imageSize = '1K',
}: GenerateGeminiImageOptions): Promise<GeneratedGeminiImage> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const model = getGeminiImageModel();
  const referenceParts = await buildReferenceParts(referenceImages);

  const response = await fetch(
    `${GEMINI_API_BASE}/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, ...referenceParts],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini image generation failed (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: GeminiPart[];
      };
    }>;
  };

  const imagePart = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((part) => {
      const inlineData = part.inlineData ?? part.inline_data;
      return Boolean(inlineData?.data);
    });

  const inlineData = imagePart?.inlineData ?? imagePart?.inline_data;
  if (!inlineData?.data) {
    throw new Error('Gemini response did not include an image.');
  }

  return {
    data: inlineData.data,
    mimeType: inlineData.mimeType ?? inlineData.mime_type ?? 'image/png',
    model,
  };
}
