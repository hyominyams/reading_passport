import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      student_id,
      book_id,
      character_id,
      character_name,
      chat_type,
      messages,
      language,
    } = body as {
      student_id: string;
      book_id: string;
      character_id: string | null;
      character_name: string | null;
      chat_type: string;
      messages: { role: string; content: string; timestamp: string }[];
      language: string;
    };

    if (!student_id || !book_id || !messages || messages.length <= 1) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('chat_logs')
      .insert({
        student_id,
        book_id,
        character_id,
        character_name,
        chat_type: chat_type ?? 'character',
        messages,
        language: language ?? 'ko',
        flagged: false,
        ended_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving chat session via beacon:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger async flag check
    if (data?.id) {
      const origin = request.nextUrl.origin;
      fetch(`${origin}/api/chat/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatLogId: data.id, messages }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, chatLogId: data?.id });
  } catch (error) {
    console.error('Chat save API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
