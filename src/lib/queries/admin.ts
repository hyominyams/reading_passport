import { createClient } from '@/lib/supabase/server';
import type { User, Book, ApprovalRequest, HiddenContent, Story, LibraryItem } from '@/types/database';

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
  created_by: string;
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
      languages_available: ['ko'],
      character_analysis: {},
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
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('books')
    .update(data)
    .eq('id', bookId);

  if (error) {
    console.error('Error updating book:', error);
    return { success: false, error: error.message };
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
