import { createClient } from '@/lib/supabase/server';
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

export async function bulkCreateStudents(
  teacherId: string,
  nicknames: string[],
  classId: string
): Promise<{ success: boolean; students?: { nickname: string; code: string }[]; error?: string }> {
  const supabase = await createClient();

  // Generate unique codes for each student
  const students: { nickname: string; code: string }[] = [];
  const existingCodes = new Set<string>();

  // Fetch existing codes to avoid duplicates
  const { data: existingStudents } = await supabase
    .from('users')
    .select('student_code')
    .not('student_code', 'is', null);

  if (existingStudents) {
    for (const s of existingStudents) {
      if (s.student_code) existingCodes.add(s.student_code);
    }
  }

  for (const nickname of nicknames) {
    let code = generateStudentCode();
    while (existingCodes.has(code)) {
      code = generateStudentCode();
    }
    existingCodes.add(code);
    students.push({ nickname: nickname.trim(), code });
  }

  // Use Supabase auth admin to create users, or insert directly into users table
  // Since students use code-based login, we insert directly
  const inserts = students.map((s) => ({
    role: 'student' as const,
    nickname: s.nickname,
    student_code: s.code,
    teacher_id: teacherId,
    class: classId,
  }));

  const { error } = await supabase.from('users').insert(inserts);

  if (error) {
    console.error('Error bulk creating students:', error);
    return { success: false, error: error.message };
  }

  return { success: true, students };
}

export async function resetStudentCode(
  studentId: string
): Promise<{ success: boolean; newCode?: string; error?: string }> {
  const supabase = await createClient();

  const newCode = generateStudentCode();

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
