'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading, user, profile } = useAuth();
  const router = useRouter();
  const [waitCount, setWaitCount] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (user && !profile && waitCount < 5) {
      const timer = setTimeout(() => setWaitCount((c) => c + 1), 600);
      return () => clearTimeout(timer);
    }
    if (!user || (!isAdmin && profile)) {
      router.push('/map');
    }
  }, [loading, user, profile, isAdmin, router, waitCount]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-[calc(100vh-56px)] bg-[#f8f9fb]">
        <div className="border-b border-sky-100 bg-white/90 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-medium text-foreground">
                  {profile?.nickname ?? '관리자'}
                </span>
              </div>
              <span className="rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-medium text-sky-700">
                Admin
              </span>
            </div>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}
