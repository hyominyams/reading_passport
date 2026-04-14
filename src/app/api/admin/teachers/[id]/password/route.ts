import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json();
  const password = typeof body.password === 'string' ? body.password.trim() : '';

  if (password.length < 8) {
    return NextResponse.json({ error: '임시 비밀번호는 8자 이상이어야 합니다' }, { status: 400 });
  }

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

  const { error } = await service.auth.admin.updateUserById(id, { password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
