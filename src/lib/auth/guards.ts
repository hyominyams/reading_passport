import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { User, UserRole } from '@/types/database';

type GuardResult =
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string; email?: string | null };
      profile: User;
    }
  | {
      error: NextResponse;
    };

async function requireRoles(roles: UserRole[]): Promise<GuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile || !roles.includes(profile.role as UserRole)) {
    return {
      error: NextResponse.json({ error: '권한이 없습니다' }, { status: 403 }),
    };
  }

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as User,
  };
}

export async function requireAdmin() {
  return requireRoles(['admin']);
}

export async function requireTeacher() {
  return requireRoles(['teacher']);
}

export async function requireTeacherOrAdmin() {
  return requireRoles(['teacher', 'admin']);
}
