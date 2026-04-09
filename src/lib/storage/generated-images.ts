import { createServiceClient } from '@/lib/supabase/service';

const GENERATED_IMAGES_BUCKET =
  process.env.SUPABASE_GENERATED_IMAGES_BUCKET || 'generated-images';

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

async function ensureBucket() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.getBucket(
    GENERATED_IMAGES_BUCKET
  );

  if (data && !error) {
    return supabase;
  }

  const { error: createError } = await supabase.storage.createBucket(
    GENERATED_IMAGES_BUCKET,
    {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
    }
  );

  if (
    createError &&
    !/already exists/i.test(createError.message) &&
    !/duplicate/i.test(createError.message)
  ) {
    throw createError;
  }

  return supabase;
}

async function uploadImageBuffer(options: {
  fileBuffer: Buffer;
  mimeType: string;
  folder: string;
}) {
  const supabase = await ensureBucket();
  const extension = getFileExtension(options.mimeType);
  const filePath = `${options.folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .upload(filePath, options.fileBuffer, {
      contentType: options.mimeType,
      upsert: false,
      cacheControl: '3600',
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
