import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getClassStudents,
  bulkCreateStudents,
  resetStudentCode,
  updateStudentAccount,
  deleteStudentAccount,
} from '@/lib/queries/teacher';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  // Verify teacher role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const students = await getClassStudents(user.id);
  return NextResponse.json({ students });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, class')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const body = await request.json();
  const { action, nicknames, className, studentId } = body;
  const resolvedClassName = className || profile.class || '기본반';

  if (action === 'bulk_create') {
    if (!nicknames || !Array.isArray(nicknames) || nicknames.length === 0) {
      return NextResponse.json({ error: '학생 닉네임을 입력해주세요' }, { status: 400 });
    }

    if (nicknames.length > 30) {
      return NextResponse.json({ error: '한 번에 최대 30명까지 등록할 수 있습니다' }, { status: 400 });
    }

    const result = await bulkCreateStudents(
      user.id,
      nicknames,
      resolvedClassName
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ students: result.students });
  }

  if (action === 'reset_code') {
    if (!studentId) {
      return NextResponse.json({ error: '학생 ID가 필요합니다' }, { status: 400 });
    }

    const result = await resetStudentCode(studentId, user.id, false);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ newCode: result.newCode });
  }

  return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const body = await request.json();
  const { studentId, nickname, className } = body as {
    studentId?: string;
    nickname?: string;
    className?: string | null;
  };

  if (!studentId) {
    return NextResponse.json({ error: '학생 ID가 필요합니다' }, { status: 400 });
  }

  const result = await updateStudentAccount({
    studentId,
    teacherId: user.id,
    nickname,
    className,
    isAdmin: false,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const studentId = request.nextUrl.searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: '학생 ID가 필요합니다' }, { status: 400 });
  }

  const result = await deleteStudentAccount({
    studentId,
    teacherId: user.id,
    isAdmin: false,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
