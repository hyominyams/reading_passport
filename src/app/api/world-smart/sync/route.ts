import { NextResponse } from 'next/server';
import {
  getWorldSmartViewerProfile,
  syncWorldSmartPosts,
} from '@/lib/queries/world-smart';
import { createClient } from '@/lib/supabase/server';
import type { WorldSmartQuestionPayload } from '@/lib/world-smart';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      bookId?: string;
      chatLogId?: string | null;
      questions?: WorldSmartQuestionPayload;
    };

    if (!body.bookId || !body.questions) {
      return NextResponse.json({ error: 'bookId와 questions가 필요합니다.' }, { status: 400 });
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

    const result = await syncWorldSmartPosts({
      viewer,
      bookId: body.bookId,
      chatLogId: body.chatLogId ?? null,
      questions: body.questions,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '질문 게시글을 저장하지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
