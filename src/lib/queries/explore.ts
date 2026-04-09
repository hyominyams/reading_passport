import { createClient } from '@/lib/supabase/server';
import type { HiddenContent } from '@/types/database';

export async function getHiddenContent(
  bookId: string,
  classId?: string
): Promise<HiddenContent[]> {
  const supabase = await createClient();

  let query = supabase
    .from('hidden_content')
    .select('*')
    .eq('book_id', bookId)
    .eq('approved', true)
    .order('order', { ascending: true });

  if (classId) {
    // Get global content OR content for the student's class
    query = supabase
      .from('hidden_content')
      .select('*')
      .eq('book_id', bookId)
      .eq('approved', true)
      .or(`scope.eq.global,class_id.eq.${classId}`)
      .order('order', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching hidden content:', error);
    return [];
  }

  return (data ?? []) as HiddenContent[];
}

export async function markExplorationComplete(
  studentId: string,
  bookId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('activities')
    .select('*')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .maybeSingle();

  if (existing) {
    const completedTabs = (existing.completed_tabs as string[]).includes('hidden')
      ? existing.completed_tabs as string[]
      : [...(existing.completed_tabs as string[]), 'hidden'];
    const stampsEarned = (existing.stamps_earned as string[]).includes('hidden')
      ? existing.stamps_earned as string[]
      : [...(existing.stamps_earned as string[]), 'hidden'];

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
