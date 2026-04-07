import { createClient } from '@/lib/supabase/server';
import type { Book, Activity, Language } from '@/types/database';

export interface MapBookProgress {
  bookId: string;
  stampCount: number;
  completedTabsCount: number;
  hasStarted: boolean;
  isCompleted: boolean;
  updatedAt: string;
}

export interface MapBooksData {
  booksByCountry: Record<string, Book[]>;
  bookProgressById: Record<string, MapBookProgress>;
}

function emptyMapBooksData(): MapBooksData {
  return {
    booksByCountry: {},
    bookProgressById: {},
  };
}

export async function getBooksByCountry(): Promise<Record<string, Book[]>> {
  const { booksByCountry } = await getMapBooksData();
  return booksByCountry;
}

export async function getMapBooksData(): Promise<MapBooksData> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    if (authError) {
      console.error('Error resolving current user for map:', authError);
    }
    return emptyMapBooksData();
  }

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching books:', error);
    return emptyMapBooksData();
  }

  const books = (data ?? []) as Book[];
  const grouped: Record<string, Book[]> = {};
  for (const book of books) {
    if (!grouped[book.country_id]) {
      grouped[book.country_id] = [];
    }
    grouped[book.country_id].push(book);
  }

  const bookIds = books.map((book) => book.id);
  const bookProgressById: Record<string, MapBookProgress> = {};

  if (bookIds.length > 0) {
    const { data: activities, error: activityError } = await supabase
      .from('activities')
      .select('book_id, completed_tabs, stamps_earned, created_at')
      .eq('student_id', authData.user.id)
      .in('book_id', bookIds);

    if (activityError) {
      console.error('Error fetching map activities:', activityError);
    } else {
      for (const activity of (activities ?? []) as Pick<
        Activity,
        'book_id' | 'completed_tabs' | 'stamps_earned' | 'created_at'
      >[]) {
        const stamps = activity.stamps_earned ?? [];
        const completedTabs = activity.completed_tabs ?? [];
        bookProgressById[activity.book_id] = {
          bookId: activity.book_id,
          stampCount: stamps.length,
          completedTabsCount: completedTabs.length,
          hasStarted: stamps.length > 0 || completedTabs.length > 0,
          isCompleted: stamps.length >= 4,
          updatedAt: activity.created_at,
        };
      }
    }
  }

  return {
    booksByCountry: grouped,
    bookProgressById,
  };
}

export async function getBookById(bookId: string): Promise<Book | null> {
  const supabase = await createClient();

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
