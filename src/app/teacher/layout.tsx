'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isTeacher, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isTeacher) {
      router.push('/map');
    }
  }, [loading, isTeacher, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </div>
    );
  }

  if (!isTeacher) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="bg-muted-light/50 min-h-[calc(100vh-56px)]">
        {/* Teacher info bar */}
        <div className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-foreground">
                {profile?.nickname ?? '교사'}
              </span>
              {profile?.school && (
                <span className="text-muted">
                  {profile.school}
                  {profile.grade && ` ${profile.grade}학년`}
                  {profile.class && ` ${profile.class}반`}
                </span>
              )}
            </div>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}
