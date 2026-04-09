import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCampaign, getActiveCampaigns, getTeacherCampaigns } from '@/lib/queries/campaign';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role;
  const status = request.nextUrl.searchParams.get('status');

  let campaigns;
  if (role === 'teacher') {
    campaigns = await getTeacherCampaigns(user.id);
  } else if (role === 'admin') {
    // Admin sees all — getTeacherCampaigns won't work, use active for now
    campaigns = await getActiveCampaigns();
  } else {
    // Students see active campaigns only (RLS filters by teacher)
    campaigns = await getActiveCampaigns();
  }

  if (status) {
    campaigns = campaigns.filter((c) => c.status === status);
  }

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const result = await createCampaign({
    ...body,
    created_by: user.id,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ campaignId: result.campaignId }, { status: 201 });
}
