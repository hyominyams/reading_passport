import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const LIBRARY_METADATA_SELECT = 'id, story_id, likes, views, story_title, author_nickname, thumbnail_url';

async function getAuthorizedTeacher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return {
      error: NextResponse.json({ error: '권한이 없습니다' }, { status: 403 }),
    };
  }

  return { user, profile };
}

async function getTeacherStudentIds(teacherId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from('users')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('role', 'student');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((student) => student.id);
}

function buildLibraryMetadata(story: {
  id: string;
  country_id: string;
  book_id: string;
  cover_image_url?: string | null;
  cover_design?: { title?: string | null; image_url?: string | null } | null;
  scene_images?: string[] | null;
  student?: { nickname?: string | null } | null;
}) {
  return {
    story_id: story.id,
    country_id: story.country_id,
    book_id: story.book_id,
    story_title: story.cover_design?.title?.trim() || '나의 이야기',
    author_nickname: story.student?.nickname?.trim() || '학생',
    thumbnail_url:
      story.cover_image_url?.trim()
      || story.cover_design?.image_url?.trim()
      || story.scene_images?.[0]
      || null,
  };
}

function normalizeStoryStudent<T>(student: T | T[] | null | undefined) {
  return Array.isArray(student) ? student[0] ?? null : student ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const studentIds = await getTeacherStudentIds(auth.user.id);
  const detailStoryId = request.nextUrl.searchParams.get('storyId');

  if (studentIds.length === 0) {
    return NextResponse.json({ items: [], message: '연결된 학생이 없습니다. 학생 계정의 교사 연결을 확인해 주세요.' });
  }

  if (detailStoryId) {
    const { data: story, error } = await service
      .from('stories')
      .select(`
        id,
        student_id,
        book_id,
        country_id,
        visibility,
        created_at,
        final_text,
        cover_image_url,
        cover_design,
        scene_images,
        student:users!stories_student_id_fkey(id, nickname, class),
        book:books(id, title)
      `)
      .eq('id', detailStoryId)
      .single();

    if (error || !story || !studentIds.includes(story.student_id)) {
      return NextResponse.json({ error: '작품을 찾을 수 없습니다' }, { status: 404 });
    }

    const { data: libraryItem } = await service
      .from('library')
      .select(LIBRARY_METADATA_SELECT)
      .eq('story_id', detailStoryId)
      .maybeSingle();

    const student = normalizeStoryStudent(story.student) as { nickname?: string | null; class?: string | null } | null;

    return NextResponse.json({
      item: {
        story_id: story.id,
        student_id: story.student_id,
        visibility: story.visibility,
        created_at: story.created_at,
        country_id: story.country_id,
        book_id: story.book_id,
        final_text: story.final_text,
        book: story.book,
        student,
        cover_image_url: story.cover_image_url,
        cover_design: story.cover_design,
        scene_images: story.scene_images,
        library_id: libraryItem?.id ?? null,
        in_library: !!libraryItem,
        likes: libraryItem?.likes ?? 0,
        views: libraryItem?.views ?? 0,
        story_title: libraryItem?.story_title ?? story.cover_design?.title ?? null,
        author_nickname: libraryItem?.author_nickname ?? student?.nickname ?? null,
        thumbnail_url:
          libraryItem?.thumbnail_url
          || story.cover_image_url
          || story.cover_design?.image_url
          || story.scene_images?.[0]
          || null,
      },
    });
  }

  // Show stories that have final_text OR have reached step 7+ (finish/complete)
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
      story_status,
      current_step,
      student:users!stories_student_id_fkey(id, nickname, class),
      book:books(id, title)
    `)
    .in('student_id', studentIds)
    .or('final_text.not.is.null,current_step.gte.7')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const storyIds = (stories ?? []).map((story) => story.id);
  const libraryResult = storyIds.length === 0
    ? { data: [], error: null }
    : await service
      .from('library')
      .select(LIBRARY_METADATA_SELECT)
      .in('story_id', storyIds);

  if (libraryResult.error) {
    return NextResponse.json({ error: libraryResult.error.message }, { status: 500 });
  }

  const libraryMap = new Map((libraryResult.data ?? []).map((item) => [item.story_id, item]));

  const items = (stories ?? []).map((story) => {
    const libraryItem = libraryMap.get(story.id);
    const student = normalizeStoryStudent(story.student) as { nickname?: string | null; class?: string | null } | null;

    return {
      story_id: story.id,
      student_id: story.student_id,
      visibility: story.visibility,
      created_at: story.created_at,
      country_id: story.country_id,
      book_id: story.book_id,
      book: story.book,
      student,
      cover_image_url: story.cover_image_url,
      cover_design: story.cover_design,
      scene_images: story.scene_images,
      library_id: libraryItem?.id ?? null,
      in_library: !!libraryItem,
      likes: libraryItem?.likes ?? 0,
      views: libraryItem?.views ?? 0,
      story_title: libraryItem?.story_title ?? story.cover_design?.title ?? null,
      author_nickname: libraryItem?.author_nickname ?? student?.nickname ?? null,
      thumbnail_url:
        libraryItem?.thumbnail_url
        || story.cover_image_url
        || story.cover_design?.image_url
        || story.scene_images?.[0]
        || null,
    };
  });

  return NextResponse.json({ items });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const studentIds = await getTeacherStudentIds(auth.user.id);
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
      student:users!stories_student_id_fkey(nickname)
    `)
    .eq('id', storyId)
    .single();

  if (storyError || !story || !studentIds.includes(story.student_id)) {
    return NextResponse.json({ error: '관리할 수 없는 작품입니다' }, { status: 403 });
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

  const normalizedStory = {
    ...story,
    student: Array.isArray(story.student) ? story.student[0] ?? null : story.student,
  };
  const metadata = buildLibraryMetadata(normalizedStory);
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
