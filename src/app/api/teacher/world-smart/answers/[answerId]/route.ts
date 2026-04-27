import { NextResponse } from 'next/server';
import { getWorldSmartViewerProfile, moderateWorldSmartAnswer } from '@/lib/queries/world-smart';
import { createClient } from '@/lib/supabase/server';

async function getTeacherViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }

  const viewer = await getWorldSmartViewerProfile(user.id);
  if (!viewer) {
    return { error: NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 }) };
  }

  if (viewer.role !== 'teacher') {
    return { error: NextResponse.json({ error: '교사만 댓글을 관리할 수 있습니다.' }, { status: 403 }) };
  }

  return { viewer };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ answerId: string }> }
) {
  try {
    const { answerId } = await params;
    const body = await request.json() as { action?: 'hide' | 'unhide'; reason?: string };
    const result = await getTeacherViewer();

    if (result.error) {
      return result.error;
    }

    if (body.action !== 'hide' && body.action !== 'unhide') {
      return NextResponse.json({ error: 'action이 필요합니다.' }, { status: 400 });
    }

    await moderateWorldSmartAnswer({
      viewer: result.viewer,
      answerId,
      action: body.action,
      reason: body.reason,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글을 관리하지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ answerId: string }> }
) {
  try {
    const { answerId } = await params;
    const result = await getTeacherViewer();

    if (result.error) {
      return result.error;
    }

    await moderateWorldSmartAnswer({
      viewer: result.viewer,
      answerId,
      action: 'delete',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글을 삭제하지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
