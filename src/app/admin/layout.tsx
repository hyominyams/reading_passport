'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/map');
    }
  }, [loading, isAdmin, router]);

  if (loading) {
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
