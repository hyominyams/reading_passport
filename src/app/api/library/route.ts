import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizeStoryVisibility } from '@/lib/story-visibility';

const LIBRARY_STORY_SELECT = `
  id,
  student_id,
  book_id,
  country_id,
  language,
  story_type,
  final_text,
  uploaded_images,
  scene_images,
  illustration_style,
  cover_image_url,
  cover_design,
  translation_text,
  translated_texts,
  pdf_url_original,
  pdf_url_translated,
  translated_pdf_urls,
  visibility,
  created_at,
  author:users!stories_student_id_fkey(nickname, teacher_id)
`;

type LibraryBookRow = {
  id: string;
  title?: string | null;
  cover_url?: string | null;
};

type LibraryStoryRow = {
  id: string;
  student_id: string;
  book_id: string;
  country_id: string;
  language: string;
  story_type: string;
  final_text?: string[] | null;
  uploaded_images?: string[] | null;
  scene_images?: string[] | null;
  illustration_style?: string | null;
  cover_image_url?: string | null;
  cover_design?: {
    title?: string | null;
    author?: string | null;
    image_url?: string | null;
    story_font_key?: string | null;
    story_font_size?: number | null;
  } | null;
  translation_text?: string[] | null;
  translated_texts?: Record<string, string[]> | null;
  pdf_url_original?: string | null;
  pdf_url_translated?: string | null;
  translated_pdf_urls?: Record<string, string> | null;
  visibility?: string | null;
  created_at: string;
  author?: { nickname?: string | null; teacher_id?: string | null } | { nickname?: string | null; teacher_id?: string | null }[] | null;
};

type LibraryRow = {
  id: string;
  story_id: string;
  country_id: string;
  book_id: string;
  likes: number;
  views: number;
  story_title?: string | null;
  author_nickname?: string | null;
  thumbnail_url?: string | null;
  book?: LibraryBookRow | LibraryBookRow[] | null;
  story?: LibraryStoryRow | LibraryStoryRow[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function GET() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: viewer } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle<{ id: string; role: 'admin' | 'teacher' | 'student' }>();

  const { data, error } = await supabase
    .from('library')
    .select(
      `
        id,
        story_id,
        country_id,
        book_id,
        likes,
        views,
        story_title,
        author_nickname,
        thumbnail_url,
        book:books(id, title, cover_url),
        story:stories(${LIBRARY_STORY_SELECT})
      `
    )
    .order('likes', { ascending: false });

  if (error) {
    console.error('Error fetching library:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as LibraryRow[]).map((item) => {
    const story = normalizeRelation(item.story);
    return {
      ...item,
      book: normalizeRelation(item.book),
      story: story
        ? {
            ...story,
            author: normalizeRelation(story.author),
          }
        : null,
    };
  });

  const visibleRows = rows.filter((item) => {
    const story = item.story;
    if (!story) return false;

    const visibility = normalizeStoryVisibility(story.visibility);
    if (visibility === 'public' || story.student_id === user.id) {
      return true;
    }

    if (viewer?.role === 'admin') {
      return true;
    }

    return viewer?.role === 'teacher' && story.author?.teacher_id === user.id;
  });

  const storyIds = visibleRows.map((item) => item.story_id);

  const likeCounts: Record<string, number> = {};
  const commentCounts: Record<string, number> = {};
  if (storyIds.length > 0) {
    const [likeResult, commentResult] = await Promise.all([
      supabase.from('story_likes').select('story_id').in('story_id', storyIds),
      supabase.from('story_comments').select('story_id').in('story_id', storyIds),
    ]);

    if (likeResult.error) {
      console.error('Error fetching likes:', likeResult.error);
    } else {
      for (const row of likeResult.data ?? []) {
        const sid = (row as { story_id: string }).story_id;
        likeCounts[sid] = (likeCounts[sid] ?? 0) + 1;
      }
    }

    if (commentResult.error) {
      console.error('Error fetching comment counts:', commentResult.error);
    } else {
      for (const row of commentResult.data ?? []) {
        const sid = (row as { story_id: string }).story_id;
        commentCounts[sid] = (commentCounts[sid] ?? 0) + 1;
      }
    }
  }

  const items = visibleRows
    .map((item) => ({
      ...item,
      story: item.story
        ? {
            ...item.story,
            visibility: normalizeStoryVisibility(item.story.visibility),
          }
        : item.story,
      story_title:
        item.story_title?.trim()
        || item.story?.cover_design?.title?.trim()
        || null,
      author_nickname:
        item.author_nickname?.trim()
        || item.story?.author?.nickname?.trim()
        || null,
      thumbnail_url:
        item.thumbnail_url?.trim()
        || item.story?.cover_image_url?.trim()
        || item.story?.cover_design?.image_url?.trim()
        || item.story?.uploaded_images?.find((url) => typeof url === 'string' && url.trim().length > 0)
        || item.story?.scene_images?.find((url) => typeof url === 'string' && url.trim().length > 0)
        || null,
      likes: likeCounts[item.story_id] ?? item.likes,
      comment_count: commentCounts[item.story_id] ?? 0,
    }))
    .sort(
      (a: { likes: number }, b: { likes: number }) => b.likes - a.likes
    );

  return NextResponse.json({ items });
}
