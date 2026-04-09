import { createClient } from '@/lib/supabase/server';
import { generateAndStoreBookCover } from '@/lib/books/generate-cover';
import type { User, Book, ApprovalRequest, HiddenContent, Story, LibraryItem, Language } from '@/types/database';

function computeLanguagesAvailable(
  pdfUrlKo?: string | null,
  pdfUrlEn?: string | null
): Language[] {
  const languages: Language[] = [];

  if (pdfUrlKo) {
    languages.push('ko');
  }
  if (pdfUrlEn) {
    languages.push('en');
  }

  // Keep Korean as the fallback so new books remain readable even before PDF URLs are finalized.
  if (languages.length === 0) {
    languages.push('ko');
  }

  return languages;
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
  pdf_url_ko?: string | null;
  pdf_url_en?: string | null;
  character_analysis?: Record<string, unknown>;
  created_by: string;
  base_url?: string;
}): Promise<{ success: boolean; bookId?: string; error?: string }> {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('books')
    .insert({
      country_id: data.country_id,
      title: data.title,
      cover_url: data.cover_url,
      pdf_url_ko: data.pdf_url_ko ?? null,
      pdf_url_en: data.pdf_url_en ?? null,
      languages_available: computeLanguagesAvailable(data.pdf_url_ko, data.pdf_url_en),
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
      const generatedCoverUrl = await generateAndStoreBookCover({
        bookId: result.id,
        pdfUrlKo: data.pdf_url_ko ?? null,
        pdfUrlEn: data.pdf_url_en ?? null,
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
    pdf_url_ko: string | null;
    pdf_url_en: string | null;
    approved: boolean;
    character_analysis: Record<string, unknown>;
    base_url: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: currentBook, error: fetchError } = await supabase
    .from('books')
    .select('cover_url, pdf_url_ko, pdf_url_en')
    .eq('id', bookId)
    .single();

  if (fetchError || !currentBook) {
    console.error('Error fetching book before update:', fetchError);
    return { success: false, error: fetchError?.message ?? '도서를 찾을 수 없습니다' };
  }

  const nextPdfUrlKo = data.pdf_url_ko !== undefined ? data.pdf_url_ko : currentBook.pdf_url_ko;
  const nextPdfUrlEn = data.pdf_url_en !== undefined ? data.pdf_url_en : currentBook.pdf_url_en;
  const nextLanguages = computeLanguagesAvailable(nextPdfUrlKo, nextPdfUrlEn);
  const { base_url, ...bookUpdateData } = data;

  const { error } = await supabase
    .from('books')
    .update({
      ...bookUpdateData,
      pdf_url_ko: nextPdfUrlKo,
      pdf_url_en: nextPdfUrlEn,
      languages_available: nextLanguages,
    })
    .eq('id', bookId);

  if (error) {
    console.error('Error updating book:', error);
    return { success: false, error: error.message };
  }

  const pdfUrlChanged =
    nextPdfUrlKo !== currentBook.pdf_url_ko || nextPdfUrlEn !== currentBook.pdf_url_en;

  const shouldRegenerateCover =
    pdfUrlChanged ||
    !currentBook.cover_url ||
    currentBook.cover_url === nextPdfUrlKo ||
    currentBook.cover_url === nextPdfUrlEn;

  if (shouldRegenerateCover) {
    try {
      const generatedCoverUrl = await generateAndStoreBookCover({
        bookId,
        pdfUrlKo: nextPdfUrlKo,
        pdfUrlEn: nextPdfUrlEn,
        baseUrl: base_url,
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
