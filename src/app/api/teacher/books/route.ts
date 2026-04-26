import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureTeacherClassRecord } from '@/lib/classroom';
import { generateAndStoreBookCover } from '@/lib/books/generate-cover';
import { attachLatestBookAnalyses } from '@/lib/queries/book-analyses';
import { attachLatestBookPdfTexts } from '@/lib/queries/book-pdf-texts';
import { pickPreferredPdfUrlFromMap, computeLanguagesFromMap } from '@/lib/pdf-analysis';
import type { ApprovalStatus } from '@/types/database';

async function getAuthorizedTeacher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, class, school, grade')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    return {
      error: NextResponse.json({ error: '권한이 없습니다' }, { status: 403 }),
    };
  }

  return { user, profile };
}

async function ensureApprovalRequest(service: ReturnType<typeof createServiceClient>, options: {
  requesterId: string;
  contentType: 'book';
  contentId: string;
  contentTitle: string;
  contentScope: 'global' | 'class';
}) {
  const { data: latestRequest } = await service
    .from('approval_requests')
    .select('status')
    .eq('requester_id', options.requesterId)
    .eq('content_type', options.contentType)
    .eq('content_id', options.contentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRequest?.status === 'pending') {
    return false;
  }

  await service.from('approval_requests').insert({
    requester_id: options.requesterId,
    content_type: options.contentType,
    content_id: options.contentId,
    status: 'pending',
    content_title: options.contentTitle,
    content_scope: options.contentScope,
  });

  return true;
}

export async function GET() {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { user } = auth;

  const [globalBooksResult, ownBooksResult, approvalResult] = await Promise.all([
    service
      .from('books')
      .select('*')
      .eq('scope', 'global')
      .eq('approved', true)
      .order('title', { ascending: true }),
    service
      .from('books')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false }),
    service
      .from('approval_requests')
      .select('content_id, status, created_at')
      .eq('requester_id', user.id)
      .eq('content_type', 'book')
      .order('created_at', { ascending: false }),
  ]);

  if (globalBooksResult.error) {
    return NextResponse.json({ error: globalBooksResult.error.message }, { status: 500 });
  }

  if (ownBooksResult.error) {
    return NextResponse.json({ error: ownBooksResult.error.message }, { status: 500 });
  }

  const approvalMap = new Map<string, ApprovalStatus>();
  for (const request of approvalResult.data ?? []) {
    const contentId = request.content_id as string;
    if (!approvalMap.has(contentId)) {
      approvalMap.set(contentId, request.status as ApprovalStatus);
    }
  }

  const mergedBooks = new Map<string, Record<string, unknown>>();

  for (const book of globalBooksResult.data ?? []) {
    mergedBooks.set(book.id, {
      ...book,
      approval_status: approvalMap.get(book.id) ?? null,
      can_manage: book.created_by === user.id,
    });
  }

  for (const book of ownBooksResult.data ?? []) {
    mergedBooks.set(book.id, {
      ...book,
      approval_status: approvalMap.get(book.id) ?? null,
      can_manage: book.created_by === user.id,
    });
  }

  const sortedBooks = Array.from(mergedBooks.values()).sort((a, b) => {
    const countryCompare = String(a.country_id).localeCompare(String(b.country_id));
    if (countryCompare !== 0) {
      return countryCompare;
    }
    return String(a.title).localeCompare(String(b.title));
  });
  const booksWithAnalyses = await attachLatestBookAnalyses(
    service,
    sortedBooks as (Record<string, unknown> & { id: string })[],
  );
  const books = await attachLatestBookPdfTexts(service, booksWithAnalyses);

  return NextResponse.json({ books });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { user, profile } = auth;
  const body = await request.json();
  const countryId = typeof body.country_id === 'string' ? body.country_id.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const coverUrl = typeof body.cover_url === 'string' ? body.cover_url.trim() : '';
  const scope = body.scope === 'global' ? 'global' : 'class';
  const targetClassName =
    typeof body.class_name === 'string' && body.class_name.trim()
      ? body.class_name.trim()
      : profile.class?.trim() || '기본반';

  // Build pdf_urls map (accept both new pdf_urls and legacy fields)
  const pdfUrls: Record<string, string> = {};
  if (body.pdf_urls && typeof body.pdf_urls === 'object') {
    for (const [k, v] of Object.entries(body.pdf_urls)) {
      if (typeof v === 'string' && v.trim()) pdfUrls[k] = v.trim();
    }
  }
  if (!Object.keys(pdfUrls).length) {
    const pdfUrlKo = typeof body.pdf_url_ko === 'string' ? body.pdf_url_ko.trim() : '';
    const pdfUrlEn = typeof body.pdf_url_en === 'string' ? body.pdf_url_en.trim() : '';
    if (pdfUrlKo) pdfUrls.ko = pdfUrlKo;
    if (pdfUrlEn) pdfUrls.en = pdfUrlEn;
  }

  const preferredPdfUrl = pickPreferredPdfUrlFromMap(pdfUrls);
  const resolvedCoverUrl = coverUrl || preferredPdfUrl;

  if (!countryId || !title || !resolvedCoverUrl) {
    return NextResponse.json({
      error: '국가, 제목, PDF URL 또는 표지 URL을 입력해주세요',
    }, { status: 400 });
  }

  let classId: string | null = null;

  if (scope === 'class') {
    const classRecord = await ensureTeacherClassRecord(service, {
      id: user.id,
      class: targetClassName,
      school: profile.school,
      grade: profile.grade,
    });
    classId = classRecord.id;
  }

  const { data: createdBook, error } = await service
    .from('books')
    .insert({
      country_id: countryId,
      title,
      cover_url: resolvedCoverUrl,
      pdf_urls: pdfUrls,
      pdf_url_ko: pdfUrls.ko ?? null,
      pdf_url_en: pdfUrls.en ?? null,
      languages_available: computeLanguagesFromMap(pdfUrls),
      created_by: user.id,
      scope,
      class_id: classId,
      approved: scope === 'class',
    })
    .select('id')
    .single();

  if (error || !createdBook) {
    return NextResponse.json({ error: error?.message || '도서 등록에 실패했습니다' }, { status: 500 });
  }

  if (scope === 'global') {
    await ensureApprovalRequest(service, {
      requesterId: user.id,
      contentType: 'book',
      contentId: createdBook.id,
      contentTitle: title,
      contentScope: scope,
    });
  }

  try {
    const generatedCoverUrl = await generateAndStoreBookCover({
      bookId: createdBook.id,
      pdfUrls,
      baseUrl: request.nextUrl.origin,
    });

    if (generatedCoverUrl) {
      await service
        .from('books')
        .update({ cover_url: generatedCoverUrl })
        .eq('id', createdBook.id);
    }
  } catch (coverError) {
    console.error('Failed to generate teacher book cover:', coverError);
  }

  return NextResponse.json({ bookId: createdBook.id });
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { user, profile } = auth;
  const body = await request.json();
  const bookId = typeof body.id === 'string' ? body.id : '';

  if (!bookId) {
    return NextResponse.json({ error: '도서 ID가 필요합니다' }, { status: 400 });
  }

  const { data: existingBook, error: fetchError } = await service
    .from('books')
    .select('id, title, created_by, scope, approved, class_id, cover_url, pdf_urls, pdf_url_ko, pdf_url_en')
    .eq('id', bookId)
    .single();

  if (fetchError || !existingBook) {
    return NextResponse.json({ error: '도서를 찾을 수 없습니다' }, { status: 404 });
  }

  if (existingBook.created_by !== user.id) {
    return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body.country_id === 'string') {
    updateData.country_id = body.country_id.trim();
  }

  if (typeof body.title === 'string') {
    updateData.title = body.title.trim();
  }

  // Build next pdf_urls map
  const currentPdfUrls = (existingBook as Record<string, unknown>).pdf_urls as Record<string, string> | null ?? {};
  let nextPdfUrls: Record<string, string>;
  if (body.pdf_urls && typeof body.pdf_urls === 'object') {
    nextPdfUrls = {};
    for (const [k, v] of Object.entries(body.pdf_urls)) {
      if (typeof v === 'string' && v.trim()) nextPdfUrls[k] = v.trim();
    }
  } else {
    nextPdfUrls = { ...currentPdfUrls };
    if (body.pdf_url_ko !== undefined) {
      if (typeof body.pdf_url_ko === 'string' && body.pdf_url_ko.trim()) nextPdfUrls.ko = body.pdf_url_ko.trim();
      else delete nextPdfUrls.ko;
    }
    if (body.pdf_url_en !== undefined) {
      if (typeof body.pdf_url_en === 'string' && body.pdf_url_en.trim()) nextPdfUrls.en = body.pdf_url_en.trim();
      else delete nextPdfUrls.en;
    }
  }

  updateData.pdf_urls = nextPdfUrls;
  updateData.pdf_url_ko = nextPdfUrls.ko ?? null;
  updateData.pdf_url_en = nextPdfUrls.en ?? null;
  updateData.languages_available = computeLanguagesFromMap(nextPdfUrls);

  if (typeof body.cover_url === 'string') {
    updateData.cover_url = body.cover_url.trim() || pickPreferredPdfUrlFromMap(nextPdfUrls) || existingBook.cover_url;
  }

  if (existingBook.scope === 'global' && existingBook.created_by === user.id) {
    updateData.approved = false;
  }

  if (typeof body.class_name === 'string' && existingBook.scope === 'class') {
    const classRecord = await ensureTeacherClassRecord(service, {
      id: user.id,
      class: body.class_name.trim() || '기본반',
      school: profile.school,
      grade: profile.grade,
    });
    updateData.class_id = classRecord.id;
  }

  const { error } = await service
    .from('books')
    .update(updateData)
    .eq('id', bookId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const oldPdfUrl = pickPreferredPdfUrlFromMap(currentPdfUrls);
    const newPdfUrl = pickPreferredPdfUrlFromMap(nextPdfUrls);
    const shouldRegenerateCover = oldPdfUrl !== newPdfUrl || !existingBook.cover_url;

    if (shouldRegenerateCover) {
      const generatedCoverUrl = await generateAndStoreBookCover({
        bookId,
        pdfUrls: nextPdfUrls,
        baseUrl: request.nextUrl.origin,
      });

      if (generatedCoverUrl) {
        await service
          .from('books')
          .update({ cover_url: generatedCoverUrl })
          .eq('id', bookId);
      }
    }
  } catch (coverError) {
    console.error('Failed to regenerate teacher book cover:', coverError);
  }

  if (existingBook.scope === 'global' && existingBook.created_by === user.id) {
    await ensureApprovalRequest(service, {
      requesterId: user.id,
      contentType: 'book',
      contentId: bookId,
      contentTitle:
        typeof updateData.title === 'string'
          ? updateData.title
          : existingBook.title,
      contentScope: 'global',
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthorizedTeacher();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();
  const { user } = auth;
  const bookId = request.nextUrl.searchParams.get('id');

  if (!bookId) {
    return NextResponse.json({ error: '도서 ID가 필요합니다' }, { status: 400 });
  }

  const { data: existingBook, error: fetchError } = await service
    .from('books')
    .select('id, created_by')
    .eq('id', bookId)
    .single();

  if (fetchError || !existingBook) {
    return NextResponse.json({ error: '도서를 찾을 수 없습니다' }, { status: 404 });
  }

  if (existingBook.created_by !== user.id) {
    return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });
  }

  const { error } = await service
    .from('books')
    .delete()
    .eq('id', bookId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
