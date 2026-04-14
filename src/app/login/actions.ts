'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { buildAutoNickname, hasNickname } from '@/lib/profile';

interface LoginResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
  needsOnboarding?: boolean;
}

function buildStudentEmail(studentId: string): string {
  return `student-${studentId}@student.worlddocent.local`;
}

function normalizeTeacherEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function teacherLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  const normalizedEmail = normalizeTeacherEmail(email);
  if (!normalizedEmail) {
    return { success: false, error: '이메일을 입력해주세요.' };
  }

  const supabase = await createClient();

  await supabase.auth.signOut({ scope: 'local' });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    return { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  // Check role using service client (bypasses RLS - session cookies not yet available in same request)
  const serviceClient = createServiceClient();
  const { data: profileData, error: profileError } = await serviceClient
    .from('users')
    .select('role, nickname')
    .eq('id', data.user.id)
    .maybeSingle();

  const profile = profileData as { role: 'admin' | 'teacher' | 'student'; nickname: string | null } | null;

  if (profileError) {
    await supabase.auth.signOut();
    return { success: false, error: '로그인 후 계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: '계정 프로필을 찾을 수 없습니다. 관리자에게 계정 복구를 요청해주세요.',
    };
  }

  if (profile.role !== 'teacher' && profile.role !== 'admin') {
    await supabase.auth.signOut();
    return { success: false, error: '교사 계정이 아닙니다. 학생 로그인을 이용해주세요.' };
  }

  const resolvedNickname = hasNickname(profile.nickname)
    ? profile.nickname
    : buildAutoNickname({
        id: data.user.id,
        role: profile.role,
        email: data.user.email,
        nickname: profile.nickname,
      });

  if (!hasNickname(profile.nickname)) {
    await serviceClient
      .from('users')
      .update({ nickname: resolvedNickname })
      .eq('id', data.user.id);
  }

  await serviceClient.auth.admin.updateUserById(data.user.id, {
    email: normalizedEmail,
    email_confirm: true,
    app_metadata: {
      ...(data.user.app_metadata ?? {}),
      role: profile.role,
    },
    user_metadata: {
      ...(data.user.user_metadata ?? {}),
      nickname: resolvedNickname,
    },
  }).catch(() => undefined);

  return {
    success: true,
    redirectTo: profile.role === 'admin' ? '/admin' : '/teacher',
  };
}

export async function studentLogin(
  studentCode: string
): Promise<LoginResult> {
  // Use service role to look up student code
  const serviceClient = createServiceClient();

  // Find the student by their 6-digit code
  const { data: student, error: lookupError } = await serviceClient
    .from('users')
    .select('id, email, nickname, student_code')
    .eq('student_code', studentCode)
    .single();

  if (lookupError || !student) {
    return { success: false, error: '존재하지 않는 학생 코드입니다.' };
  }

  // Sign in the student using a custom token approach
  // Since students don't have passwords, we use the service role to create a session
  const { data: authData, error: authError } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: student.email || buildStudentEmail(student.id),
  });

  if (authError || !authData) {
    return { success: false, error: '로그인 처리 중 오류가 발생했습니다.' };
  }

  // Use the hashed token to verify the OTP and create a session
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  const tokenHash = authData.properties?.hashed_token;

  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (verifyError) {
      return { success: false, error: '로그인 처리 중 오류가 발생했습니다.' };
    }
  }

  if (!hasNickname(student.nickname)) {
    const fallbackNickname = buildAutoNickname({
      id: student.id,
      role: 'student',
      email: student.email,
      nickname: student.nickname,
      student_code: student.student_code ?? studentCode,
    });

    await serviceClient
      .from('users')
      .update({ nickname: fallbackNickname })
      .eq('id', student.id);
  }

  return {
    success: true,
    redirectTo: '/map',
    needsOnboarding: false,
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut({ scope: 'local' });
}
