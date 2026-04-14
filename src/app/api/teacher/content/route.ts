import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getTeacherHiddenContent } from '@/lib/queries/teacher';
import { ensureTeacherClassRecord } from '@/lib/classroom';

async function ensureApprovalRequest(service: ReturnType<typeof createServiceClient>, options: {
  requesterId: string;
  contentId: string;
  contentTitle: string;
}) {
  const { data: latestRequest } = await service
    .from('approval_requests')
    .select('status')
    .eq('requester_id', options.requesterId)
    .eq('content_type', 'hidden_content')
    .eq('content_id', options.contentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRequest?.status === 'pending') {
    return false;
  }

  await service.from('approval_requests').insert({
    requester_id: options.requesterId,
    content_type: 'hidden_content',
    content_id: options.contentId,
    status: 'pending',
    content_title: options.contentTitle,
    content_scope: 'global',
  });

  return true;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const bookId = request.nextUrl.searchParams.get('bookId');
  if (!bookId) {
    return NextResponse.json({ error: 'bookId가 필요합니다' }, { status: 400 });
  }

  const content = await getTeacherHiddenContent(bookId, user.id);
  const ownContentIds = content
    .filter((item) => item.created_by === user.id)
    .map((item) => item.id);

  const approvalMap = new Map<string, string>();

  if (ownContentIds.length > 0) {
    const { data: approvalRequests } = await service
      .from('approval_requests')
      .select('content_id, status, created_at')
      .eq('requester_id', user.id)
      .eq('content_type', 'hidden_content')
      .in('content_id', ownContentIds)
      .order('created_at', { ascending: false });

    for (const request of approvalRequests ?? []) {
      const contentId = request.content_id as string;
      if (!approvalMap.has(contentId)) {
        approvalMap.set(contentId, request.status as string);
      }
    }
  }

  return NextResponse.json({
    content: content.map((item) => ({
      ...item,
      approval_status: approvalMap.get(item.id) ?? null,
      can_manage: item.created_by === user.id,
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, class, school, grade')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const body = await request.json();
  const { bookId, countryId, type, title, url, order, scope, className } = body;

  if (!bookId || !title || !url || !type) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
  }

  let classId: string | null = null;
  if (scope !== 'global') {
    const classRecord = await ensureTeacherClassRecord(supabase, {
      id: user.id,
      class: typeof className === 'string' && className.trim()
        ? className.trim()
        : profile.class,
      school: profile.school,
      grade: profile.grade,
    });
    classId = classRecord.id;
  }

  const insertData: Record<string, unknown> = {
    book_id: bookId,
    country_id: countryId || '',
    type,
    title,
    url,
    order: order || 0,
    created_by: user.id,
    scope: scope === 'global' ? 'global' : 'class',
    class_id: classId,
    approved: scope === 'class', // class-only auto-approved, global needs admin
  };

  const { data: result, error } = await supabase
    .from('hidden_content')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If requesting global scope, create approval request
  if (scope === 'global') {
    await ensureApprovalRequest(service, {
      requesterId: user.id,
      contentId: result.id,
      contentTitle: title,
    });
  }

  return NextResponse.json({ id: result.id });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const body = await request.json();
  const { id, title, type, url, order } = body;

  if (!id) {
    return NextResponse.json({ error: '콘텐츠 ID가 필요합니다' }, { status: 400 });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('hidden_content')
    .select('created_by, scope, approved, title')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: '콘텐츠를 찾을 수 없습니다' }, { status: 404 });
  }

  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (type !== undefined) updateData.type = type;
  if (url !== undefined) updateData.url = url;
  if (order !== undefined) updateData.order = order;

  if (existing.scope === 'global' && existing.created_by === user.id) {
    updateData.approved = false;
  }

  const { error } = await supabase
    .from('hidden_content')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing.scope === 'global' && existing.created_by === user.id) {
    await ensureApprovalRequest(service, {
      requesterId: user.id,
      contentId: id,
      contentTitle:
        typeof updateData.title === 'string'
          ? updateData.title
          : existing.title,
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '콘텐츠 ID가 필요합니다' }, { status: 400 });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('hidden_content')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!existing || existing.created_by !== user.id) {
    return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });
  }

  const { error } = await supabase
    .from('hidden_content')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
