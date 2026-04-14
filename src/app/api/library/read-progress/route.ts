import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

function isMissingStoryReadProgressTable(error: {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined) {
  const message = error?.message ?? '';
  return message.includes("Could not find the table 'public.story_read_progress' in the schema cache");
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 }),
    };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if ('error' in auth) {
    return auth.error;
  }

  const storyId = request.nextUrl.searchParams.get('storyId');
  if (!storyId) {
    return NextResponse.json({ error: 'storyId가 필요합니다' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('story_read_progress')
    .select('completed, last_page, total_pages_snapshot, completed_at')
    .eq('story_id', storyId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error) {
    if (isMissingStoryReadProgressTable(error)) {
      return NextResponse.json({
        progress: null,
        trackingAvailable: false,
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    progress: data ?? null,
    trackingAvailable: true,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if ('error' in auth) {
    return auth.error;
  }

  const body = await request.json();
  const storyId = typeof body.storyId === 'string' ? body.storyId : '';
  const totalPages = typeof body.totalPages === 'number' && Number.isFinite(body.totalPages)
    ? Math.max(0, Math.round(body.totalPages))
    : null;

  if (!storyId) {
    return NextResponse.json({ error: 'storyId가 필요합니다' }, { status: 400 });
  }

  if (totalPages === null) {
    return NextResponse.json({ error: '유효한 totalPages가 필요합니다' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('story_read_progress')
    .upsert(
      {
        story_id: storyId,
        user_id: auth.user.id,
        last_page: totalPages,
        total_pages_snapshot: totalPages,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'story_id,user_id' }
    );

  if (error) {
    if (isMissingStoryReadProgressTable(error)) {
      return NextResponse.json({
        success: true,
        trackingAvailable: false,
      });
    }

    return NextResponse.json({
      error: error.message,
      code: error.code ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    trackingAvailable: true,
  });
}
