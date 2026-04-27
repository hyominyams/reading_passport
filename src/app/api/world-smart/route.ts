import { NextResponse } from 'next/server';
import { getWorldSmartBoardData, getWorldSmartViewerProfile } from '@/lib/queries/world-smart';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bookId = url.searchParams.get('bookId')?.trim();

    if (!bookId) {
      return NextResponse.json({ error: 'bookId가 필요합니다.' }, { status: 400 });
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

    const data = await getWorldSmartBoardData(bookId, viewer);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'World Smart를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
