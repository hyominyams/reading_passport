import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) {
    return auth.error;
  }

  const service = createServiceClient();

  const [
    teacherCount,
    studentCount,
    pendingApprovalCount,
    bookCount,
    hiddenContentCount,
    libraryCount,
    flaggedChatCount,
    recentTeachers,
    recentBooks,
    recentApprovals,
  ] = await Promise.all([
    service.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    service.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    service.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('books').select('id', { count: 'exact', head: true }),
    service.from('hidden_content').select('id', { count: 'exact', head: true }),
    service.from('library').select('id', { count: 'exact', head: true }),
    service.from('chat_logs').select('id', { count: 'exact', head: true }).eq('flagged', true),
    service
      .from('users')
      .select('id, email, nickname, school, grade, class, created_at')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false })
      .limit(5),
    service
      .from('books')
      .select('id, title, country_id, approved, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    service
      .from('approval_requests')
      .select('id, content_type, content_title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    stats: {
      teachers: teacherCount.count ?? 0,
      students: studentCount.count ?? 0,
      pendingApprovals: pendingApprovalCount.count ?? 0,
      books: bookCount.count ?? 0,
      hiddenContent: hiddenContentCount.count ?? 0,
      libraryItems: libraryCount.count ?? 0,
      flaggedChats: flaggedChatCount.count ?? 0,
    },
    recent: {
      teachers: recentTeachers.data ?? [],
      books: recentBooks.data ?? [],
      approvals: recentApprovals.data ?? [],
    },
  });
}
