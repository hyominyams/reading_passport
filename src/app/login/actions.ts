'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

interface LoginResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
  needsOnboarding?: boolean;
}

export async function teacherLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  // Check role using service client (bypasses RLS - session cookies not yet available in same request)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    await supabase.auth.signOut();
    return { success: false, error: '교사 계정이 아닙니다. 학생 로그인을 이용해주세요.' };
  }

  return {
    success: true,
    redirectTo: profile.role === 'admin' ? '/admin' : '/teacher',
  };
}

export async function studentLogin(
  studentCode: string
): Promise<LoginResult> {
  // Use service role to look up student code
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the student by their 6-digit code
  const { data: student, error: lookupError } = await serviceClient
    .from('users')
    .select('id, email, nickname')
    .eq('student_code', studentCode)
    .single();

  if (lookupError || !student) {
    return { success: false, error: '존재하지 않는 학생 코드입니다.' };
  }

  // Sign in the student using a custom token approach
  // Since students don't have passwords, we use the service role to create a session
  const { data: authData, error: authError } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: student.email || `${studentCode}@student.worlddocent.local`,
  });

  if (authError || !authData) {
    return { success: false, error: '로그인 처리 중 오류가 발생했습니다.' };
  }

  // Use the hashed token to verify the OTP and create a session
  const supabase = await createClient();
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

  const needsOnboarding = !student.nickname;

  return {
    success: true,
    redirectTo: needsOnboarding ? '/onboarding' : '/map',
    needsOnboarding,
  };
}
