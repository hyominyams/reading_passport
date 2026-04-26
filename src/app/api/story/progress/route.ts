import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyProductionWatchdog } from '@/lib/story-production-watchdog';
import type { Story } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get('storyId');

    if (!storyId) {
      return Response.json({ error: 'storyId is required' }, { status: 400 });
    }

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('stories')
      .select('id, student_id, production_status, production_progress, production_started_at, production_heartbeat_at, production_error_message, current_step')
      .eq('id', storyId)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Story not found' }, { status: 404 });
    }

    let story = data as Pick<
      Story,
      | 'id'
      | 'student_id'
      | 'production_status'
      | 'production_progress'
      | 'production_started_at'
      | 'production_heartbeat_at'
      | 'production_error_message'
      | 'current_step'
    >;

    if (story.student_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    story = await applyProductionWatchdog(supabase, story);

    return Response.json({
      status: story.production_status,
      progress: story.production_progress,
      current_step: story.current_step,
      error_message: story.production_error_message,
    });
  } catch (error) {
    console.error('Progress API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
