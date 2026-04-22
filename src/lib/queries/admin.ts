import { createClient } from '@/lib/supabase/server';
import { computeLanguagesFromMap, pickPreferredPdfUrlFromMap } from '@/lib/pdf-analysis';
import type { User, Book, ApprovalRequest, HiddenContent, Story, LibraryItem } from '@/types/database';

async function generateBookCover(options: {
  bookId: string;
  pdfUrls?: Record<string, string> | null;
  pdfUrlKo?: string | null;
  pdfUrlEn?: string | null;
  baseUrl?: string;
}) {
  const coverModule = await import('@/lib/books/generate-cover');
  return coverModule.generateAndStoreBookCover(options);
}

export async function getAllTeachers(): Promise<User[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'teacher')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }

  return (data ?? []) as User[];
}

export async function getPendingApprovals(): Promise<(ApprovalRequest & { requester?: User })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('approval_requests')
    .select('*, requester:users(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending approvals:', error);
    return [];
  }

  return (data ?? []) as (ApprovalRequest & { requester?: User })[];
}

export async function processApproval(
  requestId: string,
  status: 'approved' | 'rejected',
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  void reviewerId;
  const supabase = await createClient();

  // Get the approval request first
  const { data: request, error: fetchError } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Approval request not found' };
  }

  const approval = request as ApprovalRequest;

  // Update the approval request
  const { error: updateError } = await supabase
    .from('approval_requests')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // If approved, update the content
  if (status === 'approved') {
    const table = approval.content_type === 'book' ? 'books' : 'hidden_content';
    const { error: contentError } = await supabase
      .from(table)
      .update({ approved: true, scope: 'global' })
      .eq('id', approval.content_id);

    if (contentError) {
      return { success: false, error: contentError.message };
    }
  }

  return { success: true };
}

export async function getAllBooks(): Promise<Book[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all books:', error);
    return [];
  }

  return (data ?? []) as Book[];
}

export async function createBook(data: {
  country_id: string;
  title: string;
  cover_url: string;
  pdf_urls?: Record<string, string>;
  /** @deprecated */
  pdf_url_ko?: string | null;
  /** @deprecated */
  pdf_url_en?: string | null;
  character_analysis?: Record<string, unknown>;
  created_by: string;
  base_url?: string;
}): Promise<{ success: boolean; bookId?: string; error?: string }> {
  const supabase = await createClient();

  // Build canonical pdf_urls map
  const pdfUrls: Record<string, string> = { ...(data.pdf_urls ?? {}) };
  if (!Object.keys(pdfUrls).length) {
    if (data.pdf_url_ko?.trim()) pdfUrls.ko = data.pdf_url_ko.trim();
    if (data.pdf_url_en?.trim()) pdfUrls.en = data.pdf_url_en.trim();
  }

  const { data: result, error } = await supabase
    .from('books')
    .insert({
      country_id: data.country_id,
      title: data.title,
      cover_url: data.cover_url,
      pdf_urls: pdfUrls,
      pdf_url_ko: pdfUrls.ko ?? null,
      pdf_url_en: pdfUrls.en ?? null,
      languages_available: computeLanguagesFromMap(pdfUrls),
      character_analysis: data.character_analysis ?? {},
      created_by: data.created_by,
      scope: 'global',
      approved: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating book:', error);
    return { success: false, error: error.message };
  }

  if (result?.id) {
    try {
      const generatedCoverUrl = await generateBookCover({
        bookId: result.id,
        pdfUrls,
        baseUrl: data.base_url,
      });

      if (generatedCoverUrl) {
        const { error: coverUpdateError } = await supabase
          .from('books')
          .update({ cover_url: generatedCoverUrl })
          .eq('id', result.id);

        if (coverUpdateError) {
          console.error('Error updating generated cover:', coverUpdateError);
        }
      }
    } catch (coverError) {
      console.error('Failed to generate cover after book creation:', coverError);
    }
  }

  return { success: true, bookId: result?.id };
}

export async function updateBook(
  bookId: string,
  data: Partial<{
    title: string;
    country_id: string;
    cover_url: string;
    pdf_urls: Record<string, string>;
    /** @deprecated */
    pdf_url_ko: string | null;
    /** @deprecated */
    pdf_url_en: string | null;
    approved: boolean;
    character_analysis: Record<string, unknown>;
    base_url: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: currentBook, error: fetchError } = await supabase
    .from('books')
    .select('cover_url, pdf_urls, pdf_url_ko, pdf_url_en')
    .eq('id', bookId)
    .single();

  if (fetchError || !currentBook) {
    console.error('Error fetching book before update:', fetchError);
    return { success: false, error: fetchError?.message ?? '도서를 찾을 수 없습니다' };
  }

  // Build next pdf_urls map
  let nextPdfUrls: Record<string, string>;
  if (data.pdf_urls !== undefined) {
    nextPdfUrls = { ...data.pdf_urls };
  } else {
    nextPdfUrls = { ...((currentBook.pdf_urls as Record<string, string>) ?? {}) };
    if (data.pdf_url_ko !== undefined) {
      if (data.pdf_url_ko) nextPdfUrls.ko = data.pdf_url_ko;
      else delete nextPdfUrls.ko;
    }
    if (data.pdf_url_en !== undefined) {
      if (data.pdf_url_en) nextPdfUrls.en = data.pdf_url_en;
      else delete nextPdfUrls.en;
    }
  }

  const nextLanguages = computeLanguagesFromMap(nextPdfUrls);
  const baseUrl = data.base_url;
  const bookUpdateData = { ...data };
  delete bookUpdateData.base_url;
  delete bookUpdateData.pdf_urls;
  delete bookUpdateData.pdf_url_ko;
  delete bookUpdateData.pdf_url_en;

  const { error } = await supabase
    .from('books')
    .update({
      ...bookUpdateData,
      pdf_urls: nextPdfUrls,
      pdf_url_ko: nextPdfUrls.ko ?? null,
      pdf_url_en: nextPdfUrls.en ?? null,
      languages_available: nextLanguages,
    })
    .eq('id', bookId);

  if (error) {
    console.error('Error updating book:', error);
    return { success: false, error: error.message };
  }

  const oldPdfUrl = pickPreferredPdfUrlFromMap((currentBook.pdf_urls as Record<string, string>) ?? {});
  const newPdfUrl = pickPreferredPdfUrlFromMap(nextPdfUrls);
  const pdfUrlChanged = oldPdfUrl !== newPdfUrl;

  const shouldRegenerateCover =
    pdfUrlChanged ||
    !currentBook.cover_url;

  if (shouldRegenerateCover) {
    try {
      const generatedCoverUrl = await generateBookCover({
        bookId,
        pdfUrls: nextPdfUrls,
        baseUrl,
      });

      if (generatedCoverUrl && generatedCoverUrl !== currentBook.cover_url) {
        const { error: coverUpdateError } = await supabase
          .from('books')
          .update({ cover_url: generatedCoverUrl })
          .eq('id', bookId);

        if (coverUpdateError) {
          console.error('Error updating generated cover:', coverUpdateError);
        }
      }
    } catch (coverError) {
      console.error('Failed to regenerate cover after book update:', coverError);
    }
  }

  return { success: true };
}

export async function deleteBook(bookId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', bookId);

  if (error) {
    console.error('Error deleting book:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getAllLibraryItems(): Promise<(LibraryItem & { story?: Story & { student?: User } })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('library')
    .select('*, story:stories(*, student:users(*))')
    .order('likes', { ascending: false });

  if (error) {
    console.error('Error fetching library items:', error);
    return [];
  }

  return (data ?? []) as (LibraryItem & { story?: Story & { student?: User } })[];
}

export async function hideLibraryItem(libraryId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('library')
    .delete()
    .eq('id', libraryId);

  if (error) {
    console.error('Error hiding library item:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateStoryVisibility(
  storyId: string,
  visibility: 'public' | 'class' | 'private'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stories')
    .update({ visibility })
    .eq('id', storyId);

  if (error) {
    console.error('Error updating story visibility:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getAllHiddenContent(): Promise<HiddenContent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('hidden_content')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
    console.error('Error fetching all hidden content:', error);
    return [];
  }

  return (data ?? []) as HiddenContent[];
}

export async function createHiddenContent(data: {
  book_id: string;
  country_id: string;
  type: 'video' | 'pdf' | 'image' | 'link';
  title: string;
  url: string;
  order: number;
  created_by: string;
  scope: 'global' | 'class';
  class_id?: string | null;
}): Promise<{ success: boolean; contentId?: string; error?: string }> {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('hidden_content')
    .insert({
      ...data,
      approved: data.scope === 'global',
      class_id: data.class_id ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating hidden content:', error);
    return { success: false, error: error.message };
  }

  return { success: true, contentId: result?.id };
}

export async function updateHiddenContent(
  contentId: string,
  data: Partial<{
    title: string;
    type: 'video' | 'pdf' | 'image' | 'link';
    url: string;
    order: number;
    approved: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('hidden_content')
    .update(data)
    .eq('id', contentId);

  if (error) {
    console.error('Error updating hidden content:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteHiddenContent(contentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('hidden_content')
    .delete()
    .eq('id', contentId);

  if (error) {
    console.error('Error deleting hidden content:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
