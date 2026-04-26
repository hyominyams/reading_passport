import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Activity, Story } from '@/types/database';

function appendUnique(values: unknown, value: string): string[] {
  const existing = Array.isArray(values)
    ? values.filter((item): item is string => typeof item === 'string')
    : [];

  return Array.from(new Set([...existing, value]));
}

export async function POST(request: NextRequest) {
  let body: { storyId?: unknown };

  try {
    body = (await request.json()) as { storyId?: unknown };
  } catch {
    return NextResponse.json({ error: '공유할 이야기를 확인하지 못했어요.' }, { status: 400 });
  }

  const storyId = typeof body.storyId === 'string' ? body.storyId.trim() : '';
  if (!storyId) {
    return NextResponse.json({ error: 'storyId가 필요합니다.' }, { status: 400 });
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: storyData, error: storyLoadError } = await service
    .from('stories')
    .select('*')
    .eq('id', storyId)
    .maybeSingle();

  if (storyLoadError || !storyData) {
    return NextResponse.json({ error: '이야기를 찾을 수 없습니다.' }, { status: 404 });
  }

  const story = storyData as Story;

  if (story.student_id !== user.id) {
    return NextResponse.json({ error: '공유 권한이 없습니다.' }, { status: 403 });
  }

  if (!story.final_text?.some((page) => page.trim().length > 0)) {
    return NextResponse.json({ error: '완성된 본문이 필요합니다.' }, { status: 400 });
  }

  const completedAt = new Date().toISOString();
  const { error: storyUpdateError } = await service
    .from('stories')
    .update({
      story_status: 'completed',
      completed_at: completedAt,
      current_step: Math.max(story.current_step, 8),
    })
    .eq('id', storyId);

  if (storyUpdateError) {
    console.error('Failed to publish story:', storyUpdateError);
    return NextResponse.json({ error: '이야기 상태를 저장하지 못했어요.' }, { status: 500 });
  }

  const { data: authorProfile } = await service
    .from('users')
    .select('nickname')
    .eq('id', story.student_id)
    .maybeSingle<{ nickname: string | null }>();

  const storyTitle = story.cover_design?.title?.trim() || '나의 이야기';
  const authorNickname =
    authorProfile?.nickname?.trim()
    || story.cover_design?.author?.trim()
    || '작성자';
  const thumbnailUrl =
    story.cover_image_url?.trim()
    || story.cover_design?.image_url?.trim()
    || story.uploaded_images?.find((url) => typeof url === 'string' && url.trim().length > 0)
    || story.scene_images?.find((url) => typeof url === 'string' && url.trim().length > 0)
    || null;

  const libraryMetadata = {
    country_id: story.country_id,
    book_id: story.book_id,
    story_title: storyTitle,
    author_nickname: authorNickname,
    thumbnail_url: thumbnailUrl,
  };

  const { data: existingLibraryItem, error: existingLibraryError } = await service
    .from('library')
    .select('id')
    .eq('story_id', storyId)
    .maybeSingle<{ id: string }>();

  if (existingLibraryError) {
    console.error('Failed to load library item:', existingLibraryError);
    return NextResponse.json({ error: '도서관 상태를 확인하지 못했어요.' }, { status: 500 });
  }

  if (existingLibraryItem) {
    const { error: libraryUpdateError } = await service
      .from('library')
      .update(libraryMetadata)
      .eq('id', existingLibraryItem.id);

    if (libraryUpdateError) {
      console.error('Failed to update library item:', libraryUpdateError);
      return NextResponse.json({ error: '도서관에 등록하지 못했어요.' }, { status: 500 });
    }
  } else {
    const { error: libraryInsertError } = await service
      .from('library')
      .insert({
        story_id: storyId,
        ...libraryMetadata,
        likes: 0,
        views: 0,
      });

    if (libraryInsertError) {
      console.error('Failed to insert library item:', libraryInsertError);
      return NextResponse.json({ error: '도서관에 등록하지 못했어요.' }, { status: 500 });
    }
  }

  const { data: activity, error: activityLoadError } = await service
    .from('activities')
    .select('id, completed_tabs, stamps_earned')
    .eq('student_id', story.student_id)
    .eq('book_id', story.book_id)
    .maybeSingle<Pick<Activity, 'id' | 'completed_tabs' | 'stamps_earned'>>();

  if (activityLoadError) {
    console.error('Failed to load activity for MyStory completion:', activityLoadError);
    return NextResponse.json({ error: '도장 상태를 확인하지 못했어요.' }, { status: 500 });
  }

  if (activity) {
    const { error: activityUpdateError } = await service
      .from('activities')
      .update({
        completed_tabs: appendUnique(activity.completed_tabs, 'mystory'),
        stamps_earned: appendUnique(activity.stamps_earned, 'mystory'),
      })
      .eq('id', activity.id);

    if (activityUpdateError) {
      console.error('Failed to update MyStory activity stamp:', activityUpdateError);
      return NextResponse.json({ error: 'My World 도장을 저장하지 못했어요.' }, { status: 500 });
    }
  } else {
    const { error: activityInsertError } = await service.from('activities').insert({
      student_id: story.student_id,
      book_id: story.book_id,
      country_id: story.country_id,
      language: story.language,
      completed_tabs: ['read', 'hidden', 'questions', 'mystory'],
      stamps_earned: ['read', 'hidden', 'questions', 'mystory'],
    });

    if (activityInsertError) {
      console.error('Failed to insert MyStory activity stamp:', activityInsertError);
      return NextResponse.json({ error: 'My World 도장을 저장하지 못했어요.' }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    completedAt,
  });
}
