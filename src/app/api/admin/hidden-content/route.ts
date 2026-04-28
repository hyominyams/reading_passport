import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('hidden_content')
    .select('*, book:books(id, title, country_id), creator:users(id, nickname, email)')
    .order('book_id', { ascending: true })
    .order('order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ content: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const body = await request.json();
  const bookId = typeof body.bookId === 'string' ? body.bookId : '';
  const countryId = typeof body.countryId === 'string' ? body.countryId.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const order = typeof body.order === 'number' && Number.isFinite(body.order) ? Math.max(0, Math.round(body.order)) : 0;

  if (!bookId || !countryId || !title || !url || !type) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
  }

  const { data, error } = await service
    .from('hidden_content')
    .insert({
      book_id: bookId,
      country_id: countryId,
      type,
      title,
      url,
      order,
      created_by: auth.user.id,
      scope: 'global',
      class_id: null,
      approved: true,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';

  if (!id) {
    return NextResponse.json({ error: '콘텐츠 ID가 필요합니다' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body.title === 'string') {
    updateData.title = body.title.trim();
  }
  if (typeof body.type === 'string') {
    updateData.type = body.type;
  }
  if (typeof body.url === 'string') {
    updateData.url = body.url.trim();
  }
  if (typeof body.order === 'number' && Number.isFinite(body.order)) {
    updateData.order = Math.max(0, Math.round(body.order));
  }
  const targetBookId =
    typeof body.targetBookId === 'string'
      ? body.targetBookId
      : typeof body.bookId === 'string'
        ? body.bookId
        : '';

  if (targetBookId) {
    const { data: targetBook, error: targetBookError } = await service
      .from('books')
      .select('id, country_id')
      .eq('id', targetBookId)
      .maybeSingle();

    if (targetBookError) {
      return NextResponse.json({ error: targetBookError.message }, { status: 500 });
    }

    if (!targetBook) {
      return NextResponse.json({ error: '이동할 도서를 찾을 수 없습니다' }, { status: 404 });
    }

    updateData.book_id = targetBook.id;
    updateData.country_id = targetBook.country_id;
  } else if (typeof body.countryId === 'string') {
    updateData.country_id = body.countryId.trim();
  }

  const { error } = await service
    .from('hidden_content')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '콘텐츠 ID가 필요합니다' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('hidden_content')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
