'use client';

import { useAuthContext } from '@/contexts/AuthProvider';

export function useAuth() {
  const { user, profile, role, loading, refreshProfile, signOut } = useAuthContext();

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher' || role === 'admin';
  const isStudent = role === 'student';
  const isAuthenticated = !!user;
  const needsOnboarding = isAuthenticated && profile?.nickname === null;

  return {
    user,
    profile,
    role,
    loading,
    isAdmin,
    isTeacher,
    isStudent,
    isAuthenticated,
    needsOnboarding,
    refreshProfile,
    signOut,
  };
}
