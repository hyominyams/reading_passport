import { createServiceClient } from '@/lib/supabase/service';

const CAMPAIGN_ASSETS_BUCKET =
  process.env.SUPABASE_CAMPAIGN_ASSETS_BUCKET || 'campaign-assets';

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

async function ensureBucket() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.getBucket(
    CAMPAIGN_ASSETS_BUCKET
  );

  if (data && !error) {
    return supabase;
  }

  const { error: createError } = await supabase.storage.createBucket(
    CAMPAIGN_ASSETS_BUCKET,
    {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
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

export async function uploadCampaignAsset(options: {
  fileBuffer: Buffer;
  mimeType: string;
  campaignId: string;
  submissionId: string;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = await ensureBucket();
  const extension = getFileExtension(options.mimeType);
  const storagePath = `${options.campaignId}/${options.submissionId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(CAMPAIGN_ASSETS_BUCKET)
    .upload(storagePath, options.fileBuffer, {
      contentType: options.mimeType,
      upsert: false,
      cacheControl: '3600',
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
  const supabase = await ensureBucket();
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
  const supabase = await ensureBucket();
  const { error } = await supabase.storage
    .from(CAMPAIGN_ASSETS_BUCKET)
    .remove(storagePaths);

  if (error) {
    console.error('Failed to delete submission assets:', error);
  }
}
