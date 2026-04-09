import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateSubmission, deleteSubmission } from '@/lib/queries/campaign';
import { deleteCampaignSubmissionAssets } from '@/lib/storage/campaign-assets';
import type { CampaignAssetMeta } from '@/types/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { sid } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = await updateSubmission(sid, body);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { sid } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the submission to get asset paths for cleanup
  const { data: submission } = await supabase
    .from('campaign_submissions')
    .select('assets')
    .eq('id', sid)
    .single();

  const result = await deleteSubmission(sid);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Clean up storage files
  if (submission?.assets) {
    const assets = submission.assets as CampaignAssetMeta[];
    const paths = assets.map((a) => a.storage_path).filter(Boolean);
    await deleteCampaignSubmissionAssets(paths);
  }

  return NextResponse.json({ success: true });
}
