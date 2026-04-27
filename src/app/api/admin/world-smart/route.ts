import { NextResponse } from 'next/server';
import {
  getWorldSmartManagementData,
  getWorldSmartViewerProfile,
  type WorldSmartManagementFilters,
} from '@/lib/queries/world-smart';
import { createClient } from '@/lib/supabase/server';
import type { QuestionBoardCategory } from '@/types/database';

function readFilters(url: URL): WorldSmartManagementFilters {
  return {
    bookId: url.searchParams.get('bookId'),
    className: url.searchParams.get('className'),
    teacherId: url.searchParams.get('teacherId'),
    questionType: (url.searchParams.get('questionType') as QuestionBoardCategory | 'all' | null),
    status: (url.searchParams.get('status') as WorldSmartManagementFilters['status']),
    query: url.searchParams.get('query'),
  };
}

export async function GET(request: Request) {
  try {
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

    if (viewer.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 질문 게시판을 관리할 수 있습니다.' }, { status: 403 });
    }

    const data = await getWorldSmartManagementData(viewer, readFilters(new URL(request.url)));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : '질문 게시판을 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
