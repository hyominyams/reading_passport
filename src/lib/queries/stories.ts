import { createClient } from '@/lib/supabase/server';
import type { Story, LibraryItem, Visibility, StoryType, Language, CharacterRef } from '@/types/database';

export async function createStory(data: {
  student_id: string;
  book_id: string;
  country_id: string;
  language: Language;
  story_type: StoryType;
  custom_input?: string | null;
  chat_log?: Record<string, unknown>;
  all_student_messages?: string | null;
  gauge_final?: number;
}): Promise<{ success: boolean; storyId?: string; error?: string }> {
  const supabase = await createClient();

  const { data: result, error } = await supabase
    .from('stories')
    .insert({
      student_id: data.student_id,
      book_id: data.book_id,
      country_id: data.country_id,
      language: data.language,
      story_type: data.story_type,
      custom_input: data.custom_input ?? null,
      chat_log: data.chat_log ?? {},
      all_student_messages: data.all_student_messages ?? null,
      gauge_final: data.gauge_final ?? 0,
      visibility: 'public' as Visibility,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating story:', error);
    return { success: false, error: error.message };
  }

  return { success: true, storyId: result?.id };
}

export async function updateStory(
  storyId: string,
  data: Partial<{
    chat_log: Record<string, unknown>;
    all_student_messages: string | null;
    gauge_final: number;
    ai_draft: string[] | null;
    final_text: string[] | null;
    character_refs: CharacterRef[] | null;
    scene_images: string[] | null;
    translation_text: string[] | null;
    pdf_url_original: string | null;
    pdf_url_translated: string | null;
    visibility: Visibility;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stories')
    .update(data)
    .eq('id', storyId);

  if (error) {
    console.error('Error updating story:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getStory(storyId: string): Promise<Story | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', storyId)
    .single();

  if (error) {
    console.error('Error fetching story:', error);
    return null;
  }

  return data as Story;
}

export async function getStudentStories(studentId: string): Promise<Story[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching student stories:', error);
    return [];
  }

  return (data ?? []) as Story[];
}

export async function getStudentStoryForBook(
  studentId: string,
  bookId: string
): Promise<Story | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching student story for book:', error);
    return null;
  }

  return (data as Story) ?? null;
}

export async function getLibraryItems(filters?: {
  country_id?: string;
  book_id?: string;
}): Promise<(LibraryItem & { story: Story })[]> {
  const supabase = await createClient();

  let query = supabase
    .from('library')
    .select('*, story:stories(*)')
    .order('likes', { ascending: false });

  if (filters?.country_id) {
    query = query.eq('country_id', filters.country_id);
  }
  if (filters?.book_id) {
    query = query.eq('book_id', filters.book_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching library items:', error);
    return [];
  }

  return (data ?? []) as (LibraryItem & { story: Story })[];
}

export async function toggleLike(
  storyId: string,
  userId: string
): Promise<{ success: boolean; liked: boolean; error?: string }> {
  const supabase = await createClient();

  // Check if already liked
  const { data: existing } = await supabase
    .from('story_likes')
    .select('id')
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from('story_likes')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, liked: true, error: error.message };
    }

    // Decrement count
    await supabase.rpc('decrement_likes', { p_story_id: storyId });
    return { success: true, liked: false };
  } else {
    // Like
    const { error } = await supabase
      .from('story_likes')
      .insert({ story_id: storyId, user_id: userId });

    if (error) {
      return { success: false, liked: false, error: error.message };
    }

    // Increment count
    await supabase.rpc('increment_likes', { p_story_id: storyId });
    return { success: true, liked: true };
  }
}

export async function registerToLibrary(
  storyId: string,
  countryId: string,
  bookId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Check if already registered
  const { data: existing } = await supabase
    .from('library')
    .select('id')
    .eq('story_id', storyId)
    .single();

  if (existing) {
    return { success: true };
  }

  const { error } = await supabase
    .from('library')
    .insert({
      story_id: storyId,
      country_id: countryId,
      book_id: bookId,
      likes: 0,
      views: 0,
    });

  if (error) {
    console.error('Error registering to library:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function markMyStoryComplete(
  studentId: string,
  bookId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('activities')
    .select('*')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .single();

  if (existing) {
    const completedTabs = (existing.completed_tabs as string[]).includes('mystory')
      ? existing.completed_tabs as string[]
      : [...(existing.completed_tabs as string[]), 'mystory'];
    const stampsEarned = (existing.stamps_earned as string[]).includes('mystory')
      ? existing.stamps_earned as string[]
      : [...(existing.stamps_earned as string[]), 'mystory'];

    const { error } = await supabase
      .from('activities')
      .update({
        completed_tabs: completedTabs,
        stamps_earned: stampsEarned,
      })
      .eq('id', existing.id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  return { success: false, error: 'Activity not found. Complete reading first.' };
}
