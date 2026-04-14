import { ensurePublicBucket } from '@/lib/storage/buckets';

const TEACHER_ASSETS_BUCKET =
  process.env.SUPABASE_TEACHER_ASSETS_BUCKET || 'teacher-assets';
const TEACHER_ASSET_FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const IMMUTABLE_CACHE_CONTROL = '31536000';

function getFileExtension(mimeType: string) {
  switch (mimeType.split(';', 1)[0]) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

export async function uploadTeacherAsset(options: {
  fileBuffer: Buffer;
  mimeType: string;
  folder: string;
  fileName?: string;
}) {
  if (options.fileBuffer.byteLength > TEACHER_ASSET_FILE_SIZE_LIMIT) {
    throw new Error('Teacher asset exceeds the 25MB storage limit.');
  }

  const supabase = await ensurePublicBucket(
    TEACHER_ASSETS_BUCKET,
    TEACHER_ASSET_FILE_SIZE_LIMIT
  );
  const extension = getFileExtension(options.mimeType);
  const sanitizedBaseName = options.fileName
    ?.replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filePath = `${options.folder}/${new Date().toISOString().slice(0, 10)}/${sanitizedBaseName || crypto.randomUUID()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(TEACHER_ASSETS_BUCKET)
    .upload(filePath, options.fileBuffer, {
      contentType: options.mimeType,
      upsert: false,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(TEACHER_ASSETS_BUCKET)
    .getPublicUrl(filePath);

  return {
    publicUrl: data.publicUrl,
    storagePath: filePath,
  };
}
