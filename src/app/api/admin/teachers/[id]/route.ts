import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureTeacherClassRecord } from '@/lib/classroom';
import { buildAutoNickname } from '@/lib/profile';

function normalizeGrade(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

async function getTeacherDependencies(service: ReturnType<typeof createServiceClient>, teacherId: string) {
  const [students, books, hiddenContent] = await Promise.all([
    service.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('teacher_id', teacherId),
    service.from('books').select('id', { count: 'exact', head: true }).eq('created_by', teacherId),
    service.from('hidden_content').select('id', { count: 'exact', head: true }).eq('created_by', teacherId),
  ]);

  return {
    students: students.count ?? 0,
    books: books.count ?? 0,
    hiddenContent: hiddenContent.count ?? 0,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const service = createServiceClient();
  const { data: teacher, error } = await service
    .from('users')
    .select('id, email, nickname, school, grade, class, avatar, created_at')
    .eq('id', id)
    .eq('role', 'teacher')
    .single();

  if (error || !teacher) {
    return NextResponse.json({ error: '교사를 찾을 수 없습니다' }, { status: 404 });
  }

  const { data: classes, error: classesError } = await service
    .from('classes')
    .select('id, teacher_id, class_code, school, grade, class_name, mystory_required_turns, questions_required_count')
    .eq('teacher_id', id)
    .order('grade', { ascending: true })
    .order('class_name', { ascending: true });

  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  const dependencies = await getTeacherDependencies(service, id);

  const { data: students } = await service
    .from('users')
    .select('id, class')
    .eq('role', 'student')
    .eq('teacher_id', id);

  const studentRows = students ?? [];
  const studentIds = studentRows.map((student) => student.id);
  const fallbackClassNames = new Set<string>();

  if (typeof teacher.class === 'string' && teacher.class.trim()) {
    fallbackClassNames.add(teacher.class.trim());
  }

  for (const student of studentRows) {
    if (typeof student.class === 'string' && student.class.trim()) {
      fallbackClassNames.add(student.class.trim());
    }
  }

  const normalizedClasses = (classes ?? []).length > 0
    ? (classes ?? [])
    : Array.from(fallbackClassNames).map((className, index) => ({
        id: `derived-${index}-${className}`,
        teacher_id: id,
        class_code: '미생성',
        school: teacher.school ?? '미정',
        grade: teacher.grade ?? 1,
        class_name: className,
        mystory_required_turns: 5,
        questions_required_count: 7,
      }));

  const [stories, approvals, flaggedChats, recentBooks, recentHiddenContent] = await Promise.all([
    studentIds.length > 0
      ? service.from('stories').select('id').in('student_id', studentIds).not('final_text', 'is', null)
      : Promise.resolve({ data: [], error: null }),
    service
      .from('approval_requests')
      .select('id, status')
      .eq('requester_id', id),
    studentIds.length > 0
      ? service.from('chat_logs').select('id').in('student_id', studentIds).eq('flagged', true)
      : Promise.resolve({ data: [], error: null }),
    service
      .from('books')
      .select('id, title, country_id, approved, created_at, scope')
      .eq('created_by', id)
      .order('created_at', { ascending: false })
      .limit(5),
    service
      .from('hidden_content')
      .select('id, title, type, book_id, approved, scope')
      .eq('created_by', id)
      .order('order', { ascending: true })
      .limit(8),
  ]);

  return NextResponse.json({
    teacher: {
      ...teacher,
      role: 'teacher',
    },
    stats: {
      students: dependencies.students,
      classes: normalizedClasses.length,
      books: dependencies.books,
      hiddenContent: dependencies.hiddenContent,
      completedStories: stories.data?.length ?? 0,
      pendingApprovals: (approvals.data ?? []).filter((item) => item.status === 'pending').length,
      flaggedChats: flaggedChats.data?.length ?? 0,
    },
    dependencies,
    canDelete:
      dependencies.students === 0
      && dependencies.books === 0
      && dependencies.hiddenContent === 0,
    classes: normalizedClasses,
    recentBooks: recentBooks.data ?? [],
    recentHiddenContent: recentHiddenContent.data ?? [],
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const service = createServiceClient();
  const body = await request.json();

  const { data: teacher, error: fetchError } = await service
    .from('users')
    .select('id, email, role')
    .eq('id', id)
    .eq('role', 'teacher')
    .single();

  if (fetchError || !teacher) {
    return NextResponse.json({ error: '교사를 찾을 수 없습니다' }, { status: 404 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : teacher.email ?? '';
  const nicknameInput = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const school = typeof body.school === 'string' ? body.school.trim() : '';
  const className = typeof body.className === 'string' ? body.className.trim() : '';
  const grade = normalizeGrade(body.grade);

  if (!email) {
    return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 });
  }

  const nickname = nicknameInput || buildAutoNickname({
    id,
    role: 'teacher',
    email,
    nickname: nicknameInput,
  });

  const { data: authUserResult, error: authLookupError } = await service.auth.admin.getUserById(id);
  if (authLookupError || !authUserResult.user) {
    return NextResponse.json({ error: authLookupError?.message ?? '교사 인증 계정을 찾을 수 없습니다' }, { status: 500 });
  }

  const { error: authError } = await service.auth.admin.updateUserById(id, {
    email,
    email_confirm: true,
    app_metadata: {
      ...(authUserResult.user.app_metadata ?? {}),
      role: 'teacher',
    },
    user_metadata: {
      ...(authUserResult.user.user_metadata ?? {}),
      nickname,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const { data: updatedTeacher, error: updateError } = await service
    .from('users')
    .update({
      email,
      nickname,
      school: school || null,
      grade,
      class: className || null,
    })
    .eq('id', id)
    .select('id, email, nickname, school, grade, class, avatar, created_at')
    .single();

  if (updateError || !updatedTeacher) {
    return NextResponse.json({ error: updateError?.message ?? '교사 수정에 실패했습니다' }, { status: 500 });
  }

  if (className) {
    await ensureTeacherClassRecord(service, {
      id,
      class: className,
      school: school || null,
      grade,
    });
  }

  return NextResponse.json({
    teacher: {
      ...updatedTeacher,
      role: 'teacher',
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const service = createServiceClient();

  const { data: teacher, error: fetchError } = await service
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('role', 'teacher')
    .single();

  if (fetchError || !teacher) {
    return NextResponse.json({ error: '교사를 찾을 수 없습니다' }, { status: 404 });
  }

  const dependencies = await getTeacherDependencies(service, id);

  if (dependencies.students > 0 || dependencies.books > 0 || dependencies.hiddenContent > 0) {
    return NextResponse.json({
      error: '연결된 데이터가 남아 있어 교사를 삭제할 수 없습니다',
      dependencies,
    }, { status: 409 });
  }

  const { error } = await service.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
