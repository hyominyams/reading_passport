import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Story } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get('storyId');

    if (!storyId) {
      return Response.json({ error: 'storyId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('stories')
      .select('production_status, production_progress, current_step')
      .eq('id', storyId)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Story not found' }, { status: 404 });
    }

    const story = data as Pick<Story, 'production_status' | 'production_progress' | 'current_step'>;

    return Response.json({
      status: story.production_status,
      progress: story.production_progress,
      current_step: story.current_step,
    });
  } catch (error) {
    console.error('Progress API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
