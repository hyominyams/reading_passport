import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

const LIBRARY_METADATA_SELECT = 'id, story_id, likes, views, story_title, author_nickname, thumbnail_url';

type StoryStudent = {
  id?: string;
  nickname?: string | null;
  class?: string | null;
  teacher_id?: string | null;
} | null;

function normalizeStudent(student: StoryStudent | StoryStudent[]) {
  return Array.isArray(student) ? student[0] ?? null : student;
}

function buildLibraryMetadata(story: {
  id: string;
  country_id: string;
  book_id: string;
  cover_image_url?: string | null;
  cover_design?: { title?: string | null; image_url?: string | null } | null;
  scene_images?: string[] | null;
  student?: StoryStudent | StoryStudent[];
}) {
  const normalizedStudent = normalizeStudent(story.student ?? null);

  return {
    story_id: story.id,
    country_id: story.country_id,
    book_id: story.book_id,
    story_title: story.cover_design?.title?.trim() || '나의 이야기',
    author_nickname: normalizedStudent?.nickname?.trim() || '학생',
    thumbnail_url:
      story.cover_image_url?.trim()
      || story.cover_design?.image_url?.trim()
      || story.scene_images?.[0]
      || null,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { data: stories, error } = await service
    .from('stories')
    .select(`
      id,
      student_id,
      book_id,
      country_id,
      visibility,
      created_at,
      cover_image_url,
      cover_design,
      scene_images,
      student:users!stories_student_id_fkey(id, nickname, class, teacher_id),
      book:books(id, title)
    `)
    .not('final_text', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const storyRows = stories ?? [];
  const storyIds = storyRows.map((story) => story.id);
  const teacherIds = Array.from(new Set(
    storyRows
      .map((story) => normalizeStudent(story.student)?.teacher_id)
      .filter((teacherId): teacherId is string => !!teacherId)
  ));

  const [libraryResult, likesResult, teachersResult] = await Promise.all([
    storyIds.length > 0
      ? service.from('library').select(LIBRARY_METADATA_SELECT).in('story_id', storyIds)
      : Promise.resolve({ data: [], error: null }),
    storyIds.length > 0
      ? service.from('story_likes').select('story_id').in('story_id', storyIds)
      : Promise.resolve({ data: [], error: null }),
    teacherIds.length > 0
      ? service.from('users').select('id, nickname, email').in('id', teacherIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const libraryByStoryId = new Map((libraryResult.data ?? []).map((item) => [item.story_id, item]));
  const teacherById = new Map((teachersResult.data ?? []).map((teacher) => [
    teacher.id,
    teacher.nickname?.trim() || teacher.email?.trim() || '교사',
  ]));

  const likeCounts: Record<string, number> = {};
  for (const row of likesResult.data ?? []) {
    likeCounts[row.story_id] = (likeCounts[row.story_id] ?? 0) + 1;
  }

  return NextResponse.json({
    items: storyRows.map((story) => {
      const libraryItem = libraryByStoryId.get(story.id);
      const normalizedStudent = normalizeStudent(story.student ?? null);
      return {
        story_id: story.id,
        student_id: story.student_id,
        country_id: story.country_id,
        book_id: story.book_id,
        visibility: story.visibility,
        created_at: story.created_at,
        student: normalizedStudent,
        teacher_name: normalizedStudent?.teacher_id ? teacherById.get(normalizedStudent.teacher_id) ?? null : null,
        book: story.book,
        cover_image_url: story.cover_image_url,
        cover_design: story.cover_design,
        scene_images: story.scene_images,
        library_id: libraryItem?.id ?? null,
        in_library: !!libraryItem,
        likes: likeCounts[story.id] ?? libraryItem?.likes ?? 0,
        views: libraryItem?.views ?? 0,
        story_title: libraryItem?.story_title ?? story.cover_design?.title ?? null,
        author_nickname: libraryItem?.author_nickname ?? normalizedStudent?.nickname ?? null,
        thumbnail_url:
          libraryItem?.thumbnail_url
          || story.cover_image_url
          || story.cover_design?.image_url
          || story.scene_images?.[0]
          || null,
      };
    }),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const body = await request.json();
  const action = body.action as 'set_visibility' | 'toggle_library' | undefined;
  const storyId = typeof body.storyId === 'string' ? body.storyId : '';

  if (!action || !storyId) {
    return NextResponse.json({ error: '작업 정보가 부족합니다' }, { status: 400 });
  }

  const { data: story, error: storyError } = await service
    .from('stories')
    .select(`
      id,
      student_id,
      book_id,
      country_id,
      visibility,
      cover_image_url,
      cover_design,
      scene_images,
      student:users!stories_student_id_fkey(nickname, class, teacher_id)
    `)
    .eq('id', storyId)
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: '작품을 찾을 수 없습니다' }, { status: 404 });
  }

  if (action === 'set_visibility') {
    const visibility = body.visibility;
    if (!['public', 'class', 'private'].includes(visibility)) {
      return NextResponse.json({ error: '유효하지 않은 공개 범위입니다' }, { status: 400 });
    }

    const { error } = await service
      .from('stories')
      .update({ visibility })
      .eq('id', storyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, visibility });
  }

  const { data: existingLibraryItem } = await service
    .from('library')
    .select('id')
    .eq('story_id', storyId)
    .maybeSingle();

  if (existingLibraryItem?.id) {
    const { error } = await service
      .from('library')
      .delete()
      .eq('id', existingLibraryItem.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, in_library: false });
  }

  const metadata = buildLibraryMetadata(story);
  const { data: insertedItem, error } = await service
    .from('library')
    .insert({
      ...metadata,
      likes: 0,
      views: 0,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, in_library: true, library_id: insertedItem.id });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const libraryId = request.nextUrl.searchParams.get('libraryId');
  const storyId = request.nextUrl.searchParams.get('storyId');
  const service = createServiceClient();

  if (!libraryId && !storyId) {
    return NextResponse.json({ error: '삭제 대상이 필요합니다' }, { status: 400 });
  }

  const query = service.from('library').delete();
  const { error } = libraryId
    ? await query.eq('id', libraryId)
    : await query.eq('story_id', storyId!);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
