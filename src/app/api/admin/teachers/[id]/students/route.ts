import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

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

  const { data: teacher, error: teacherError } = await service
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('role', 'teacher')
    .single();

  if (teacherError || !teacher) {
    return NextResponse.json({ error: '교사를 찾을 수 없습니다' }, { status: 404 });
  }

  const { data: students, error } = await service
    .from('users')
    .select('*')
    .eq('teacher_id', id)
    .eq('role', 'student')
    .order('nickname', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const studentRows = students ?? [];
  const studentIds = studentRows.map((student) => student.id);

  if (studentIds.length === 0) {
    return NextResponse.json({ students: [] });
  }

  const [activitiesResult, flaggedChatsResult] = await Promise.all([
    service
      .from('activities')
      .select('*, book:books(*)')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false }),
    service
      .from('chat_logs')
      .select('student_id')
      .in('student_id', studentIds)
      .eq('flagged', true),
  ]);

  const activitiesByStudent = new Map<string, Record<string, unknown>[]>();
  for (const activity of activitiesResult.data ?? []) {
    const list = activitiesByStudent.get(activity.student_id) ?? [];
    list.push(activity);
    activitiesByStudent.set(activity.student_id, list);
  }

  const flaggedStudentIds = new Set((flaggedChatsResult.data ?? []).map((item) => item.student_id));

  return NextResponse.json({
    students: studentRows.map((student) => ({
      ...student,
      allActivities: activitiesByStudent.get(student.id) ?? [],
      hasFlaggedChat: flaggedStudentIds.has(student.id),
    })),
  });
}
