import { NextResponse } from 'next/server';
import { getWorldSmartViewerProfile, upsertWorldSmartAnswer } from '@/lib/queries/world-smart';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json() as { content?: string };

    if (!body.content?.trim()) {
      return NextResponse.json({ error: '답변 내용을 입력해주세요.' }, { status: 400 });
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

    await upsertWorldSmartAnswer({
      viewer,
      postId,
      content: body.content,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '답변을 저장하지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
