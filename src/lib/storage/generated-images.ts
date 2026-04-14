import { ensurePublicBucket } from '@/lib/storage/buckets';

const GENERATED_IMAGES_BUCKET =
  process.env.SUPABASE_GENERATED_IMAGES_BUCKET || 'generated-images';
const GENERATED_IMAGES_FILE_SIZE_LIMIT = 5 * 1024 * 1024;
const IMMUTABLE_CACHE_CONTROL = '31536000';

function getFileExtension(mimeType: string) {
  switch (mimeType.split(';', 1)[0]) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'png';
  }
}

async function uploadImageBuffer(options: {
  fileBuffer: Buffer;
  mimeType: string;
  folder: string;
}) {
  if (options.fileBuffer.byteLength > GENERATED_IMAGES_FILE_SIZE_LIMIT) {
    throw new Error('Generated image exceeds the 5MB storage limit.');
  }

  const supabase = await ensurePublicBucket(
    GENERATED_IMAGES_BUCKET,
    GENERATED_IMAGES_FILE_SIZE_LIMIT
  );
  const extension = getFileExtension(options.mimeType);
  const filePath = `${options.folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .upload(filePath, options.fileBuffer, {
      contentType: options.mimeType,
      upsert: false,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function storeGeneratedImage(options: {
  base64Data: string;
  mimeType: string;
  folder: string;
}) {
  const fileBuffer = Buffer.from(options.base64Data, 'base64');

  return uploadImageBuffer({
    fileBuffer,
    mimeType: options.mimeType,
    folder: options.folder,
  });
}

export async function storeGeneratedImageBuffer(options: {
  fileBuffer: Buffer;
  mimeType: string;
  folder: string;
}) {
  return uploadImageBuffer(options);
}
