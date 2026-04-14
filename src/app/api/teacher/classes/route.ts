import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureTeacherClassRecord } from '@/lib/classroom';
import { clampRequiredQuestionCount } from '@/lib/question-requirements';

async function getAuthorizedTeacher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, class, school, grade')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return { supabase, error: NextResponse.json({ error: '권한이 없습니다' }, { status: 403 }) };
  }

  return { supabase, profile, user };
}

export async function GET() {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase, profile, user } = auth;

  const { data: studentClasses } = await supabase
    .from('users')
    .select('class')
    .eq('teacher_id', user.id)
    .eq('role', 'student')
    .not('class', 'is', null);

  const classNames = new Set<string>();
  if (profile.class?.trim()) classNames.add(profile.class.trim());
  for (const row of studentClasses ?? []) {
    if (typeof row.class === 'string' && row.class.trim()) {
      classNames.add(row.class.trim());
    }
  }

  if (classNames.size === 0) {
    classNames.add('기본반');
  }

  for (const className of classNames) {
    await ensureTeacherClassRecord(supabase, {
      id: user.id,
      class: className,
      school: profile.school,
      grade: profile.grade,
    });
  }

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, teacher_id, class_code, school, grade, class_name, mystory_required_turns, questions_required_count')
    .eq('teacher_id', user.id)
    .order('grade', { ascending: true })
    .order('class_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ classes: classes ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase, profile, user } = auth;
  const body = await request.json();
  const className = typeof body.class_name === 'string' ? body.class_name.trim() : '';

  if (!className) {
    return NextResponse.json({ error: '반 이름을 입력해주세요' }, { status: 400 });
  }

  const existingClass = await supabase
    .from('classes')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('class_name', className)
    .maybeSingle();

  if (existingClass.data?.id) {
    return NextResponse.json({ error: '이미 같은 이름의 반이 있습니다' }, { status: 409 });
  }

  try {
    const record = await ensureTeacherClassRecord(supabase, {
      id: user.id,
      class: className,
      school: profile.school,
      grade: profile.grade,
    });

    const { data: createdClass, error } = await supabase
      .from('classes')
      .select('id, teacher_id, class_code, school, grade, class_name, mystory_required_turns, questions_required_count')
      .eq('id', record.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ class: createdClass });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '반 생성에 실패했습니다',
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth && auth.error) return auth.error;

  const { supabase, user } = auth;
  const body = await request.json();
  const { id, mystory_required_turns, questions_required_count } = body as {
    id?: string;
    mystory_required_turns?: number;
    questions_required_count?: number;
  };

  if (!id) {
    return NextResponse.json({ error: '반 ID가 필요합니다' }, { status: 400 });
  }

  const updateData: Record<string, number> = {};

  if (typeof mystory_required_turns === 'number') {
    updateData.mystory_required_turns = Math.max(3, Math.min(20, Math.round(mystory_required_turns)));
  }

  if (typeof questions_required_count === 'number') {
    updateData.questions_required_count = clampRequiredQuestionCount(questions_required_count);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: '변경할 설정 값이 없습니다' }, { status: 400 });
  }

  const { error } = await supabase
    .from('classes')
    .update(updateData)
    .eq('id', id)
    .eq('teacher_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...updateData });
}
