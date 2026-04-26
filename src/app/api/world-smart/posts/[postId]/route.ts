import { NextResponse } from 'next/server';
import {
  deleteWorldSmartPost,
  getWorldSmartViewerProfile,
  updateWorldSmartPost,
} from '@/lib/queries/world-smart';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json() as { questionText?: string };

    if (!body.questionText?.trim()) {
      return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 });
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

    await updateWorldSmartPost({
      viewer,
      postId,
      questionText: body.questionText,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '질문을 수정하지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
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

    await deleteWorldSmartPost({
      viewer,
      postId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '질문을 삭제하지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
