import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const { storyId, chatLog } = await request.json();

    if (!storyId || !chatLog) {
      return Response.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = createServiceClient();
    await supabase
      .from('stories')
      .update({ chat_log: chatLog })
      .eq('id', storyId);

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
