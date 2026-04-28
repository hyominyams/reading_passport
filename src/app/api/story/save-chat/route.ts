import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const { storyId, chatLog, docentChatLog } = (await request.json()) as {
      storyId?: unknown;
      chatLog?: unknown;
      docentChatLog?: unknown;
    };

    if (typeof storyId !== 'string' || !storyId.trim()) {
      return Response.json({ error: 'Missing params' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (Array.isArray(chatLog)) {
      updates.chat_log = chatLog;
    }
    if (Array.isArray(docentChatLog)) {
      updates.docent_chat_log = docentChatLog;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'Missing chat payload' }, { status: 400 });
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
      .eq('id', storyId.trim())
      .maybeSingle();

    if (storyError || !story) {
      return Response.json({ error: 'Story not found' }, { status: 404 });
    }

    if (story.student_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('stories')
      .update(updates)
      .eq('id', storyId.trim());

    if (updateError) {
      throw updateError;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Save story chat failed:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
