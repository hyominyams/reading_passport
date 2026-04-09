import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCampaign,
  getCampaignSubmissions,
  createSubmission,
  getSubmissionLikeCounts,
  getUserLikedSubmissions,
} from '@/lib/queries/campaign';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const submissions = await getCampaignSubmissions(id);
  const submissionIds = submissions.map((s) => s.id);

  const [likeCounts, userLiked] = await Promise.all([
    getSubmissionLikeCounts(submissionIds),
    getUserLikedSubmissions(user.id, submissionIds),
  ]);

  const enriched = submissions.map((s) => ({
    ...s,
    like_count: likeCounts[s.id] ?? 0,
    liked_by_me: userLiked.has(s.id),
  }));

  return NextResponse.json({ submissions: enriched });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const campaign = await getCampaign(id);
  if (!campaign || campaign.status !== 'active') {
    return NextResponse.json({ error: 'Campaign not found or not active' }, { status: 404 });
  }

  if (campaign.deadline && new Date(campaign.deadline) < new Date()) {
    return NextResponse.json({ error: 'Campaign deadline has passed' }, { status: 400 });
  }

  const body = await request.json();
  const result = await createSubmission({
    campaign_id: id,
    student_id: user.id,
    content_type: body.content_type,
    title: body.title,
    description: body.description ?? null,
    assets: body.assets ?? [],
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ submissionId: result.submissionId }, { status: 201 });
}
