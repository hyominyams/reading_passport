import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { data: approvals, error } = await service
    .from('approval_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const approvalRows = approvals ?? [];
  const requesterIds = Array.from(new Set(approvalRows.map((approval) => approval.requester_id)));
  const bookIds = approvalRows
    .filter((approval) => approval.content_type === 'book')
    .map((approval) => approval.content_id);
  const hiddenContentIds = approvalRows
    .filter((approval) => approval.content_type === 'hidden_content')
    .map((approval) => approval.content_id);

  const [requestersResult, booksResult, hiddenContentResult] = await Promise.all([
    requesterIds.length > 0
      ? service.from('users').select('id, nickname, email, school, grade, class').in('id', requesterIds)
      : Promise.resolve({ data: [], error: null }),
    bookIds.length > 0
      ? service.from('books').select('id, title, cover_url, country_id, scope, approved').in('id', bookIds)
      : Promise.resolve({ data: [], error: null }),
    hiddenContentIds.length > 0
      ? service.from('hidden_content').select('id, title, url, type, book_id, country_id, scope, approved').in('id', hiddenContentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const requesterById = new Map((requestersResult.data ?? []).map((requester) => [requester.id, requester]));
  const bookById = new Map((booksResult.data ?? []).map((book) => [book.id, book]));
  const hiddenContentById = new Map((hiddenContentResult.data ?? []).map((content) => [content.id, content]));

  return NextResponse.json({
    approvals: approvalRows.map((approval) => ({
      ...approval,
      requester: requesterById.get(approval.requester_id) ?? null,
      content:
        approval.content_type === 'book'
          ? bookById.get(approval.content_id) ?? null
          : hiddenContentById.get(approval.content_id) ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const body = await request.json();
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const action = body.action;
  const reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim() : null;

  if (!requestId || !action || !['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.rpc('process_admin_approval', {
    p_request_id: requestId,
    p_reviewer_id: auth.user.id,
    p_status: action,
    p_review_note: reviewNote,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
