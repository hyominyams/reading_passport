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

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { data: teachers, error } = await service
    .from('users')
    .select('id, email, nickname, school, grade, class, avatar, created_at')
    .eq('role', 'teacher')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const teacherRows = teachers ?? [];
  const teacherIds = teacherRows.map((teacher) => teacher.id);

  if (teacherIds.length === 0) {
    return NextResponse.json({ teachers: [] });
  }

  const [
    studentsResult,
    classesResult,
    booksResult,
    hiddenContentResult,
    approvalsResult,
  ] = await Promise.all([
    service
      .from('users')
      .select('id, teacher_id, class')
      .eq('role', 'student')
      .in('teacher_id', teacherIds),
    service
      .from('classes')
      .select('id, teacher_id')
      .in('teacher_id', teacherIds),
    service
      .from('books')
      .select('id, created_by')
      .in('created_by', teacherIds),
    service
      .from('hidden_content')
      .select('id, created_by')
      .in('created_by', teacherIds),
    service
      .from('approval_requests')
      .select('requester_id, status')
      .in('requester_id', teacherIds),
  ]);

  const studentRows = studentsResult.data ?? [];
  const studentIds = studentRows.map((student) => student.id);
  const studentTeacherMap = new Map(studentRows.map((student) => [student.id, student.teacher_id]));
  const classNamesByTeacher = new Map<string, Set<string>>();

  for (const teacher of teacherRows) {
    const names = new Set<string>();
    if (typeof teacher.class === 'string' && teacher.class.trim()) {
      names.add(teacher.class.trim());
    }
    classNamesByTeacher.set(teacher.id, names);
  }

  for (const student of studentRows) {
    if (typeof student.class === 'string' && student.class.trim()) {
      classNamesByTeacher.get(student.teacher_id)?.add(student.class.trim());
    }
  }

  const [storiesResult, flaggedChatsResult] = await Promise.all([
    studentIds.length > 0
      ? service
          .from('stories')
          .select('student_id')
          .in('student_id', studentIds)
          .not('final_text', 'is', null)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length > 0
      ? service
          .from('chat_logs')
          .select('student_id')
          .in('student_id', studentIds)
          .eq('flagged', true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const counts = new Map<
    string,
    {
      students: number;
      classes: number;
      books: number;
      hiddenContent: number;
      pendingApprovals: number;
      completedStories: number;
      flaggedChats: number;
    }
  >();

  for (const teacherId of teacherIds) {
    counts.set(teacherId, {
      students: 0,
      classes: 0,
      books: 0,
      hiddenContent: 0,
      pendingApprovals: 0,
      completedStories: 0,
      flaggedChats: 0,
    });
  }

  for (const row of studentRows) {
    const target = counts.get(row.teacher_id);
    if (target) {
      target.students += 1;
    }
  }

  for (const row of classesResult.data ?? []) {
    const target = counts.get(row.teacher_id);
    if (target) {
      target.classes += 1;
    }
  }

  for (const row of booksResult.data ?? []) {
    const target = counts.get(row.created_by);
    if (target) {
      target.books += 1;
    }
  }

  for (const row of hiddenContentResult.data ?? []) {
    const target = counts.get(row.created_by);
    if (target) {
      target.hiddenContent += 1;
    }
  }

  for (const row of approvalsResult.data ?? []) {
    if (row.status === 'pending') {
      const target = counts.get(row.requester_id);
      if (target) {
        target.pendingApprovals += 1;
      }
    }
  }

  for (const row of storiesResult.data ?? []) {
    const teacherId = studentTeacherMap.get(row.student_id);
    if (teacherId) {
      counts.get(teacherId)!.completedStories++;
    }
  }

  for (const row of flaggedChatsResult.data ?? []) {
    const teacherId = studentTeacherMap.get(row.student_id);
    if (teacherId) {
      counts.get(teacherId)!.flaggedChats += 1;
    }
  }

  return NextResponse.json({
    teachers: teacherRows.map((teacher) => {
      const stats = counts.get(teacher.id);
      return {
        ...teacher,
        role: 'teacher',
        stats: {
          ...stats!,
          classes: Math.max(stats?.classes ?? 0, classNamesByTeacher.get(teacher.id)?.size ?? 0),
        },
        canDelete:
          (stats?.students ?? 0) === 0
          && (stats?.books ?? 0) === 0
          && (stats?.hiddenContent ?? 0) === 0,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const body = await request.json();

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const school = typeof body.school === 'string' ? body.school.trim() : '';
  const className = typeof body.className === 'string' ? body.className.trim() : '';
  const grade = normalizeGrade(body.grade);

  if (!email) {
    return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: '임시 비밀번호는 8자 이상이어야 합니다' }, { status: 400 });
  }

  const { data: createdAuth, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !createdAuth.user) {
    return NextResponse.json({ error: authError?.message ?? '교사 계정을 생성하지 못했습니다' }, { status: 500 });
  }

  const teacherId = createdAuth.user.id;
  const resolvedNickname = nickname || buildAutoNickname({
    id: teacherId,
    role: 'teacher',
    email,
    nickname,
  });

  try {
    const { error: authProfileError } = await service.auth.admin.updateUserById(teacherId, {
      email,
      email_confirm: true,
      app_metadata: {
        ...(createdAuth.user.app_metadata ?? {}),
        role: 'teacher',
      },
      user_metadata: {
        ...(createdAuth.user.user_metadata ?? {}),
        nickname: resolvedNickname,
      },
    });

    if (authProfileError) {
      throw authProfileError;
    }

    const { data: teacher, error: insertError } = await service
      .from('users')
      .insert({
        id: teacherId,
        email,
        role: 'teacher',
        nickname: resolvedNickname,
        school: school || null,
        grade,
        class: className || null,
      })
      .select('id, email, nickname, school, grade, class, avatar, created_at')
      .single();

    if (insertError || !teacher) {
      throw insertError ?? new Error('교사 프로필 생성에 실패했습니다');
    }

    if (className) {
      await ensureTeacherClassRecord(service, {
        id: teacherId,
        class: className,
        school: school || null,
        grade,
      });
    }

    return NextResponse.json({
      teacher: {
        ...teacher,
        role: 'teacher',
        stats: {
          students: 0,
          classes: className ? 1 : 0,
          books: 0,
          hiddenContent: 0,
          pendingApprovals: 0,
          completedStories: 0,
          flaggedChats: 0,
        },
        canDelete: true,
      },
    });
  } catch (error) {
    await service.auth.admin.deleteUser(teacherId);

    return NextResponse.json({
      error: error instanceof Error ? error.message : '교사 생성에 실패했습니다',
    }, { status: 500 });
  }
}
