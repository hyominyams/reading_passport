import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { User, Activity, ChatLog, Book, HiddenContent, Story } from '@/types/database';

export async function getClassStudents(teacherId: string): Promise<User[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('role', 'student')
    .order('nickname', { ascending: true });

  if (error) {
    console.error('Error fetching class students:', error);
    return [];
  }

  return (data ?? []) as User[];
}

export async function getStudentActivities(studentId: string): Promise<(Activity & { book?: Book })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('activities')
    .select('*, book:books(*)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching student activities:', error);
    return [];
  }

  return (data ?? []) as (Activity & { book?: Book })[];
}

export async function getStudentChatLogs(
  studentId: string,
  bookId?: string
): Promise<ChatLog[]> {
  const supabase = await createClient();

  let query = supabase
    .from('chat_logs')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (bookId) {
    query = query.eq('book_id', bookId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching student chat logs:', error);
    return [];
  }

  return (data ?? []) as ChatLog[];
}

export function generateStudentCode(): string {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function buildStudentEmail(studentId: string): string {
  return `student-${studentId}@student.worlddocent.local`;
}

async function loadExistingStudentCodes(): Promise<Set<string>> {
  const supabase = createServiceClient();
  const existingCodes = new Set<string>();

  const { data, error } = await supabase
    .from('users')
    .select('student_code')
    .not('student_code', 'is', null);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    if (row.student_code) {
      existingCodes.add(row.student_code);
    }
  }

  return existingCodes;
}

function nextUniqueStudentCode(existingCodes: Set<string>): string {
  let code = generateStudentCode();
  while (existingCodes.has(code)) {
    code = generateStudentCode();
  }
  existingCodes.add(code);
  return code;
}

export async function bulkCreateStudents(
  teacherId: string,
  nicknames: string[],
  classId: string
): Promise<{ success: boolean; students?: { nickname: string; code: string }[]; error?: string }> {
  const supabase = createServiceClient();
  const cleanNicknames = nicknames.map((nickname) => nickname.trim()).filter(Boolean);
  const createdAuthUserIds: string[] = [];

  if (cleanNicknames.length === 0) {
    return { success: false, error: '학생 닉네임을 입력해주세요' };
  }

  try {
    const existingCodes = await loadExistingStudentCodes();
    const students: { nickname: string; code: string }[] = [];

    for (const nickname of cleanNicknames) {
      const code = nextUniqueStudentCode(existingCodes);
      const authUserId = randomUUID();
      const internalEmail = buildStudentEmail(authUserId);

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        id: authUserId,
        email: internalEmail,
        password: randomUUID(),
        email_confirm: true,
        user_metadata: {
          nickname,
          student_code: code,
          teacher_id: teacherId,
        },
        app_metadata: {
          role: 'student',
        },
      });

      if (authError || !authUser.user) {
        throw authError ?? new Error('학생 계정을 생성할 수 없습니다.');
      }

      createdAuthUserIds.push(authUser.user.id);

      const { error: profileError } = await supabase.from('users').insert({
        id: authUser.user.id,
        email: internalEmail,
        role: 'student',
        nickname,
        student_code: code,
        teacher_id: teacherId,
        class: classId,
      });

      if (profileError) {
        throw profileError;
      }

      students.push({ nickname, code });
    }

    return { success: true, students };
  } catch (error) {
    console.error('Error bulk creating students:', error);

    // Best-effort rollback of auth users if profile insertion fails mid-batch.
    for (const id of createdAuthUserIds.reverse()) {
      await supabase.auth.admin.deleteUser(id);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '학생 생성에 실패했습니다',
    };
  }
}

export async function resetStudentCode(
  studentId: string,
  teacherId: string,
  isAdmin = false
): Promise<{ success: boolean; newCode?: string; error?: string }> {
  const supabase = createServiceClient();
  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('id, teacher_id, role, student_code')
    .eq('id', studentId)
    .single();

  if (targetError || !target) {
    return { success: false, error: '학생을 찾을 수 없습니다.' };
  }

  if (target.role !== 'student') {
    return { success: false, error: '학생 코드만 재발급할 수 있습니다.' };
  }

  if (!isAdmin && target.teacher_id !== teacherId) {
    return { success: false, error: '학생 코드 재발급 권한이 없습니다.' };
  }

  const existingCodes = await loadExistingStudentCodes();
  if (target.student_code) {
    existingCodes.delete(target.student_code);
  }

  const newCode = nextUniqueStudentCode(existingCodes);

  const { error } = await supabase
    .from('users')
    .update({ student_code: newCode })
    .eq('id', studentId);

  if (error) {
    console.error('Error resetting student code:', error);
    return { success: false, error: error.message };
  }

  return { success: true, newCode };
}

export async function getTeacherHiddenContent(
  bookId: string,
  teacherId: string
): Promise<HiddenContent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('hidden_content')
    .select('*')
    .eq('book_id', bookId)
    .or(`created_by.eq.${teacherId},scope.eq.global`)
    .order('order', { ascending: true });

  if (error) {
    console.error('Error fetching teacher hidden content:', error);
    return [];
  }

  return (data ?? []) as HiddenContent[];
}

export async function getClassStories(
  teacherId: string
): Promise<(Story & { student?: User; book?: Book })[]> {
  const supabase = await createClient();

  // Get students for this teacher
  const { data: students } = await supabase
    .from('users')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('role', 'student');

  if (!students || students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  const { data, error } = await supabase
    .from('stories')
    .select('*, student:users(*), book:books(*)')
    .in('student_id', studentIds)
    .not('final_text', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching class stories:', error);
    return [];
  }

  return (data ?? []) as (Story & { student?: User; book?: Book })[];
}

export async function getStudentOverview(teacherId: string): Promise<{
  students: (User & {
    currentActivity?: Activity & { book?: Book };
    chatLogs?: ChatLog[];
    hasFlaggedChat?: boolean;
  })[];
}> {
  const supabase = await createClient();

  // Get all students for this teacher
  const { data: studentsData, error: studentsError } = await supabase
    .from('users')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('role', 'student')
    .order('nickname', { ascending: true });

  if (studentsError || !studentsData) {
    console.error('Error fetching students:', studentsError);
    return { students: [] };
  }

  const students = studentsData as User[];
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) return { students: [] };

  // Get all activities for these students
  const { data: activitiesData } = await supabase
    .from('activities')
    .select('*, book:books(*)')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false });

  // Get flagged chat logs
  const { data: flaggedChats } = await supabase
    .from('chat_logs')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('flagged', true);

  const activities = (activitiesData ?? []) as (Activity & { book?: Book })[];
  const flaggedStudentIds = new Set((flaggedChats ?? []).map((c) => c.student_id));

  // Map activities to students - pick the most recent one
  const studentActivities = new Map<string, Activity & { book?: Book }>();
  for (const activity of activities) {
    if (!studentActivities.has(activity.student_id)) {
      studentActivities.set(activity.student_id, activity);
    }
  }

  const enrichedStudents = students.map((student) => ({
    ...student,
    currentActivity: studentActivities.get(student.id),
    hasFlaggedChat: flaggedStudentIds.has(student.id),
  }));

  return { students: enrichedStudents };
}
