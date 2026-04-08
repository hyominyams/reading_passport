import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('library')
    .select(
      '*, book:books(id, title, cover_url), story:stories(*, author:users!stories_student_id_fkey(nickname))'
    )
    .order('likes', { ascending: false });

  if (error) {
    console.error('Error fetching library:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const storyIds = (data ?? []).map((item: { story_id: string }) => item.story_id);

  const likeCounts: Record<string, number> = {};
  if (storyIds.length > 0) {
    const { data: likeRows, error: likeError } = await supabase
      .from('story_likes')
      .select('story_id')
      .in('story_id', storyIds);

    if (likeError) {
      console.error('Error fetching likes:', likeError);
    } else {
      for (const row of likeRows ?? []) {
        const sid = (row as { story_id: string }).story_id;
        likeCounts[sid] = (likeCounts[sid] ?? 0) + 1;
      }
    }
  }

  const items = (data ?? [])
    .filter(
      (item: { story?: { visibility?: string } | null }) =>
        item.story && item.story.visibility !== 'private'
    )
    .map((item: { story_id: string; likes: number }) => ({
      ...item,
      likes: likeCounts[item.story_id] ?? item.likes,
    }))
    .sort(
      (a: { likes: number }, b: { likes: number }) => b.likes - a.likes
    );

  return NextResponse.json({ items });
}
