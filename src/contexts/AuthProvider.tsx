'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { User, UserRole } from '@/types/database';
import { buildAutoNickname, hasNickname } from '@/lib/profile';

interface AuthContextType {
  user: SupabaseUser | null;
  profile: User | null;
  role: UserRole | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();

  const ensureNickname = useCallback(async (loadedProfile: User) => {
    if (hasNickname(loadedProfile.nickname)) {
      return loadedProfile;
    }

    const fallbackNickname = buildAutoNickname(loadedProfile);
    const { data: updatedProfile, error } = await supabase
      .from('users')
      .update({ nickname: fallbackNickname })
      .eq('id', loadedProfile.id)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to persist auto nickname:', error);
      return { ...loadedProfile, nickname: fallbackNickname } as User;
    }

    return (updatedProfile as User | null) ?? { ...loadedProfile, nickname: fallbackNickname };
  }, [supabase]);

  const fetchProfile = useCallback(async (userId: string) => {
    // Try fetching profile with retries (RLS may not be ready immediately after login)
    let attempts = 0;
    while (attempts < 3) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        const hydratedProfile = await ensureNickname(data as User);
        setProfile(hydratedProfile);
        return;
      }
      // If RLS blocks the read, wait briefly and retry
      if (error && attempts < 2) {
        await new Promise((r) => setTimeout(r, 500));
      }
      attempts++;
    }

    setProfile(null);
  }, [ensureNickname, supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      setLoading(false);
      router.replace('/login');
      router.refresh();
    }
  }, [router, supabase]);

  useEffect(() => {
    let isMounted = true;

    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return;

        try {
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Redirect students who need onboarding
  useEffect(() => {
    if (loading) return;
    if (!user || !profile) return;
    if (profile.role !== 'student') return;

    const needsOnboarding = !profile.nickname;
    const exemptPaths = ['/onboarding', '/login'];
    const isExempt = exemptPaths.some((p) => pathname.startsWith(p));

    if (needsOnboarding && !isExempt) {
      router.replace('/onboarding');
    }
  }, [loading, user, profile, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
