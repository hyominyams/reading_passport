import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pickPreferredPdfUrl } from '@/lib/pdf-analysis';
import { getAllBooks, createBook, updateBook, deleteBook } from '@/lib/queries/admin';

export async function GET() {
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }

  const books = await getAllBooks();
  return NextResponse.json({ books });
}

export async function POST(request: NextRequest) {
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }

  const body = await request.json();
  const { country_id, title, cover_url, pdf_url_ko, pdf_url_en, character_analysis } = body;
  const normalizedCoverUrl = cover_url?.trim() || null;
  const preferredPdfUrl = pickPreferredPdfUrl(pdf_url_ko, pdf_url_en);
  const resolvedCoverUrl = normalizedCoverUrl || preferredPdfUrl;

  if (!country_id || !title || !resolvedCoverUrl) {
    return NextResponse.json({ error: '국가, 제목, PDF 또는 표지 URL을 입력해주세요' }, { status: 400 });
  }

  const result = await createBook({
    country_id,
    title,
    cover_url: resolvedCoverUrl,
    pdf_url_ko: pdf_url_ko || null,
    pdf_url_en: pdf_url_en || null,
    character_analysis:
      character_analysis && typeof character_analysis === 'object'
        ? character_analysis
        : undefined,
    created_by: user.id,
    base_url: request.nextUrl.origin,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ bookId: result.bookId });
}

export async function PUT(request: NextRequest) {
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }

  const body = await request.json();
  const { id, cover_url, pdf_url_ko, pdf_url_en, ...restUpdateData } = body;

  if (!id) {
    return NextResponse.json({ error: '도서 ID가 필요합니다' }, { status: 400 });
  }

  const normalizedCoverUrl = typeof cover_url === 'string' ? cover_url.trim() : cover_url;
  const preferredPdfUrl = pickPreferredPdfUrl(pdf_url_ko, pdf_url_en);
  const updateData = {
    ...restUpdateData,
    ...(cover_url !== undefined ? { cover_url: normalizedCoverUrl || preferredPdfUrl || '' } : {}),
    ...(pdf_url_ko !== undefined ? { pdf_url_ko: pdf_url_ko || null } : {}),
    ...(pdf_url_en !== undefined ? { pdf_url_en: pdf_url_en || null } : {}),
    base_url: request.nextUrl.origin,
  };

  const result = await updateBook(id, updateData);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
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

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '도서 ID가 필요합니다' }, { status: 400 });
  }

  const result = await deleteBook(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
