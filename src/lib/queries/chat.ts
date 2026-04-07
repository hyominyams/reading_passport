import { createClient } from '@/lib/supabase/server';
import type { ChatLog, ChatMessage, ChatType, Language } from '@/types/database';

export async function getChatLogs(
  studentId: string,
  bookId: string
): Promise<ChatLog[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chat_logs')
    .select('*')
    .eq('student_id', studentId)
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching chat logs:', error);
    return [];
  }

  return (data ?? []) as ChatLog[];
}

export async function saveChatSession(
  studentId: string,
  bookId: string,
  characterId: string | null,
  characterName: string | null,
  messages: ChatMessage[],
  language: Language,
  chatType: ChatType
): Promise<{ success: boolean; chatLogId?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chat_logs')
    .insert({
      student_id: studentId,
      book_id: bookId,
      character_id: characterId,
      character_name: characterName,
      chat_type: chatType,
      messages,
      language,
      flagged: false,
      ended_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving chat session:', error);
    return { success: false, error: error.message };
  }

  return { success: true, chatLogId: data?.id };
}

export async function flagChatSession(
  chatLogId: string,
  flagged: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('chat_logs')
    .update({ flagged })
    .eq('id', chatLogId);

  if (error) {
    console.error('Error flagging chat session:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function markCharacterChatComplete(
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
    const completedTabs = (existing.completed_tabs as string[]).includes('character')
      ? existing.completed_tabs as string[]
      : [...(existing.completed_tabs as string[]), 'character'];
    const stampsEarned = (existing.stamps_earned as string[]).includes('character')
      ? existing.stamps_earned as string[]
      : [...(existing.stamps_earned as string[]), 'character'];

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
