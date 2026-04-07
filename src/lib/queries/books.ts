import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { Book, Activity, Language } from '@/types/database';

export async function getBooksByCountry(): Promise<Record<string, Book[]>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching books:', error);
    return {};
  }

  const grouped: Record<string, Book[]> = {};
  for (const book of (data ?? []) as Book[]) {
    if (!grouped[book.country_id]) {
      grouped[book.country_id] = [];
    }
    grouped[book.country_id].push(book);
  }

  return grouped;
}

export async function getBookById(bookId: string): Promise<Book | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single();

  if (error) {
    console.error('Error fetching book:', error);
    return null;
  }

  return data as Book;
}

export async function getStudentActivity(
  studentId: string,
  bookId: string
): Promise<Activity | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching activity:', error);
    return null;
  }

  return (data as Activity) ?? null;
}

export async function saveReadingComplete(
  studentId: string,
  bookId: string,
  countryId: string,
  emotion: string,
  oneLine: string,
  language: Language
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Check if activity exists
  const { data: existing } = await supabase
    .from('activities')
    .select('*')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .single();

  if (existing) {
    // Update existing activity
    const activity = existing as Activity;
    const completedTabs = activity.completed_tabs.includes('read')
      ? activity.completed_tabs
      : [...activity.completed_tabs, 'read'];
    const stampsEarned = activity.stamps_earned.includes('read')
      ? activity.stamps_earned
      : [...activity.stamps_earned, 'read'];

    const { error } = await supabase
      .from('activities')
      .update({
        emotion,
        one_line: oneLine,
        language,
        completed_tabs: completedTabs,
        stamps_earned: stampsEarned,
      })
      .eq('id', activity.id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } else {
    // Create new activity
    const { error } = await supabase.from('activities').insert({
      student_id: studentId,
      book_id: bookId,
      country_id: countryId,
      language,
      emotion,
      one_line: oneLine,
      completed_tabs: ['read'],
      stamps_earned: ['read'],
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }
}
