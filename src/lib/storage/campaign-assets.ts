import { ensurePublicBucket } from '@/lib/storage/buckets';

const CAMPAIGN_ASSETS_BUCKET =
  process.env.SUPABASE_CAMPAIGN_ASSETS_BUCKET || 'campaign-assets';
const CAMPAIGN_ASSET_FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const IMMUTABLE_CACHE_CONTROL = '31536000';

function getFileExtension(mimeType: string) {
  switch (mimeType.split(';', 1)[0]) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/png':
      return 'png';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

export async function uploadCampaignAsset(options: {
  fileBuffer: Buffer;
  mimeType: string;
  campaignId: string;
  submissionId: string;
}): Promise<{ publicUrl: string; storagePath: string }> {
  if (options.fileBuffer.byteLength > CAMPAIGN_ASSET_FILE_SIZE_LIMIT) {
    throw new Error('Campaign asset exceeds the 10MB storage limit.');
  }

  const supabase = await ensurePublicBucket(
    CAMPAIGN_ASSETS_BUCKET,
    CAMPAIGN_ASSET_FILE_SIZE_LIMIT
  );
  const extension = getFileExtension(options.mimeType);
  const storagePath = `${options.campaignId}/${options.submissionId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(CAMPAIGN_ASSETS_BUCKET)
    .upload(storagePath, options.fileBuffer, {
      contentType: options.mimeType,
      upsert: false,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(CAMPAIGN_ASSETS_BUCKET)
    .getPublicUrl(storagePath);

  return { publicUrl: data.publicUrl, storagePath };
}

export async function deleteCampaignAsset(storagePath: string): Promise<void> {
  const supabase = await ensurePublicBucket(
    CAMPAIGN_ASSETS_BUCKET,
    CAMPAIGN_ASSET_FILE_SIZE_LIMIT
  );
  const { error } = await supabase.storage
    .from(CAMPAIGN_ASSETS_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error('Failed to delete campaign asset:', error);
  }
}

export async function deleteCampaignSubmissionAssets(
  storagePaths: string[]
): Promise<void> {
  if (storagePaths.length === 0) return;
  const supabase = await ensurePublicBucket(
    CAMPAIGN_ASSETS_BUCKET,
    CAMPAIGN_ASSET_FILE_SIZE_LIMIT
  );
  const { error } = await supabase.storage
    .from(CAMPAIGN_ASSETS_BUCKET)
    .remove(storagePaths);

  if (error) {
    console.error('Failed to delete submission assets:', error);
  }
}
