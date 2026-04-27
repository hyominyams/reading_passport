import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const { storyId, chatLog } = await request.json();

    if (!storyId || !chatLog) {
      return Response.json({ error: 'Missing params' }, { status: 400 });
    }

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('id, student_id')
      .eq('id', storyId)
      .maybeSingle();

    if (storyError || !story) {
      return Response.json({ error: 'Story not found' }, { status: 404 });
    }

    if (story.student_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('stories')
      .update({ chat_log: chatLog })
      .eq('id', storyId);

    if (updateError) {
      throw updateError;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Save story chat failed:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
