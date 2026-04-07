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
      <div className="bg-muted-light/50 min-h-[calc(100vh-56px)]">
        {children}
      </div>
    </>
  );
}
