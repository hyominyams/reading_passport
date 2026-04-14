import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { pickPreferredPdfUrlFromMap } from '@/lib/pdf-analysis';
import { getAllBooks, createBook, updateBook, deleteBook } from '@/lib/queries/admin';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const books = await getAllBooks();
  return NextResponse.json({ books });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const body = await request.json();
  const { country_id, title, cover_url, pdf_urls, character_analysis } = body;

  // Build pdf_urls map (accept both new pdf_urls and legacy fields)
  const pdfUrls: Record<string, string> = {};
  if (pdf_urls && typeof pdf_urls === 'object') {
    for (const [k, v] of Object.entries(pdf_urls)) {
      if (typeof v === 'string' && v.trim()) pdfUrls[k] = v.trim();
    }
  }
  if (!Object.keys(pdfUrls).length) {
    if (typeof body.pdf_url_ko === 'string' && body.pdf_url_ko.trim()) pdfUrls.ko = body.pdf_url_ko.trim();
    if (typeof body.pdf_url_en === 'string' && body.pdf_url_en.trim()) pdfUrls.en = body.pdf_url_en.trim();
  }

  const normalizedCoverUrl = cover_url?.trim() || null;
  const preferredPdfUrl = pickPreferredPdfUrlFromMap(pdfUrls);
  const resolvedCoverUrl = normalizedCoverUrl || preferredPdfUrl;

  if (!country_id || !title || !resolvedCoverUrl) {
    return NextResponse.json({ error: '국가, 제목, PDF 또는 표지 URL을 입력해주세요' }, { status: 400 });
  }

  const result = await createBook({
    country_id,
    title,
    cover_url: resolvedCoverUrl,
    pdf_urls: pdfUrls,
    character_analysis:
      character_analysis && typeof character_analysis === 'object'
        ? character_analysis
        : undefined,
    created_by: auth.user.id,
    base_url: request.nextUrl.origin,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ bookId: result.bookId });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const body = await request.json();
  const { id, cover_url, pdf_urls, ...restUpdateData } = body;

  if (!id) {
    return NextResponse.json({ error: '도서 ID가 필요합니다' }, { status: 400 });
  }

  // Build pdf_urls map
  const pdfUrls: Record<string, string> = {};
  if (pdf_urls && typeof pdf_urls === 'object') {
    for (const [k, v] of Object.entries(pdf_urls)) {
      if (typeof v === 'string' && v.trim()) pdfUrls[k] = v.trim();
    }
  }

  const normalizedCoverUrl = typeof cover_url === 'string' ? cover_url.trim() : cover_url;
  const preferredPdfUrl = pickPreferredPdfUrlFromMap(pdfUrls);
  const updateData = {
    ...restUpdateData,
    pdf_urls: pdfUrls,
    ...(cover_url !== undefined ? { cover_url: normalizedCoverUrl || preferredPdfUrl || '' } : {}),
    base_url: request.nextUrl.origin,
  };

  const result = await updateBook(id, updateData);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
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
    return NextResponse.json({ error: '도서 ID가 필요합니다' }, { status: 400 });
  }

  const result = await deleteBook(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
