import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadCampaignAsset } from '@/lib/storage/campaign-assets';
import { getCampaign } from '@/lib/queries/campaign';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const campaignId = formData.get('campaignId') as string;
  const submissionId = formData.get('submissionId') as string | null;
  const file = formData.get('file') as File;

  if (!campaignId || !file) {
    return NextResponse.json({ error: 'Missing campaignId or file' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const maxBytes = campaign.max_file_size_mb * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File too large. Max ${campaign.max_file_size_mb}MB` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const effectiveSubmissionId = submissionId || 'draft';

  const { publicUrl, storagePath } = await uploadCampaignAsset({
    fileBuffer: buffer,
    mimeType: file.type,
    campaignId,
    submissionId: effectiveSubmissionId,
  });

  return NextResponse.json({
    asset: {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'pdf',
      size_bytes: file.size,
      storage_path: storagePath,
      public_url: publicUrl,
    },
  });
}
