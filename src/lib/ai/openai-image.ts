import { toFile, type Uploadable } from 'openai';
import openai from '@/lib/ai/openai';

const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export interface OpenAIReferenceImage {
  imageUrl: string;
  name?: string;
}

export interface GeneratedOpenAIImage {
  data: string;
  mimeType: string;
  model: string;
}

type AppAspectRatio = '4:3' | '3:4' | '1:1';
type OpenAIImageSize = '1024x1024' | '1536x1024' | '1024x1536';
type OpenAIOutputFormat = 'png' | 'jpeg' | 'webp';
type OpenAIQuality = 'low' | 'medium' | 'high' | 'auto';

interface GenerateOpenAIImageOptions {
  prompt: string;
  referenceImages?: OpenAIReferenceImage[];
  aspectRatio?: AppAspectRatio | string;
  quality?: OpenAIQuality;
  outputFormat?: OpenAIOutputFormat;
  timeoutMs?: number;
}

function getOpenAIImageModel() {
  return process.env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL;
}

function parseDataUrl(imageUrl: string) {
  const match = imageUrl.match(/^data:(.+?);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: normalizeImageMimeType(match[1]),
    data: Buffer.from(match[2], 'base64'),
  };
}

function normalizeImageMimeType(mimeType: string) {
  const clean = mimeType.split(';', 1)[0].toLowerCase();

  if (clean === 'image/jpg') {
    return 'image/jpeg';
  }

  return clean;
}

function isSupportedReferenceMimeType(mimeType: string) {
  return ['image/png', 'image/jpeg', 'image/webp'].includes(
    normalizeImageMimeType(mimeType)
  );
}

function extensionForMimeType(mimeType: string) {
  switch (normalizeImageMimeType(mimeType)) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

function filenameSafeReferenceName(name: string | undefined, fallback: string) {
  const safeName = name
    ?.normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return safeName || fallback;
}

function mimeTypeForOutputFormat(outputFormat: OpenAIOutputFormat) {
  switch (outputFormat) {
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

function sizeForAspectRatio(aspectRatio: string | undefined): OpenAIImageSize {
  switch (aspectRatio) {
    case '4:3':
      return '1536x1024';
    case '3:4':
      return '1024x1536';
    case '1:1':
    default:
      return '1024x1024';
  }
}

async function loadReferenceImage(
  referenceImage: OpenAIReferenceImage,
  index: number
): Promise<Uploadable | null> {
  const dataUrl = parseDataUrl(referenceImage.imageUrl);
  if (dataUrl) {
    if (!isSupportedReferenceMimeType(dataUrl.mimeType)) {
      console.warn(
        `Skipping unsupported reference image type for "${referenceImage.name ?? 'unknown'}": ${dataUrl.mimeType}`
      );
      return null;
    }

    return toFile(
      dataUrl.data,
      `${filenameSafeReferenceName(referenceImage.name, `reference-${index}`)}.${extensionForMimeType(dataUrl.mimeType)}`,
      { type: dataUrl.mimeType }
    );
  }

  const response = await fetch(referenceImage.imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load reference image (${response.status})`);
  }

  const mimeType = normalizeImageMimeType(
    response.headers.get('content-type') || 'image/png'
  );

  if (!isSupportedReferenceMimeType(mimeType)) {
    console.warn(
      `Skipping unsupported reference image type for "${referenceImage.name ?? 'unknown'}": ${mimeType}`
    );
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  return toFile(
    buffer,
    `${filenameSafeReferenceName(referenceImage.name, `reference-${index}`)}.${extensionForMimeType(mimeType)}`,
    { type: mimeType }
  );
}

async function buildReferenceFiles(referenceImages: OpenAIReferenceImage[]) {
  const limitedReferenceImages = referenceImages.slice(0, 16);
  if (referenceImages.length > limitedReferenceImages.length) {
    console.warn('Skipping extra reference images; OpenAI image edits support up to 16 inputs.');
  }

  const files = await Promise.all(
    limitedReferenceImages.map(async (referenceImage, index) => {
      try {
        return loadReferenceImage(referenceImage, index);
      } catch (error) {
        console.warn(
          `Skipping reference image for "${referenceImage.name ?? 'unknown'}"`,
          error
        );
        return null;
      }
    })
  );

  return files.filter((file): file is Uploadable => Boolean(file));
}

function extractImageBase64(response: { data?: Array<{ b64_json?: string }> }) {
  const image = response.data?.find((item) => item.b64_json);

  if (!image?.b64_json) {
    throw new Error('OpenAI image response did not include base64 image data.');
  }

  return image.b64_json;
}

export async function generateOpenAIImage({
  prompt,
  referenceImages = [],
  aspectRatio = '1:1',
  quality = 'medium',
  outputFormat = 'jpeg',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: GenerateOpenAIImageOptions): Promise<GeneratedOpenAIImage> {
  const model = getOpenAIImageModel();
  const size = sizeForAspectRatio(aspectRatio);
  const referenceFiles = await buildReferenceFiles(referenceImages);
  const outputCompression = outputFormat === 'png' ? undefined : 85;

  if (referenceFiles.length > 0) {
    const response = await openai.images.edit(
      {
        model,
        image: referenceFiles,
        prompt,
        n: 1,
        size,
        quality,
        output_format: outputFormat,
        ...(outputCompression !== undefined && {
          output_compression: outputCompression,
        }),
      },
      { timeout: timeoutMs }
    );

    return {
      data: extractImageBase64(response),
      mimeType: mimeTypeForOutputFormat(outputFormat),
      model,
    };
  }

  const response = await openai.images.generate(
    {
      model,
      prompt,
      n: 1,
      size,
      quality,
      output_format: outputFormat,
      moderation: 'auto',
      ...(outputCompression !== undefined && {
        output_compression: outputCompression,
      }),
    },
    { timeout: timeoutMs }
  );

  return {
    data: extractImageBase64(response),
    mimeType: mimeTypeForOutputFormat(outputFormat),
    model,
  };
}
