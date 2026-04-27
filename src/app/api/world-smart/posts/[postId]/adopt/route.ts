import { NextResponse } from 'next/server';
import { adoptWorldSmartAnswer, getWorldSmartViewerProfile } from '@/lib/queries/world-smart';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json() as { answerId?: string };

    if (!body.answerId) {
      return NextResponse.json({ error: '채택할 답변이 필요합니다.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const viewer = await getWorldSmartViewerProfile(user.id);
    if (!viewer) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    await adoptWorldSmartAnswer({
      viewer,
      postId,
      answerId: body.answerId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '답변을 채택하지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
