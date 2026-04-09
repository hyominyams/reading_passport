import { createClient } from '@/lib/supabase/server';
import type {
  Campaign,
  CampaignStatus,
  CampaignContentType,
  CampaignSubmission,
  CampaignAssetMeta,
  ContentScope,
  SubmissionStatus,
} from '@/types/database';

// ── Campaigns ──

export async function createCampaign(data: {
  title: string;
  description: string;
  cover_image_url?: string | null;
  allowed_content_types: CampaignContentType[];
  tags?: string[];
  status?: CampaignStatus;
  deadline?: string | null;
  max_files_per_submission?: number;
  max_file_size_mb?: number;
  created_by: string;
  class_id?: string | null;
  scope?: ContentScope;
}): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('campaigns')
    .insert({
      title: data.title,
      description: data.description,
      cover_image_url: data.cover_image_url ?? null,
      allowed_content_types: data.allowed_content_types,
      tags: data.tags ?? [],
      status: data.status ?? 'draft',
      deadline: data.deadline ?? null,
      max_files_per_submission: data.max_files_per_submission ?? 3,
      max_file_size_mb: data.max_file_size_mb ?? 5,
      created_by: data.created_by,
      class_id: data.class_id ?? null,
      scope: data.scope ?? 'class',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating campaign:', error);
    return { success: false, error: error.message };
  }

  return { success: true, campaignId: result?.id };
}

export async function updateCampaign(
  campaignId: string,
  data: Partial<{
    title: string;
    description: string;
    cover_image_url: string | null;
    allowed_content_types: CampaignContentType[];
    tags: string[];
    status: CampaignStatus;
    deadline: string | null;
    max_files_per_submission: number;
    max_file_size_mb: number;
    class_id: string | null;
    scope: ContentScope;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('campaigns')
    .update(data)
    .eq('id', campaignId);

  if (error) {
    console.error('Error updating campaign:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (error) {
    console.error('Error fetching campaign:', error);
    return null;
  }

  return data as Campaign;
}

export async function getActiveCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active campaigns:', error);
    return [];
  }

  return (data ?? []) as Campaign[];
}

export async function getTeacherCampaigns(teacherId: string): Promise<Campaign[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching teacher campaigns:', error);
    return [];
  }

  return (data ?? []) as Campaign[];
}

export async function deleteCampaign(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId);

  if (error) {
    console.error('Error deleting campaign:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ── Submissions ──

export async function createSubmission(data: {
  campaign_id: string;
  student_id: string;
  content_type: CampaignContentType;
  title: string;
  description?: string | null;
  assets: CampaignAssetMeta[];
}): Promise<{ success: boolean; submissionId?: string; error?: string }> {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('campaign_submissions')
    .insert({
      campaign_id: data.campaign_id,
      student_id: data.student_id,
      content_type: data.content_type,
      title: data.title,
      description: data.description ?? null,
      assets: data.assets,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating submission:', error);
    return { success: false, error: error.message };
  }

  return { success: true, submissionId: result?.id };
}

export async function updateSubmission(
  submissionId: string,
  data: Partial<{
    title: string;
    description: string | null;
    content_type: CampaignContentType;
    assets: CampaignAssetMeta[];
    status: SubmissionStatus;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('campaign_submissions')
    .update(data)
    .eq('id', submissionId);

  if (error) {
    console.error('Error updating submission:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getCampaignSubmissions(
  campaignId: string
): Promise<(CampaignSubmission & { student?: { id: string; nickname: string | null; avatar: string | null } })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaign_submissions')
    .select('*, student:users(id, nickname, avatar)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }

  return (data ?? []) as (CampaignSubmission & { student?: { id: string; nickname: string | null; avatar: string | null } })[];
}

export async function deleteSubmission(
  submissionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('campaign_submissions')
    .delete()
    .eq('id', submissionId);

  if (error) {
    console.error('Error deleting submission:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ── Likes ──

export async function toggleSubmissionLike(
  submissionId: string,
  userId: string
): Promise<{ success: boolean; liked: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('campaign_likes')
    .select('id')
    .eq('submission_id', submissionId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('campaign_likes')
      .delete()
      .eq('submission_id', submissionId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, liked: true, error: error.message };
    }
    return { success: true, liked: false };
  } else {
    const { error } = await supabase
      .from('campaign_likes')
      .insert({ submission_id: submissionId, user_id: userId });

    if (error) {
      return { success: false, liked: false, error: error.message };
    }
    return { success: true, liked: true };
  }
}

export async function getSubmissionLikeCounts(
  submissionIds: string[]
): Promise<Record<string, number>> {
  if (submissionIds.length === 0) return {};
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaign_likes')
    .select('submission_id')
    .in('submission_id', submissionIds);

  if (error) {
    console.error('Error fetching like counts:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.submission_id] = (counts[row.submission_id] ?? 0) + 1;
  }
  return counts;
}

export async function getUserLikedSubmissions(
  userId: string,
  submissionIds: string[]
): Promise<Set<string>> {
  if (submissionIds.length === 0) return new Set();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('campaign_likes')
    .select('submission_id')
    .eq('user_id', userId)
    .in('submission_id', submissionIds);

  if (error) {
    console.error('Error fetching user likes:', error);
    return new Set();
  }

  return new Set((data ?? []).map((r) => r.submission_id));
}
